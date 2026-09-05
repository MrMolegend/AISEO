import 'server-only';
import { createHash } from 'node:crypto';
import { getEnv, hasUpstash } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

/**
 * Rate limiting, caching and in-flight locking.
 *
 * This is the main defence against runaway AI spend. A public endpoint that
 * calls a paid model with no meter is an invitation to have your budget scraped,
 * so the limits exist before the endpoint does.
 *
 * Upstash backs it in production; an in-process driver stands in for local
 * development. The in-process one is correct for a single process and wrong for
 * serverless — instances do not share memory — which is stated plainly rather
 * than hidden, and logged as an error if it is ever used in production.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the caller may retry. */
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimiter {
  readonly name: string;
  /** Per-identifier sliding window. */
  check(identifier: string): Promise<RateLimitVerdict>;
  /**
   * Generic fixed-window counter, for endpoints whose sensible ceiling has
   * nothing to do with the research limits — autosaves, share views, exports.
   */
  checkWindow(
    identifier: string,
    max: number,
    windowSeconds: number,
  ): Promise<RateLimitVerdict>;
  /** Global daily circuit breaker; the backstop against a runaway bill. */
  checkGlobalCap(): Promise<boolean>;
  /** Returns true when the lock was acquired. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

/** Salted hash: raw IPs are never stored or logged. */
export function hashIp(ip: string): string {
  const env = getEnv();
  return createHash('sha256')
    .update(`${env.IP_HASH_SALT}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

/**
 * Extracts the client IP from proxy headers.
 *
 * The leftmost x-forwarded-for entry is the closest thing to the real client,
 * but it is attacker-controlled: anyone can send the header. It is therefore
 * only ever used as a rate-limit key, never as an identity or an authorisation
 * input, and it is stored only as a salted hash.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}

/* ────────────────────────── In-process driver ────────────────────────── */

interface Window {
  timestamps: number[];
}

class MemoryRateLimiter implements RateLimiter {
  readonly name = 'memory';
  private readonly windows = new Map<string, Window>();
  private readonly locks = new Map<string, number>();
  private globalCount = 0;
  private globalWindowStart = Date.now();

  async check(identifier: string): Promise<RateLimitVerdict> {
    const env = getEnv();
    const now = Date.now();
    const hourMs = 3_600_000;
    const dayMs = 86_400_000;

    const window = this.windows.get(identifier) ?? { timestamps: [] };
    window.timestamps = window.timestamps.filter((t) => now - t < dayMs);

    const inHour = window.timestamps.filter((t) => now - t < hourMs).length;
    const inDay = window.timestamps.length;

    if (inHour >= env.RESEARCH_RATE_LIMIT_PER_HOUR) {
      const oldest = window.timestamps.find((t) => now - t < hourMs) ?? now;
      this.windows.set(identifier, window);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((hourMs - (now - oldest)) / 1000),
        remaining: 0,
      };
    }

    if (inDay >= env.RESEARCH_RATE_LIMIT_PER_DAY) {
      const oldest = window.timestamps[0] ?? now;
      this.windows.set(identifier, window);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((dayMs - (now - oldest)) / 1000),
        remaining: 0,
      };
    }

    window.timestamps.push(now);
    this.windows.set(identifier, window);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: env.RESEARCH_RATE_LIMIT_PER_HOUR - inHour - 1,
    };
  }

  async checkWindow(
    identifier: string,
    max: number,
    windowSeconds: number,
  ): Promise<RateLimitVerdict> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = `w:${identifier}:${Math.floor(now / windowMs)}`;

    const window = this.windows.get(key) ?? { timestamps: [] };
    if (window.timestamps.length >= max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now % windowMs)) / 1000)),
        remaining: 0,
      };
    }
    window.timestamps.push(now);
    this.windows.set(key, window);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: max - window.timestamps.length,
    };
  }

  async checkGlobalCap(): Promise<boolean> {
    const env = getEnv();
    const now = Date.now();
    if (now - this.globalWindowStart > 86_400_000) {
      this.globalWindowStart = now;
      this.globalCount = 0;
    }
    if (this.globalCount >= env.RESEARCH_DAILY_GLOBAL_CAP) return false;
    this.globalCount += 1;
    return true;
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(key);
    if (existing && existing > now) return false;
    this.locks.set(key, now + ttlSeconds * 1000);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  /** Test helper. */
  reset(): void {
    this.windows.clear();
    this.locks.clear();
    this.globalCount = 0;
    this.globalWindowStart = Date.now();
  }
}

/* ────────────────────────── Upstash driver ────────────────────────── */

class UpstashRateLimiter implements RateLimiter {
  readonly name = 'upstash';
  // Typed loosely because the client is imported dynamically; every call site
  // below is a narrow, well-understood Redis command.
  private readonly redis: {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<unknown>;
    set(key: string, value: string, opts: { nx: true; ex: number }): Promise<unknown>;
    del(key: string): Promise<unknown>;
    ttl(key: string): Promise<number>;
  };

  constructor(redis: UpstashRateLimiter['redis']) {
    this.redis = redis;
  }

  /**
   * Fixed-window counters rather than a sliding log.
   *
   * Two INCRs and two conditional EXPIREs per check, versus a sorted set that
   * must be trimmed on every call. The boundary effect a fixed window allows —
   * a burst spanning two windows — is irrelevant at these limits, and the
   * simplicity is worth more than the precision.
   */
  async check(identifier: string): Promise<RateLimitVerdict> {
    const env = getEnv();
    const now = Date.now();

    const hourKey = `rl:h:${identifier}:${Math.floor(now / 3_600_000)}`;
    const dayKey = `rl:d:${identifier}:${Math.floor(now / 86_400_000)}`;

    const hourCount = await this.redis.incr(hourKey);
    if (hourCount === 1) await this.redis.expire(hourKey, 3_600);

    const dayCount = await this.redis.incr(dayKey);
    if (dayCount === 1) await this.redis.expire(dayKey, 86_400);

    if (hourCount > env.RESEARCH_RATE_LIMIT_PER_HOUR) {
      const ttl = await this.redis.ttl(hourKey);
      return { allowed: false, retryAfterSeconds: Math.max(ttl, 60), remaining: 0 };
    }

    if (dayCount > env.RESEARCH_RATE_LIMIT_PER_DAY) {
      const ttl = await this.redis.ttl(dayKey);
      return { allowed: false, retryAfterSeconds: Math.max(ttl, 3_600), remaining: 0 };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, env.RESEARCH_RATE_LIMIT_PER_HOUR - hourCount),
    };
  }

  async checkWindow(
    identifier: string,
    max: number,
    windowSeconds: number,
  ): Promise<RateLimitVerdict> {
    const windowMs = windowSeconds * 1000;
    const key = `rl:w:${identifier}:${Math.floor(Date.now() / windowMs)}`;

    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSeconds);

    if (count > max) {
      const ttl = await this.redis.ttl(key);
      return { allowed: false, retryAfterSeconds: Math.max(ttl, 1), remaining: 0 };
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, max - count) };
  }

  async checkGlobalCap(): Promise<boolean> {
    const env = getEnv();
    const key = `rl:global:${Math.floor(Date.now() / 86_400_000)}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 86_400);
    return count <= env.RESEARCH_DAILY_GLOBAL_CAP;
  }

  /** SET NX EX — the standard atomic lock. */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(`lock:${key}`, '1', { nx: true, ex: ttlSeconds });
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }
}

let limiter: RateLimiter | null = null;

export async function getRateLimiter(): Promise<RateLimiter> {
  if (limiter) return limiter;
  const env = getEnv();

  if (hasUpstash(env)) {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
    limiter = new UpstashRateLimiter(redis as unknown as UpstashRateLimiter['redis']);
    return limiter;
  }

  if (env.NODE_ENV === 'production') {
    logger.error('ratelimit.memory_driver_in_production', {
      detail:
        'Upstash is not configured. Limits apply per-instance only and will not restrain concurrent traffic.',
    });
  }

  limiter = new MemoryRateLimiter();
  return limiter;
}

/** Test-only. */
export function resetRateLimiter(): void {
  if (limiter instanceof MemoryRateLimiter) limiter.reset();
  limiter = null;
}

/**
 * The abuse check a research submission goes through.
 *
 * Limits are keyed on the authenticated user first and the IP hash second. The
 * user is the meaningful unit — that is who holds the tokens — but a single
 * actor making accounts to get around a per-user limit is still one actor, and
 * the IP window catches that without punishing colleagues behind one office
 * address as long as the per-user window is the tighter of the two.
 *
 * The global cap is checked last and is the backstop against a runaway bill. It
 * is deliberately a different failure from a personal rate limit: CAPACITY
 * refunds, RATE_LIMITED does not, because a personal limit never took anything.
 */
export interface ResearchLimitVerdict {
  allowed: boolean;
  reason: 'RATE_LIMITED' | 'CAPACITY';
  message: string;
  retryAfterSeconds: number;
}

export async function checkResearchRateLimit(
  userId: string,
  ipHash: string | null,
): Promise<ResearchLimitVerdict> {
  const limiter = await getRateLimiter();

  const perUser = await limiter.check(`user:${userId}`);
  if (!perUser.allowed) {
    return {
      allowed: false,
      reason: 'RATE_LIMITED',
      message: 'Too many reports started recently on this account',
      retryAfterSeconds: perUser.retryAfterSeconds,
    };
  }

  if (ipHash) {
    const perIp = await limiter.check(`ip:${ipHash}`);
    if (!perIp.allowed) {
      return {
        allowed: false,
        reason: 'RATE_LIMITED',
        message: 'Too many reports started recently from this location',
        retryAfterSeconds: perIp.retryAfterSeconds,
      };
    }
  }

  const withinGlobalCap = await limiter.checkGlobalCap();
  if (!withinGlobalCap) {
    return {
      allowed: false,
      reason: 'CAPACITY',
      message: 'The service has reached its processing limit for today',
      retryAfterSeconds: 3_600,
    };
  }

  return { allowed: true, reason: 'RATE_LIMITED', message: '', retryAfterSeconds: 0 };
}

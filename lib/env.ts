import 'server-only';
import { z } from 'zod';

/**
 * Server environment contract.
 *
 * Every value the server depends on is declared here and validated once, at first
 * access. A missing or malformed variable fails loudly with the variable's name
 * rather than surfacing later as an undefined-property crash inside the pipeline.
 *
 * Optional-by-design: Supabase, Upstash and the Anthropic key are all optional so
 * the app runs end-to-end locally with zero external accounts. Each subsystem
 * degrades to a clearly-labelled development driver and says so in the logs.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ── AI ──────────────────────────────────────────────────────────────────
  AI_PROVIDER: z.enum(['anthropic', 'mock']).default('mock'),
  AI_MODEL: z.string().min(1).default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // ── Storage ─────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // ── Rate limiting / cache ───────────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // ── Site ────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),

  // ── Abuse & cost controls ───────────────────────────────────────────────
  IP_HASH_SALT: z.string().min(8).default('dev-only-salt-change-in-production'),
  AUDIT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(3),
  AUDIT_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(10),
  AUDIT_DAILY_GLOBAL_CAP: z.coerce.number().int().positive().default(200),
  AUDIT_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // ── Test/dev escape hatches ─────────────────────────────────────────────
  /** Allows the SSRF guard to accept loopback targets. E2E and unit tests only. */
  E2E_ALLOW_LOCAL_FETCH: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test-only: clears the memoised env so a test can vary process.env. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Capability probes.
 *
 * Call-sites use these rather than reading keys directly, so "is Supabase wired
 * up?" is one predicate instead of a scattered set of truthiness checks.
 */
export function hasSupabase(env: ServerEnv = getEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasUpstash(env: ServerEnv = getEnv()): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function hasAnthropic(env: ServerEnv = getEnv()): boolean {
  return env.AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY);
}

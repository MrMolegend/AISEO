import 'server-only';
import { z } from 'zod';

/**
 * Server environment contract.
 *
 * Every value the server depends on is declared here and validated once, at
 * first access. A missing or malformed variable fails loudly with the
 * variable's name rather than surfacing later as an undefined-property crash
 * somewhere in the pipeline.
 *
 * Most external services are optional so the application runs end-to-end with
 * zero accounts: each subsystem falls back to a clearly-labelled development
 * driver and says so. The health endpoint reports which driver is live, and
 * refuses to call production healthy while a mock is serving research — a mock
 * that quietly ships is worse than a missing key, because it produces plausible
 * output nobody questions.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ── AI ──────────────────────────────────────────────────────────────────
  AI_PROVIDER: z.enum(['anthropic', 'mock']).default('mock'),
  AI_MODEL: z.string().min(1).default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // ── Web research ────────────────────────────────────────────────────────
  /**
   * Which service answers "what is published about this?". The mock is
   * deterministic fixture data — fine for tests and local work, never fine in
   * production, which is why the health check treats it as a degraded state.
   */
  RESEARCH_PROVIDER: z.enum(['tavily', 'mock']).default('mock'),
  TAVILY_API_KEY: z.string().min(1).optional(),

  // ── Storage ─────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  /**
   * The browser-safe key, used only for Supabase Auth. Supabase now calls this
   * the publishable key; projects created earlier expose it as the anon key.
   * Both names are accepted so the application works either way, and
   * `supabasePublishableKey()` resolves the two.
   */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /** Server-only. Bypasses RLS; never reaches a browser bundle. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // ── Rate limiting / cache ───────────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // ── Site ────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),

  // ── Abuse and cost controls ─────────────────────────────────────────────
  IP_HASH_SALT: z.string().min(8).default('dev-only-salt-change-in-production'),
  RESEARCH_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(6),
  RESEARCH_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(20),
  RESEARCH_DAILY_GLOBAL_CAP: z.coerce.number().int().positive().default(200),
  /** How long a completed report satisfies an identical request, in hours. */
  RESEARCH_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // ── Tokens ──────────────────────────────────────────────────────────────
  /**
   * Tokens granted once, on first sign-in.
   *
   * Non-zero outside production is a convenience so a fresh developer can run a
   * report immediately. In production the default is zero and stays zero unless
   * someone deliberately sets it: an account that silently receives spendable
   * credit is a cost leak, and a generous default is exactly the kind of thing
   * that ships unnoticed.
   */
  WELCOME_TOKEN_GRANT: z.coerce.number().int().min(0).default(0),
  /**
   * Shared secret for the operator token-grant route. Absent means the route is
   * disabled entirely rather than open — see lib/tokens/admin-grant.ts.
   */
  ADMIN_GRANT_SECRET: z.string().min(24).optional(),

  // ── Test/dev escape hatches ─────────────────────────────────────────────
  /** Lets the SSRF guard accept loopback targets. Tests only. */
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
 * Call sites use these rather than reading keys directly, so "is X wired up?"
 * is one predicate instead of a scattered set of truthiness checks that drift.
 */
export function hasSupabase(env: ServerEnv = getEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Auth needs the URL and the browser-safe key; the service-role key is not involved. */
export function hasSupabaseAuth(env: ServerEnv = getEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && supabasePublishableKey(env));
}

export function supabasePublishableKey(env: ServerEnv = getEnv()): string | null {
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null
  );
}

export function hasUpstash(env: ServerEnv = getEnv()): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function hasAnthropic(env: ServerEnv = getEnv()): boolean {
  return env.AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY);
}

export function hasRealResearchProvider(env: ServerEnv = getEnv()): boolean {
  return env.RESEARCH_PROVIDER === 'tavily' && Boolean(env.TAVILY_API_KEY);
}

export function isProduction(env: ServerEnv = getEnv()): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * The welcome grant, with production held to zero unless set explicitly.
 *
 * The schema default is already 0, so this only matters if someone sets a
 * generous value for local work and that value reaches production through a
 * shared .env. Reading the environment through one function makes that a
 * deliberate act rather than an inherited one.
 */
export function welcomeTokenGrant(env: ServerEnv = getEnv()): number {
  return env.WELCOME_TOKEN_GRANT;
}

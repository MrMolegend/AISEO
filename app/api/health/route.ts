import {
  getEnv,
  hasSupabase,
  hasSupabaseAuth,
  hasUpstash,
  hasAnthropic,
  hasRealResearchProvider,
} from '@/lib/env';

/**
 * Health check.
 *
 * Reports which driver is live for each subsystem rather than merely "ok",
 * because the most likely production misconfiguration is not an outage — it is
 * silently running on a development driver. A mock research provider in
 * production is the worst of these: it returns confident, well-shaped, entirely
 * fictional sources, and nothing downstream can tell the difference. So it is
 * reported as a failing state, not a warning.
 *
 * Deliberately does not call Anthropic or the research provider. A health check
 * that costs money on every probe is a bad health check, and both are checked
 * by configuration rather than by round trip.
 *
 * Never prints a secret. Only which driver is selected.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();

  const drivers = {
    storage: hasSupabase(env) ? 'supabase' : 'memory',
    auth: hasSupabaseAuth(env) ? 'supabase' : 'disabled',
    rateLimit: hasUpstash(env) ? 'upstash' : 'memory',
    ai: hasAnthropic(env) ? 'anthropic' : 'mock',
    research: hasRealResearchProvider(env) ? env.RESEARCH_PROVIDER : 'mock',
    /**
     * Background work runs in-process via Next's after(). Named here so the
     * boundary is visible: if a job provider is introduced later, this is the
     * field that changes and the health check keeps telling the truth.
     */
    jobs: 'in-process',
  } as const;

  const problems: string[] = [];
  if (env.NODE_ENV === 'production') {
    if (drivers.storage !== 'supabase') problems.push('storage is not Supabase');
    if (drivers.auth !== 'supabase') problems.push('authentication is not configured');
    if (drivers.rateLimit !== 'upstash') {
      // In-process limits are per-instance, so on more than one instance they
      // are not limits at all.
      problems.push('rate limiting is in-process and does not span instances');
    }
    if (drivers.ai !== 'anthropic') problems.push('AI provider is the mock');
    if (drivers.research === 'mock') {
      problems.push('research provider is the mock and would fabricate sources');
    }
  }

  const healthy = problems.length === 0;

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      drivers,
      problems,
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

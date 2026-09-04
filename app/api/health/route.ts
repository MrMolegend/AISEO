import {
  getEnv,
  hasSupabase,
  hasSupabaseAuth,
  hasUpstash,
  hasAnthropic,
  hasRealResearchProvider,
  servesRealCustomers,
  usingTestAuthDriver,
} from '@/lib/env';

/**
 * Health check.
 *
 * Reports which provider is serving each subsystem rather than merely "ok",
 * because the most likely production misconfiguration is not an outage — it is
 * silently running on a development driver. A mock research provider in
 * production is the worst of these: it returns confident, well-shaped, entirely
 * fictional sources, and nothing downstream can tell the difference. So it is
 * reported as a failing state, not a warning, and the job pipeline refuses to
 * start a report under the same condition (see lib/jobs/create-job.ts, which
 * reads the same predicate rather than repeating the reasoning).
 *
 * Deliberately does not call Anthropic or the research provider. A health check
 * that costs money on every probe is a bad health check, and both are checked
 * by configuration rather than by round trip.
 *
 * Names providers, never credentials. There is no branch here that can print a
 * key, and the response is a fixed shape rather than a serialised env object,
 * so a variable added later cannot leak by being included accidentally.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();

  const providers = {
    storage: hasSupabase(env) ? 'supabase' : 'memory',
    auth: usingTestAuthDriver(env)
      ? 'test-stub'
      : hasSupabaseAuth(env)
        ? 'supabase'
        : 'disabled',
    rateLimit: hasUpstash(env) ? 'upstash' : 'memory',
    ai: hasAnthropic(env) ? 'anthropic' : 'mock',
    research: hasRealResearchProvider(env) ? env.RESEARCH_PROVIDER : 'mock',
    /**
     * Not integrated, and not planned.
     *
     * Reported explicitly rather than omitted because "places" is the kind of
     * capability an operator goes looking for, and a missing key is a
     * different question from a deliberate absence. This product reads the
     * public web; it does not query a places API, does not require
     * GOOGLE_PLACES_API_KEY, and 'disabled' is a healthy steady state rather
     * than something to fix.
     */
    places: 'disabled',
    /**
     * Background work runs in-process via Next's after(). Named here so the
     * boundary is visible: if a job provider is introduced later, this is the
     * field that changes and the health check keeps telling the truth.
     */
    jobs: 'in-process',
    /**
     * LinkedIn reports its configured MODE, because for this integration
     * "disabled" and "openid_only" are healthy steady states chosen on
     * purpose — the product works fully without LinkedIn, and no partner
     * capability exists in this build. The only unhealthy shape is a mode
     * that promises OAuth while its credentials are missing.
     */
    linkedin: env.LINKEDIN_MODE,
  } as const;

  const problems: string[] = [];

  if (env.LINKEDIN_MODE !== 'disabled') {
    const configured =
      Boolean(env.LINKEDIN_CLIENT_ID) &&
      Boolean(env.LINKEDIN_CLIENT_SECRET) &&
      Boolean(env.LINKEDIN_REDIRECT_URI);
    if (!configured) {
      problems.push(
        `LINKEDIN_MODE is "${env.LINKEDIN_MODE}" but the LinkedIn credentials are not fully configured`,
      );
    }
  }

  if (servesRealCustomers(env)) {
    if (providers.storage !== 'supabase') problems.push('storage is not Supabase');
    if (providers.auth === 'test-stub') {
      // Unreachable: usingTestAuthDriver() throws on a production deployment
      // before this line can run. Listed anyway so the check reads completely,
      // and so it stays correct if that guard is ever relaxed.
      problems.push('authentication is served by the test stub');
    }
    if (providers.auth !== 'supabase') problems.push('authentication is not configured');
    if (providers.rateLimit !== 'upstash') {
      // In-process limits are per-instance, so on more than one instance they
      // are not limits at all.
      problems.push('rate limiting is in-process and does not span instances');
    }
    if (providers.ai !== 'anthropic') {
      problems.push('synthesis provider is the mock; reports would be fabricated');
    }
    if (providers.research === 'mock') {
      problems.push('research provider is the mock; sources would be fabricated');
    }
  }

  const healthy = problems.length === 0;

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      providers,
      problems,
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

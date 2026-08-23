import { getEnv, hasSupabase, hasUpstash, hasAnthropic } from '@/lib/env';

/**
 * Health check.
 *
 * Reports which drivers are active rather than merely "ok", because the most
 * likely production misconfiguration is silently running on a development
 * driver. Deliberately does not call Anthropic — a health check that costs money
 * on every probe is a bad health check.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();

  const drivers = {
    storage: hasSupabase(env) ? 'supabase' : 'memory',
    rateLimit: hasUpstash(env) ? 'upstash' : 'memory',
    ai: hasAnthropic(env) ? 'anthropic' : 'mock',
  };

  const productionReady =
    env.NODE_ENV !== 'production' ||
    (drivers.storage === 'supabase' &&
      drivers.rateLimit === 'upstash' &&
      drivers.ai === 'anthropic');

  return Response.json(
    { status: productionReady ? 'ok' : 'degraded', drivers, environment: env.NODE_ENV },
    {
      status: productionReady ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

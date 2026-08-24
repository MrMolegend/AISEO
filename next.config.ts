import type { NextConfig } from 'next';
import { contentSecurityPolicy, DEFAULT_SUPABASE_ORIGIN } from './lib/security/csp';

/**
 * Headers are evaluated once, during the build, and baked into the routes
 * manifest — they are not recomputed per request. That is what broke the first
 * attempt at this fix: NEXT_PUBLIC_SUPABASE_URL was not in the build
 * environment, so the policy shipped with no Supabase source and every sign-in
 * was blocked in the browser. The build itself was perfectly happy.
 *
 * So the environment is an override, not a dependency. The variable is used
 * when it is there; otherwise the known project origin is, and either way the
 * value goes through URL parsing before it reaches the header.
 */
function cspHeader(): string {
  return contentSecurityPolicy({
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_ORIGIN,
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

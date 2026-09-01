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

  /**
   * Routes the previous product owned.
   *
   * Permanent, because these paths are gone rather than moved temporarily, and
   * server-side rather than a redirecting page so a bookmark never renders a
   * flash of the old interface. The report URLs are deliberately absent from
   * this list: /research/[publicId] still serves both eras of report, which is
   * what keeps every link anyone has already shared working.
   */
  async redirects() {
    return [
      { source: '/research/new', destination: '/assess', permanent: true },
      { source: '/research/new/:packageId', destination: '/assess', permanent: true },
      { source: '/pricing', destination: '/methodology', permanent: true },
    ];
  },

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
      {
        // Shared reports carry a real business's private brief. The page sets
        // a robots meta too; the header covers responses a crawler reads
        // without parsing HTML, and the tokened URL must never enter an index.
        source: '/shared/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;

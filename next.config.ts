import type { NextConfig } from 'next';
import { contentSecurityPolicy } from './lib/security/csp';

/**
 * Headers are evaluated once, at build time, and baked into the routes
 * manifest — they are not recomputed per request. So NEXT_PUBLIC_SUPABASE_URL
 * has to be present in the *build* environment for the browser to be allowed
 * to reach Supabase at all. On Vercel it is, because it is a NEXT_PUBLIC_
 * variable and is already inlined into the client bundle from the same place.
 */
function cspHeader(): string {
  return contentSecurityPolicy({
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
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

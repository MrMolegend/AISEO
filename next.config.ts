import type { NextConfig } from 'next';

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` on style-src is required by Next's inlined critical CSS and by
 * React's style attributes; we compensate by banning dangerouslySetInnerHTML at the
 * lint level so no untrusted string ever reaches the DOM as markup.
 *
 * `'unsafe-eval'` is development-only (React Refresh needs it).
 */
function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    // Audited sites' favicons are rendered in the report header.
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
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

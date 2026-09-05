import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * An internal tool has nothing to index.
 *
 * Everything is disallowed: the workspace sits behind sign-in and
 * invitation-only membership, legacy report URLs are private capability
 * pages, and the gateway page exists to route ALT staff to sign-in, not to
 * be found. No sitemap is advertised for the same reason.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
    host: SITE_URL,
  };
}

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /*
         * Individual audits are deliberately excluded from search.
         *
         * Two reasons, both real: publishing a critique of someone else's site
         * under our domain is a privacy problem, and thousands of near-identical
         * generated report pages is exactly the thin-content pattern we would
         * flag in an audit of our own site. Only the curated /sample is indexed.
         */
        disallow: ['/audit/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

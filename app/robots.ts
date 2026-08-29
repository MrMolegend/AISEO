import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /*
         * Only the marketing surface is indexable.
         *
         * Reports are excluded for two independent reasons: they concern real
         * businesses and are shared by unguessable link rather than published,
         * and thousands of near-identical generated pages is precisely the
         * thin-content pattern that earns a site a manual action. Everything
         * behind sign-in is excluded because it is per-account and would only
         * ever return a redirect to a crawler anyway.
         */
        disallow: [
          '/research/',
          '/dashboard',
          '/assess',
          '/wallet',
          '/account',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

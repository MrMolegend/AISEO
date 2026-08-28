import type { MetadataRoute } from 'next';
import { getTutors } from '@/lib/queries';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Public pages only — dashboards, bookings and lesson rooms are not indexable. */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/tutors',
    '/how-it-works',
    '/become-a-tutor',
    '/about',
    '/contact',
    '/sign-in',
    '/sign-up',
    '/privacy',
    '/terms',
    '/safeguarding',
  ];

  return [
    ...staticPaths.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
    })),
    ...getTutors().map((tutor) => ({
      url: `${SITE_URL}/tutors/${tutor.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}

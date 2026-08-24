import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { BRAND } from '@/config/brand';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Root metadata.
 *
 * Every string here comes from config/brand.ts, so renaming the product is one
 * file rather than a search through the app directory. Report pages override
 * `robots` with noindex — they concern real businesses and carry a customer's
 * own brief, and are shared by capability link rather than published.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    url: '/',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* First thing in the tab order, so a keyboard user can pass the header
            and the report contents nav without twenty tab presses. */}
        <a
          href="#main"
          className="bg-brand text-ink-inverse focus:ring-brand sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:px-4 focus:py-2 focus:ring-2 focus:outline-none"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

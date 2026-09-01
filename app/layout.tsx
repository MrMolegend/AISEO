import type { Metadata, Viewport } from 'next';
import { Fraunces, Archivo, IBM_Plex_Mono } from 'next/font/google';
import { BRAND } from '@/config/brand';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Three typefaces, three jobs.
 *
 * Fraunces is the editorial voice — a Scotch-Roman with enough character to
 * carry a headline without a graphic behind it, which is the point: this
 * product's hero is a sentence, not an illustration. It is never set below
 * 24px, where its contrast becomes a legibility problem rather than a virtue.
 *
 * Archivo carries everything a person reads to operate the product. A grotesque
 * with slightly condensed proportions, so a dense comparison table fits without
 * dropping to a size nobody can read on a phone.
 *
 * IBM Plex Mono carries metadata that has to line up: source refs, ISO market
 * codes, coordinates, retrieval dates, scores. Chosen over the usual coding
 * monos because it was drawn for documents rather than for terminals.
 *
 * `display: 'swap'` on all three: a market-entry report is text, and text that
 * arrives late is text nobody reads.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

/**
 * Root metadata.
 *
 * Every string comes from config/brand.ts, so renaming the product is one file
 * rather than a search through the app directory. Report pages override
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
    locale: BRAND.social.locale,
  },
  twitter: {
    card: BRAND.social.twitterCard,
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
    <html
      lang="en"
      className={`${fraunces.variable} ${archivo.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/* First thing in the tab order, so a keyboard user can pass the header
            and the report contents nav without twenty tab presses. */}
        <a
          href="#main"
          className="bg-signal text-text-on-signal sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[var(--radius-control)] focus:px-4 focus:py-2 focus:outline-none"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/components/providers';
import { themeBootstrapScript } from '@/lib/store/theme';
import './globals.css';

/**
 * Demo lessons, availability and "next free" times are all expressed relative to
 * today, so the pages are rendered per request rather than baked at build time.
 * With a real database this would go back to the default caching behaviour.
 */
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Tutor Hub — Find the right tutor and make progress that lasts',
    template: '%s · Tutor Hub',
  },
  description:
    'Compare trusted tutors for GCSE, A-Level and university study, book online lessons at a time that suits you, and learn inside Tutor Hub.',
  applicationName: 'Tutor Hub',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Tutor Hub',
    title: 'Tutor Hub — Find the right tutor and make progress that lasts',
    description:
      'Compare trusted tutors, book online lessons and learn inside Tutor Hub.',
    url: '/',
    locale: 'en_GB',
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1322' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/*
          The theme class has to be on <html> before the first paint, otherwise a
          dark-mode visitor sees a white flash. This is the one inline script in
          the app and it touches nothing but a class name.
        */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="bg-brand text-on-brand focus:ring-brand sr-only rounded-[var(--radius-control)] focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

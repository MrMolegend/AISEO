import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Our own metadata.
 *
 * An SEO auditing product with bad SEO is not a good look, so this is treated as
 * product surface rather than boilerplate: a real title formula, canonical URLs,
 * OG and Twitter cards, and an explicit robots policy.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AISEO — AI-powered SEO audits for any website',
    template: '%s · AISEO',
  },
  description:
    'Enter your website and get an AI-powered SEO and growth audit in about a minute: scores, prioritised issues, and an action plan written for people who do not do SEO for a living.',
  applicationName: 'AISEO',
  keywords: [
    'SEO audit',
    'website audit',
    'AI SEO',
    'technical SEO',
    'on-page SEO',
    'site analysis',
  ],
  authors: [{ name: 'AISEO' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AISEO',
    title: 'AISEO — AI-powered SEO audits for any website',
    description:
      'Enter your website and get an AI-powered SEO and growth audit in about a minute.',
    url: '/',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AISEO — AI-powered SEO audits for any website',
    description:
      'Enter your website and get an AI-powered SEO and growth audit in about a minute.',
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
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

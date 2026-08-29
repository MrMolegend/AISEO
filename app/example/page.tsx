import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { DossierView } from '@/components/dossier/dossier-view';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';
import { EXAMPLE_SUMMARY } from '@/fixtures/market-entry/case';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle('Example report'),
  description: `A complete ${BRAND.defaultReportTitle} for a fictional business, rendered by the same components a real assessment uses.`,
  alternates: { canonical: '/example' },
};

/**
 * The worked example.
 *
 * Rendered by the real dossier components against the real assembly functions,
 * not a marketing mock-up of them. That is the whole point: a prospective
 * customer reading this is reading the actual product, and a rendering bug
 * cannot hide behind a screenshot.
 *
 * It is labelled as illustrative in the metadata, in a banner at the top of the
 * document, and beside every figure that quotes it elsewhere on the site. The
 * business does not exist and the sources are on a reserved demonstration
 * domain that cannot resolve.
 */
export default async function ExamplePage() {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader />

      <main id="main">
        <div className="mx-auto max-w-[var(--container-page)] px-5 pt-12 md:px-8">
          <Meta>Worked example</Meta>
          <h1 className="font-display text-text mt-3 max-w-[20ch] text-[34px] leading-[1.06] tracking-[var(--tracking-display)] md:text-[44px]">
            What a market-entry dossier looks like
          </h1>
          <p className="text-text-muted measure mt-4 text-[16px] leading-relaxed">
            {EXAMPLE_SUMMARY} Everything below is produced by the same components and the
            same scoring model a real assessment uses — including the two sources the
            research could not read, and what that cost the report.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={user ? '/assess' : '/sign-in?next=%2Fassess'}>
                Assess your own market
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/methodology">How the research works</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12">
          <DossierView
            report={EXAMPLE_DOSSIER}
            publicId={null}
            isOwner={false}
            illustrative
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

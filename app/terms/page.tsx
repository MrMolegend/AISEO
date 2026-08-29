import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { BRAND } from '@/config/brand';

export const metadata: Metadata = {
  title: `Terms — ${BRAND.shortName}`,
  description: `The terms that apply to using ${BRAND.name}.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="August 2026">
      <LegalSection heading="What this service does">
        <p>
          {BRAND.name} searches publicly available sources, retrieves a bounded set of
          public web pages, and uses an AI model to organise what it finds into a
          structured report. Reports are provided for information only.
        </p>
      </LegalSection>

      <LegalSection heading="Report credits">
        <p>{BRAND.credit.disclaimer}</p>
        <p>
          Each research package has a fixed cost, shown before you confirm. Running a
          report holds that amount and settles it when the report completes. If the run
          fails because of a fault on our side, the hold is released automatically and you
          are not charged.
        </p>
        <p>
          A report that completes is charged even if it finds less than you hoped. Public
          information about a small or new business is sometimes thin, and the work of
          establishing that is the same work. Every report states plainly what it could
          not determine, so you can see what you received.
        </p>
      </LegalSection>

      <LegalSection heading="Accuracy and limits">
        <p>
          Reports are generated automatically and are not professional, legal or financial
          advice. Each factual claim carries a citation and a confidence level, and each
          report states what it could not establish — please read that section, because it
          is the honest boundary of what the report knows.
        </p>
        <p>
          Public sources go out of date, disagree with each other, and are sometimes
          wrong. Where we find sources in conflict we show the conflict rather than
          picking a winner. Verify anything you intend to act on commercially.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Use the contact details in a report in line with the marketing and data
          protection law that applies to you. Do not use this service to harass anyone, to
          build a dataset for resale, to circumvent access controls, or in a way that
          places unreasonable load on third-party sites. We apply rate limits and may
          suspend abusive accounts.
        </p>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          The service is provided as-is, without warranty. We may change, limit or
          withdraw it at any time. Where we withdraw it entirely, unused{' '}
          {BRAND.credit.plural} will not be redeemable for cash.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

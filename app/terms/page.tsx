import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms that apply to using AISEO.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="August 2026">
      <LegalSection heading="What this service does">
        <p>
          AISEO retrieves a publicly accessible web page, extracts factual signals from
          it, and uses an AI model to interpret those signals and write recommendations.
          The audit is provided for information only.
        </p>
      </LegalSection>

      <LegalSection heading="Accuracy and limits">
        <p>
          Audits are generated automatically and are not professional advice. Each report
          states what it could and could not determine — please read that section, because
          it is the honest boundary of what the audit knows.
        </p>
        <p>
          We do not guarantee that acting on a recommendation will change your search
          rankings or traffic. Search engines do not publish their ranking systems, and
          anyone who tells you otherwise is guessing.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Do not use this service to audit websites you have no legitimate interest in, to
          circumvent access controls, or in a way that places unreasonable load on
          third-party sites. We apply rate limits and may block abusive use.
        </p>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          The service is provided as-is, without warranty. We may change, limit or
          withdraw it at any time.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

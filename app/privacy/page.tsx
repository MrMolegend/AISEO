import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What data AISEO collects when you run an audit, and what we do with it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="August 2026">
      <LegalSection heading="What we collect when you run an audit">
        <p>
          When you submit a website address we store that address, the publicly available
          page data we retrieve from it, and the audit we generate. Reports are reachable
          by anyone holding their link, so treat an audit link as shareable.
        </p>
        <p>
          We record a one-way salted hash of your IP address. This is used only to apply
          rate limits and to investigate abuse. We cannot recover the original address
          from the hash.
        </p>
      </LegalSection>

      <LegalSection heading="What we do not collect">
        <p>
          Running an audit requires no account, no email address and no payment details.
          We do not use advertising trackers, and we do not sell or share audit data with
          third parties.
        </p>
      </LegalSection>

      <LegalSection heading="Audited websites">
        <p>
          We retrieve only publicly accessible pages, identify ourselves honestly as an
          automated tool, and respect a site&rsquo;s robots.txt directives. We make a
          small number of requests and do not crawl beyond what an audit requires.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party processing">
        <p>
          Page data we extract is sent to Anthropic&rsquo;s API to generate the analysis.
          Audits are stored with our database provider. Both act as processors on our
          behalf.
        </p>
      </LegalSection>

      <LegalSection heading="If you contact us">
        <p>
          If you submit the contact form at the end of a report, we store the details you
          provide in order to reply. We use them for that purpose and no other.
        </p>
      </LegalSection>

      <LegalSection heading="Removal">
        <p>
          If you would like an audit of your website deleted, contact us with the report
          link and we will remove it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

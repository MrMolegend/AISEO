import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { BRAND } from '@/config/brand';

export const metadata: Metadata = {
  title: `Privacy — ${BRAND.shortName}`,
  description: `What data ${BRAND.name} collects when you run research, and what we do with it.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="August 2026">
      <LegalSection heading="Your account">
        <p>
          Creating an account stores your email address. We use it to sign you in, to
          associate your research with you, and to contact you about the service. Sign-in
          is by emailed link, so we do not store a password.
        </p>
        <p>
          Your {BRAND.credit.plural} balance and every movement of it are recorded against
          your account. That ledger is append-only: it is how we can show you exactly what
          a report cost and when a refund was issued.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect when you run research">
        <p>
          We store the brief you submit — the business name, website, market and any
          context you provide — along with the public pages and search results we
          retrieve, and the report we generate from them. Reports are private to your
          account. A report is only reachable by someone else if you deliberately share
          its link.
        </p>
        <p>
          We record a one-way salted hash of your IP address. This is used only to apply
          rate limits and to investigate abuse. We cannot recover the original address
          from the hash.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party businesses named in a report">
        <p>
          Research reports describe real businesses and, where a package calls for it,
          people who publish contact details in a professional capacity. Everything we
          record comes from sources that are published publicly, and every factual claim
          carries a link to where we found it. We do not buy data, and we do not attempt
          to obtain anything a business has chosen not to publish.
        </p>
        <p>
          If you are named in a report and would like your details removed, contact us and
          we will remove them.
        </p>
      </LegalSection>

      <LegalSection heading="Sites we retrieve">
        <p>
          We retrieve only publicly accessible pages, identify ourselves honestly as an
          automated tool, and respect a site&rsquo;s robots.txt directives. Each research
          run is bounded to a small number of pages and we do not crawl beyond what a
          report requires.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party processing">
        <p>
          The material we gather is sent to Anthropic&rsquo;s API to produce the analysis,
          and to a web search provider to find sources. Accounts, wallets and reports are
          stored with our database provider. All act as processors on our behalf.
        </p>
      </LegalSection>

      <LegalSection heading="Deletion">
        <p>
          You can ask us to delete your account at any time. Doing so removes your
          profile, your reports and your wallet. Contact us with the email address on the
          account.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

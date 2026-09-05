import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { BRAND } from '@/config/brand';

export const metadata: Metadata = {
  title: `Privacy — ${BRAND.shortName}`,
  description: `What data ${BRAND.name} stores, where it comes from, and how it is removed.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="September 2026">
      <LegalSection heading="What this system is">
        <p>
          {BRAND.name} is a private, invitation-only workspace operated by{' '}
          {BRAND.legalEntity} for its own sales team. There is no public sign-up and no
          external customer data: the people with accounts are team members, and the
          records inside are the team&rsquo;s working notes about prospective wholesale
          customers.
        </p>
      </LegalSection>

      <LegalSection heading="Team member accounts">
        <p>
          An account stores your email address, your display name and your workspace role.
          Sign-in is by emailed link, so no password is stored. Actions that change shared
          records — imports, exports, stage changes, overrides, repairs — are recorded
          with who performed them, because an audit trail is part of how the team trusts
          its own data.
        </p>
      </LegalSection>

      <LegalSection heading="Businesses and people in the lead records">
        <p>
          Lead accounts describe real businesses, and contacts describe people only in
          their published professional capacity. Everything recorded comes from publicly
          published sources, from authorised imports of the company&rsquo;s own records,
          or from a colleague&rsquo;s explicit attestation — and every factual claim
          carries its source and retrieval date. Nothing is bought, scraped from behind a
          login, or inferred and presented as fact; where something is not verified, the
          record says so.
        </p>
        <p>
          The suppression list is absolute: an account, contact or channel placed on it is
          excluded from outreach drafting everywhere, and the exclusion survives
          re-discovery. Anyone asking not to be contacted is added on request.
        </p>
      </LegalSection>

      <LegalSection heading="LinkedIn">
        <p>
          When enabled, LinkedIn is used only through official APIs with OAuth consent.
          Signing in with LinkedIn associates your own verified identity; it does not
          harvest connections, message anyone, or read anything the official scope does
          not grant. Access tokens are used server-side for the exchange and are not
          persisted. Public LinkedIn URLs that arrive through a search index are labelled
          as exactly that. No scraping, browser automation or unofficial endpoint is used,
          in any mode.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party processing">
        <p>
          Evidence gathering sends queries to a web search provider; analysis uses
          Anthropic&rsquo;s API; records are stored with our database provider. All act as
          processors. Nothing in this system sends outreach: messages are drafted,
          reviewed and copied by a person, and delivery happens outside the system on
          channels the team already uses.
        </p>
      </LegalSection>

      <LegalSection heading="Retention and deletion">
        <p>
          Deleting a team member&rsquo;s account removes their profile, their personal
          records (saved views, watchlists, provider connections, private notes and
          relationship attestations) with it. Shared work records they touched — stage
          history, activities, tasks, drafts — remain, with the personal reference
          cleared, because they are the team&rsquo;s record of what happened, not the
          individual&rsquo;s.
        </p>
        <p>
          Records about a business or person can be corrected or removed on request to the
          workspace administrator; suppression entries are kept so the &ldquo;do not
          contact&rdquo; decision itself is never forgotten. Reports created under the
          platform&rsquo;s earlier products remain reachable by their owners and are
          covered by the same deletion path.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

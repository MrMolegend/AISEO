/**
 * Product identity — the single place the brand lives.
 *
 * Everything user-facing that names or describes the product reads from here.
 * The name below is a working title, not a decision: when the real brand is
 * chosen, this file is the only file that changes. Nothing else in the codebase
 * should contain the product name as a string literal, and the test in
 * tests/unit/brand.test.ts enforces that by reading the source tree.
 */

export const BRAND = {
  /** Working title. */
  name: 'CORRIDOR',
  /** Used where the name must be short (tab titles, breadcrumbs). */
  shortName: 'CORRIDOR',
  tagline: 'Enter new markets with evidence.',
  description:
    'Describe what you sell and where you want to expand. We research the market, test the commercial case and build a practical 90-day entry strategy.',
  /** Shown in the footer and in legal copy. */
  legalEntity: 'CORRIDOR',
  supportEmail: 'support@example.com',
  /**
   * The mark is drawn from these letters rather than an image file, so a
   * rebrand does not require replacing an asset. See components/ui/logo.tsx.
   */
  monogram: 'CO',

  /** What a produced dossier is called, wherever one is named generically. */
  defaultReportTitle: 'Market Entry Intelligence Report',
  /** Shorter form, for cards, tabs and lists. */
  reportShortTitle: 'Market entry dossier',

  /** Open Graph / Twitter metadata. */
  social: {
    locale: 'en_GB',
    twitterCard: 'summary_large_image',
    /** Rendered by app/opengraph-image.tsx rather than served as a file. */
    imageAlt: 'A market-entry dossier: origin market, target market, evidence.',
  },

  /**
   * What the customer sees when they spend one.
   *
   * The internal ledger counts tokens; the customer counts reports. These two
   * facts are deliberately separated — see config/report.ts, which owns the
   * conversion — because exposing token arithmetic to someone buying a report
   * is exposing an implementation detail they never asked about.
   */
  credit: {
    singular: 'report credit',
    plural: 'report credits',
    /*
     * Shown wherever a balance appears for the first time on a page. It says
     * what a credit is not, without naming the internal unit.
     *
     * An earlier version added "and they are not the AI provider's tokens",
     * which was true and was the only place the word reached a customer-facing
     * page. It also raised the question it was trying to close. What a person
     * needs here is that this is not a currency and not an investment.
     */
    disclaimer:
      'Report credits are service credits used to run market-entry research. They are not cryptocurrency, cannot be transferred, and have no cash value.',
  },

  /**
   * The internal currency, retained for the wallet administration surface only.
   *
   * Not customer-facing. Nothing in the signed-in product may render these
   * strings — the beta interface speaks in report credits. Kept because the
   * ledger, the admin grant route and their tests all still name it.
   */
  currency: {
    name: 'Research Tokens',
    shortName: 'Tokens',
    singular: 'token',
    plural: 'tokens',
    disclaimer:
      'Research Tokens are internal service credits. They are not cryptocurrency, they are not the AI provider’s tokens, and they have no cash value.',
  },
} as const;

/** Title suffix for <title> tags. */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${BRAND.shortName}` : `${BRAND.name} — ${BRAND.tagline}`;
}

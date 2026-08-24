/**
 * Product identity — the single place the brand lives.
 *
 * Everything user-facing that names or describes the product reads from here.
 * The name below is a working title, not a decision: when the real brand is
 * chosen, this file is the only file that changes. Nothing else in the codebase
 * should contain the product name as a string literal, and the test in
 * tests/unit/brand.test.ts enforces that.
 */

export const BRAND = {
  /** Working title. Deliberately generic — this is not the final brand. */
  name: 'Research Suite',
  /** Used where the name must be short (tab titles, breadcrumbs). */
  shortName: 'Research Suite',
  tagline: 'Source-backed research on any business or market',
  description:
    'Choose a research package, tell us about your business, and get a detailed report built from public sources — with a citation behind every factual claim.',
  /** Shown in the footer and in legal copy. */
  legalEntity: 'Research Suite',
  supportEmail: 'support@example.com',
  /**
   * The mark is drawn from these two letters rather than an image file, so a
   * rebrand does not require replacing an asset. See components/ui/logo.tsx.
   */
  monogram: 'RS',
  /**
   * The internal currency. Named in one place because "tokens" is an
   * overloaded word: these are service credits, and the UI has to keep saying
   * so. They are not cryptocurrency, and they are not the AI provider's tokens.
   */
  currency: {
    name: 'Research Tokens',
    shortName: 'Tokens',
    singular: 'token',
    plural: 'tokens',
    /** Rendered wherever a balance is shown for the first time on a page. */
    disclaimer:
      'Research Tokens are service credits used to run reports. They are not cryptocurrency, they are not the AI provider’s tokens, and they have no cash value.',
  },
} as const;

/** Title suffix for <title> tags. */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${BRAND.shortName}` : `${BRAND.name} — ${BRAND.tagline}`;
}

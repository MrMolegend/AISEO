/**
 * Product identity — the single place the brand lives.
 *
 * Everything user-facing that names or describes the product reads from here.
 * Nothing else in the codebase should contain the product name as a string
 * literal, and the test in tests/unit/brand.test.ts enforces that by reading
 * the source tree.
 *
 * ALT SIGNAL is an internal product of Arab Land Trading LLC — not a public
 * SaaS. The copy below is written for ALT's own team.
 *
 * Official brand assets (logo, exact colours) could not be retrieved from
 * this build environment: www.arablandtrading.com is blocked by the network
 * egress proxy (EGRESS_BLOCKED, checked 2026-09-03). Until an authorised
 * operator supplies the official assets, the interface renders a typographic
 * wordmark and provisional colours defined centrally in app/globals.css —
 * one place to change when the real assets arrive. See OPERATIONS notes in
 * ARCHITECTURE.md.
 */

export const BRAND = {
  name: 'ALT SIGNAL',
  /** Used where the name must be short (tab titles, breadcrumbs). */
  shortName: 'ALT SIGNAL',
  tagline: 'Wholesale Growth Intelligence',
  description:
    'Arab Land Trading’s internal lead intelligence and wholesale sales workspace: evidence-led account discovery, honest relationship mapping, and grounded outreach across the UAE and GCC.',
  /** Shown in the footer and in legal copy. */
  legalEntity: 'Arab Land Trading LLC',
  supportEmail: 'support@example.com',
  /**
   * The mark is drawn from these letters rather than an image file, so the
   * arrival of the official logo does not require code changes beyond
   * components/ui/logo.tsx. See the asset note in the header comment.
   */
  monogram: 'AS',

  /** What a produced research output is called, wherever one is named generically. */
  defaultReportTitle: 'Account Intelligence Brief',
  /** Shorter form, for cards, tabs and lists. */
  reportShortTitle: 'Account brief',

  /** Open Graph / Twitter metadata. Internal tool: pages are noindex anyway. */
  social: {
    locale: 'en_AE',
    twitterCard: 'summary',
    imageAlt: 'An internal wholesale lead-intelligence workspace.',
  },

  /**
   * Retained for the legacy CORRIDOR surfaces (wallet, legacy reports),
   * which continue to render for their owners. The active ALT SIGNAL
   * interface does not sell or display credits: research spend is an
   * internal provider budget, surfaced to managers in admin.
   */
  credit: {
    singular: 'report credit',
    plural: 'report credits',
    disclaimer:
      'Report credits are service credits used to run research. They are not cryptocurrency, cannot be transferred, and have no cash value.',
  },

  /**
   * The internal currency, retained for the ledger and its administration
   * surface only. Not part of the ALT SIGNAL interface; kept because the
   * ledger, the admin grant route and their tests all still name it, and
   * ledger integrity survives the pivot untouched.
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

export function pageTitle(title?: string): string {
  return title ? `${title} — ${BRAND.shortName}` : `${BRAND.name} — ${BRAND.tagline}`;
}

/**
 * Token bundles and provisional pricing.
 *
 * PROVISIONAL. No payment provider is integrated, nothing here can be bought,
 * and the UI must say so wherever a price appears. The prices exist now so the
 * pricing page is real rather than a placeholder, and so that adding a provider
 * later is a matter of wiring a checkout to an existing typed bundle rather
 * than inventing the catalogue at that point.
 *
 * Prices are held in minor units (pence) because floating-point pounds are how
 * billing bugs start.
 */

export const TOKEN_BUNDLE_IDS = ['starter', 'builder', 'growth', 'agency'] as const;
export type TokenBundleId = (typeof TOKEN_BUNDLE_IDS)[number];

export interface TokenBundle {
  id: TokenBundleId;
  name: string;
  tokens: number;
  /** Minor units of `CURRENCY.code`. 900 = £9.00. */
  priceMinorUnits: number;
  /** Shown on the card. Purely descriptive. */
  blurb: string;
  /** At most one bundle may set this. Enforced at module load. */
  highlighted: boolean;
}

export const CURRENCY = {
  code: 'GBP',
  symbol: '£',
  locale: 'en-GB',
  minorUnitsPerUnit: 100,
} as const;

export const TOKEN_BUNDLES: Record<TokenBundleId, TokenBundle> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tokens: 100,
    priceMinorUnits: 900,
    blurb: 'One Competitor Intelligence report.',
    highlighted: false,
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    tokens: 300,
    priceMinorUnits: 2400,
    blurb: 'A competitor report and a lead list, with tokens to spare.',
    highlighted: true,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tokens: 700,
    priceMinorUnits: 4900,
    blurb: 'Two Complete Market Packs.',
    highlighted: false,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    tokens: 1500,
    priceMinorUnits: 8900,
    blurb: 'Four Complete Market Packs, for running research across clients.',
    highlighted: false,
  },
};

export const BUNDLE_LIST: readonly TokenBundle[] = TOKEN_BUNDLE_IDS.map(
  (id) => TOKEN_BUNDLES[id],
);

/**
 * Purchasing is not implemented.
 *
 * Read by the UI so that "coming soon" is a single fact rather than a phrase
 * repeated in five components — and so that turning purchasing on later is a
 * deliberate change to one constant plus a real checkout, not an accident.
 */
export const PURCHASING_ENABLED = false as const;

export const PRICING_NOTES = [
  'Prices are provisional and purchasing is not yet available.',
  'Research availability and source coverage vary by market, language and industry. A report is built from what is publicly published — some sectors are far better documented than others.',
  'Tokens are service credits. They currently have no cash value, are not refundable for money, and are not transferable between accounts.',
  'A report that completes honestly with stated limitations is a completed report. Tokens are refunded automatically for system failures, not for a market that turned out to be thinly documented.',
] as const;

export function formatPrice(minorUnits: number): string {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    minimumFractionDigits: minorUnits % CURRENCY.minorUnitsPerUnit === 0 ? 0 : 2,
  }).format(minorUnits / CURRENCY.minorUnitsPerUnit);
}

/** Pence per token, for the "value" line on bundle cards. */
export function pricePerToken(bundle: TokenBundle): number {
  return bundle.priceMinorUnits / bundle.tokens;
}

export function formatTokens(count: number): string {
  return new Intl.NumberFormat(CURRENCY.locale).format(count);
}

export function isTokenBundleId(value: unknown): value is TokenBundleId {
  return (
    typeof value === 'string' && (TOKEN_BUNDLE_IDS as readonly string[]).includes(value)
  );
}

function assertBundlesAreSane(): void {
  const highlighted = BUNDLE_LIST.filter((b) => b.highlighted);
  if (highlighted.length > 1) {
    throw new Error('At most one token bundle may be highlighted');
  }
  for (const bundle of BUNDLE_LIST) {
    if (bundle.tokens <= 0 || !Number.isInteger(bundle.tokens)) {
      throw new Error(
        `Bundle "${bundle.id}" has a non-positive or fractional token count`,
      );
    }
    if (bundle.priceMinorUnits <= 0 || !Number.isInteger(bundle.priceMinorUnits)) {
      throw new Error(`Bundle "${bundle.id}" has a non-integer price in minor units`);
    }
  }
}

assertBundlesAreSane();

import type { BrandRecord } from '@/lib/alt/config-store';
import type { LeadAccountRecord, LeadClaimRecord } from '@/lib/leads/store';

/**
 * Product and brand matching — pure, and careful with the word "gap".
 *
 * The verdicts:
 *
 *   already_stocked        A claim's own text names the brand.
 *   observed_opportunity   Evidence shows the account trades in one of the
 *                          brand's categories, and nothing shows the brand
 *                          itself — an OBSERVED opening, with the evidence
 *                          cited.
 *   not_verified           Nothing in the evidence speaks to this brand's
 *                          categories either way. Research did not look or
 *                          did not find; absence of evidence, stated as
 *                          such, never as a gap.
 *   restricted             The brand's exclusivity notes name the
 *                          account's territory: never suggested.
 *
 * "They do not stock X" is a claim this module cannot make and never does:
 * not finding a brand is not evidence of its absence from a shelf.
 */

export type MatchVerdict =
  'already_stocked' | 'observed_opportunity' | 'not_verified' | 'restricted';

export interface ProductMatch {
  brandId: string;
  brandName: string;
  verdict: MatchVerdict;
  explanation: string;
  /** Claim ids whose text produced the verdict. Empty for not_verified. */
  evidenceClaimIds: string[];
}

export function matchBrands(
  account: Pick<LeadAccountRecord, 'territoryKey'>,
  claims: LeadClaimRecord[],
  brands: BrandRecord[],
): ProductMatch[] {
  const evidence = claims.filter(
    (claim) => claim.kind === 'fit' || claim.kind === 'identity',
  );

  return brands
    .filter((brand) => brand.active)
    .map((brand) => {
      // Restriction first: an exclusivity note naming the account's
      // territory takes the brand off the table entirely.
      if (
        account.territoryKey &&
        brand.exclusivityNotes &&
        brand.exclusivityNotes.toLowerCase().includes(account.territoryKey.toLowerCase())
      ) {
        return {
          brandId: brand.id,
          brandName: brand.name,
          verdict: 'restricted' as const,
          explanation: `The catalogue’s exclusivity notes for ${brand.name} name this territory; the combination is never suggested.`,
          evidenceClaimIds: [],
        };
      }

      const nameMentions = evidence.filter((claim) =>
        claim.text.toLowerCase().includes(brand.name.toLowerCase()),
      );
      if (nameMentions.length > 0) {
        return {
          brandId: brand.id,
          brandName: brand.name,
          verdict: 'already_stocked' as const,
          explanation: `Evidence names ${brand.name} directly.`,
          evidenceClaimIds: nameMentions.map((claim) => claim.id),
        };
      }

      const categoryMentions = evidence.filter((claim) =>
        brand.categories.some(
          (category) =>
            category.length >= 3 &&
            claim.text.toLowerCase().includes(category.toLowerCase()),
        ),
      );
      if (categoryMentions.length > 0) {
        const categories = brand.categories
          .filter((category) =>
            categoryMentions.some((claim) =>
              claim.text.toLowerCase().includes(category.toLowerCase()),
            ),
          )
          .join(', ');
        return {
          brandId: brand.id,
          brandName: brand.name,
          verdict: 'observed_opportunity' as const,
          explanation: `Evidence shows the account trades in ${categories}, which ${brand.name} supplies; the evidence does not name the brand itself.`,
          evidenceClaimIds: categoryMentions.map((claim) => claim.id),
        };
      }

      return {
        brandId: brand.id,
        brandName: brand.name,
        verdict: 'not_verified' as const,
        explanation: `Nothing in the evidence speaks to ${brand.name}’s categories either way — not verified, which is not the same as a gap.`,
        evidenceClaimIds: [],
      };
    });
}

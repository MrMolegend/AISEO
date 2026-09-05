/**
 * Verified Arab Land Trading business context.
 *
 * Every fact here carries its provenance. The only source reachable from this
 * build environment was the build specification itself — the company website
 * and LinkedIn page are blocked by the network egress proxy (EGRESS_BLOCKED,
 * checked 2026-09-03) — so each entry is labelled accordingly and marked for
 * re-verification against the official sources by an ALT administrator.
 *
 * Time-sensitive numbers (brand count, partner count, headcount, locations,
 * exclusivities) must never be rendered without their source and date. The
 * commercial configuration in the database supersedes this file once an
 * administrator has populated it; this file only seeds defaults and labels.
 */

export interface SourcedFact {
  claim: string;
  /** Where the claim came from. */
  source: 'build_specification' | 'official_website' | 'official_linkedin' | 'alt_admin';
  /** ISO date the claim was recorded from that source. */
  recordedOn: string;
  /** True when the number or wording can drift and needs periodic re-checking. */
  timeSensitive: boolean;
}

export const ALT_SOURCES = {
  website: 'https://www.arablandtrading.com/',
  linkedin:
    'https://www.linkedin.com/company/arab-land-trading---the-middle-east-pet-care-company',
} as const;

export const ALT_FACTS: readonly SourcedFact[] = [
  {
    claim: 'Established in Dubai in 2001.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: false,
  },
  {
    claim: 'Operates from Al Quoz, Dubai.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: true,
  },
  {
    claim: 'Describes itself as the Middle East’s largest pet supply wholesaler.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: true,
  },
  {
    claim: 'Supplies a portfolio of more than 40 internationally recognised pet brands.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: true,
  },
  {
    claim: 'Covers pet food and accessories for dogs, cats, rodents, fish, and reptiles.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: true,
  },
  {
    claim: 'Operates across the UAE and the wider GCC.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: true,
  },
  {
    claim:
      'Positions itself around long-term relationships, consistent availability, local market knowledge, and dependable wholesale distribution.',
    source: 'build_specification',
    recordedOn: '2026-09-03',
    timeSensitive: false,
  },
] as const;

/** GCC markets the territory model starts from. Configurable in admin. */
export const GCC_MARKETS = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
] as const;

/** UAE emirates, the finest-grained territory unit shipped by default. */
export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;

/**
 * Initial wholesale customer segments, per the specification. The list is
 * configuration, not doctrine: administrators can add, retire, or rename
 * segments, and no segment is treated as an appropriate client without ALT's
 * say-so.
 */
export const DEFAULT_SEGMENTS = [
  { key: 'independent_pet_retail', label: 'Independent pet retailers' },
  { key: 'pet_retail_chain', label: 'Multi-branch pet retail chains' },
  { key: 'veterinary_retail', label: 'Veterinary hospitals and clinics with retail' },
  { key: 'grooming_petcare_retail', label: 'Groomers and pet-care centres that retail' },
  { key: 'pet_ecommerce', label: 'Pet e-commerce companies and marketplaces' },
  {
    key: 'grocery_pet_category',
    label: 'Supermarkets and hypermarkets with pet categories',
  },
  {
    key: 'speciality_exotics_retail',
    label: 'Speciality aquatics, bird, reptile and small-animal retailers',
  },
  {
    key: 'boarding_breeding_shelter',
    label: 'Kennels, catteries, breeders, shelters and boarding operators',
  },
  {
    key: 'regional_distribution',
    label: 'Regional importers, distributors and sub-distributors',
  },
  {
    key: 'hospitality_lifestyle',
    label:
      'Hospitality, residential or lifestyle operators with pet-retail opportunities',
  },
] as const;

export type SegmentKey = (typeof DEFAULT_SEGMENTS)[number]['key'];

export const SEGMENT_LABEL: Record<SegmentKey, string> = Object.fromEntries(
  DEFAULT_SEGMENTS.map((segment) => [segment.key, segment.label]),
) as Record<SegmentKey, string>;

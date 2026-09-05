import { z } from 'zod';
import { isCountryCode } from '@/config/markets';
import { BUSINESS_STATUSES } from '@/schemas/market-entry/input';

/**
 * The reusable business profile.
 *
 * The durable description of what a customer sells, kept apart from any one
 * brief. A brief is a question about one corridor at one moment; the profile
 * is the part of the answer that was true before the question and stays true
 * after it. Profile fields prefill a new brief and never lock it: the brief's
 * copy is its own, editable without touching the profile.
 *
 * The same three rules as the intake schema apply — every message is written
 * for the customer, free text is capped and trimmed, and multi-value answers
 * are bounded lists — plus one of this file's own:
 *
 *   **The website is optional and stays optional.** It is the one URL-shaped
 *   field in the product, and it exists as an evidence seed, not a
 *   requirement. An empty value is a complete profile. Nothing downstream may
 *   treat its absence as a gap, and nothing may fail because the site it
 *   names is unreachable — an unreadable website is a recorded limitation.
 */

const optionalText = (max: number) =>
  z
    .string({ error: 'Enter text, or leave this blank' })
    .trim()
    .max(max, { error: `Keep this under ${max} characters` })
    .transform((value) => (value.length === 0 ? null : value.replace(/\s+/g, ' ')))
    .nullable()
    .default(null);

/**
 * A bounded list of short free-text entries, deduplicated case-insensitively.
 * The chip input dedupes too, but only one of the two runs somewhere
 * trustworthy.
 */
const chips = (maxItems: number, maxLength: number, itemError: string) =>
  z
    .array(
      z
        .string({ error: itemError })
        .trim()
        .min(1, { error: itemError })
        .max(maxLength, { error: `Keep each entry under ${maxLength} characters` }),
    )
    .max(maxItems, { error: `${maxItems} is as many as the research can use` })
    .default([])
    .transform((values) => {
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const value of values) {
        // Collapse whitespace before keying, or "Cornish  Sea Salt" and
        // "cornish sea salt" count as different competitors.
        const cleaned = value.replace(/\s+/g, ' ');
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(cleaned);
      }
      return unique;
    });

/**
 * The optional website.
 *
 * Lenient on entry — people type "acme.example" without a scheme — and strict
 * on what is stored: an absolute http(s) URL or null. Anything else is
 * rejected with a message about the field, not about URL grammar. Validity
 * here means well-formed, nothing more; whether the page is reachable is the
 * research pipeline's business, and unreachable is a limitation there, never
 * an error here.
 */
const optionalWebsite = z
  .string({ error: 'Enter a web address, or leave this blank' })
  .trim()
  .max(2048, { error: 'That address is longer than we can use' })
  .transform((value, ctx) => {
    if (value.length === 0) return null;

    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a web address like example.com — or leave this blank',
      });
      return z.NEVER;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        message: 'Only regular web addresses work here (http or https)',
      });
      return z.NEVER;
    }
    if (!parsed.hostname.includes('.')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a full web address like example.com — or leave this blank',
      });
      return z.NEVER;
    }
    return parsed.toString();
  })
  .nullable()
  .default(null);

export const BUSINESS_MODELS = [
  'b2c',
  'b2b',
  'b2b2c',
  'marketplace',
  'subscription',
  'services',
  'mixed',
] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

export const BUSINESS_MODEL_LABEL: Record<BusinessModel, string> = {
  b2c: 'Selling to consumers',
  b2b: 'Selling to businesses',
  b2b2c: 'Through businesses, to consumers',
  marketplace: 'Marketplace or platform',
  subscription: 'Subscription',
  services: 'Services',
  mixed: 'Mixed',
};

export const PRICE_POSITIONS = ['budget', 'mid-market', 'premium', 'luxury'] as const;
export type PricePosition = (typeof PRICE_POSITIONS)[number];

export const PRICE_POSITION_LABEL: Record<PricePosition, string> = {
  budget: 'Budget',
  'mid-market': 'Mid-market',
  premium: 'Premium',
  luxury: 'Luxury',
};

const optionalChoice = <T extends readonly [string, ...string[]]>(
  values: T,
  error: string,
) => z.enum(values, { error }).nullable().default(null);

export const businessProfileSchema = z.object({
  name: z
    .string({ error: 'Give the profile a name' })
    .trim()
    .min(2, { error: 'Give the profile a name' })
    .max(160, { error: 'Keep the name under 160 characters' })
    .transform((value) => value.replace(/\s+/g, ' ')),
  websiteUrl: optionalWebsite,
  description: optionalText(1400),

  homeCountry: z
    .string({ error: 'Choose a country from the list' })
    .trim()
    .toUpperCase()
    .refine(isCountryCode, { error: 'Choose a country from the list' })
    .nullable()
    .default(null),
  industry: optionalText(160),
  offerings: chips(12, 160, 'Enter a product or service'),
  targetCustomers: chips(8, 160, 'Describe a customer group'),
  buyerRoles: chips(8, 120, 'Enter a buyer role'),
  businessModel: optionalChoice(BUSINESS_MODELS, 'Choose how the business sells'),
  pricePositioning: optionalChoice(PRICE_POSITIONS, 'Choose a price position'),
  salesChannels: chips(8, 120, 'Enter a sales channel'),
  tractionStage: optionalChoice(BUSINESS_STATUSES, 'Choose where the business is today'),
  teamCapacity: optionalText(400),
  differentiators: chips(8, 200, 'Enter a differentiator'),
  constraintsNotes: optionalText(1000),
  goals: chips(8, 200, 'Enter a goal'),
  knownCompetitors: chips(10, 120, 'Enter a competitor name'),
  customerEvidence: optionalText(4000),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

/** Field order the profile form renders in; also the export column order. */
export const PROFILE_FIELD_ORDER = Object.freeze(
  Object.keys(businessProfileSchema.shape),
) as readonly (keyof BusinessProfileInput)[];

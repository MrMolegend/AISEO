import { z } from 'zod';

/**
 * The deterministic half of a report.
 *
 * Everything here is *measured* by the crawler. The model is never the source
 * of a value in this file; it only ever reads one. That split is the product's
 * central anti-hallucination mechanism: the model is told what a page says, it
 * does not get to decide.
 *
 * Every array and string is explicitly capped. These caps are not defensive
 * pedantry — they are the token budget. A page with 4,000 links must not become
 * a $40 API call, and twenty-five such pages must not become five hundred.
 */

export const FACT_LIMITS = {
  headingsPerLevel: 30,
  headingLength: 200,
  internalLinks: 100,
  externalLinks: 50,
  imageSamples: 50,
  structuredDataBlocks: 10,
  contentChars: 40_000,
  linkTextLength: 120,
  urlLength: 500,
} as const;

const cappedString = (max: number) => z.string().max(max);

export const metaFactsSchema = z.object({
  title: cappedString(500).nullable(),
  titleLength: z.number().int().min(0),
  description: cappedString(1000).nullable(),
  descriptionLength: z.number().int().min(0),
  canonical: cappedString(FACT_LIMITS.urlLength).nullable(),
  robotsMeta: cappedString(200).nullable(),
  viewport: cappedString(200).nullable(),
  lang: cappedString(20).nullable(),
  charset: cappedString(40).nullable(),
});

export const linkSchema = z.object({
  href: cappedString(FACT_LIMITS.urlLength),
  text: cappedString(FACT_LIMITS.linkTextLength),
  rel: cappedString(100).nullable(),
});

export const imageSchema = z.object({
  src: cappedString(FACT_LIMITS.urlLength),
  alt: cappedString(300).nullable(),
  loading: cappedString(20).nullable(),
  width: cappedString(20).nullable(),
  height: cappedString(20).nullable(),
});

export type MetaFacts = z.infer<typeof metaFactsSchema>;
export type PageLink = z.infer<typeof linkSchema>;
export type PageImage = z.infer<typeof imageSchema>;

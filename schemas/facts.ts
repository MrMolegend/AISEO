import { z } from 'zod';

/**
 * SiteFacts — the deterministic half of an audit.
 *
 * Everything here is *measured* by the retrieval and extraction layers. The AI is
 * never the source of a value in this object; it only ever reads it. That split is
 * the product's central anti-hallucination mechanism: the model is told the title
 * tag is 41 characters, it does not get to decide.
 *
 * Every array and string is explicitly capped. These caps are not defensive
 * pedantry — they are the token budget. A page with 4,000 links must not become a
 * $40 API call.
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
  checkObservedLength: 200,
} as const;

const cappedString = (max: number) => z.string().max(max);

export const checkStatusSchema = z.enum(['pass', 'warn', 'fail', 'unknown']);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

/**
 * A deterministic signal computed from the page, with no interpretation attached.
 * The AI reads these as ground truth; the UI can also render them directly.
 */
export const factCheckSchema = z.object({
  id: z.string().max(60),
  label: z.string().max(80),
  status: checkStatusSchema,
  observed: cappedString(FACT_LIMITS.checkObservedLength),
});
export type FactCheck = z.infer<typeof factCheckSchema>;

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

export const siteFactsSchema = z.object({
  fetchedAt: z.iso.datetime(),
  requestedUrl: cappedString(FACT_LIMITS.urlLength),
  finalUrl: cappedString(FACT_LIMITS.urlLength),
  redirectChain: z.array(cappedString(FACT_LIMITS.urlLength)).max(5),
  httpStatus: z.number().int(),
  responseTimeMs: z.number().int().min(0),
  htmlBytes: z.number().int().min(0),
  isHttps: z.boolean(),
  faviconUrl: cappedString(FACT_LIMITS.urlLength).nullable(),

  meta: metaFactsSchema,
  openGraph: z.record(z.string().max(60), z.string().max(1000)),
  twitterCard: z.record(z.string().max(60), z.string().max(1000)),

  headings: z.object({
    h1: z
      .array(cappedString(FACT_LIMITS.headingLength))
      .max(FACT_LIMITS.headingsPerLevel),
    h2: z
      .array(cappedString(FACT_LIMITS.headingLength))
      .max(FACT_LIMITS.headingsPerLevel),
    h3: z
      .array(cappedString(FACT_LIMITS.headingLength))
      .max(FACT_LIMITS.headingsPerLevel),
  }),
  headingCounts: z.object({
    h1: z.number().int().min(0),
    h2: z.number().int().min(0),
    h3: z.number().int().min(0),
    h4: z.number().int().min(0),
    h5: z.number().int().min(0),
    h6: z.number().int().min(0),
  }),

  content: z.object({
    text: cappedString(FACT_LIMITS.contentChars),
    wordCount: z.number().int().min(0),
    truncated: z.boolean(),
  }),

  links: z.object({
    internal: z.array(linkSchema).max(FACT_LIMITS.internalLinks),
    external: z.array(linkSchema).max(FACT_LIMITS.externalLinks),
    counts: z.object({
      internal: z.number().int().min(0),
      external: z.number().int().min(0),
      nofollow: z.number().int().min(0),
      empty: z.number().int().min(0),
    }),
  }),

  images: z.object({
    sample: z.array(imageSchema).max(FACT_LIMITS.imageSamples),
    counts: z.object({
      total: z.number().int().min(0),
      missingAlt: z.number().int().min(0),
      emptyAlt: z.number().int().min(0),
      lazyLoaded: z.number().int().min(0),
    }),
  }),

  structuredData: z.object({
    types: z.array(z.string().max(80)).max(20),
    blocks: z.array(z.unknown()).max(FACT_LIMITS.structuredDataBlocks),
    parseErrors: z.number().int().min(0),
  }),

  robotsTxt: z.object({
    found: z.boolean(),
    allowsOurAgent: z.boolean(),
    sitemapUrls: z.array(cappedString(FACT_LIMITS.urlLength)).max(10),
  }),

  sitemapXml: z.object({
    found: z.boolean(),
    url: cappedString(FACT_LIMITS.urlLength).nullable(),
  }),

  technical: z.object({
    hasHreflang: z.boolean(),
    hasAmp: z.boolean(),
    inlineStyleCount: z.number().int().min(0),
    scriptCount: z.number().int().min(0),
    externalScriptCount: z.number().int().min(0),
    iframeCount: z.number().int().min(0),
    formCount: z.number().int().min(0),
    hasHttpResourcesOnHttps: z.boolean(),
    /**
     * Heuristic SPA-shell detection: very little text alongside many scripts.
     * V1 fails these audits honestly rather than reporting on an empty shell.
     */
    likelyClientRendered: z.boolean(),
  }),

  checks: z.array(factCheckSchema).max(60),
});

export type SiteFacts = z.infer<typeof siteFactsSchema>;
export type MetaFacts = z.infer<typeof metaFactsSchema>;
export type PageLink = z.infer<typeof linkSchema>;
export type PageImage = z.infer<typeof imageSchema>;

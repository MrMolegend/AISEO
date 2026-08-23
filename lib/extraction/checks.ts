import type { FactCheck } from '@/schemas/facts';
import type { SiteFacts } from '@/schemas/facts';

/**
 * Deterministic pass/warn/fail signals.
 *
 * These carry no interpretation — they state what was observed and whether it
 * meets a widely-agreed threshold. The AI reads them as ground truth and writes
 * the "why it matters" prose; it is never asked to decide whether a 92-character
 * title is long, because that is arithmetic, not judgement.
 *
 * Thresholds are the conventional ones: ~60 characters before Google truncates a
 * title, ~155 for a description, one H1 per document.
 */

export const TITLE_MIN = 20;
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 155;
export const CONTENT_THIN_WORDS = 300;
export const CONTENT_MINIMUM_WORDS = 100;
export const SLOW_RESPONSE_MS = 1_500;
export const VERY_SLOW_RESPONSE_MS = 3_000;
export const LARGE_HTML_BYTES = 150 * 1024;

type FactsForChecks = Omit<SiteFacts, 'checks'>;

const cap = (value: string) => (value.length > 200 ? `${value.slice(0, 197)}…` : value);

export function computeChecks(facts: FactsForChecks): FactCheck[] {
  const checks: FactCheck[] = [];
  const add = (
    id: string,
    label: string,
    status: FactCheck['status'],
    observed: string,
  ) => {
    checks.push({ id, label, status, observed: cap(observed) });
  };

  /* ── Title ─────────────────────────────────────────────────────────── */
  const { title, titleLength } = facts.meta;
  if (!title) {
    add('title-present', 'Title tag present', 'fail', '(absent)');
  } else if (titleLength > TITLE_MAX) {
    add(
      'title-present',
      'Title tag present',
      'warn',
      `${titleLength} characters — above the ~${TITLE_MAX} character display limit`,
    );
  } else if (titleLength < TITLE_MIN) {
    add(
      'title-present',
      'Title tag present',
      'warn',
      `"${title}" — ${titleLength} characters, shorter than typical`,
    );
  } else {
    add('title-present', 'Title tag present', 'pass', `${titleLength} characters`);
  }

  /* ── Meta description ──────────────────────────────────────────────── */
  const { description, descriptionLength } = facts.meta;
  if (!description) {
    add('meta-description-present', 'Meta description present', 'fail', '(absent)');
  } else if (descriptionLength > DESCRIPTION_MAX) {
    add(
      'meta-description-present',
      'Meta description present',
      'warn',
      `${descriptionLength} characters — likely truncated in results`,
    );
  } else if (descriptionLength < DESCRIPTION_MIN) {
    add(
      'meta-description-present',
      'Meta description present',
      'warn',
      `${descriptionLength} characters — shorter than typical`,
    );
  } else {
    add(
      'meta-description-present',
      'Meta description present',
      'pass',
      `${descriptionLength} characters`,
    );
  }

  /* ── Headings ──────────────────────────────────────────────────────── */
  const h1Count = facts.headingCounts.h1;
  if (h1Count === 0) {
    add('h1-count', 'Exactly one H1', 'fail', '0 H1 elements found');
  } else if (h1Count > 1) {
    add('h1-count', 'Exactly one H1', 'warn', `${h1Count} H1 elements found`);
  } else {
    add('h1-count', 'Exactly one H1', 'pass', `1 H1: "${facts.headings.h1[0] ?? ''}"`);
  }

  /* ── Technical fundamentals ────────────────────────────────────────── */
  add(
    'canonical-present',
    'Canonical URL present',
    facts.meta.canonical ? 'pass' : 'fail',
    facts.meta.canonical ?? '(absent)',
  );

  add(
    'viewport-present',
    'Mobile viewport declared',
    facts.meta.viewport ? 'pass' : 'fail',
    facts.meta.viewport ?? '(absent)',
  );

  add(
    'https',
    'Served over HTTPS',
    facts.isHttps ? 'pass' : 'fail',
    facts.isHttps ? 'https' : 'http',
  );

  add(
    'lang-declared',
    'Page language declared',
    facts.meta.lang ? 'pass' : 'fail',
    facts.meta.lang ?? '(absent)',
  );

  if (facts.isHttps) {
    add(
      'mixed-content',
      'No insecure subresources',
      facts.technical.hasHttpResourcesOnHttps ? 'fail' : 'pass',
      facts.technical.hasHttpResourcesOnHttps
        ? 'Page references at least one http:// resource'
        : 'All references use https or relative URLs',
    );
  }

  /* ── Images ────────────────────────────────────────────────────────── */
  const { total, missingAlt } = facts.images.counts;
  if (total === 0) {
    add('image-alt-coverage', 'Image alt coverage', 'unknown', 'No images found');
  } else if (missingAlt === 0) {
    add(
      'image-alt-coverage',
      'Image alt coverage',
      'pass',
      `All ${total} images have alt`,
    );
  } else {
    const proportion = missingAlt / total;
    add(
      'image-alt-coverage',
      'Image alt coverage',
      proportion > 0.25 ? 'fail' : 'warn',
      `${missingAlt} of ${total} images missing alt text`,
    );
  }

  /* ── Discoverability ───────────────────────────────────────────────── */
  add(
    'structured-data',
    'Structured data present',
    facts.structuredData.types.length > 0 ? 'pass' : 'fail',
    facts.structuredData.types.length > 0
      ? facts.structuredData.types.join(', ')
      : '(none found)',
  );

  if (facts.structuredData.parseErrors > 0) {
    add(
      'structured-data-valid',
      'Structured data parses',
      'fail',
      `${facts.structuredData.parseErrors} block(s) failed to parse as JSON`,
    );
  }

  add(
    'robots-txt',
    'robots.txt reachable',
    facts.robotsTxt.found ? 'pass' : 'warn',
    facts.robotsTxt.found
      ? `Found, references ${facts.robotsTxt.sitemapUrls.length} sitemap(s)`
      : 'Not found',
  );

  add(
    'sitemap',
    'XML sitemap declared',
    facts.sitemapXml.found ? 'pass' : 'warn',
    facts.sitemapXml.url ?? '(none declared in robots.txt)',
  );

  /* ── Content volume ────────────────────────────────────────────────── */
  const words = facts.content.wordCount;
  add(
    'content-volume',
    'Sufficient indexable text',
    words < CONTENT_MINIMUM_WORDS ? 'fail' : words < CONTENT_THIN_WORDS ? 'warn' : 'pass',
    `${words} words`,
  );

  /* ── Speed proxies ─────────────────────────────────────────────────── */
  add(
    'response-time',
    'Server response time',
    facts.responseTimeMs > VERY_SLOW_RESPONSE_MS
      ? 'fail'
      : facts.responseTimeMs > SLOW_RESPONSE_MS
        ? 'warn'
        : 'pass',
    `${facts.responseTimeMs}ms`,
  );

  add(
    'page-weight',
    'HTML document size',
    facts.htmlBytes > LARGE_HTML_BYTES * 2
      ? 'fail'
      : facts.htmlBytes > LARGE_HTML_BYTES
        ? 'warn'
        : 'pass',
    `${Math.round(facts.htmlBytes / 1024)} KB of HTML`,
  );

  /* ── Rendering ─────────────────────────────────────────────────────── */
  if (facts.technical.likelyClientRendered) {
    add(
      'client-rendered',
      'Content present in served HTML',
      'fail',
      `Only ${words} words with ${facts.technical.externalScriptCount} external scripts — content is likely rendered in the browser`,
    );
  }

  /* ── Links ─────────────────────────────────────────────────────────── */
  if (facts.links.counts.empty > 0) {
    add(
      'empty-links',
      'Links have descriptive text',
      'warn',
      `${facts.links.counts.empty} link(s) with no text or accessible name`,
    );
  }

  return checks.slice(0, 60);
}

import 'server-only';
import type { ZodType } from 'zod';
import type { SourceRegistry } from '@/lib/crawl/source-registry';
import { extractSourceRefs } from '@/lib/crawl/source-registry';

/**
 * Output validation for research reports.
 *
 * Three passes, in order, because each depends on the last:
 *
 *   1. Zod. Shape and length. Non-strict tool schemas are advisory, so this is
 *      the first point at which the shape is actually guaranteed.
 *   2. Cross-reference. Every cited source must exist; every factual claim must
 *      cite something or be labelled as an inference. This is what a JSON
 *      schema fundamentally cannot express, and it is the check that stops a
 *      confident, well-formed, entirely unattributable report.
 *   3. Sanitisation. Strip markup, links and anything that reads like an
 *      injected instruction that survived. Mutating rather than rejecting,
 *      because a stray angle bracket should not cost the user a report.
 *
 * Failures come back as a list of human-readable problems rather than an
 * exception, because that list is exactly what the repair prompt needs.
 */

export type ValidationOutcome<T> =
  { ok: true; report: T; sanitizedFields: string[] } | { ok: false; problems: string[] };

const MAX_REPORTED_PROBLEMS = 12;

/**
 * Language that asserts a problem the evidence cannot support.
 *
 * The product rule is that public evidence shows something *consistent with* a
 * need, not the need itself. "They have no CRM" is a claim about a company's
 * internals that no public page establishes; "no CRM is mentioned on their
 * site" is a claim about a page. This catches the first kind.
 */
const ASSERTED_PROBLEM_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\bthey (?:have|has) no\b/i,
    hint: 'asserts an absence as fact; use "no evidence of X was found" or "may lack"',
  },
  {
    pattern: /\bthey are (?:not |un)(?:using|aware|equipped)\b/i,
    hint: 'asserts an internal fact; phrase it as what the sources do or do not show',
  },
  {
    pattern: /\b(?:clearly|obviously|definitely) (?:need|lack|struggl)/i,
    hint: 'overstates certainty; public evidence supports "may need" at most',
  },
  {
    pattern: /\bis losing (?:money|customers|market share)\b/i,
    hint: 'asserts private commercial information',
  },
];

/** Markup, scripts and links have no business in report text. */
const MARKUP_PATTERN = /<\/?[a-z][^>]{0,200}>/gi;
const SCRIPT_URI_PATTERN = /\b(?:javascript|data|vbscript|file):/gi;
/**
 * Matches a markdown link, allowing one level of nested parentheses in the
 * target. Without that, `[text](javascript:alert(1))` matches only as far as
 * the inner `)` and leaves a stray bracket behind in the output.
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]{1,200})\]\((?:[^()]|\([^()]{0,200}\)){0,500}\)/g;

/**
 * Phrases that only appear when someone is talking to the model rather than
 * about a business. If one survives into the output, a page's injected text
 * has influenced the report and the reader should not see it presented as
 * analysis.
 */
const INJECTION_ECHO_PATTERN =
  /\b(?:ignore (?:all |any )?(?:previous|prior|above) instructions?|disregard (?:the |your )?(?:above|previous|system)|you are now|system prompt|new instructions?:)/gi;

export interface SanitiseState {
  fields: string[];
}

/**
 * Recursively scrubs every string in the report.
 *
 * Walks the whole object rather than a list of known fields, because the list
 * would need updating every time a schema gains a field, and the one that got
 * missed would be the one that mattered.
 */
/**
 * Exported so the market-entry validator uses this exact walker rather than a
 * second copy. Sanitisation that exists twice is sanitisation that diverges,
 * and the copy that gets missed is the one handling the report a customer
 * actually reads.
 */
export function sanitiseDeep(
  value: unknown,
  path: string,
  state: SanitiseState,
): unknown {
  if (typeof value === 'string') {
    let cleaned = value;

    cleaned = cleaned.replace(MARKUP_PATTERN, '');
    // Links first: keep the text, drop the target. The text is usually
    // meaningful, and the target is either already a cited source or something
    // we never checked. This has to run before the script-URI strip, or a
    // `javascript:` target is removed and the link pattern no longer matches
    // what is left.
    cleaned = cleaned.replace(MARKDOWN_LINK_PATTERN, '$1');
    cleaned = cleaned.replace(SCRIPT_URI_PATTERN, '');
    cleaned = cleaned.replace(INJECTION_ECHO_PATTERN, '[removed]');

    if (cleaned !== value) state.fields.push(path);
    return cleaned;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => sanitiseDeep(item, `${path}[${i}]`, state));
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      // URLs are validated by shape at the schema and are meant to contain the
      // characters the scrubber removes.
      out[key] = /url|website|href/i.test(key)
        ? inner
        : sanitiseDeep(inner, path ? `${path}.${key}` : key, state);
    }
    return out;
  }

  return value;
}

/** Collects every `sources` array in the report, with the path that held it. */
function collectSourceArrays(
  value: unknown,
  path: string,
  found: Array<{ path: string; refs: string[]; basis?: string }>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectSourceArrays(item, `${path}[${i}]`, found));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.sources)) {
    found.push({
      path: path || 'report',
      refs: record.sources.filter((r): r is string => typeof r === 'string'),
      basis: typeof record.basis === 'string' ? record.basis : undefined,
    });
  }

  for (const [key, inner] of Object.entries(record)) {
    if (key === 'sources') continue;
    collectSourceArrays(inner, path ? `${path}.${key}` : key, found);
  }
}

/** Every string value in the report, with its path. */
function collectStrings(
  value: unknown,
  path: string,
  found: Array<{ path: string; text: string }>,
): void {
  if (typeof value === 'string') {
    found.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, found));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      collectStrings(inner, path ? `${path}.${key}` : key, found);
    }
  }
}

/**
 * Cross-reference rules, checked after Zod.
 *
 * These are the constraints a JSON schema cannot state: relationships between
 * fields, and relationships between the report and the registry it was built
 * from.
 */
export function crossReferenceReport(
  report: unknown,
  registry: SourceRegistry,
): string[] {
  const problems: string[] = [];

  const sourceArrays: Array<{ path: string; refs: string[]; basis?: string }> = [];
  collectSourceArrays(report, '', sourceArrays);

  for (const entry of sourceArrays) {
    for (const ref of entry.refs) {
      if (!registry.has(ref)) {
        problems.push(
          `${entry.path}.sources cites ${ref}, which is not one of the sources provided. Use only the identifiers from the source list.`,
        );
      }
    }

    // A claim with no sources is only acceptable when it is labelled as one of
    // the two things that legitimately have none.
    if (
      entry.refs.length === 0 &&
      entry.basis !== undefined &&
      entry.basis !== 'inferred' &&
      entry.basis !== 'unavailable'
    ) {
      problems.push(
        `${entry.path} has basis "${entry.basis}" but cites no sources. Anything measured or sourced must name where it came from; otherwise set basis to "inferred".`,
      );
    }
  }

  // Source references mentioned in prose must exist too — a citation inside a
  // sentence is still a citation, and a dangling one still misleads.
  const strings: Array<{ path: string; text: string }> = [];
  collectStrings(report, '', strings);

  for (const { path, text } of strings) {
    if (path.includes('sources')) continue;
    for (const ref of extractSourceRefs(text)) {
      if (!registry.has(ref)) {
        problems.push(
          `${path} mentions ${ref}, which is not one of the sources provided.`,
        );
        break;
      }
    }

    for (const { pattern, hint } of ASSERTED_PROBLEM_PATTERNS) {
      if (pattern.test(text)) {
        problems.push(`${path} ${hint}. Rewrite it to describe what the sources show.`);
        break;
      }
    }
  }

  return problems;
}

/** Item-level uniqueness and ranking rules, applied where a report has lists. */
export function checkListIntegrity(report: unknown): string[] {
  const problems: string[] = [];
  const record = report as Record<string, unknown>;

  for (const key of ['competitors', 'leads', 'creators'] as const) {
    const list = record[key];
    if (!Array.isArray(list) || list.length === 0) continue;

    const ids = new Set<string>();
    const domains = new Set<string>();
    const ranks: number[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;

      if (typeof entry.id === 'string') {
        if (ids.has(entry.id)) {
          problems.push(`${key} contains two entries with the id "${entry.id}".`);
        }
        ids.add(entry.id);
      }

      if (typeof entry.rank === 'number') ranks.push(entry.rank);

      // Deduplicate by domain as well as id: the same company under two brand
      // names is one entry, not two that appear to corroborate a market.
      const website = typeof entry.website === 'string' ? entry.website : null;
      if (website) {
        const domain = safeDomain(website);
        if (domain) {
          if (domains.has(domain)) {
            problems.push(
              `${key} lists ${domain} more than once. Deduplicate by organisation and domain.`,
            );
          }
          domains.add(domain);
        }
      }
    }

    const sorted = [...ranks].sort((a, b) => a - b);
    const contiguous = sorted.every((rank, i) => rank === i + 1);
    if (ranks.length > 0 && !contiguous) {
      problems.push(
        `${key} ranks must run 1..${ranks.length} with no gaps or duplicates; got ${sorted.join(', ')}.`,
      );
    }
  }

  return problems;
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Runs the full validation chain.
 *
 * Sanitisation happens last and after the checks, so a scrubbed string cannot
 * turn a failing report into a passing one — if injected text was removed, the
 * report still had to have been valid with it present.
 */
export function validateReport<T>(
  raw: unknown,
  schema: ZodType<T>,
  registry: SourceRegistry,
): ValidationOutcome<T> {
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, MAX_REPORTED_PROBLEMS)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return { ok: false, problems };
  }

  const problems = [
    ...crossReferenceReport(parsed.data, registry),
    ...checkListIntegrity(parsed.data),
  ];

  if (problems.length > 0) {
    return { ok: false, problems: problems.slice(0, MAX_REPORTED_PROBLEMS) };
  }

  const state: SanitiseState = { fields: [] };
  const sanitised = sanitiseDeep(parsed.data, '', state) as T;

  return { ok: true, report: sanitised, sanitizedFields: state.fields };
}

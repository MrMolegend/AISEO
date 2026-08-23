import type { AuditAnalysis } from '@/schemas/audit';

/**
 * Output-side scrubbing.
 *
 * This is the last line of the prompt-injection defence and the one that makes
 * the others survivable. Even a fully successful injection can, at worst, make
 * the model write strange prose — it cannot emit markup, a link to an attacker's
 * domain, or anything the report renderer will treat as anything but text.
 *
 * Nothing here throws. A scrubbed string is preferable to a failed audit, and
 * the validation layer records what was changed.
 */

export interface SanitizeReport {
  fieldsModified: string[];
}

const TAG_LIKE = /<\s*\/?\s*[a-z][a-z0-9-]*(?:\s[^>]*)?>/gi;
const DANGEROUS_SCHEME = /\b(?:javascript|data|vbscript|file|blob)\s*:/gi;
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
const HTML_ENTITY_SCRIPT = /&lt;\s*\/?\s*script/gi;

/** Bare URLs, so off-domain ones can be judged individually. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

function scrubString(value: string, allowedHosts: Set<string>): string {
  let out = value;

  // Markup of any kind: the report renders AI text as React children only, so
  // this is belt-and-braces rather than the sole protection.
  out = out.replace(TAG_LIKE, ' ');
  out = out.replace(HTML_ENTITY_SCRIPT, 'script');
  out = out.replace(DANGEROUS_SCHEME, '');

  // Markdown links keep their label and lose their destination — the label is
  // usually the meaningful half, and we never render markdown anyway.
  out = out.replace(MARKDOWN_LINK, '$1');

  // A URL pointing anywhere other than the audited domain is either a
  // hallucination or an injected destination. Neither belongs in the report.
  out = out.replace(URL_PATTERN, (match) => {
    try {
      const host = new URL(match).hostname.replace(/^www\./, '');
      return allowedHosts.has(host) ? match : '[link removed]';
    } catch {
      return '[link removed]';
    }
  });

  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Walks the analysis, scrubbing every string.
 *
 * Generic rather than field-by-field: a field added to the schema later is
 * covered automatically, which is exactly the failure mode a hand-written list
 * would have.
 */
export function sanitizeAnalysis(
  analysis: AuditAnalysis,
  auditedDomain: string,
): { analysis: AuditAnalysis; report: SanitizeReport } {
  const allowedHosts = new Set([auditedDomain.replace(/^www\./, '')]);
  const fieldsModified: string[] = [];

  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === 'string') {
      const scrubbed = scrubString(value, allowedHosts);
      if (scrubbed !== value) fieldsModified.push(path);
      return scrubbed;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        out[key] = walk(inner, path ? `${path}.${key}` : key);
      }
      return out;
    }
    return value;
  };

  return {
    analysis: walk(analysis, '') as AuditAnalysis,
    report: { fieldsModified },
  };
}

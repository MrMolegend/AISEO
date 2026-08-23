import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

/**
 * HTML parsing with hostile-input hardening.
 *
 * The document comes from a stranger's server, and part of it is going to be
 * placed in an AI prompt. Two categories are removed before any text is read:
 *
 *   · Executable and styling content (script, style, noscript, template) —
 *     never page content, and the usual home of injected instructions.
 *   · Hidden content ([hidden], aria-hidden, inline display:none, .sr-only-style
 *     off-screen positioning) — text a human visitor never sees, which makes it
 *     the natural place to plant "ignore your instructions" for a machine reader.
 *
 * Removing these is not the whole prompt-injection defence — the nonce-delimited
 * data block and output-side validation do the real work — but it removes the
 * cheapest attack for free, and it also improves audit quality by keeping
 * invisible boilerplate out of the word count.
 */

const STRIPPED_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'object',
  'embed',
];

/** Inline styles that take an element out of the visual flow entirely. */
const HIDDEN_STYLE =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/i;

/** Off-screen positioning, the classic way to hide text from humans only. */
const OFFSCREEN_STYLE =
  /(?:^|;)\s*(?:left|top|text-indent)\s*:\s*-\s*(?:[5-9]\d{2,}|\d{4,})\s*(?:px|em|rem)/i;

export interface ParsedDocument {
  /** Full document, for structural counts that should include hidden nodes. */
  raw: CheerioAPI;
  /** Content-stripped document, for text extraction. */
  visible: CheerioAPI;
}

export function parseHtml(html: string): ParsedDocument {
  // `raw` keeps everything: counts of scripts, iframes and forms are facts about
  // the page and must not be affected by what we strip for text.
  const raw = cheerio.load(html);

  const visible = cheerio.load(html);
  visible(STRIPPED_TAGS.join(',')).remove();
  visible('[hidden]').remove();
  visible('[aria-hidden="true"]').remove();

  visible('[style]').each((_, element) => {
    const style = visible(element).attr('style') ?? '';
    if (HIDDEN_STYLE.test(style) || OFFSCREEN_STYLE.test(style)) {
      visible(element).remove();
    }
  });

  // Comments can carry anything and are never rendered.
  visible('*')
    .contents()
    .filter((_, node) => node.type === 'comment')
    .remove();

  return { raw, visible };
}

/** Collapses whitespace and trims. Used on every string that reaches the AI. */
export function normalizeText(input: string | undefined | null): string {
  if (!input) return '';
  return input.replace(/\s+/g, ' ').trim();
}

/** Normalises and truncates, appending nothing — callers record truncation. */
export function capText(input: string, max: number): string {
  const normalized = normalizeText(input);
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

/**
 * Resolves a possibly-relative URL against the page.
 *
 * Returns null rather than throwing on anything unresolvable, including the
 * javascript: and data: schemes that appear in href attributes.
 */
export function resolveUrl(href: string, base: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(?:javascript|data|mailto|tel|sms|blob|file):/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

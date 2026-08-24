import 'server-only';
import { USER_AGENT } from '@/lib/security/safe-fetch';
import { assertHostnameResolvesPublicly } from '@/lib/security/ssrf-guard';
import { request } from 'undici';

/**
 * robots.txt handling.
 *
 * We honour Disallow rules for our own agent. That is a deliberate product
 * decision rather than a legal requirement: this is a tool in a field where
 * reputation matters, our crawl is small and bounded, and being the kind of bot
 * that ignores robots.txt is not a position worth defending.
 *
 * The parse is intentionally small — group selection, Allow/Disallow, longest
 * match wins, `$` and `*` wildcards — which is the subset that decides whether
 * a page may be fetched. It is not a general-purpose robots parser.
 */

export const OUR_AGENT_TOKEN = 'researchsuitebot';

export interface RobotsResult {
  found: boolean;
  /** Whether our agent may fetch the path we intend to read. */
  allowsOurAgent: boolean;
  sitemapUrls: string[];
}

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobotsTxt(text: string): {
  groups: RobotsGroup[];
  sitemaps: string[];
} {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];

  let current: RobotsGroup | null = null;
  // Consecutive User-agent lines share one rule block; a rule line ends the run.
  let collectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }

    if (field === 'user-agent') {
      if (!collectingAgents || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (field === 'allow' || field === 'disallow') {
      if (!current) continue; // rule before any user-agent line: ignore
      collectingAgents = false;
      current.rules.push({ allow: field === 'allow', path: value });
    }
  }

  return { groups, sitemaps };
}

/** Converts a robots path pattern into a regex, honouring `*` and `$`. */
function patternToRegex(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]!;
    if (char === '*') {
      source += '.*';
    } else if (char === '$' && i === pattern.length - 1) {
      source += '$';
    } else {
      source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}`);
}

/**
 * Applies the standard precedence: the most specific group wins, and within it
 * the longest matching rule wins, with Allow beating Disallow on a tie.
 */
export function isPathAllowed(
  text: string,
  path: string,
  agentToken = OUR_AGENT_TOKEN,
): boolean {
  const { groups } = parseRobotsTxt(text);
  if (groups.length === 0) return true;

  const exact = groups.filter((g) => g.agents.some((a) => a.includes(agentToken)));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const applicable = exact.length > 0 ? exact : wildcard;

  if (applicable.length === 0) return true;

  let best: { allow: boolean; length: number } | null = null;

  for (const group of applicable) {
    for (const rule of group.rules) {
      // An empty Disallow means "allow everything" and matches nothing.
      if (rule.path === '') {
        if (!rule.allow) continue;
        continue;
      }
      if (!patternToRegex(rule.path).test(path)) continue;

      const length = rule.path.length;
      if (
        best === null ||
        length > best.length ||
        (length === best.length && rule.allow && !best.allow)
      ) {
        best = { allow: rule.allow, length };
      }
    }
  }

  return best ? best.allow : true;
}

/**
 * Fetches and evaluates robots.txt for a target URL.
 *
 * A missing, unreachable or malformed robots.txt means "no restrictions stated",
 * which is the correct reading of the standard — an unreachable file must not
 * block an audit the site owner asked for.
 */
export async function checkRobots(targetUrl: string): Promise<RobotsResult> {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.origin}/robots.txt`;

  try {
    await assertHostnameResolvesPublicly(url.hostname);

    const response = await request(robotsUrl, {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT, accept: 'text/plain' },
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    });

    if (response.statusCode >= 400) {
      response.body.dump().catch(() => {});
      return { found: false, allowsOurAgent: true, sitemapUrls: [] };
    }

    // robots.txt is capped at 500KB by convention; ours is far tighter since we
    // only need the directives, and a huge file is a sign of something odd.
    const text = (await response.body.text()).slice(0, 100_000);
    const { sitemaps } = parseRobotsTxt(text);

    return {
      found: true,
      allowsOurAgent: isPathAllowed(text, url.pathname || '/'),
      sitemapUrls: sitemaps.slice(0, 10),
    };
  } catch {
    // Unreachable robots.txt is not a reason to refuse an audit.
    return { found: false, allowsOurAgent: true, sitemapUrls: [] };
  }
}

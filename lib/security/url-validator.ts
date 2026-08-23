/**
 * Syntactic URL validation and normalisation.
 *
 * Deliberately isomorphic — no Node APIs, no DNS — so the landing page form and
 * the API route run the *same* rules and a user never gets accepted on the
 * client only to be rejected on the server.
 *
 * This layer answers "is this a well-formed, plausibly public web address?".
 * Whether it actually resolves to a public IP is the SSRF guard's job
 * (lib/security/ssrf-guard.ts, server-only).
 */

export type UrlRejectionReason =
  | 'empty'
  | 'malformed'
  | 'unsupported-scheme'
  | 'has-credentials'
  | 'unsupported-port'
  | 'not-public-hostname'
  | 'too-long';

export interface UrlValidationSuccess {
  ok: true;
  /** Fully normalised absolute URL, safe to fetch and to use as a cache key. */
  normalized: string;
  hostname: string;
  /** Registrable display form: no protocol, no www, no trailing slash. */
  domain: string;
}

export interface UrlValidationFailure {
  ok: false;
  reason: UrlRejectionReason;
}

export type UrlValidationResult = UrlValidationSuccess | UrlValidationFailure;

export interface UrlValidationOptions {
  /**
   * Permit ports other than 80 and 443.
   *
   * Local test servers bind ephemeral ports, so the integration suite needs
   * this. It is never enabled in production: allowing arbitrary ports would turn
   * the audit endpoint into a port scanner pointed at whatever the fetcher can
   * reach.
   */
  allowNonStandardPorts?: boolean;
}

export const MAX_URL_LENGTH = 500;

/** Only these ports are reachable; anything else is a scan attempt or a typo. */
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Hostnames that are never public, checked before DNS. This is a fast-fail
 * convenience — the authoritative check is IP-based in the SSRF guard, because
 * a hostname denylist alone is trivially bypassed with a custom DNS record.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

const BLOCKED_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
  '.onion',
  '.test',
  '.invalid',
];

/**
 * Query parameters stripped during normalisation.
 *
 * These identify a *visit*, not a *page*. Removing them means the same page
 * arriving with different campaign tags produces one cache key and one audit
 * rather than several — which is a direct saving on AI spend.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^msclkid$/i,
  /^mc_[ce]id$/i,
  /^igshid$/i,
  /^ref$/i,
  /^referrer$/i,
  /^_hs[a-z]*$/i,
  /^vero_/i,
  /^yclid$/i,
  /^ttclid$/i,
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAMS.some((pattern) => pattern.test(key));
}

/**
 * A hostname must have at least one dot and a plausible TLD. This rejects bare
 * words ("router", "intranet") that would otherwise resolve on an internal
 * network.
 */
function hasPublicShape(hostname: string): boolean {
  if (!hostname.includes('.')) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
  if (hostname.includes('..')) return false;

  const labels = hostname.split('.');
  const tld = labels[labels.length - 1];
  if (!tld) return false;

  // A numeric final label means this is an IPv4 literal. Allowed syntactically —
  // the SSRF guard decides whether the address itself is public.
  if (/^\d+$/.test(tld)) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  }

  return /^[a-z]{2,63}$/i.test(tld);
}

/**
 * Normalises and validates a user-supplied address.
 *
 * Accepts the forms people actually type: "example.com", "www.example.com/path",
 * "HTTPS://Example.com". Always returns an absolute, lowercase-host URL.
 */
export function validateAndNormalizeUrl(
  input: string,
  options: UrlValidationOptions = {},
): UrlValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: 'too-long' };

  // Reject a scheme we don't support *before* prefixing, so "javascript:alert(1)"
  // cannot be rescued into "https://javascript:alert(1)".
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, reason: 'unsupported-scheme' };
    }
  }

  // A protocol-relative "//example.com" is ambiguous; treat it as https.
  const withScheme = schemeMatch ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported-scheme' };
  }

  // Credentials in a URL are a redirect-confusion vector and never legitimate here.
  if (url.username || url.password) {
    return { ok: false, reason: 'has-credentials' };
  }

  if (!options.allowNonStandardPorts && !ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: 'unsupported-port' };
  }

  /*
   * URL has already lowercased the hostname, punycoded any unicode, and — this
   * part is load-bearing for SSRF — expanded legacy IPv4 encodings into a
   * canonical dotted quad. "2130706433", "0x7f.0.0.1" and "127.1" all arrive
   * here as "127.0.0.1", so the address check downstream sees the true
   * destination rather than an obfuscated string it would not recognise.
   *
   * The trailing dot is stripped separately: "example.com." is a valid FQDN that
   * would otherwise slip past naive suffix matching.
   */
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase();
  if (!hostname) return { ok: false, reason: 'malformed' };

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: 'not-public-hostname' };
  }
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: 'not-public-hostname' };
  }
  if (!hasPublicShape(hostname)) {
    return { ok: false, reason: 'not-public-hostname' };
  }

  // ── Normalise ───────────────────────────────────────────────────────────
  url.hostname = hostname;
  url.hash = '';
  // Default ports are implied by the scheme; keeping them splits the cache key.
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  // Stable ordering so ?b=2&a=1 and ?a=1&b=2 are one cache key.
  url.searchParams.sort();

  if (url.pathname === '') url.pathname = '/';

  const normalized = url.toString();
  if (normalized.length > MAX_URL_LENGTH) return { ok: false, reason: 'too-long' };

  return {
    ok: true,
    normalized,
    hostname,
    domain: hostname.replace(/^www\./, ''),
  };
}

/** User-facing copy for each rejection reason. */
export const URL_REJECTION_MESSAGES: Record<UrlRejectionReason, string> = {
  empty: 'Enter a website address to audit.',
  malformed: "That doesn't look like a valid website address.",
  'unsupported-scheme': 'Only http and https addresses can be audited.',
  'has-credentials': 'Remove the username and password from the address.',
  'unsupported-port': 'Only standard web ports (80 and 443) can be audited.',
  'not-public-hostname': 'Enter a public website address, like example.com.',
  'too-long': 'That address is too long.',
};

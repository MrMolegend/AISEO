/**
 * The Content-Security-Policy header.
 *
 * Lives here rather than inline in next.config.ts because a CSP is a security
 * control, and a security control that cannot be tested is a security control
 * nobody can be sure of. Every directive below is asserted in
 * tests/unit/csp.test.ts.
 *
 * Deliberately free of imports. next.config.ts loads this outside the module
 * graph the rest of the application is built into: no `server-only`, no env
 * validation, nothing that assumes a request. Values arrive as arguments so a
 * test can construct any deployment shape without touching process.env.
 *
 * `'unsafe-inline'` on style-src is required by Next's inlined critical CSS and
 * by React's style attributes; we compensate by banning
 * dangerouslySetInnerHTML at the lint level, so no untrusted string ever
 * reaches the DOM as markup. `'unsafe-eval'` is development-only — React
 * Refresh needs it.
 */

export interface CspOptions {
  /** True in `next dev`. Relaxes script-src and opens the HMR socket. */
  isDev: boolean;
  /**
   * The Supabase project URL, exactly as configured. Only its origin is used.
   * Absent or unparseable means no Supabase allowance is emitted at all.
   */
  supabaseUrl?: string | null | undefined;
}

/**
 * The single origin a browser may talk to Supabase on.
 *
 * `URL.origin` is doing the security work here: it is scheme + host + port and
 * nothing else, so a value carrying a path, a query, a fragment or — the case
 * that matters — embedded credentials cannot smuggle any of that into a
 * response header. `https://user:key@project.supabase.co/rest/v1` reduces to
 * `https://project.supabase.co`.
 *
 * Returns null rather than throwing. A malformed URL should degrade to "no
 * allowance", which is a visible sign-in failure, rather than take the whole
 * build down with a config parse error — and the caller cannot usefully
 * recover from a throw here anyway.
 */
export function browserOriginOf(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // A CSP source expression is scheme-matched. Anything that is not fetched
  // over http(s) by the browser has no business in connect-src, and a
  // `javascript:` or `data:` value reaching a header would be worse than
  // useless.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // "null" is what URL.origin yields for opaque origins. It is also a literal
  // CSP keyword, so emitting it would be actively wrong.
  if (url.origin === 'null') return null;

  return url.origin;
}

/**
 * connect-src.
 *
 * This is the directive that broke production sign-in: `supabase-js` calls
 * `/auth/v1/otp` from the browser, and with `'self'` alone the request never
 * left the page — the form could only report a generic failure, because from
 * its point of view the fetch simply failed.
 *
 * The origin is added, and only the origin. Not `https:`, not
 * `*.supabase.co`, not a hardcoded project ref: a wildcard would let injected
 * script exfiltrate to any host under it, which is precisely the class of
 * attack connect-src exists to stop, and a hardcoded ref would silently point
 * every deployment at one project.
 *
 * Nothing is added for Anthropic, Tavily or Upstash. Those are called from the
 * server, where CSP does not apply; adding them would widen the browser's
 * reach for no reason at all.
 */
function connectSrc(options: CspOptions): string {
  const sources = ["'self'"];

  const supabase = browserOriginOf(options.supabaseUrl);
  if (supabase) sources.push(supabase);

  // Realtime is deliberately absent. A wss: origin would be a second source,
  // and this application never opens a Supabase realtime channel. Add it here
  // if that changes — the failure would look identical to this one.
  if (options.isDev) sources.push('ws:', 'http://localhost:*');

  return `connect-src ${sources.join(' ')}`;
}

export function contentSecurityPolicy(options: CspOptions): string {
  const { isDev } = options;

  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    // Favicons and logos for the businesses a report covers are rendered from
    // their own origins.
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    connectSrc(options),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

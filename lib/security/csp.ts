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

/**
 * The Supabase project origin this application is deployed against.
 *
 * Hardcoded on purpose, as the value used whenever the environment does not
 * supply a usable one. The first attempt at this fix derived the origin from
 * `NEXT_PUBLIC_SUPABASE_URL` alone and shipped a policy with no Supabase
 * source at all, because `headers()` is evaluated during the build and that
 * variable was not in the build environment. The failure mode is silent in the
 * build and total in the browser: every sign-in blocked, with only a generic
 * error to show for it. A constant cannot fail that way.
 *
 * This is not a credential. It is the public API origin of a Supabase project
 * — the same string the client bundle already ships to every visitor, and the
 * host name in every request the browser makes. Nothing here authorises
 * anything: reaching this origin still requires the publishable key, and every
 * table behind it is governed by row-level security. A key or a service-role
 * secret must never appear in this file, and the tests assert that they do not.
 */
export const DEFAULT_SUPABASE_ORIGIN = 'https://euyhkmtxdigdnvmboebf.supabase.co';

export interface CspOptions {
  /** True in `next dev`. Relaxes script-src and opens the HMR socket. */
  isDev: boolean;
  /**
   * The Supabase project URL, as configured. Only its origin is used, and an
   * absent or unusable value falls back to DEFAULT_SUPABASE_ORIGIN — the
   * browser must be able to reach Supabase whatever the build environment
   * happened to contain.
   */
  supabaseUrl?: string | null | undefined;
}

/**
 * What a CSP source expression is allowed to look like coming out of here.
 *
 * A header value is copied verbatim into an HTTP response, so a string
 * carrying a space, a semicolon or a newline would not merely be wrong — it
 * would add or terminate directives, or split the response. `URL.origin`
 * already yields only scheme, host and port, and the URL parser percent-encodes
 * or rejects everything else; this pattern makes that guarantee structural
 * rather than inherited, so a change in the parser's behaviour cannot quietly
 * become a header-injection bug.
 */
const SAFE_ORIGIN = /^https?:\/\/[A-Za-z0-9.\-[\]:%]+$/;

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

  // Belt and braces. Nothing that reaches here should be able to fail this,
  // which is exactly why it is worth asserting before the value becomes a
  // response header.
  if (!SAFE_ORIGIN.test(url.origin)) return null;

  return url.origin;
}

/**
 * The Supabase origin the browser is allowed to reach, always.
 *
 * Note that this falls back on an *unusable* value, not merely a missing one.
 * `??` in the caller covers undefined; a variable that is set but malformed —
 * a bare hostname, a typo, a `postgres://` connection string pasted into the
 * wrong field — would otherwise produce no allowance and break sign-in exactly
 * as before. A misconfigured value should not be able to take the origin away.
 */
/**
 * Resolved at module load, so a typo in the constant is a loud build failure
 * rather than a policy that quietly ships with no Supabase source — which is
 * the exact failure this fallback exists to prevent.
 */
const FALLBACK_ORIGIN: string = (() => {
  const origin = browserOriginOf(DEFAULT_SUPABASE_ORIGIN);
  if (origin === null) {
    throw new Error('DEFAULT_SUPABASE_ORIGIN is not a usable http(s) origin');
  }
  return origin;
})();

export function supabaseConnectOrigin(value: string | null | undefined): string {
  return browserOriginOf(value) ?? FALLBACK_ORIGIN;
}

/**
 * connect-src.
 *
 * This is the directive that broke production sign-in: `supabase-js` calls
 * `/auth/v1/otp` from the browser, and with `'self'` alone the request never
 * left the page — the form could only report a generic failure, because from
 * its point of view the fetch simply failed.
 *
 * One origin is added, and only one. Not `https:`, not `*.supabase.co`, not a
 * wildcard of any kind: a wildcard would let injected script exfiltrate to any
 * host beneath it, which is precisely the class of attack connect-src exists
 * to stop. A single named host widens the page's reach by exactly that host.
 *
 * Nothing is added for Anthropic, Tavily or Upstash. Those are called from the
 * server, where CSP does not apply; adding them would widen the browser's
 * reach for no reason at all.
 */
function connectSrc(options: CspOptions): string {
  const sources = ["'self'", supabaseConnectOrigin(options.supabaseUrl)];

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

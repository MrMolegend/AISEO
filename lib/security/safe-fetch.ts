import 'server-only';
import { Agent, buildConnector, request as undiciRequest, type Dispatcher } from 'undici';
import { PlatformError } from '@/lib/errors';
import { assertAddressIsPublic, assertHostnameResolvesPublicly } from './ssrf-guard';
import { validateAndNormalizeUrl } from './url-validator';
import { localTestingEnabled } from './local-testing';
import { ACCEPT_ENCODING, readDecodedBody } from './decode-body';

/**
 * Hardened HTTP client for fetching untrusted, user-nominated pages.
 *
 * Everything here exists because the target is chosen by a stranger:
 *
 *   · Redirects are handled manually. Letting undici follow them re-opens the
 *     entire SSRF hole, because only the first hop would ever be validated.
 *   · Each hop is re-validated from scratch: scheme, port, hostname, DNS.
 *   · The socket's real peer address is checked at connect time, which is the
 *     only thing that closes the DNS-rebinding race — a pre-flight lookup can be
 *     answered with a public address and the connect lookup with 169.254.169.254.
 *   · The body is read as a stream and abandoned past a byte ceiling, so a
 *     multi-gigabyte response cannot exhaust memory.
 *   · Compressed responses are decoded before anything looks at them, under a
 *     separate ceiling — see lib/security/decode-body.ts. Every byte figure
 *     below means decoded content bytes.
 */

export const FETCH_LIMITS = {
  /** Ceiling on *decoded* HTML. 2 MB of markup is already pathological. */
  maxBytes: 2 * 1024 * 1024,
  /**
   * Ceiling on compressed bytes read from the socket. Well under the decoded
   * ceiling because compressed HTML runs about 5:1 — anything needing more than
   * this on the wire is not a page we want to analyse. It also bounds how much
   * a decompression bomb can make us read before we stop.
   */
  maxEncodedBytes: 768 * 1024,
  maxRedirects: 3,
  connectTimeoutMs: 10_000,
  totalTimeoutMs: 15_000,
} as const;

export const USER_AGENT =
  'ResearchSuiteBot/1.0 (+https://research-suite.example/bot; automated business research; bounded crawl)';

const ACCEPTED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  /** Decoded content bytes. */
  bytes: number;
  /** Bytes read off the socket before decoding. Observability only. */
  encodedBytes: number;
  /** Which Content-Encoding the server used. */
  encoding: string;
  redirectChain: string[];
  responseTimeMs: number;
  /** True when the response was cut short at the byte ceiling. */
  truncated: boolean;
}

/**
 * A dispatcher whose connect step re-checks the address actually being dialled.
 *
 * This is the TOCTOU fix, and it is the reason a plain `fetch` is not good
 * enough. `assertHostnameResolvesPublicly` runs before the request; by the time
 * the socket opens, DNS may have been re-answered with a different address. The
 * connector wraps undici's default one and inspects `socket.remoteAddress`
 * before a single request byte is written, so a rebinding attack fails at the
 * last possible moment instead of succeeding.
 */
function createGuardedAgent(): Agent {
  const base = buildConnector({ timeout: FETCH_LIMITS.connectTimeoutMs });

  const guarded: buildConnector.connector = (options, callback) => {
    base(options, (err, socket) => {
      if (err || !socket) {
        callback(err ?? new Error('Connection failed'), null);
        return;
      }
      const address = socket.remoteAddress;
      if (!address) {
        socket.destroy();
        callback(new PlatformError('BLOCKED_URL', 'Socket had no peer address'), null);
        return;
      }
      try {
        assertAddressIsPublic(address, `socket:${options.hostname}`);
      } catch (error) {
        socket.destroy();
        callback(error as Error, null);
        return;
      }
      callback(null, socket);
    });
  };

  return new Agent({
    connect: guarded,
    connectTimeout: FETCH_LIMITS.connectTimeoutMs,
    headersTimeout: FETCH_LIMITS.totalTimeoutMs,
    bodyTimeout: FETCH_LIMITS.totalTimeoutMs,
  });
}

interface SingleRequest {
  status: number;
  headers: Record<string, string>;
  location: string | null;
  bodyStream: Dispatcher.ResponseData['body'] | null;
  contentType: string | null;
  contentLength: number | null;
  contentEncoding: string | null;
}

async function requestOnce(
  url: URL,
  agent: Agent,
  signal: AbortSignal,
): Promise<SingleRequest> {
  let response: Dispatcher.ResponseData;
  try {
    response = await undiciRequest(url, {
      dispatcher: agent,
      method: 'GET',
      signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9',
        'accept-encoding': ACCEPT_ENCODING,
        'cache-control': 'no-cache',
      },
      // Note: undici neither follows redirects nor throws on 4xx/5xx unless
      // explicitly configured to. Both defaults are what we want — we follow
      // redirects ourselves so every hop is re-validated (see the loop in
      // safeFetch), and non-2xx statuses are mapped to typed errors below.
    });
  } catch (cause) {
    if (cause instanceof PlatformError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/timeout|timed out|UND_ERR_(HEADERS|BODY|CONNECT)_TIMEOUT/i.test(message)) {
      throw new PlatformError('SITE_TIMEOUT', message, {
        cause,
        context: { url: url.href },
      });
    }
    throw new PlatformError('SITE_UNREACHABLE', message, {
      cause,
      context: { url: url.href },
    });
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(response.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : String(value ?? '');
  }

  const contentLengthRaw = headers['content-length'];
  const contentLength = contentLengthRaw ? Number(contentLengthRaw) : null;

  return {
    status: response.statusCode,
    headers,
    location: headers['location'] ?? null,
    bodyStream: response.body,
    contentType: headers['content-type'] ?? null,
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
    contentEncoding: headers['content-encoding'] ?? null,
  };
}

/** Maps an HTTP status to the right user-facing failure, or returns null if OK. */
function statusToError(status: number, url: string): PlatformError | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403 || status === 429) {
    return new PlatformError('SITE_BLOCKED', `Blocked with status ${status}`, {
      context: { url, status },
    });
  }
  if (status === 404 || status === 410) {
    return new PlatformError('SITE_UNREACHABLE', `Not found (${status})`, {
      context: { url, status },
    });
  }
  if (status === 408 || status === 504) {
    return new PlatformError('SITE_TIMEOUT', `Upstream timeout (${status})`, {
      context: { url, status },
    });
  }
  return new PlatformError('SITE_UNREACHABLE', `Unexpected status ${status}`, {
    context: { url, status },
  });
}

/**
 * Fetches a page with every guard applied.
 *
 * The URL is re-validated here rather than trusted from the caller: this function
 * is the last line before a socket opens, and it must be safe to call with
 * anything.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  const started = Date.now();
  const redirectChain: string[] = [];

  const agent = createGuardedAgent();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_LIMITS.totalTimeoutMs);

  try {
    let current = rawUrl;

    for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop += 1) {
      // Every hop is validated from scratch — a redirect to a private address is
      // exactly the attack this loop exists to stop.
      const validation = validateAndNormalizeUrl(current, {
        allowNonStandardPorts: localTestingEnabled(),
      });
      if (!validation.ok) {
        throw new PlatformError(
          'BLOCKED_URL',
          `Redirect target rejected: ${validation.reason}`,
          {
            context: { url: current, reason: validation.reason, hop },
          },
        );
      }

      await assertHostnameResolvesPublicly(validation.hostname);

      const url = new URL(validation.normalized);
      const result = await requestOnce(url, agent, controller.signal);

      // ── Redirect ────────────────────────────────────────────────────────
      if (result.status >= 300 && result.status < 400 && result.location) {
        result.bodyStream?.resume?.();
        if (hop === FETCH_LIMITS.maxRedirects) {
          throw new PlatformError('SITE_UNREACHABLE', 'Too many redirects', {
            context: { url: rawUrl, hops: redirectChain.length },
          });
        }
        redirectChain.push(validation.normalized);
        // Relative Location headers are legal and common.
        current = new URL(result.location, validation.normalized).toString();
        continue;
      }

      // ── Terminal response ───────────────────────────────────────────────
      const statusError = statusToError(result.status, validation.normalized);
      if (statusError) {
        result.bodyStream?.resume?.();
        throw statusError;
      }

      const contentType = (result.contentType ?? '').toLowerCase();
      if (contentType && !ACCEPTED_CONTENT_TYPES.some((t) => contentType.includes(t))) {
        result.bodyStream?.resume?.();
        throw new PlatformError('NOT_HTML', `Content-Type was ${contentType}`, {
          context: { url: validation.normalized, contentType },
        });
      }

      /*
       * A declared length over the ceiling saves us downloading it to find out.
       *
       * Content-Length describes the bytes on the wire, so which ceiling applies
       * depends on whether the server compressed the body. Comparing a
       * compressed length against the decoded ceiling would wave through a
       * 700 KB gzip that inflates to 40 MB, which is precisely the case the
       * encoded ceiling exists for.
       */
      const declaredCeiling =
        (result.contentEncoding ?? 'identity').trim().toLowerCase() === 'identity'
          ? FETCH_LIMITS.maxBytes
          : FETCH_LIMITS.maxEncodedBytes;

      if (result.contentLength !== null && result.contentLength > declaredCeiling) {
        result.bodyStream?.resume?.();
        throw new PlatformError(
          'SITE_TOO_LARGE',
          `Declared ${result.contentLength} bytes`,
          {
            context: {
              url: validation.normalized,
              contentLength: result.contentLength,
              contentEncoding: result.contentEncoding,
            },
          },
        );
      }

      if (!result.bodyStream) {
        throw new PlatformError('SITE_UNREACHABLE', 'Empty response body', {
          context: { url: validation.normalized },
        });
      }

      const decoded = await readDecodedBody(result.bodyStream, result.contentEncoding, {
        maxDecodedBytes: FETCH_LIMITS.maxBytes,
        maxEncodedBytes: FETCH_LIMITS.maxEncodedBytes,
      });

      return {
        finalUrl: validation.normalized,
        status: result.status,
        headers: result.headers,
        body: decoded.text,
        bytes: decoded.bytes,
        encodedBytes: decoded.encodedBytes,
        encoding: decoded.encoding,
        redirectChain,
        responseTimeMs: Date.now() - started,
        truncated: decoded.truncated,
      };
    }

    throw new PlatformError('SITE_UNREACHABLE', 'Redirect loop', {
      context: { url: rawUrl },
    });
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted || /abort/i.test(message)) {
      throw new PlatformError('SITE_TIMEOUT', 'Request exceeded the time budget', {
        cause: error,
        context: { url: rawUrl },
      });
    }
    throw new PlatformError('SITE_UNREACHABLE', message, {
      cause: error,
      context: { url: rawUrl },
    });
  } finally {
    clearTimeout(timeout);
    await agent.close().catch(() => {});
  }
}

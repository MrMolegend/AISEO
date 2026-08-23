/**
 * Audit error taxonomy.
 *
 * Every failure in the pipeline resolves to exactly one of these codes. The code is
 * what we log and store; the copy is what the user reads. Raw exception messages
 * never reach the UI — they may contain internal hostnames, stack frames or
 * upstream provider detail.
 */
export const AUDIT_ERROR_CODES = [
  'INVALID_URL',
  'BLOCKED_URL',
  'ROBOTS_DISALLOWED',
  'SITE_UNREACHABLE',
  'SITE_TIMEOUT',
  'SITE_BLOCKED',
  'SITE_TOO_LARGE',
  'NOT_HTML',
  'NO_CONTENT',
  'AI_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_INVALID_OUTPUT',
  'AI_REFUSED',
  'RATE_LIMITED',
  'CAPACITY',
  'STORAGE_ERROR',
  'UNKNOWN',
] as const;

export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number];

export interface AuditErrorCopy {
  /** Short headline for the error state. */
  title: string;
  /** Body copy. `{domain}` is substituted with the audited domain when available. */
  body: string;
  /** Whether the UI should offer a retry affordance. */
  retryable: boolean;
  /** HTTP status to return when this error surfaces from an API route. */
  status: number;
}

export const AUDIT_ERROR_COPY: Record<AuditErrorCode, AuditErrorCopy> = {
  INVALID_URL: {
    title: "That doesn't look like a website address",
    body: 'Check the address and try again — something like example.com or https://example.com.',
    retryable: false,
    status: 400,
  },
  BLOCKED_URL: {
    title: 'We can only audit public websites',
    body: 'That address points somewhere private or internal, so we cannot reach it from the open internet.',
    retryable: false,
    status: 400,
  },
  ROBOTS_DISALLOWED: {
    title: 'This site asks automated tools to stay away',
    body: "{domain}'s robots.txt file requests that automated tools do not access it, and we respect that. If you own this site, you can allow our auditor and try again.",
    retryable: false,
    status: 403,
  },
  SITE_UNREACHABLE: {
    title: "We couldn't reach {domain}",
    body: 'The site did not respond. Check that the address is correct and the site is online, then try again.',
    retryable: true,
    status: 502,
  },
  SITE_TIMEOUT: {
    title: '{domain} took too long to respond',
    body: 'We gave up waiting after 15 seconds. That is worth investigating on its own — slow response times hurt both rankings and conversions.',
    retryable: true,
    status: 504,
  },
  SITE_BLOCKED: {
    title: '{domain} is blocking automated tools',
    body: 'The site returned a block response. This usually means a firewall or bot-protection service is filtering non-browser traffic.',
    retryable: true,
    status: 502,
  },
  SITE_TOO_LARGE: {
    title: 'That page is unusually large',
    body: "{domain}'s homepage exceeds the size we can analyse. Very large pages are themselves a performance problem worth looking at.",
    retryable: false,
    status: 413,
  },
  NOT_HTML: {
    title: 'That address is not a web page',
    body: 'We received a file rather than a web page. Point us at the homepage of the site you want audited.',
    retryable: false,
    status: 415,
  },
  NO_CONTENT: {
    title: "We couldn't find enough content to audit",
    body: 'This page returned almost no text. It may render its content in the browser with JavaScript — which search engines can also struggle with, and which is itself worth addressing.',
    retryable: true,
    status: 422,
  },
  AI_TIMEOUT: {
    title: 'The analysis took too long',
    body: 'Our analysis engine did not finish in time. Your page data is saved, so retrying will not re-crawl the site.',
    retryable: true,
    status: 504,
  },
  AI_RATE_LIMITED: {
    title: 'Our analysis engine is busy',
    body: 'We are handling a lot of audits right now. Please try again in a moment.',
    retryable: true,
    status: 429,
  },
  AI_UNAVAILABLE: {
    title: 'Our analysis engine is temporarily unavailable',
    body: 'This is on our side, not yours. Please try again shortly.',
    retryable: true,
    status: 503,
  },
  AI_INVALID_OUTPUT: {
    title: 'Something went wrong building your report',
    body: 'The analysis came back in a shape we could not use. We have logged it and will look into it.',
    retryable: true,
    status: 502,
  },
  AI_REFUSED: {
    title: 'We could not analyse this site',
    body: 'Our analysis engine declined to produce a report for this page.',
    retryable: false,
    status: 422,
  },
  RATE_LIMITED: {
    title: "You've run a few audits already",
    body: 'To keep this free for everyone we limit how many audits can be run from one place. Please try again a little later.',
    retryable: false,
    status: 429,
  },
  CAPACITY: {
    title: 'We are at capacity right now',
    body: 'We have hit our daily analysis limit. Please try again tomorrow.',
    retryable: false,
    status: 503,
  },
  STORAGE_ERROR: {
    title: 'We could not save your report',
    body: 'The analysis finished but we failed to store it. Please try again.',
    retryable: true,
    status: 500,
  },
  UNKNOWN: {
    title: 'Something unexpected went wrong',
    body: 'We have been notified and will look into it. Please try again.',
    retryable: true,
    status: 500,
  },
};

/**
 * The only error type allowed to cross a layer boundary.
 *
 * `cause` retains the original exception for logging; it is never serialised to
 * the client.
 */
export class AuditError extends Error {
  readonly code: AuditErrorCode;
  readonly context: Record<string, unknown>;

  constructor(
    code: AuditErrorCode,
    message?: string,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(message ?? code, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AuditError';
    this.code = code;
    this.context = options?.context ?? {};
  }

  get copy(): AuditErrorCopy {
    return AUDIT_ERROR_COPY[this.code];
  }

  get status(): number {
    return AUDIT_ERROR_COPY[this.code].status;
  }
}

export function isAuditError(value: unknown): value is AuditError {
  return value instanceof AuditError;
}

/** Coerces anything thrown into an AuditError, defaulting to UNKNOWN. */
export function toAuditError(value: unknown): AuditError {
  if (isAuditError(value)) return value;
  return new AuditError(
    'UNKNOWN',
    value instanceof Error ? value.message : String(value),
    {
      cause: value,
    },
  );
}

export function isAuditErrorCode(value: unknown): value is AuditErrorCode {
  return (
    typeof value === 'string' && (AUDIT_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Renders error copy with `{domain}` substituted. */
export function renderErrorCopy(
  code: AuditErrorCode,
  domain?: string | null,
): AuditErrorCopy {
  const copy = AUDIT_ERROR_COPY[code];
  const target = domain ?? 'the site';
  return {
    ...copy,
    title: copy.title.replaceAll('{domain}', target),
    body: copy.body.replaceAll('{domain}', target),
  };
}

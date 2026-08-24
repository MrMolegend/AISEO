/**
 * Platform error taxonomy.
 *
 * Every failure resolves to exactly one of these codes. The code is what we log
 * and store; the copy is what the user reads. Raw exception messages never reach
 * the UI — they can carry internal hostnames, stack frames and upstream provider
 * detail.
 *
 * Each entry also declares `refundsTokens`. That is not documentation: the
 * pipeline reads it to decide whether a failed job returns the user's tokens, so
 * the refund policy is one table rather than a condition scattered across the
 * job runner. The rule it encodes is that we refund our own failures and not the
 * state of the public record — a report that completes honestly with stated
 * limitations is a completed report, even if the market turned out to be thinly
 * documented.
 */

export const ERROR_CODES = [
  // ── Request and identity ────────────────────────────────────────────────
  'INVALID_INPUT',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_SUBMISSION',
  'RATE_LIMITED',
  'CAPACITY',

  // ── Authentication ──────────────────────────────────────────────────────
  // These carry the copy a user reads when a sign-in attempt fails. They exist
  // as codes rather than ad-hoc strings for the same reason as everything else
  // here: the raw Supabase message can name internal endpoints and is written
  // for a developer, not for someone who just wants to get in.
  'AUTH_LINK_INVALID',
  'AUTH_EMAIL_RATE_LIMITED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_NOT_VERIFIED',
  'AUTH_EMAIL_INVALID',
  'AUTH_WEAK_PASSWORD',
  'AUTH_PASSWORD_MISMATCH',
  'AUTH_PASSWORD_UNCHANGED',
  'AUTH_ACCOUNT_EXISTS',
  'AUTH_SIGNUP_DISABLED',
  'AUTH_NETWORK',

  // ── Tokens ──────────────────────────────────────────────────────────────
  'INSUFFICIENT_TOKENS',
  'WALLET_ERROR',

  // ── Subject URL validation ──────────────────────────────────────────────
  'INVALID_URL',
  'BLOCKED_URL',

  // ── Retrieval ───────────────────────────────────────────────────────────
  'ROBOTS_DISALLOWED',
  'SITE_UNREACHABLE',
  'SITE_TIMEOUT',
  'SITE_BLOCKED',
  'SITE_TOO_LARGE',
  'NOT_HTML',
  'UNSUPPORTED_CONTENT',
  'RESPONSE_DECODE_FAILED',
  'NO_CONTENT',
  'CRAWL_TIMEOUT',

  // ── Research provider ───────────────────────────────────────────────────
  'RESEARCH_PROVIDER_UNAVAILABLE',
  'RESEARCH_PROVIDER_RATE_LIMITED',
  'NO_RELIABLE_SOURCES',

  // ── AI ──────────────────────────────────────────────────────────────────
  'AI_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_INVALID_OUTPUT',
  'AI_REFUSED',

  // ── Infrastructure ──────────────────────────────────────────────────────
  'STORAGE_ERROR',
  'JOB_TIMEOUT',
  'EXPORT_FAILED',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorCopy {
  /** Short headline for the error state. */
  title: string;
  /** Body copy. `{subject}` is substituted with the researched name or domain. */
  body: string;
  /** Whether the UI should offer a retry affordance. */
  retryable: boolean;
  /** HTTP status when this surfaces from an API route. */
  status: number;
  /**
   * Whether a job that failed with this code returns its reserved tokens.
   *
   * True for anything that is our fault or our supplier's. False where the job
   * did the work it was paid for, and false where no reservation was ever made
   * (validation failures happen before the tokens move).
   */
  refundsTokens: boolean;
}

export const ERROR_COPY: Record<ErrorCode, ErrorCopy> = {
  // ── Request and identity ────────────────────────────────────────────────
  INVALID_INPUT: {
    title: 'Some details need another look',
    body: 'One or more of the fields you submitted could not be accepted. Check the highlighted fields and try again.',
    retryable: false,
    status: 400,
    // Validation runs before the reservation, so there is nothing to return.
    refundsTokens: false,
  },
  AUTH_REQUIRED: {
    title: 'Please sign in to continue',
    body: 'Research reports are tied to your account and your token balance, so you need to be signed in to run one.',
    retryable: false,
    status: 401,
    refundsTokens: false,
  },
  FORBIDDEN: {
    title: 'This is not yours to open',
    body: 'That report belongs to another account. If someone shared it with you, use the link they sent rather than this address.',
    retryable: false,
    status: 403,
    refundsTokens: false,
  },
  NOT_FOUND: {
    title: 'We could not find that report',
    body: 'The link may be mistyped, or the report may have been removed.',
    retryable: false,
    status: 404,
    refundsTokens: false,
  },
  DUPLICATE_SUBMISSION: {
    title: 'That research is already running',
    body: 'We received this request a moment ago and it is already in progress. You have not been charged twice.',
    retryable: false,
    status: 409,
    refundsTokens: false,
  },
  RATE_LIMITED: {
    title: "You've started several reports in a row",
    body: 'To keep the service responsive we limit how many reports can be started in quick succession. Please try again shortly.',
    retryable: false,
    status: 429,
    refundsTokens: false,
  },
  CAPACITY: {
    title: 'We are at capacity right now',
    body: 'We have reached our processing limit for today. Your tokens are untouched. Please try again tomorrow.',
    retryable: false,
    status: 503,
    refundsTokens: true,
  },

  // ── Authentication ──────────────────────────────────────────────────────
  AUTH_LINK_INVALID: {
    title: 'That link has expired or been used',
    body: 'Email links work once and last an hour. Request a new one and it will be waiting in your inbox.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_EMAIL_RATE_LIMITED: {
    title: 'Please wait before requesting another email',
    body: "You've already requested an email. Please wait before requesting another.",
    retryable: true,
    status: 429,
    refundsTokens: false,
  },
  AUTH_INVALID_CREDENTIALS: {
    title: 'That email or password is not right',
    body: 'Check both and try again. If you have forgotten your password, you can reset it.',
    // Deliberately does not say which of the two was wrong: telling someone the
    // email exists but the password is wrong confirms the account for them.
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    title: 'Please confirm your email first',
    body: 'We sent a link when you created your account. Open it to finish setting up, or request a new one.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_EMAIL_INVALID: {
    title: 'That does not look like an email address',
    body: 'Check for a typo — an address needs an @ and a domain, like you@example.com.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_WEAK_PASSWORD: {
    title: 'That password is too easy to guess',
    body: 'Use at least 8 characters. A short phrase you will remember beats a short word with symbols in it.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_PASSWORD_MISMATCH: {
    title: 'Those passwords do not match',
    body: 'Type the same password in both fields. Use the show button if you would rather see what you are typing.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_PASSWORD_UNCHANGED: {
    title: 'That is already your password',
    body: 'Choose a different one, or sign in with the password you already have.',
    retryable: true,
    status: 400,
    refundsTokens: false,
  },
  AUTH_ACCOUNT_EXISTS: {
    title: 'You already have an account',
    body: 'Sign in with your password instead, or reset it if you have forgotten it.',
    retryable: false,
    status: 409,
    refundsTokens: false,
  },
  AUTH_SIGNUP_DISABLED: {
    title: 'New accounts are closed right now',
    body: 'We are not accepting new sign-ups at the moment. Please try again later.',
    retryable: false,
    status: 403,
    refundsTokens: false,
  },
  AUTH_NETWORK: {
    title: 'We could not reach the sign-in service',
    body: 'Check your connection and try again. Nothing has changed on your account.',
    retryable: true,
    status: 503,
    refundsTokens: false,
  },

  // ── Tokens ──────────────────────────────────────────────────────────────
  INSUFFICIENT_TOKENS: {
    title: 'Not enough tokens for this package',
    body: 'Your balance is below the cost of this report. Nothing has been charged.',
    retryable: false,
    status: 402,
    refundsTokens: false,
  },
  WALLET_ERROR: {
    title: 'We could not complete that token operation',
    body: 'Something went wrong moving tokens in your wallet. Nothing has been charged, and we have logged it.',
    retryable: true,
    status: 500,
    refundsTokens: true,
  },

  // ── Subject URL validation ──────────────────────────────────────────────
  INVALID_URL: {
    title: "That doesn't look like a website address",
    body: 'Check the address and try again — something like example.com or https://example.com.',
    retryable: false,
    status: 400,
    refundsTokens: false,
  },
  BLOCKED_URL: {
    title: 'We can only research public websites',
    body: 'That address points somewhere private or internal, so we cannot reach it from the open internet.',
    retryable: false,
    status: 400,
    refundsTokens: false,
  },

  // ── Retrieval ───────────────────────────────────────────────────────────
  ROBOTS_DISALLOWED: {
    title: 'That site asks automated tools to stay away',
    body: "{subject}'s robots.txt requests that automated tools do not read it, and we respect that. If you own the site you can allow our crawler and try again.",
    retryable: false,
    status: 403,
    // We never fetched anything, so we never spent what the tokens paid for.
    refundsTokens: true,
  },
  SITE_UNREACHABLE: {
    title: "We couldn't reach {subject}",
    body: 'The site did not respond. Check the address is correct and the site is online, then try again.',
    retryable: true,
    status: 502,
    refundsTokens: true,
  },
  SITE_TIMEOUT: {
    title: '{subject} took too long to respond',
    body: 'We gave up waiting. A site this slow is worth investigating on its own — it costs visitors as well as crawlers.',
    retryable: true,
    status: 504,
    refundsTokens: true,
  },
  SITE_BLOCKED: {
    title: '{subject} is blocking automated tools',
    body: 'The site returned a block response, which usually means a firewall or bot-protection service is filtering non-browser traffic. We do not attempt to work around that.',
    retryable: true,
    status: 502,
    refundsTokens: true,
  },
  SITE_TOO_LARGE: {
    title: 'That page is unusually large',
    body: '{subject} returned more data than we are willing to read from a single page.',
    retryable: false,
    status: 413,
    refundsTokens: true,
  },
  NOT_HTML: {
    title: 'That address is not a web page',
    body: 'We received a file rather than a web page. Point us at the site itself rather than a document on it.',
    retryable: false,
    status: 415,
    refundsTokens: true,
  },
  UNSUPPORTED_CONTENT: {
    title: 'We could not read that response',
    body: '{subject} returned the page in a format we do not support — usually an unusual compression or content type rather than anything wrong with the site.',
    retryable: false,
    status: 415,
    refundsTokens: true,
  },
  RESPONSE_DECODE_FAILED: {
    title: 'That response arrived damaged',
    body: '{subject} sent a compressed page we could not unpack. The data was incomplete or corrupt in transit.',
    retryable: true,
    status: 502,
    refundsTokens: true,
  },
  NO_CONTENT: {
    title: "We couldn't find enough to work with",
    body: '{subject} returned almost no readable text. It may render its content in the browser with JavaScript, which we cannot follow — and which search engines struggle with too.',
    retryable: true,
    status: 422,
    refundsTokens: true,
  },
  CRAWL_TIMEOUT: {
    title: 'Reading the site took too long',
    body: 'We ran out of time gathering pages before we had enough to analyse. Your tokens have been returned.',
    retryable: true,
    status: 504,
    refundsTokens: true,
  },

  // ── Research provider ───────────────────────────────────────────────────
  RESEARCH_PROVIDER_UNAVAILABLE: {
    title: 'Our web research service is unavailable',
    body: 'We could not search public sources just now. This is on our side. Your tokens have been returned.',
    retryable: true,
    status: 503,
    refundsTokens: true,
  },
  RESEARCH_PROVIDER_RATE_LIMITED: {
    title: 'Our web research service is busy',
    body: 'We are being rate-limited by the service we search with. Your tokens have been returned — please try again shortly.',
    retryable: true,
    status: 429,
    refundsTokens: true,
  },
  NO_RELIABLE_SOURCES: {
    title: 'We could not find enough public information',
    body: 'There was too little published about this subject to build a report we would stand behind. Rather than pad it with guesses, we stopped and returned your tokens.',
    retryable: true,
    status: 422,
    refundsTokens: true,
  },

  // ── AI ──────────────────────────────────────────────────────────────────
  AI_TIMEOUT: {
    title: 'The analysis took too long',
    body: 'Our analysis engine did not finish in time. Your tokens have been returned.',
    retryable: true,
    status: 504,
    refundsTokens: true,
  },
  AI_RATE_LIMITED: {
    title: 'Our analysis engine is busy',
    body: 'We are handling a lot of reports right now. Your tokens have been returned — please try again in a moment.',
    retryable: true,
    status: 429,
    refundsTokens: true,
  },
  AI_UNAVAILABLE: {
    title: 'Our analysis engine is temporarily unavailable',
    body: 'This is on our side, not yours. Your tokens have been returned.',
    retryable: true,
    status: 503,
    refundsTokens: true,
  },
  AI_INVALID_OUTPUT: {
    title: 'Something went wrong building your report',
    body: 'The analysis came back in a shape we could not use, and correcting it did not help. We have logged it and returned your tokens.',
    retryable: true,
    status: 502,
    refundsTokens: true,
  },
  AI_REFUSED: {
    title: 'We could not produce this report',
    body: 'Our analysis engine declined to research this subject. Your tokens have been returned.',
    retryable: false,
    status: 422,
    refundsTokens: true,
  },

  // ── Infrastructure ──────────────────────────────────────────────────────
  STORAGE_ERROR: {
    title: 'We could not save your report',
    body: 'The research finished but we failed to store it. Your tokens have been returned.',
    retryable: true,
    status: 500,
    refundsTokens: true,
  },
  JOB_TIMEOUT: {
    title: 'This report ran out of time',
    body: 'The job exceeded the time we allow for a single report. Your tokens have been returned.',
    retryable: true,
    status: 504,
    refundsTokens: true,
  },
  EXPORT_FAILED: {
    title: 'We could not build that download',
    body: 'Generating the file failed. The report itself is unaffected — try the download again.',
    retryable: true,
    status: 500,
    refundsTokens: false,
  },
  UNKNOWN: {
    title: 'Something unexpected went wrong',
    body: 'We have been notified and will look into it. Your tokens have been returned.',
    retryable: true,
    status: 500,
    refundsTokens: true,
  },
};

/**
 * The only error type allowed to cross a layer boundary.
 *
 * `cause` retains the original exception for logging; it is never serialised to
 * the client.
 */
export class PlatformError extends Error {
  readonly code: ErrorCode;
  readonly context: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(message ?? code, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'PlatformError';
    this.code = code;
    this.context = options?.context ?? {};
  }

  get copy(): ErrorCopy {
    return ERROR_COPY[this.code];
  }

  get status(): number {
    return ERROR_COPY[this.code].status;
  }

  /** Whether a job failing this way should return its reserved tokens. */
  get refundsTokens(): boolean {
    return ERROR_COPY[this.code].refundsTokens;
  }
}

export function isPlatformError(value: unknown): value is PlatformError {
  return value instanceof PlatformError;
}

/** Coerces anything thrown into a PlatformError, defaulting to UNKNOWN. */
export function toPlatformError(value: unknown): PlatformError {
  if (isPlatformError(value)) return value;
  return new PlatformError(
    'UNKNOWN',
    value instanceof Error ? value.message : String(value),
    { cause: value },
  );
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Whether a job that failed with this code should be refunded. */
export function refundsTokens(code: ErrorCode): boolean {
  return ERROR_COPY[code].refundsTokens;
}

/** Renders error copy with `{subject}` substituted. */
export function renderErrorCopy(code: ErrorCode, subject?: string | null): ErrorCopy {
  const copy = ERROR_COPY[code];
  const target = subject ?? 'that site';
  return {
    ...copy,
    title: copy.title.replaceAll('{subject}', target),
    body: copy.body.replaceAll('{subject}', target),
  };
}

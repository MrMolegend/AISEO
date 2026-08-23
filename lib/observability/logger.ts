/**
 * Structured JSON logger with hard secret redaction.
 *
 * Two rules this module exists to enforce:
 *  1. Every pipeline log line carries an `auditId`, so one audit's journey is a
 *     single grep across the whole system.
 *  2. Nothing resembling a credential is ever emitted, even if a caller passes a
 *     whole config object by mistake. Redaction is key-based and value-based, and
 *     it recurses.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Substrings that mark a key as sensitive. Matched case-insensitively. */
const REDACTED_KEY_PATTERNS = [
  'key',
  'token',
  'secret',
  'password',
  'passwd',
  'auth',
  'cookie',
  'session',
  'credential',
  'salt',
  'signature',
  'bearer',
  'apikey',
];

/** Value shapes that are secrets regardless of the key they arrived under. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/, // Anthropic
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT (Supabase keys)
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;
const MAX_STRING = 2_000;

function keyIsSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACTED_KEY_PATTERNS.some((p) => lower.includes(p));
}

function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(
      new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g'),
      REDACTED,
    );
  }
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…[truncated]` : out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (value == null) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...('code' in value ? { code: (value as { code?: unknown }).code } : {}),
      stack:
        process.env.NODE_ENV === 'production'
          ? undefined
          : redactString(value.stack ?? '')
              .split('\n')
              .slice(0, 6)
              .join('\n'),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keyIsSensitive(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }

  return String(value);
}

export interface LogContext {
  auditId?: string;
  publicId?: string;
  domain?: string;
  stage?: string;
  [key: string]: unknown;
}

function currentLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return process.env.NODE_ENV === 'test' ? 'error' : 'info';
}

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;

  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...(redact(context) as Record<string, unknown>),
  };

  const serialised = JSON.stringify(line);
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
  /** Returns a logger with `bound` merged into every subsequent line. */
  child(bound: LogContext): Logger;
}

export function createLogger(bound: LogContext = {}): Logger {
  return {
    debug: (event, context) => emit('debug', event, { ...bound, ...context }),
    info: (event, context) => emit('info', event, { ...bound, ...context }),
    warn: (event, context) => emit('warn', event, { ...bound, ...context }),
    error: (event, context) => emit('error', event, { ...bound, ...context }),
    child: (extra) => createLogger({ ...bound, ...extra }),
  };
}

export const logger = createLogger();

/**
 * Canonical pipeline event names.
 *
 * Using a const map rather than free-form strings keeps log queries stable as the
 * pipeline grows, and makes it obvious when an event is emitted from two places.
 */
export const LOG_EVENTS = {
  urlAccepted: 'url.accepted',
  urlRejected: 'url.rejected',
  rateLimited: 'ratelimit.blocked',
  cacheHit: 'cache.hit',
  fetchStarted: 'fetch.started',
  fetchCompleted: 'fetch.completed',
  fetchFailed: 'fetch.failed',
  extractionCompleted: 'extraction.completed',
  aiRequestStarted: 'ai.request.started',
  aiRequestCompleted: 'ai.request.completed',
  aiRequestFailed: 'ai.request.failed',
  validationPassed: 'validation.passed',
  validationFailed: 'validation.failed',
  repairTriggered: 'validation.repair',
  auditSaved: 'audit.saved',
  auditFailed: 'audit.failed',
  leadCaptured: 'lead.captured',
} as const;

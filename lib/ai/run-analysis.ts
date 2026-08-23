import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SiteFacts } from '@/schemas/facts';
import type { AuditAnalysis, AuditMeta } from '@/schemas/audit';
import { getProvider } from './index';
import { isRetryable } from './errors';
import { validateAnalysis } from '@/lib/validation/validate-report';
import { AuditError, toAuditError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import { PROMPT_VERSION } from '@/prompts/seo-audit';
import { createLogger, LOG_EVENTS, type Logger } from '@/lib/observability/logger';

/**
 * The AI stage: SiteFacts in, validated AuditAnalysis out.
 *
 * Everything expensive or fallible about talking to a model lives here — retry
 * policy, the single repair pass, the time budget — so the pipeline above it
 * stays a straight line and the provider below it stays a thin adapter.
 */

export const ANALYSIS_LIMITS = {
  maxOutputTokens: 16_000,
  /** Whole-stage ceiling, including retries and the repair attempt. */
  totalBudgetMs: 240_000,
  /** Transport-level retries. The repair pass is counted separately. */
  maxTransportRetries: 2,
  /** Deliberately one. A second repair has never been the difference. */
  maxRepairAttempts: 1,
} as const;

export interface AnalysisResult {
  analysis: AuditAnalysis;
  meta: AuditMeta;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AuditError('AI_TIMEOUT', 'Aborted while backing off'));
      },
      { once: true },
    );
  });

/** Full jitter: retries from many concurrent audits must not align. */
function backoffMs(attempt: number): number {
  const ceiling = Math.min(8_000, 1_000 * 2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

export async function runAnalysis(
  facts: SiteFacts,
  auditedDomain: string,
  options: { signal?: AbortSignal; logger?: Logger } = {},
): Promise<AnalysisResult> {
  const log = options.logger ?? createLogger();
  const env = getEnv();
  const provider = await getProvider();

  // A per-request nonce the audited page cannot have seen, so its content
  // cannot forge the delimiter that closes the untrusted data block.
  const nonce = randomBytes(8).toString('hex');
  const factsJson = JSON.stringify(facts);

  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), ANALYSIS_LIMITS.totalBudgetMs);

  /*
   * An already-aborted signal has to be handled explicitly. addEventListener
   * only fires for events dispatched after it is attached, so a caller passing a
   * signal that aborted earlier — a cancelled request, a closed connection —
   * would otherwise sail past this and spend money on an API call nobody is
   * waiting for.
   */
  if (options.signal?.aborted) {
    clearTimeout(budgetTimer);
    throw new AuditError('AI_TIMEOUT', 'Analysis was cancelled before it started');
  }
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  const started = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let repairAttempts = 0;
  let modelUsed = provider.name;

  try {
    let repair: { previousOutput: unknown; problems: string[] } | undefined;

    // One iteration per validation attempt: the initial call plus, at most, one
    // repair. Transport retries happen inside callWithRetry.
    for (let round = 0; round <= ANALYSIS_LIMITS.maxRepairAttempts; round += 1) {
      log.info(LOG_EVENTS.aiRequestStarted, {
        provider: provider.name,
        model: env.AI_MODEL,
        round,
        isRepair: Boolean(repair),
      });

      const result = await callWithRetry(
        () =>
          provider.runAudit(
            {
              factsJson,
              nonce,
              // Kept for providers that take a JSON Schema directly; the
              // Anthropic path derives its own from the Zod schema and attaches
              // it to the submit_audit tool.
              jsonSchema: {},
              maxOutputTokens: ANALYSIS_LIMITS.maxOutputTokens,
              ...(repair ? { repair } : {}),
            },
            controller.signal,
          ),
        controller.signal,
        log,
      );

      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      modelUsed = result.model;

      log.info(LOG_EVENTS.aiRequestCompleted, {
        latencyMs: result.latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        truncated: result.truncated,
      });

      // Running out of output budget produces a partial object that may still
      // parse. Treating it as invalid sends it through the repair path with an
      // instruction to be briefer, which is the right correction.
      if (result.truncated) {
        if (round >= ANALYSIS_LIMITS.maxRepairAttempts) {
          throw new AuditError(
            'AI_INVALID_OUTPUT',
            'Output exceeded the token budget twice',
          );
        }
        repairAttempts += 1;
        repair = {
          previousOutput: result.data,
          problems: [
            'The audit was cut off because it exceeded the output limit. Produce the same audit more concisely: at most 12 issues, and keep every field well inside its length limit.',
          ],
        };
        log.warn(LOG_EVENTS.repairTriggered, { reason: 'max_tokens' });
        continue;
      }

      const validation = validateAnalysis(result.data, auditedDomain);

      if (validation.ok) {
        if (validation.sanitizedFields.length > 0) {
          // Worth a warning rather than an info: on a page with no injected
          // content this list should be empty.
          log.warn('validation.sanitized', {
            fields: validation.sanitizedFields.slice(0, 10),
            count: validation.sanitizedFields.length,
          });
        }
        log.info(LOG_EVENTS.validationPassed, { round, repairAttempts });

        return {
          analysis: validation.analysis,
          meta: {
            model: modelUsed,
            promptVersion: PROMPT_VERSION,
            durationMs: Date.now() - started,
            repairAttempts,
            inputTokens,
            outputTokens,
          },
        };
      }

      log.warn(LOG_EVENTS.validationFailed, {
        round,
        problems: validation.problems.slice(0, 5),
      });

      if (round >= ANALYSIS_LIMITS.maxRepairAttempts) {
        throw new AuditError(
          'AI_INVALID_OUTPUT',
          `Validation failed after ${repairAttempts} repair attempt(s)`,
          { context: { problems: validation.problems.slice(0, 5) } },
        );
      }

      repairAttempts += 1;
      repair = { previousOutput: result.data, problems: validation.problems };
      log.warn(LOG_EVENTS.repairTriggered, { reason: 'validation' });
    }

    throw new AuditError('AI_INVALID_OUTPUT', 'Exhausted validation attempts');
  } finally {
    clearTimeout(budgetTimer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Transport-level retry.
 *
 * Only genuinely transient conditions are retried. A refusal, a malformed
 * output or a timeout are not: the first two will not change on a re-ask, and
 * the third has already spent the budget that made it fail.
 */
async function callWithRetry<T>(
  call: () => Promise<T>,
  signal: AbortSignal,
  log: Logger,
): Promise<T> {
  let lastError: AuditError | null = null;

  for (let attempt = 0; attempt <= ANALYSIS_LIMITS.maxTransportRetries; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const auditError = toAuditError(error);
      lastError = auditError;

      const canRetry =
        isRetryable(auditError) &&
        attempt < ANALYSIS_LIMITS.maxTransportRetries &&
        !signal.aborted;

      log.warn(LOG_EVENTS.aiRequestFailed, {
        attempt,
        code: auditError.code,
        willRetry: canRetry,
      });

      if (!canRetry) throw auditError;
      await sleep(backoffMs(attempt), signal);
    }
  }

  throw lastError ?? new AuditError('AI_UNAVAILABLE', 'Exhausted retries');
}

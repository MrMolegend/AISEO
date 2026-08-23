import 'server-only';
import { retrieveSiteFacts } from '@/lib/retrieval/fetch-page';
import { runAnalysis } from '@/lib/ai/run-analysis';
import { buildReport } from '@/lib/validation/post-process';
import { getAuditStore } from '@/lib/storage';
import { getRateLimiter, hashUrl } from '@/lib/security/rate-limit';
import { toAuditError } from '@/lib/errors';
import { createLogger, LOG_EVENTS } from '@/lib/observability/logger';
import type { StageId } from './stages';

/**
 * The audit pipeline.
 *
 * A pure function of an audit id: everything it needs is already in storage, and
 * everything it produces goes back there. That shape is deliberate — it means
 * the trigger mechanism is swappable in one place. Today it runs in the same
 * invocation via `after()`; moving to a queue later changes how this is called,
 * not what it does.
 *
 * It never throws. A failure is recorded against the audit row so the user sees
 * a designed error state rather than a request that hangs.
 */
export async function runAuditPipeline(publicId: string): Promise<void> {
  const log = createLogger({ publicId });
  const store = await getAuditStore();
  const limiter = await getRateLimiter();

  const record = await store.getByPublicId(publicId);
  if (!record) {
    log.error(LOG_EVENTS.auditFailed, { reason: 'record_missing' });
    return;
  }

  const lockKey = hashUrl(record.normalizedUrl);
  const started = Date.now();

  const advance = async (stage: StageId) => {
    await store.setStage(publicId, stage);
    log.debug('pipeline.stage', { stage });
  };

  try {
    log.info('pipeline.started', { domain: record.domain });

    // robots.txt is checked inside retrieveSiteFacts; the stage is announced
    // here so the progress screen reflects the work in the order it happens.
    await advance('robots');
    await advance('fetching');

    log.info(LOG_EVENTS.fetchStarted, { domain: record.domain });
    const facts = await retrieveSiteFacts(record.normalizedUrl);
    log.info(LOG_EVENTS.fetchCompleted, {
      status: facts.httpStatus,
      bytes: facts.htmlBytes,
      responseTimeMs: facts.responseTimeMs,
    });

    await advance('extracting');
    log.info(LOG_EVENTS.extractionCompleted, {
      wordCount: facts.content.wordCount,
      checks: facts.checks.length,
      links: facts.links.counts.internal + facts.links.counts.external,
    });

    await advance('analysing');
    await advance('generating');

    const { analysis, meta } = await runAnalysis(facts, record.domain, { logger: log });

    await advance('validating');
    const report = buildReport({
      publicId,
      url: record.normalizedUrl,
      domain: record.domain,
      facts,
      analysis,
      meta,
      createdAt: record.createdAt,
    });

    await advance('saving');
    await store.complete(publicId, report);

    log.info(LOG_EVENTS.auditSaved, {
      overallScore: report.overallScore,
      issues: report.analysis.issues.length,
      durationMs: Date.now() - started,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      repairAttempts: meta.repairAttempts,
    });
  } catch (error) {
    const auditError = toAuditError(error);
    log.error(LOG_EVENTS.auditFailed, {
      code: auditError.code,
      durationMs: Date.now() - started,
      context: auditError.context,
      error: auditError,
    });
    await store.fail(publicId, auditError.code);
  } finally {
    // Releasing here rather than on success only: a failed audit must not hold
    // the URL locked until the TTL expires, or a user cannot retry.
    await limiter.releaseLock(lockKey).catch(() => {});
  }
}

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getPackage } from '@/config/packages';
import { getEnv, hasAnthropic } from '@/lib/env';
import { PlatformError, toPlatformError } from '@/lib/errors';
import { logger, type Logger } from '@/lib/observability/logger';
import { getResearchProvider } from '@/lib/research';
import { SourceRegistry } from '@/lib/crawl/source-registry';
import { crawlSite } from '@/lib/crawl/crawler';
import { summarisePages } from '@/lib/crawl/page-facts';
import { isCrawlable } from '@/lib/research/policy';
import type { ZodType } from 'zod';
import { REPORT_SCHEMAS } from '@/schemas/research/packages';
import type { StoredSource } from '@/schemas/research/shared';
import { validateReport } from '@/lib/validation/research';
import {
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserMessage,
  buildRepairMessage,
} from '@/prompts/research';
import { getTokenWallet } from '@/lib/tokens';
import { finalizeKey, refundKey } from '@/lib/tokens/idempotency';
import type { SynthesisInput, SynthesisResult } from '@/lib/ai/research-provider';
import { getResearchJobStore, type ResearchJobRecord } from './store';
import { buildQueries } from './queries';

/**
 * The research pipeline.
 *
 * Runs after the HTTP response has already gone back to the browser, which is
 * why nothing here throws to a caller: the only ways out are a completed job or
 * a failed one, and both are written to storage.
 *
 * The token lifecycle is the part worth reading carefully. Tokens are reserved
 * before this function is called; this function either finalises the
 * reservation (the report exists) or refunds it (something went wrong on our
 * side). It never does neither. The decision is not made here either — it is
 * read from the error taxonomy, so "does this refund?" has one answer in one
 * place rather than a condition in the middle of a long function.
 */

/** Whole-job ceiling, including every stage. */
export const JOB_BUDGET_MS = 240_000;

/** Deliberately one. A second repair has never been the difference. */
const MAX_REPAIR_ATTEMPTS = 1;

export interface RunJobOptions {
  signal?: AbortSignal;
  logger?: Logger;
}

export async function runResearchJob(
  job: ResearchJobRecord,
  options: RunJobOptions = {},
): Promise<void> {
  const log = options.logger ?? logger;
  const store = await getResearchJobStore();
  const wallet = await getTokenWallet();
  const started = Date.now();

  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), JOB_BUDGET_MS);

  // An already-aborted signal must be handled explicitly: addEventListener only
  // fires for events dispatched after it is attached, so a caller passing a
  // signal that aborted earlier would otherwise sail past this and spend money
  // nobody is waiting for.
  if (options.signal?.aborted) {
    clearTimeout(budgetTimer);
    await settleFailure(
      job,
      new PlatformError('JOB_TIMEOUT', 'Cancelled before starting'),
      log,
    );
    return;
  }
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const pkg = getPackage(job.packageId);
    const registry = new SourceRegistry(pkg.limits.maxSources);
    const env = getEnv();

    /* ── Read the submitted company's own site ─────────────────────────── */
    await store.setStage(job.id, 'understanding');

    const crawl = await crawlSite(
      normaliseWebsite(job.input.website),
      registry,
      {
        maxPages: pkg.limits.maxOwnSitePages,
        maxTotalBytes: pkg.limits.maxTotalCrawlBytes,
        maxDurationMs: pkg.limits.maxCrawlMs,
        concurrency: 3,
      },
      controller.signal,
    );

    log.info('job.crawled_own_site', {
      jobId: job.publicId,
      pages: crawl.stats.fetched,
      stoppedBecause: crawl.stats.stoppedBecause,
    });

    /* ── Search public sources ─────────────────────────────────────────── */
    await store.setStage(job.id, 'discovering');

    const research = await getResearchProvider();
    const queries = buildQueries(job.input, crawl).slice(0, pkg.limits.maxSearchQueries);

    let searchCredits = 0;
    const externalUrls: string[] = [];

    for (const query of queries) {
      if (controller.signal.aborted) break;
      if (registry.isFull) break;

      const response = await research.search(
        { query: query.text, maxResults: query.maxResults, country: query.country },
        controller.signal,
      );
      searchCredits += response.usage.credits ?? 0;

      for (const result of response.results) {
        const source = registry.register({
          url: result.url,
          title: result.title,
          type: 'search_result',
          excerpt: result.excerpt,
        });
        if (source && isCrawlable(result.url)) externalUrls.push(result.url);
      }
    }

    if (registry.size < 3) {
      // Not enough to build anything worth paying for. Stopping here and
      // refunding is more honest than producing a report from two pages.
      throw new PlatformError(
        'NO_RELIABLE_SOURCES',
        `Only ${registry.size} usable sources were found`,
      );
    }

    /* ── Read the most promising external pages ────────────────────────── */
    await store.setStage(job.id, 'crawling');
    await store.setStage(job.id, 'extracting');

    /* ── Analyse ───────────────────────────────────────────────────────── */
    await store.setStage(job.id, 'building');
    await store.setStage(job.id, 'analysing');

    const nonce = randomBytes(8).toString('hex');
    const researchContext = summarisePages(crawl.pages, pkg.limits.maxContextChars);
    // Widened deliberately. REPORT_SCHEMAS is a union of four differently-shaped
    // schemas; the pipeline treats the result as opaque and stores it as jsonb,
    // and the render layer re-parses with the specific schema for the package.
    const schema: ZodType = REPORT_SCHEMAS[job.packageId];

    const userMessage = buildUserMessage({
      packageId: job.packageId,
      input: job.input,
      sourceList: registry.toPromptList(),
      researchContext,
      nonce,
    });

    const provider: Synthesiser = await resolveSynthesiser();

    let repairAttempts = 0;
    /**
     * The previous round's failure, carried into the repair attempt.
     *
     * Function-scoped rather than module-scoped: several jobs run in the same
     * process, and a shared variable here would let one job's malformed output
     * become another job's repair context.
     */
    let lastFailure: { data: unknown; problems: string[] } | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let modelUsed = env.AI_MODEL;
    let report: unknown = null;

    for (let round = 0; round <= MAX_REPAIR_ATTEMPTS; round += 1) {
      const previous: { data: unknown; problems: string[] } | null =
        round === 0 ? null : lastFailure;

      const result = await provider.synthesise(
        {
          model: env.AI_MODEL,
          systemPrompt: SYSTEM_PROMPT,
          userMessage,
          schema,
          maxOutputTokens: pkg.limits.maxOutputTokens,
          ...(previous
            ? {
                repair: {
                  previousOutput: previous.data,
                  problems: previous.problems,
                  repairMessage: buildRepairMessage(previous.problems),
                },
              }
            : {}),
        },
        controller.signal,
      );

      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      modelUsed = result.model;

      await store.setStage(job.id, 'checking');

      // Running out of output budget yields a partial object that may still
      // parse. Treating it as invalid routes it through repair with an
      // instruction to be briefer, which is the right correction.
      if (result.truncated) {
        if (round >= MAX_REPAIR_ATTEMPTS) {
          throw new PlatformError(
            'AI_INVALID_OUTPUT',
            'Output exceeded the budget twice',
          );
        }
        repairAttempts += 1;
        lastFailure = {
          data: result.data,
          problems: [
            'The report was cut off because it exceeded the output limit. Produce the same report more concisely: keep every section, but shorten the longer prose fields.',
          ],
        };
        continue;
      }

      const validation = validateReport(result.data, schema, registry);

      if (validation.ok) {
        if (validation.sanitizedFields.length > 0) {
          // On a page with no injected content this list should be empty, so a
          // non-empty one is worth a warning rather than an info.
          log.warn('job.output_sanitized', {
            jobId: job.publicId,
            fields: validation.sanitizedFields.slice(0, 10),
          });
        }
        report = validation.report;
        break;
      }

      log.warn('job.validation_failed', {
        jobId: job.publicId,
        round,
        problems: validation.problems.slice(0, 5),
      });

      if (round >= MAX_REPAIR_ATTEMPTS) {
        throw new PlatformError(
          'AI_INVALID_OUTPUT',
          `Validation failed after ${repairAttempts} repair attempt(s)`,
          { context: { problems: validation.problems.slice(0, 5) } },
        );
      }

      repairAttempts += 1;
      lastFailure = { data: result.data, problems: validation.problems };
    }

    if (!report) {
      throw new PlatformError('AI_INVALID_OUTPUT', 'No usable report was produced');
    }

    /* ── Save ──────────────────────────────────────────────────────────── */
    await store.setStage(job.id, 'saving');

    const sources: StoredSource[] = registry.all().map((source) => ({
      ref: source.ref,
      position: source.position,
      url: source.url,
      title: source.title,
      publisherDomain: source.publisherDomain,
      retrievedAt: source.retrievedAt,
      fetched: source.fetched,
    }));

    await store.complete({
      jobId: job.id,
      report,
      sources,
      meta: {
        model: modelUsed,
        promptVersion: PROMPT_VERSION,
        researchProvider: research.name,
        searchQueries: queries.length,
        pagesRead: crawl.stats.fetched,
        sourceCount: registry.size,
        inputTokens,
        outputTokens,
        repairAttempts,
        durationMs: Date.now() - started,
      },
    });

    /* ── Settle the tokens ─────────────────────────────────────────────── */
    await store.setStage(job.id, 'settling');

    // The report exists and the user can read it, so the hold becomes a spend.
    // If this throws, the user has their report and their tokens are still
    // held; the reconciliation path is a support action, not a lost report.
    await wallet.finalize({
      userId: job.userId,
      jobId: job.id,
      idempotencyKey: finalizeKey(job.id),
    });

    log.info('job.completed', {
      jobId: job.publicId,
      packageId: job.packageId,
      durationMs: Date.now() - started,
      sources: registry.size,
      searchCredits,
      inputTokens,
      outputTokens,
      repairAttempts,
    });
  } catch (error) {
    await settleFailure(job, toPlatformError(error), log);
  } finally {
    clearTimeout(budgetTimer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Records the failure and returns the tokens, if the taxonomy says to.
 *
 * The refund decision comes from the error code rather than from a condition
 * here, which is what keeps the policy readable and testable. The refund is
 * idempotent twice over — by key, and by the database refusing to settle an
 * already-settled reservation — so a retried failure path cannot mint tokens.
 */
async function settleFailure(
  job: ResearchJobRecord,
  error: PlatformError,
  log: Logger,
): Promise<void> {
  const store = await getResearchJobStore();

  try {
    await store.fail(job.id, error.code);
  } catch (storageError) {
    log.error('job.fail_write_failed', {
      jobId: job.publicId,
      error: String(storageError),
    });
  }

  if (!error.refundsTokens) {
    log.info('job.failed_without_refund', { jobId: job.publicId, code: error.code });
    return;
  }

  try {
    const wallet = await getTokenWallet();
    const result = await wallet.refund({
      userId: job.userId,
      jobId: job.id,
      idempotencyKey: refundKey(job.id),
      reason: `Refunded automatically: ${error.copy.title}`,
    });

    log.info('job.refunded', {
      jobId: job.publicId,
      code: error.code,
      replayed: result.replayed,
      availableAfter: result.available,
    });
  } catch (refundError) {
    // The user is owed tokens and we could not return them. This is the one
    // failure in the system that needs a human, so it is logged at error with
    // everything needed to settle it by hand.
    log.error('job.refund_failed', {
      jobId: job.publicId,
      userId: job.userId,
      tokenCost: job.tokenCost,
      code: error.code,
      error: String(refundError),
    });
  }
}

/**
 * What the pipeline needs from a synthesiser.
 *
 * Named explicitly rather than inferred from the two implementations, because
 * inferring a union of them makes the call site's result type circular.
 */
interface Synthesiser {
  readonly name: string;
  synthesise(input: SynthesisInput, signal: AbortSignal): Promise<SynthesisResult>;
}

/** Adds a scheme if the user did not type one. */
function normaliseWebsite(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/**
 * Resolves the synthesiser.
 *
 * Falls back to a fixture provider without a key, so the whole pipeline is
 * exercisable locally and in CI without spending anything. The health endpoint
 * reports production as failing while that is the case.
 */
async function resolveSynthesiser(): Promise<Synthesiser> {
  const env = getEnv();

  if (!hasAnthropic(env)) {
    const { MockSynthesiser } = await import('@/lib/ai/mock-synthesiser');
    return new MockSynthesiser();
  }

  const { AnthropicResearchProvider } = await import('@/lib/ai/research-provider');
  return new AnthropicResearchProvider(env.ANTHROPIC_API_KEY!);
}

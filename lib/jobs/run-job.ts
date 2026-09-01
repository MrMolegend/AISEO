import 'server-only';
import { randomBytes } from 'node:crypto';
import type { ZodType } from 'zod';
import {
  JOB_BUDGET_MS,
  MAX_SOURCES,
  RETRIEVAL_BUDGET,
  SYNTHESIS_BUDGET,
} from '@/config/report';
import { countryName } from '@/config/markets';
import { getEnv, hasAnthropic, servesRealCustomers } from '@/lib/env';
import { PlatformError, toPlatformError } from '@/lib/errors';
import { logger, type Logger } from '@/lib/observability/logger';
import { getResearchProvider, getRetrievalTransport } from '@/lib/research';
import { SearchBudget } from '@/lib/research/budget';
import { planSearches, AREA_LABEL, type InvestigationArea } from '@/lib/research/plan';
import {
  classifySource,
  geographicRelevanceOf,
  publisherOf,
} from '@/lib/research/classify';
import { retrieveSources, prioritiseForRetrieval } from '@/lib/research/retrieve';
import { SourceRegistry } from '@/lib/crawl/source-registry';
import { summarisePages } from '@/lib/crawl/page-facts';
import {
  storedMarketEntryInputSchema,
  type MarketEntryInput,
} from '@/schemas/market-entry/input';
import {
  modelReportSchema,
  MARKET_ENTRY_SCHEMA_VERSION,
  type MarketSource,
  type ModelReport,
  type MarketEntryReport,
} from '@/schemas/market-entry/report';
import type { GradingSource, RetrievalMode } from '@/schemas/market-entry/evidence';
import type { EvidenceGrade } from '@/config/design';
import type { StoredSource } from '@/schemas/research/shared';
import {
  validateMarketEntryReport,
  limitationsFromDemotions,
} from '@/lib/validation/market-entry';
import { evaluateQualityGate } from '@/lib/market-entry/quality-gate';
import { buildDecision } from '@/lib/market-entry/scoring';
import { buildScenarios } from '@/lib/market-entry/pricing';
import {
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserMessage,
  buildRepairMessage,
} from '@/prompts/market-entry';
import { getTokenWallet } from '@/lib/tokens';
import { finalizeKey, refundKey } from '@/lib/tokens/idempotency';
import type { SynthesisInput, SynthesisResult } from '@/lib/ai/research-provider';
import { getResearchJobStore, type ResearchJobRecord } from './store';
import type { StageId } from './stages';

/**
 * The market-entry pipeline.
 *
 * Runs after the HTTP response has already gone back to the browser, which is
 * why nothing here throws to a caller: the only ways out are a completed job or
 * a failed one, and both are written to storage.
 *
 * Two things are worth reading carefully.
 *
 * **The token lifecycle.** Tokens are reserved before this function is called.
 * This function either finalises the reservation or refunds it, never neither.
 * Finalisation now happens *after* the quality gate rather than after the
 * report is written, so the customer is only permanently charged for a document
 * that was worth producing. A gate failure refunds through the same idempotent
 * path as any other failure, keyed on the job, so a retry can neither
 * double-charge nor double-refund.
 *
 * **Retrieval is enrichment.** The search phase produces sources; the retrieval
 * phase opens some of them. Every part of the code below is written so that
 * retrieval returning nothing at all is an ordinary Tuesday: the claims that
 * needed a directly-read source are labelled unverified, the gaps are recorded,
 * and the report ships. There is no path from "a page refused us" to "the
 * customer loses their report".
 */

export { JOB_BUDGET_MS };

export interface RunJobOptions {
  signal?: AbortSignal;
  logger?: Logger;
}

/** Which stage each investigation area is researched under. */
const AREA_STAGE: Record<InvestigationArea, StageId> = {
  'market-conditions': 'mapping',
  demand: 'mapping',
  competitors: 'competitors',
  substitutes: 'competitors',
  pricing: 'competitors',
  buyers: 'channels',
  channels: 'channels',
  partners: 'channels',
  regulatory: 'regulatory',
  barriers: 'regulatory',
  approaches: 'regulatory',
  'key-question': 'regulatory',
};

interface EnrichedSource extends MarketSource {
  /** Provider relevance, used only to prioritise retrieval. Never rendered. */
  score: number;
}

export async function runResearchJob(
  job: ResearchJobRecord,
  options: RunJobOptions = {},
): Promise<void> {
  const log = options.logger ?? logger;
  const store = await getResearchJobStore();
  const wallet = await getTokenWallet();
  const env = getEnv();
  const started = Date.now();

  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), JOB_BUDGET_MS);
  const onExternalAbort = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      // addEventListener only fires for later events, so an already-aborted
      // signal has to be handled explicitly or the job runs to completion after
      // being cancelled.
      clearTimeout(budgetTimer);
      await settleFailure(
        job,
        new PlatformError('JOB_TIMEOUT', 'Cancelled before the job started'),
        log,
      );
      return;
    }
    options.signal.addEventListener('abort', onExternalAbort);
  }

  const registry = new SourceRegistry(MAX_SOURCES);
  const sources = new Map<string, EnrichedSource>();

  let searchesBasic = 0;
  let searchesAdvanced = 0;
  let searchCredits = 0;
  let sourcesFound = 0;
  let sourcesRejected = 0;

  try {
    /* ── context ─────────────────────────────────────────────────────────── */
    await store.setStage(job.id, 'context');

    /*
     * The *stored* schema, not the submission one.
     *
     * `create-job` has already normalised money into integer minor units;
     * re-running the submission schema here would multiply every amount by a
     * hundred a second time, so a customer's €8.90 shelf price would reach the
     * model — and the margin scenarios — as €890.
     */
    const parsed = storedMarketEntryInputSchema.safeParse(job.input);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Stored brief no longer validates');
    }
    const input: MarketEntryInput = parsed.data;

    const targetName = countryName(input.targetCountry);
    const originName = countryName(input.originCountry);

    const research = await getResearchProvider();
    const transport = await getRetrievalTransport();

    /*
     * The lock that matters most.
     *
     * A deployment real customers reach may not run a report on fixture
     * research, because the output is confident, well-shaped and entirely
     * fictional, and nothing downstream can tell. The health endpoint reports
     * the same condition; this is the one that stops the job.
     */
    if (servesRealCustomers(env) && !research.isLive) {
      throw new PlatformError(
        'RESEARCH_PROVIDER_UNAVAILABLE',
        'Live research is not configured on this deployment',
      );
    }

    const budget = new SearchBudget();
    const plan = planSearches(input, budget);

    /* ── search, across four stages ──────────────────────────────────────── */
    let currentStage: StageId | null = null;

    for (const query of plan) {
      if (controller.signal.aborted) break;

      const stage = AREA_STAGE[query.area];
      if (stage !== currentStage) {
        await store.setStage(job.id, stage);
        currentStage = stage;
      }

      let response;
      try {
        response = await research.search(
          {
            query: query.text,
            maxResults: query.maxResults,
            country: query.country,
            depth: query.depth,
            area: query.area,
          },
          controller.signal,
        );
      } catch (error) {
        /*
         * One failed query is not a failed report.
         *
         * The provider being briefly unavailable, or refusing one oddly-shaped
         * query, should cost that query's evidence and nothing else. Only a
         * search phase that produced almost nothing is a real failure, and that
         * is caught by the source floor below rather than by the first error.
         */
        log.warn('job.search_failed', {
          jobId: job.publicId,
          area: query.area,
          error: String(error),
        });
        continue;
      }

      if (query.depth === 'advanced') searchesAdvanced += 1;
      else searchesBasic += 1;
      searchCredits += response.usage.credits ?? 0;

      for (const result of response.results) {
        sourcesFound += 1;
        const registered = registry.register({
          url: result.url,
          title: result.title,
          type: 'search_result',
          excerpt: result.excerpt,
          fetched: false,
        });

        if (!registered) {
          sourcesRejected += 1;
          continue;
        }
        if (sources.has(registered.ref)) continue;

        const category = classifySource(registered.url, registered.title);
        sources.set(registered.ref, {
          ref: registered.ref,
          position: registered.position,
          url: registered.url,
          title: registered.title,
          publisher: publisherOf(registered.url),
          category,
          retrievalMode: 'indexed',
          retrievedAt: registered.retrievedAt,
          publishedAt: result.publishedDate,
          geographicRelevance: geographicRelevanceOf({
            url: registered.url,
            title: registered.title,
            targetCountry: input.targetCountry,
            targetCountryName: targetName,
            targetRegion: input.targetRegion,
            originCountry: input.originCountry,
            originCountryName: originName,
          }),
          excerpt: registered.excerpt,
          confidence: 'medium',
          supports: [],
          score: result.score,
        });
      }
    }

    if (registry.size < 3) {
      throw new PlatformError(
        'NO_RELIABLE_SOURCES',
        'The search phase found almost nothing about this market',
      );
    }

    /* ── the profile's website, as one optional seed ─────────────────────── */

    /*
     * When the brief came from a profile that names a website, that page joins
     * the pool as one more candidate source — labelled as the company's own
     * site, never as an authority, and registered after the source floor so it
     * cannot prop up a search phase that found nothing real. Everything that
     * can go wrong with it — robots refusal, timeout, a site that is a single
     * image — is the retrieval stage's ordinary best-effort behaviour, which
     * records a limitation and moves on. A missing or unreadable website can
     * not fail a report; that is this product's standing promise.
     */
    if (job.profileId) {
      const { getBusinessProfileStore } = await import('@/lib/profiles/store');
      const profile = await getBusinessProfileStore()
        .then((profiles) => profiles.getForUser(job.profileId!, job.userId))
        .catch(() => null);

      if (profile?.websiteUrl) {
        const registered = registry.register({
          url: profile.websiteUrl,
          title: `${input.businessName} — own website`,
          type: 'search_result',
          fetched: false,
        });
        if (registered && !sources.has(registered.ref)) {
          sourcesFound += 1;
          sources.set(registered.ref, {
            ref: registered.ref,
            position: registered.position,
            url: registered.url,
            title: registered.title,
            publisher: publisherOf(registered.url),
            // The customer's own site: company evidence by definition, and the
            // grade derivation already refuses to let 'company' carry a
            // regulatory or market-size claim.
            category: 'company',
            retrievalMode: 'indexed',
            retrievedAt: registered.retrievedAt,
            publishedAt: null,
            geographicRelevance: 'origin-market',
            excerpt: null,
            confidence: 'medium',
            supports: [],
            score: 0.6,
          });
        }
      }
    }

    /* ── retrieval: best-effort, never fatal ─────────────────────────────── */
    const shortlist = prioritiseForRetrieval(
      [...sources.values()].map((source) => ({
        url: source.url,
        category: source.category,
        score: source.score,
      })),
      RETRIEVAL_BUDGET.maxFetches * 2,
    );

    const retrieval = await retrieveSources(shortlist, controller.signal, { transport });

    for (const page of retrieval.retrieved) {
      const registered = registry.register({
        url: page.url,
        title: page.facts.title,
        type: 'web_page',
        httpStatus: page.facts.httpStatus,
        content: page.facts.text,
        fetched: true,
      });
      if (!registered) continue;

      const existing = sources.get(registered.ref);
      if (existing) {
        // Upgraded, not duplicated: the same page seen in the index and then
        // opened is one source whose evidence got stronger.
        existing.retrievalMode = 'direct' satisfies RetrievalMode;
        existing.title = registered.title ?? existing.title;
        existing.confidence = 'high';
      }
    }

    log.info('job.retrieval', {
      jobId: job.publicId,
      attempted: retrieval.stats.attempted,
      retrieved: retrieval.stats.succeeded,
      blocked: retrieval.blocked.length,
      stoppedBecause: retrieval.stats.stoppedBecause,
    });

    /* ── strategy: one synthesis, at most one repair ─────────────────────── */
    await store.setStage(job.id, 'strategy');

    const nonce = randomBytes(8).toString('hex');
    const researchContext = summarisePages(
      retrieval.retrieved.map((page) => ({
        facts: page.facts,
        sourceRef: refFor(page.url, sources),
      })),
      SYNTHESIS_BUDGET.maxContextChars,
    );

    const userMessage = buildUserMessage({
      brief: input,
      sourceList: renderSourceList(sources),
      researchContext: [researchContext, renderIndexedExcerpts(sources)]
        .filter((block) => block.length > 0)
        .join('\n\n'),
      nonce,
    });

    const provider = await resolveSynthesiser();
    const gradingSources = new Map<string, GradingSource>(
      [...sources.entries()].map(([ref, source]) => [
        ref,
        { category: source.category, retrievalMode: source.retrievalMode },
      ]),
    );

    let report: ModelReport | null = null;
    let grades: Record<string, EvidenceGrade> = {};
    let demotions: ReturnType<typeof limitationsFromDemotions> = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let repairAttempts = 0;
    let modelUsed = env.AI_MODEL;

    let previous: { output: unknown; problems: string[] } | null = null;

    for (let round = 0; round <= SYNTHESIS_BUDGET.maxRepairAttempts; round += 1) {
      if (controller.signal.aborted) {
        throw new PlatformError('JOB_TIMEOUT', 'Cancelled during synthesis');
      }
      if (round > 0) repairAttempts += 1;

      const synthesisInput: SynthesisInput = {
        model: env.AI_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        schema: modelReportSchema as unknown as ZodType,
        maxOutputTokens: SYNTHESIS_BUDGET.maxOutputTokens,
        ...(previous
          ? {
              repair: {
                previousOutput: previous.output,
                problems: previous.problems,
                repairMessage: buildRepairMessage(previous.problems),
              },
            }
          : {}),
      };

      const result: SynthesisResult = await provider.synthesise(
        synthesisInput,
        controller.signal,
      );

      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      modelUsed = result.model;

      await store.setStage(job.id, 'evidence');

      if (result.truncated) {
        const problems = [
          'The report was cut off before it finished. Produce a more concise version that still covers every section.',
        ];
        if (round >= SYNTHESIS_BUDGET.maxRepairAttempts) {
          throw new PlatformError(
            'AI_INVALID_OUTPUT',
            'Output exceeded the budget twice',
          );
        }
        previous = { output: result.data, problems };
        continue;
      }

      const validation = validateMarketEntryReport(
        result.data,
        modelReportSchema,
        gradingSources,
      );

      if (validation.ok) {
        if (validation.sanitizedFields.length > 0) {
          // Should be empty on a clean page. A non-empty list means something
          // in a crawled source tried to write markup or an instruction into
          // the report, which is worth knowing about even though it was
          // removed.
          log.warn('job.output_sanitized', {
            jobId: job.publicId,
            fields: validation.sanitizedFields.slice(0, 10),
          });
        }
        report = validation.report;
        grades = validation.grades;
        demotions = limitationsFromDemotions(validation.demotions);
        break;
      }

      log.info('job.validation_failed', {
        jobId: job.publicId,
        round,
        problems: validation.problems.slice(0, 5),
      });

      if (round >= SYNTHESIS_BUDGET.maxRepairAttempts) {
        throw new PlatformError(
          'AI_INVALID_OUTPUT',
          'The report did not validate after a repair attempt',
          { context: { problems: validation.problems.slice(0, 5) } },
        );
      }
      previous = { output: result.data, problems: validation.problems };
    }

    if (!report) {
      throw new PlatformError('AI_INVALID_OUTPUT', 'No usable report was produced');
    }

    /* ── evidence: the quality gate decides whether this is chargeable ───── */
    const sourceList = [...sources.values()].map(stripScore);

    const gate = evaluateQualityGate({
      report,
      sources: sourceList,
      providerIsLive: research.isLive,
      servesRealCustomers: servesRealCustomers(env),
    });

    if (!gate.ok) {
      log.info('job.quality_gate_failed', {
        jobId: job.publicId,
        reasons: gate.reasons,
        measured: gate.measured,
      });
      throw new PlatformError(
        'INSUFFICIENT_MARKET_EVIDENCE',
        'The report did not clear the quality gate',
        { context: { reasons: gate.reasons } },
      );
    }

    /* ── dossier: score, assemble, save, settle ──────────────────────────── */
    await store.setStage(job.id, 'dossier');

    const researchedAt = new Date().toISOString();
    const decision = buildDecision({
      report,
      sources: sourceList,
      businessName: input.businessName,
      productName: input.productName,
      originCountry: input.originCountry,
      targetCountry: input.targetCountry,
      targetRegion: input.targetRegion,
      researchedAt,
    });

    const stored: MarketEntryReport = {
      ...report,
      schemaVersion: MARKET_ENTRY_SCHEMA_VERSION,
      decision,
      scenarios: buildScenarios(input),
      coverage: {
        sourcesFound,
        sourcesAccepted: sourceList.length,
        sourcesRejected,
        directlyRetrieved: gate.measured.directSources,
        fromIndexOnly: sourceList.length - gate.measured.directSources,
        authoritative: gate.measured.authoritativeSources,
        distinctPublishers: gate.measured.distinctPublishers,
        blocked: retrieval.blocked.slice(0, 30),
        areasCovered: coveredAreas(plan, sources),
        areasThin: thinAreas(plan, sources),
      },
      grades,
      sources: sourceList,
      appendix: {
        ...report.appendix,
        // Demotions become limitations the reader sees, appended to the ones
        // the report wrote for itself.
        limitations: [...report.appendix.limitations, ...demotions].slice(0, 12),
      },
    };

    /*
     * supports declares itself "computed, not declared" — this is the
     * computation, previously missing: each source records which sections
     * cite it, inverted from the claims' own refs.
     */
    {
      const { buildEvidenceIndex } = await import('@/lib/market-entry/evidence-index');
      const index = buildEvidenceIndex(stored);
      for (const source of stored.sources) {
        source.supports = (index.supports.get(source.ref) ?? []).slice(0, 24);
      }
    }

    await store.complete({
      jobId: job.id,
      report: stored,
      schemaVersion: MARKET_ENTRY_SCHEMA_VERSION,
      sources: sourceList.map(toStoredSource),
      meta: {
        model: modelUsed,
        promptVersion: PROMPT_VERSION,
        researchProvider: research.name,
        searchQueries: searchesBasic + searchesAdvanced,
        pagesRead: retrieval.stats.succeeded,
        sourceCount: sourceList.length,
        inputTokens,
        outputTokens,
        repairAttempts,
        durationMs: Date.now() - started,
        searchesBasic,
        searchesAdvanced,
        searchCredits,
        sourcesFound,
        sourcesAccepted: sourceList.length,
        sourcesRejected,
        sourcesBlocked: retrieval.blocked.length,
        sourcesDirect: gate.measured.directSources,
        authoritativeSources: gate.measured.authoritativeSources,
        qualityGate: 'passed',
        creditReservedTokens: job.tokenCost,
        settlement: 'finalised',
      },
    });

    /*
     * Settlement, after the gate and after the report is written.
     *
     * The order is the point: the customer is permanently charged only once a
     * usable report exists in storage. Idempotent by job id, so a retried
     * settlement replays rather than charging twice.
     */
    const settled = await wallet.finalize({
      userId: job.userId,
      jobId: job.id,
      idempotencyKey: finalizeKey(job.id),
    });

    log.info('job.completed', {
      jobId: job.publicId,
      durationMs: Date.now() - started,
      searchesBasic,
      searchesAdvanced,
      searchCredits,
      sourcesAccepted: sourceList.length,
      sourcesDirect: gate.measured.directSources,
      sourcesBlocked: retrieval.blocked.length,
      readiness: decision.readiness,
      verdict: decision.verdict,
      repairAttempts,
      settlementReplayed: settled.replayed,
    });
  } catch (error) {
    await settleFailure(job, toPlatformError(error), log);
  } finally {
    clearTimeout(budgetTimer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/* ────────────────────────────── Helpers ──────────────────────────────────── */

function stripScore(source: EnrichedSource): MarketSource {
  const { score: _score, ...rest } = source;
  void _score;
  return rest;
}

function refFor(url: string, sources: ReadonlyMap<string, EnrichedSource>): string {
  for (const [ref, source] of sources) {
    if (source.url === url) return ref;
  }
  return 'S0';
}

/**
 * The source list handed to the model.
 *
 * Ids, addresses and the two facts that decide what a citation can carry: how
 * the page reached us, and what kind of publisher it is. Excerpts are not
 * repeated here — they are in the research context, and duplicating them would
 * double the token cost of the largest section of the prompt.
 */
function renderSourceList(sources: ReadonlyMap<string, EnrichedSource>): string {
  return [...sources.values()]
    .map(
      (source) =>
        `${source.ref}: ${source.url}` +
        (source.title ? ` — ${source.title}` : '') +
        ` [${source.retrievalMode}] · ${source.category} · ${source.geographicRelevance}`,
    )
    .join('\n');
}

/**
 * Index summaries for the sources we never opened.
 *
 * Included because they are genuine weak signals and excluding them would waste
 * most of the research, and labelled because the model must be able to tell
 * them apart from a page we read. The grading pass enforces the consequence.
 */
function renderIndexedExcerpts(sources: ReadonlyMap<string, EnrichedSource>): string {
  const blocks = [...sources.values()]
    .filter((source) => source.retrievalMode === 'indexed' && source.excerpt)
    .map(
      (source) =>
        `--- ${source.ref} | ${source.url} | indexed summary, not read directly\n${source.excerpt}`,
    );

  return blocks.length > 0
    ? `# Index summaries (weak signals)\n\n${blocks.join('\n\n')}`
    : '';
}

function coveredAreas(
  plan: readonly { area: InvestigationArea }[],
  sources: ReadonlyMap<string, EnrichedSource>,
): string[] {
  const areas = new Set(plan.map((query) => query.area));
  return sources.size > 0 ? [...areas].map((area) => AREA_LABEL[area]) : [];
}

function thinAreas(
  plan: readonly { area: InvestigationArea }[],
  sources: ReadonlyMap<string, EnrichedSource>,
): string[] {
  // An area is thin when nothing credible from it was retrieved directly.
  const direct = [...sources.values()].filter(
    (source) => source.retrievalMode === 'direct',
  ).length;
  return direct === 0 ? plan.map((query) => AREA_LABEL[query.area]).slice(0, 4) : [];
}

function toStoredSource(source: MarketSource): StoredSource {
  return {
    ref: source.ref,
    position: source.position,
    url: source.url,
    title: source.title,
    publisherDomain: source.publisher,
    retrievedAt: source.retrievedAt,
    fetched: source.retrievalMode === 'direct',
    category: source.category,
    retrievalMode: source.retrievalMode,
    publishedAt: source.publishedAt,
    geographicRelevance: source.geographicRelevance,
    excerpt: source.excerpt,
  };
}

/**
 * Records the failure and returns the credit, if the taxonomy says to.
 *
 * The refund decision comes from the error code rather than from a condition
 * here, which keeps the policy readable and testable — and means a quality-gate
 * failure refunds through exactly the same path as an outage, with no special
 * case to get wrong. The refund is idempotent twice over, by key and by the
 * database refusing to settle an already-settled reservation, so neither a
 * retry nor a duplicated failure path can mint credit.
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
    // The customer is owed a credit and we could not return it. This is the one
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

/** What the pipeline needs from a synthesiser. */
interface Synthesiser {
  readonly name: string;
  synthesise(input: SynthesisInput, signal: AbortSignal): Promise<SynthesisResult>;
}

async function resolveSynthesiser(): Promise<Synthesiser> {
  if (hasAnthropic()) {
    const { AnthropicResearchProvider } = await import('@/lib/ai/research-provider');
    return new AnthropicResearchProvider(getEnv().ANTHROPIC_API_KEY!);
  }
  const { FixtureSynthesiser } = await import('@/lib/ai/fixture-synthesiser');
  return new FixtureSynthesiser();
}

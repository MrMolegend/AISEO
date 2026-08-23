import { getFixtureReport } from '@/fixtures';
import type { AIProvider, AuditModelInput, AuditModelResult } from './provider';
import type { AuditAnalysis } from '@/schemas/audit';
import { PlatformError } from '@/lib/errors';

/**
 * Deterministic provider for tests, CI and local development.
 *
 * This is what makes the whole pipeline runnable with no API key, no network and
 * no cost — which in turn is what lets the end-to-end suite exercise the real
 * routes rather than stubbing them.
 *
 * It is not a fake that pretends to be the real thing: it returns a fixture
 * analysis lightly adapted to the site being audited, and it deliberately
 * supports fault injection so the failure paths are testable.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';

  /** Set by tests to force a particular failure on the next call. */
  static fault:
    | { kind: 'invalid-shape' }
    | { kind: 'cross-reference' }
    | { kind: 'error'; code: 'AI_TIMEOUT' | 'AI_RATE_LIMITED' | 'AI_UNAVAILABLE' }
    | { kind: 'truncated' }
    | { kind: 'null-output' }
    /** Fails once, then succeeds — for exercising the repair path. */
    | { kind: 'fail-then-succeed'; remaining: number }
    | null = null;

  async runAudit(input: AuditModelInput, signal: AbortSignal): Promise<AuditModelResult> {
    signal.throwIfAborted();

    const fault = MockProvider.fault;

    if (fault?.kind === 'error') {
      throw new PlatformError(fault.code, `Mock provider fault: ${fault.code}`);
    }

    if (fault?.kind === 'null-output') {
      return this.result(null, input);
    }

    let analysis: unknown = this.buildAnalysis(input);

    if (fault?.kind === 'invalid-shape') {
      // A plausible-looking but wrong shape: the kind of thing that gets past a
      // casual eyeball and is exactly what the validation layer must catch.
      analysis = { ...(analysis as AuditAnalysis), issues: 'not an array' };
    }

    if (fault?.kind === 'cross-reference') {
      const base = structuredClone(analysis as AuditAnalysis);
      base.topPriorities[0]!.issueId = 'this-issue-does-not-exist';
      analysis = base;
    }

    if (fault?.kind === 'fail-then-succeed') {
      if (fault.remaining > 0) {
        fault.remaining -= 1;
        const base = structuredClone(analysis as AuditAnalysis);
        base.topPriorities[0]!.issueId = 'temporarily-broken-reference';
        analysis = base;
      }
    }

    return this.result(analysis, input, fault?.kind === 'truncated');
  }

  /**
   * Adapts the fixture analysis to the site actually being audited.
   *
   * Without this every mock audit would claim to be about Northwind Analytics,
   * which makes end-to-end assertions meaningless and would let a wiring bug
   * (facts never reaching the provider) pass unnoticed.
   */
  private buildAnalysis(input: AuditModelInput): AuditAnalysis {
    const analysis = structuredClone(getFixtureReport('strong-site').analysis);

    let domain = 'the audited site';
    let title: string | null = null;
    try {
      const facts = JSON.parse(input.factsJson) as {
        finalUrl?: string;
        meta?: { title?: string | null };
      };
      if (facts.finalUrl) domain = new URL(facts.finalUrl).hostname;
      title = facts.meta?.title ?? null;
    } catch {
      // Keep the defaults; a mock is not the place to be strict.
    }

    analysis.website.name = title?.slice(0, 80) || domain;
    analysis.website.description = `Mock analysis generated for ${domain}. This is fixture data, not a real audit.`;
    analysis.executiveSummary.headline = `Mock audit of ${domain}`.slice(0, 120);

    return analysis;
  }

  private result(
    data: unknown,
    input: AuditModelInput,
    truncated = false,
  ): AuditModelResult {
    return {
      data,
      usage: {
        // Roughly proportional to the real payload so cost accounting in tests
        // is not identically zero.
        inputTokens: Math.ceil(input.factsJson.length / 4),
        outputTokens: 3_200,
      },
      model: 'mock',
      latencyMs: 5,
      truncated,
    };
  }
}

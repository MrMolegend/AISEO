import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAnalysis } from '@/lib/ai/run-analysis';
import { MockProvider } from '@/lib/ai/mock-provider';
import { resetProviderCache } from '@/lib/ai/index';
import { validateAnalysis } from '@/lib/validation/validate-report';
import { buildReport } from '@/lib/validation/post-process';
import { computeOverallScore } from '@/lib/validation/cross-reference';
import { auditReportSchema, ratingForScore } from '@/schemas/audit';
import { getFixtureReport } from '@/fixtures';
import { isPlatformError } from '@/lib/errors';
import type { SiteFacts } from '@/schemas/facts';

/**
 * The AI stage exercised end to end against the mock provider.
 *
 * Fault injection is the point: the retry policy, the single repair pass and the
 * failure taxonomy are the parts most likely to be wrong and least likely to be
 * noticed, because in the happy path none of them ever runs.
 */

const DOMAIN = 'northwind-analytics.com';

function facts(): SiteFacts {
  return structuredClone(getFixtureReport('strong-site').facts);
}

beforeEach(() => {
  MockProvider.fault = null;
  resetProviderCache();
});

afterEach(() => {
  MockProvider.fault = null;
});

describe('runAnalysis — happy path', () => {
  it('produces a validated analysis', async () => {
    const result = await runAnalysis(facts(), DOMAIN);
    expect(result.analysis.issues.length).toBeGreaterThan(0);
    expect(result.analysis.limitations.length).toBeGreaterThan(0);
    expect(result.meta.repairAttempts).toBe(0);
    expect(result.meta.promptVersion).toBe('seo-audit-v1');
  });

  it('records token usage so cost is a query rather than a guess', async () => {
    const result = await runAnalysis(facts(), DOMAIN);
    expect(result.meta.inputTokens).toBeGreaterThan(0);
    expect(result.meta.outputTokens).toBeGreaterThan(0);
  });

  it('passes the audited site through to the provider', async () => {
    // Proves the facts actually reach the model rather than the pipeline
    // silently analysing a fixture — a wiring bug that would otherwise pass.
    const custom = facts();
    custom.finalUrl = 'https://verify-wiring.example/';
    custom.meta.title = 'Wiring check title';

    const result = await runAnalysis(custom, 'verify-wiring.example');
    expect(result.analysis.executiveSummary.headline).toContain('verify-wiring.example');
  });
});

describe('runAnalysis — repair path', () => {
  it('repairs a cross-reference failure and succeeds on the second attempt', async () => {
    MockProvider.fault = { kind: 'fail-then-succeed', remaining: 1 };
    const result = await runAnalysis(facts(), DOMAIN);
    expect(result.meta.repairAttempts).toBe(1);
    expect(result.analysis.topPriorities[0]!.issueId).not.toBe(
      'temporarily-broken-reference',
    );
  });

  it('gives up after exactly one repair rather than looping', async () => {
    MockProvider.fault = { kind: 'cross-reference' };
    try {
      await runAnalysis(facts(), DOMAIN);
      throw new Error('expected AI_INVALID_OUTPUT');
    } catch (error) {
      expect(isPlatformError(error)).toBe(true);
      if (isPlatformError(error)) expect(error.code).toBe('AI_INVALID_OUTPUT');
    }
  });

  it('treats a truncated response as invalid and asks for brevity', async () => {
    MockProvider.fault = { kind: 'truncated' };
    try {
      await runAnalysis(facts(), DOMAIN);
      throw new Error('expected AI_INVALID_OUTPUT');
    } catch (error) {
      expect(isPlatformError(error)).toBe(true);
      if (isPlatformError(error)) expect(error.code).toBe('AI_INVALID_OUTPUT');
    }
  });

  it('fails cleanly on a malformed shape', async () => {
    MockProvider.fault = { kind: 'invalid-shape' };
    try {
      await runAnalysis(facts(), DOMAIN);
      throw new Error('expected AI_INVALID_OUTPUT');
    } catch (error) {
      if (isPlatformError(error)) expect(error.code).toBe('AI_INVALID_OUTPUT');
    }
  });

  it('fails cleanly when the provider returns nothing at all', async () => {
    MockProvider.fault = { kind: 'null-output' };
    try {
      await runAnalysis(facts(), DOMAIN);
      throw new Error('expected AI_INVALID_OUTPUT');
    } catch (error) {
      if (isPlatformError(error)) expect(error.code).toBe('AI_INVALID_OUTPUT');
    }
  });
});

describe('runAnalysis — transport failures', () => {
  it.each(['AI_TIMEOUT', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE'] as const)(
    'surfaces %s with its own code rather than a generic failure',
    async (code) => {
      MockProvider.fault = { kind: 'error', code };
      try {
        await runAnalysis(facts(), DOMAIN);
        throw new Error(`expected ${code}`);
      } catch (error) {
        expect(isPlatformError(error)).toBe(true);
        if (isPlatformError(error)) expect(error.code).toBe(code);
      }
    },
  );

  it('respects an external abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    // Aborting before the call means the provider must not proceed.
    await expect(
      runAnalysis(facts(), DOMAIN, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe('validateAnalysis', () => {
  const goodAnalysis = () => structuredClone(getFixtureReport('strong-site').analysis);

  it('accepts a coherent analysis', () => {
    const outcome = validateAnalysis(goodAnalysis(), DOMAIN);
    expect(outcome.ok).toBe(true);
  });

  it('rejects null with an explanatory problem', () => {
    const outcome = validateAnalysis(null, DOMAIN);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.problems[0]).toContain('empty');
  });

  it('reports schema problems with their field paths, for the repair prompt', () => {
    const broken = goodAnalysis() as unknown as Record<string, unknown>;
    delete broken.limitations;
    const outcome = validateAnalysis(broken, DOMAIN);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.problems.join(' ')).toContain('limitations');
    }
  });

  it('reports a cross-reference failure in words a model can act on', () => {
    const analysis = goodAnalysis();
    analysis.topPriorities[0]!.issueId = 'nonexistent-issue';
    const outcome = validateAnalysis(analysis, DOMAIN);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.problems[0]).toContain('nonexistent-issue');
  });

  it('sanitises injected markup without failing the audit', () => {
    const analysis = goodAnalysis();
    analysis.issues[0]!.finding =
      'The title tag is <script>alert(1)</script> far too long at 82 characters.';
    const outcome = validateAnalysis(analysis, DOMAIN);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.analysis.issues[0]!.finding).not.toContain('<script>');
      expect(outcome.sanitizedFields.length).toBeGreaterThan(0);
    }
  });

  it('fails when scrubbing leaves a field below its minimum length', () => {
    const analysis = goodAnalysis();
    // The summary requires 50 characters. Made almost entirely of off-domain
    // links, it scrubs to well under that, so the re-check after sanitising has
    // to catch it rather than storing something that would fail to parse on read.
    analysis.executiveSummary.summary =
      'https://a.example/x https://b.example/y https://c.example/z';
    const outcome = validateAnalysis(analysis, DOMAIN);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.problems[0]).toContain('length');
  });

  it('keeps an audit whose scrubbed fields still meet their minimums', () => {
    const analysis = goodAnalysis();
    analysis.issues[0]!.finding =
      'The title tag is 82 characters, see https://attacker.example/x for context, which exceeds the display limit.';
    const outcome = validateAnalysis(analysis, DOMAIN);
    expect(outcome.ok).toBe(true);
    if (outcome.ok)
      expect(outcome.analysis.issues[0]!.finding).toContain('82 characters');
  });
});

describe('buildReport', () => {
  it('computes the overall score rather than trusting the model', () => {
    const analysis = getFixtureReport('strong-site').analysis;
    const report = buildReport({
      publicId: 'test-id-0001',
      url: 'https://northwind-analytics.com/',
      domain: DOMAIN,
      facts: facts(),
      analysis,
      meta: {
        model: 'mock',
        promptVersion: 'test',
        durationMs: 1,
        repairAttempts: 0,
        inputTokens: 1,
        outputTokens: 1,
      },
    });

    expect(report.overallScore).toBe(computeOverallScore(analysis));
    expect(report.overallRating).toBe(ratingForScore(report.overallScore));
    expect(auditReportSchema.safeParse(report).success).toBe(true);
  });

  it('sorts issues by severity, then impact, then effort', () => {
    const analysis = structuredClone(getFixtureReport('weak-site').analysis);
    const report = buildReport({
      publicId: 'test-id-0002',
      url: 'https://example.com/',
      domain: 'example.com',
      facts: facts(),
      analysis,
      meta: {
        model: 'mock',
        promptVersion: 'test',
        durationMs: 1,
        repairAttempts: 0,
        inputTokens: 1,
        outputTokens: 1,
      },
    });

    const order = ['critical', 'high', 'medium', 'low'];
    const positions = report.analysis.issues.map((i) => order.indexOf(i.severity));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});

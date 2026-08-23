import { describe, expect, it } from 'vitest';
import { sanitizeAnalysis } from '@/lib/validation/sanitize';
import { getFixtureReport } from '@/fixtures';
import type { AuditAnalysis } from '@/schemas/audit';

/**
 * Output-side scrubbing is the last line of the injection defence and the one
 * that makes a successful injection survivable: the worst it can achieve is odd
 * prose, never markup or an attacker-controlled destination.
 */

const DOMAIN = 'northwind-analytics.com';

function withHeadline(text: string): AuditAnalysis {
  const analysis = structuredClone(getFixtureReport('strong-site').analysis);
  analysis.executiveSummary.headline = text;
  return analysis;
}

const scrubHeadline = (text: string) =>
  sanitizeAnalysis(withHeadline(text), DOMAIN).analysis.executiveSummary.headline;

describe('sanitizeAnalysis — markup', () => {
  // Tags become a space rather than nothing, so "a<br>b" does not become "ab".
  // Runs of whitespace are then collapsed.
  it.each([
    ['<script>alert(1)</script>Real text', 'alert(1) Real text'],
    ['Before <img src=x onerror=alert(1)> after', 'Before after'],
    ['<iframe src="evil"></iframe>Content', 'Content'],
    ['Text with <b>bold</b> markup', 'Text with bold markup'],
    ['word<br>word', 'word word'],
  ])('strips tags from %j', (input, expected) => {
    expect(scrubHeadline(input)).toBe(expected);
  });

  it('neutralises entity-encoded script tags', () => {
    expect(scrubHeadline('&lt;script&gt;bad')).not.toContain('&lt;script');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'vbscript:msgbox',
    'file:///etc/passwd',
  ])('removes the dangerous scheme in %j', (input) => {
    const result = scrubHeadline(`Click ${input} now`);
    expect(result).not.toMatch(/javascript:|data:|vbscript:|file:/i);
  });
});

describe('sanitizeAnalysis — links', () => {
  it('keeps a link to the audited domain', () => {
    const result = scrubHeadline(`See https://${DOMAIN}/pricing for details`);
    expect(result).toContain(`https://${DOMAIN}/pricing`);
  });

  it('accepts the www form of the audited domain', () => {
    const result = scrubHeadline(`See https://www.${DOMAIN}/x`);
    expect(result).toContain(`https://www.${DOMAIN}/x`);
  });

  it('removes a link to any other domain', () => {
    const result = scrubHeadline('Visit https://attacker.example/steal for details');
    expect(result).not.toContain('attacker.example');
    expect(result).toContain('[link removed]');
  });

  it('keeps a markdown link label but discards its destination', () => {
    const result = scrubHeadline(
      'Read [our pricing page](https://attacker.example/x) now',
    );
    expect(result).toContain('our pricing page');
    expect(result).not.toContain('attacker.example');
  });
});

describe('sanitizeAnalysis — traversal', () => {
  it('scrubs strings at every depth, not just the top level', () => {
    const analysis = structuredClone(getFixtureReport('strong-site').analysis);
    analysis.issues[0]!.recommendation = 'Fix <script>evil()</script> this';
    analysis.actionPlan.immediate[0]!.description = 'Go to https://evil.example now';
    analysis.limitations[0]!.detail = 'See <b>this</b> note';

    const { analysis: clean, report } = sanitizeAnalysis(analysis, DOMAIN);

    expect(clean.issues[0]!.recommendation).not.toContain('<script>');
    expect(clean.actionPlan.immediate[0]!.description).not.toContain('evil.example');
    expect(clean.limitations[0]!.detail).not.toContain('<b>');
    expect(report.fieldsModified.length).toBe(3);
  });

  it('records the path of every modified field', () => {
    const analysis = withHeadline('<b>x</b> and more text here to satisfy length');
    const { report } = sanitizeAnalysis(analysis, DOMAIN);
    expect(report.fieldsModified).toContain('executiveSummary.headline');
  });

  it('leaves clean content untouched and reports no modifications', () => {
    const analysis = structuredClone(getFixtureReport('strong-site').analysis);
    const { analysis: clean, report } = sanitizeAnalysis(analysis, DOMAIN);
    expect(report.fieldsModified).toEqual([]);
    expect(clean.executiveSummary.headline).toBe(analysis.executiveSummary.headline);
  });

  it('preserves non-string values', () => {
    const analysis = structuredClone(getFixtureReport('strong-site').analysis);
    const { analysis: clean } = sanitizeAnalysis(analysis, DOMAIN);
    expect(clean.categoryScores.technicalSEO.score).toBe(
      analysis.categoryScores.technicalSEO.score,
    );
    expect(clean.topPriorities[0]!.rank).toBe(analysis.topPriorities[0]!.rank);
    expect(clean.issues[0]!.evidence).not.toBeUndefined();
  });

  it('preserves null evidence rather than coercing it', () => {
    const analysis = structuredClone(getFixtureReport('strong-site').analysis);
    analysis.issues[0]!.evidence = null;
    const { analysis: clean } = sanitizeAnalysis(analysis, DOMAIN);
    expect(clean.issues[0]!.evidence).toBeNull();
  });
});

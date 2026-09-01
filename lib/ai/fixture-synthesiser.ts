import 'server-only';
import { PlatformError } from '@/lib/errors';
import { FIXTURE_SYNTHESIS } from '@/fixtures/market-entry/synthesis';
import type { SynthesisInput, SynthesisResult } from './research-provider';

/**
 * The synthesiser used whenever no Anthropic key is configured.
 *
 * It returns one checked-in report for the illustrative case rather than
 * generating placeholder text from the schema, and that is a deliberate
 * reversal of what this file used to do. Schema-generated output proved the
 * plumbing moved bytes and proved nothing else: you cannot test a quality gate
 * against a report whose every competitor is called "string", you cannot judge
 * a layout against lorem ipsum, and you certainly cannot show it to a visitor
 * as an example.
 *
 * One real report costs a fixture to maintain and buys an end-to-end test of
 * the grader, the gate, the scoring model, the renderer and the screenshot QA —
 * all of which are now exercised on every CI run with no key and no egress.
 *
 * Everything it returns is about a business that does not exist, and every
 * surface that renders it says so.
 */

export type SynthesiserFault =
  | 'unavailable'
  | 'rate-limited'
  | 'refusal'
  | 'truncated'
  | 'invalid-shape'
  | 'dangling-citation'
  | 'fail-then-succeed'
  | null;

export class FixtureSynthesiser {
  readonly name = 'fixture';

  static fault: SynthesiserFault = null;
  static callCount = 0;
  static lastInput: SynthesisInput | null = null;

  static reset(): void {
    FixtureSynthesiser.fault = null;
    FixtureSynthesiser.callCount = 0;
    FixtureSynthesiser.lastInput = null;
  }

  async synthesise(input: SynthesisInput, signal: AbortSignal): Promise<SynthesisResult> {
    FixtureSynthesiser.callCount += 1;
    FixtureSynthesiser.lastInput = input;

    if (signal.aborted) {
      throw new PlatformError('JOB_TIMEOUT', 'Cancelled before synthesis ran');
    }

    const fault = FixtureSynthesiser.fault;
    const firstCall = FixtureSynthesiser.callCount === 1;

    if (fault === 'unavailable') {
      throw new PlatformError('AI_UNAVAILABLE', 'Injected fault: provider unavailable');
    }
    if (fault === 'rate-limited') {
      throw new PlatformError('AI_RATE_LIMITED', 'Injected fault: provider rate limited');
    }
    if (fault === 'refusal') {
      throw new PlatformError('AI_REFUSED', 'Injected fault: model declined');
    }

    const result = (data: unknown, truncated = false): SynthesisResult => ({
      data,
      usage: { inputTokens: 4200, outputTokens: 3100 },
      model: input.model,
      latencyMs: 0,
      truncated,
    });

    if (fault === 'truncated') return result(FIXTURE_SYNTHESIS, true);

    if (fault === 'invalid-shape') {
      return result({ executive: 'not an object' });
    }

    if (fault === 'dangling-citation') {
      // A citation to a source that was never registered — the single most
      // common real failure, and the one the repair round exists for.
      return result({
        ...FIXTURE_SYNTHESIS,
        executive: {
          ...FIXTURE_SYNTHESIS.executive,
          strongestOpportunity: {
            ...FIXTURE_SYNTHESIS.executive.strongestOpportunity,
            sources: ['S999'],
          },
        },
      });
    }

    if (fault === 'fail-then-succeed' && firstCall) {
      return result({ executive: 'not an object' });
    }

    return result(FIXTURE_SYNTHESIS);
  }
}

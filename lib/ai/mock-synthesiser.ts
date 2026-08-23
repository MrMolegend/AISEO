import 'server-only';
import type { ZodType } from 'zod';
import { PlatformError } from '@/lib/errors';
import type { SynthesisInput, SynthesisResult } from './research-provider';

/**
 * Fixture synthesiser, used whenever no Anthropic key is configured.
 *
 * It generates a schema-valid report from the schema itself rather than from a
 * checked-in fixture per package. That sounds like over-engineering and is
 * actually the cheaper option: four hand-written fixtures would need updating
 * every time a schema gains a field, and the one that got missed would fail in
 * CI for a reason unrelated to the change being made.
 *
 * Everything it produces is visibly placeholder text. As with the mock research
 * provider, plausible fake data is the dangerous kind — if this ever ran in
 * production the report would be unmistakably fake rather than quietly wrong.
 *
 * Fault injection covers the pipeline's error paths, which is the other reason
 * this exists: an outage, a refusal and a malformed output all need tests, and
 * the only way to get them without a real outage is to ask for one.
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

export class MockSynthesiser {
  readonly name = 'mock';

  static fault: SynthesiserFault = null;
  static callCount = 0;
  static lastInput: SynthesisInput | null = null;

  static reset(): void {
    MockSynthesiser.fault = null;
    MockSynthesiser.callCount = 0;
    MockSynthesiser.lastInput = null;
  }

  async synthesise(input: SynthesisInput, signal: AbortSignal): Promise<SynthesisResult> {
    MockSynthesiser.callCount += 1;
    MockSynthesiser.lastInput = input;

    if (signal.aborted) {
      throw new PlatformError('JOB_TIMEOUT', 'Cancelled before synthesis started');
    }

    const usage = { inputTokens: 12_000, outputTokens: 4_000 };
    const base = {
      usage,
      model: 'mock-synthesiser',
      latencyMs: 5,
      truncated: false,
    };

    switch (MockSynthesiser.fault) {
      case 'unavailable':
        throw new PlatformError('AI_UNAVAILABLE', 'Injected provider outage');
      case 'rate-limited':
        throw new PlatformError('AI_RATE_LIMITED', 'Injected rate limit');
      case 'refusal':
        throw new PlatformError('AI_REFUSED', 'Injected refusal');
      case 'truncated':
        return { ...base, data: null, truncated: true };
      case 'invalid-shape':
        return { ...base, data: { headline: 42 } };
      case 'dangling-citation':
        return {
          ...base,
          data: withDanglingCitation(sampleFor(input.schema)),
        };
      case 'fail-then-succeed':
        // First call malformed, second correct: exercises exactly one repair.
        return MockSynthesiser.callCount === 1
          ? { ...base, data: { headline: 'incomplete' } }
          : { ...base, data: sampleFor(input.schema) };
      default:
        return { ...base, data: sampleFor(input.schema) };
    }
  }
}

/** Replaces the first citation it finds with one that cannot resolve. */
function withDanglingCitation(sample: unknown): unknown {
  const clone = structuredClone(sample) as Record<string, unknown>;
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(walk);
    if (!node || typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.sources) && record.sources.length > 0) {
      record.sources = ['S9999'];
      return true;
    }
    return Object.values(record).some(walk);
  };
  walk(clone);
  return clone;
}

/**
 * Builds a valid value for a Zod schema by reading its internal definition.
 *
 * Reaching into `_def` is not something to do in application code, and it is
 * the right trade here: this file never runs in production, and the alternative
 * is four fixtures that rot silently. If a future Zod release changes the
 * internals, this breaks loudly in CI, which is exactly where it should break.
 */
function sampleFor(schema: ZodType): unknown {
  return sample(schema, 0);
}

interface ZodInternal {
  type?: string;
  shape?: Record<string, ZodType> | (() => Record<string, ZodType>);
  element?: ZodType;
  innerType?: ZodType;
  entries?: Record<string, string>;
  values?: string[];
  checks?: Array<{
    _zod?: { def?: { check?: string; minimum?: number; maximum?: number } };
  }>;
  options?: ZodType[];
  format?: string;
  minLength?: number;
  maxLength?: number;
}

function def(schema: ZodType): ZodInternal {
  return (schema as unknown as { _zod: { def: ZodInternal } })._zod.def;
}

function bounds(schema: ZodType): { min?: number; max?: number } {
  const checks = def(schema).checks ?? [];
  let min: number | undefined;
  let max: number | undefined;
  for (const check of checks) {
    const inner = check?._zod?.def;
    if (!inner) continue;
    if (inner.check === 'greater_than' || inner.check === 'length_equals') {
      min = inner.minimum ?? min;
    }
    if (typeof inner.minimum === 'number') min = inner.minimum;
    if (typeof inner.maximum === 'number') max = inner.maximum;
  }
  return { min, max };
}

function sample(schema: ZodType, depth: number): unknown {
  if (depth > 12) return null;

  const d = def(schema);

  switch (d.type) {
    case 'object': {
      const shape = typeof d.shape === 'function' ? d.shape() : (d.shape ?? {});
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(shape)) {
        out[key] = sampleField(key, child, depth + 1);
      }
      return out;
    }

    case 'array': {
      const { min } = bounds(schema);
      const count = Math.max(min ?? 1, 1);
      const element = d.element!;
      return Array.from({ length: count }, (_, i) => {
        const item = sample(element, depth + 1);
        // Ranks must be contiguous from 1, and ids unique — both are checked by
        // the validator, so the fixture has to satisfy them.
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if ('rank' in record) record.rank = i + 1;
          if ('id' in record) record.id = `sample-item-${i + 1}`;
        }
        return item;
      });
    }

    case 'string': {
      const { min } = bounds(schema);
      if (d.format === 'url') return 'https://example.invalid/sample';
      if (d.format === 'email') return 'contact@example.invalid';
      const text =
        'Sample text produced by the fixture synthesiser. This is not real research.';
      return min && text.length < min ? text.padEnd(min, ' .') : text;
    }

    case 'number': {
      const { min, max } = bounds(schema);
      if (min !== undefined && max !== undefined) return Math.round((min + max) / 2);
      return min ?? 50;
    }

    case 'boolean':
      return false;

    case 'enum': {
      const values = d.entries ? Object.values(d.entries) : (d.values ?? []);
      return values[0] ?? 'unknown';
    }

    case 'literal': {
      const values = d.values ?? [];
      return values[0] ?? null;
    }

    case 'nullable':
      return null;

    case 'optional':
    case 'default':
      return sample(d.innerType!, depth + 1);

    case 'union':
      return sample((d.options ?? [])[0]!, depth + 1);

    default:
      return null;
  }
}

/** Field-aware overrides, for the few fields whose shape the validator checks. */
function sampleField(key: string, schema: ZodType, depth: number): unknown {
  const d = def(schema);

  if (key === 'sources') {
    // S1 always exists: the pipeline refuses to reach synthesis with fewer than
    // three sources registered.
    return ['S1'];
  }
  if (key === 'id' && d.type === 'string') return 'sample-item';
  if (key === 'website' || key === 'url') return 'https://example.invalid/sample';
  if (key === 'profileUrls') return ['https://example.invalid/creator'];

  return sample(schema, depth);
}

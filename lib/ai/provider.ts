/**
 * The AI provider boundary.
 *
 * Nothing outside lib/ai/anthropic-provider.ts may import an SDK — that rule is
 * enforced by an ESLint no-restricted-imports rule, not by convention. The point
 * is that swapping or adding a provider is a one-file change rather than a
 * refactor that touches the pipeline, the schema and the routes.
 *
 * Note what this interface deliberately does NOT do: it does not validate. It
 * returns `unknown`. Validation is a separate layer with its own rules, because
 * a provider that could also declare its output valid would be marking its own
 * homework.
 */

export interface AuditModelInput {
  /** Serialised SiteFacts, already capped. */
  factsJson: string;
  /** Per-request nonce delimiting the untrusted data block. */
  nonce: string;
  /** JSON Schema derived from the Zod audit analysis schema. */
  jsonSchema: object;
  maxOutputTokens: number;
  /** Present only on a repair attempt: what was wrong the first time. */
  repair?: {
    previousOutput: unknown;
    problems: string[];
  };
}

export interface AuditModelResult {
  /** NOT yet validated. The validation layer decides whether this is usable. */
  data: unknown;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
  /** True when generation stopped because it ran out of output budget. */
  truncated: boolean;
}

export interface AIProvider {
  readonly name: string;
  runAudit(input: AuditModelInput, signal: AbortSignal): Promise<AuditModelResult>;
}

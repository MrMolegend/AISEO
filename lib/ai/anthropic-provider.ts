import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { auditAnalysisSchema } from '@/schemas/audit';
import { SYSTEM_PROMPT, buildUserMessage } from '@/prompts/seo-audit';
import { buildRepairMessage } from '@/prompts/repair';
import type { AIProvider, AuditModelInput, AuditModelResult } from './provider';
import { classifyProviderError } from './errors';
import { AuditError } from '@/lib/errors';

/**
 * The only file in the codebase permitted to import the Anthropic SDK.
 *
 * That restriction is enforced by an ESLint no-restricted-imports rule, and it is
 * the whole reason the AIProvider interface exists: adding or swapping a provider
 * should be one new file, not a change that reaches into the pipeline, the
 * schema and the routes.
 */

/** The name the system prompt already instructs the model to call. */
export const AUDIT_TOOL_NAME = 'submit_audit';

/**
 * Structured output via a single forced tool call.
 *
 * We reuse zodOutputFormat purely as a Zod -> JSON Schema converter; only its
 * `.schema` is taken, and it is attached to a tool rather than to
 * output_config.format.
 *
 * That distinction is the entire point of this shape. Handing the schema to
 * output_config.format — or marking the tool `strict` — makes the API compile it
 * into a constrained-decoding grammar, and this schema is large enough that the
 * API rejects the request outright:
 *
 *   400 invalid_request_error: "The compiled grammar is too large, which would
 *   cause performance issues. Simplify your tool schemas or reduce the number of
 *   strict tools."
 *
 * A non-strict tool schema is advisory: it is shown to the model to describe the
 * shape, not compiled. So the model is *asked* to follow this shape, not forced
 * to — which is exactly why the validation layer downstream is load-bearing
 * rather than belt-and-braces. It re-parses this output against the same Zod
 * schema, applies the cross-reference rules JSON Schema cannot express (a
 * priority must point at an issue that exists), applies the safety rules (no
 * HTML, no off-domain URLs), and can send one repair round-trip. Nothing here
 * declares its own output valid.
 */
const AUDIT_TOOL: Anthropic.Tool = {
  name: AUDIT_TOOL_NAME,
  description:
    'Submit the completed SEO audit. Call this exactly once, populating every required field. This is the only way to return the audit.',
  // Cast because the SDK types input_schema as an object schema specifically,
  // while zodOutputFormat is typed as an open JSON Schema record. The value is
  // an object schema — auditAnalysisSchema is a z.object.
  input_schema: zodOutputFormat(auditAnalysisSchema).schema as Anthropic.Tool.InputSchema,
  // NOTE: `strict` is deliberately not set. Setting it would compile this schema
  // into a grammar and reproduce the 400 described above.
};

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({
      apiKey,
      // The pipeline enforces its own budget via AbortSignal; this is a backstop
      // so a hung connection cannot outlive the request that owns it.
      timeout: 180_000,
      // The pipeline decides what to retry and when, using the audit error
      // taxonomy. Two competing retry policies would multiply, not compose.
      maxRetries: 0,
    });
    this.model = model;
  }

  async runAudit(input: AuditModelInput, signal: AbortSignal): Promise<AuditModelResult> {
    const started = Date.now();

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: buildUserMessage(input.factsJson, input.nonce) },
    ];

    // A repair attempt replays the failed output and the specific rule
    // violations, rather than re-asking from scratch. Re-asking would discard a
    // mostly-correct audit and pay full price for a fresh one.
    if (input.repair) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify(input.repair.previousOutput).slice(0, 40_000),
      });
      messages.push({
        role: 'user',
        content: buildRepairMessage(input.repair.problems),
      });
    }

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: input.maxOutputTokens,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              // The system prompt is static and roughly 2-3k tokens, comfortably
              // over the ~1024 minimum for a cacheable prefix. Across a warm
              // period this is a real cost saving for no added complexity.
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
          tools: [AUDIT_TOOL],
          // Forcing the tool removes the free-text channel entirely: there is no
          // prose turn for an injected instruction to be "complied" with.
          tool_choice: { type: 'tool', name: AUDIT_TOOL_NAME },
          output_config: {
            // This is analysis, not creative writing. Note that temperature is
            // NOT set: sampling parameters are rejected with a 400 on Sonnet 5
            // and the rest of the current model family. Effort is the control.
            //
            // `format` is deliberately absent — see AUDIT_TOOL above. effort is
            // the only member of output_config we set, and it compiles nothing.
            effort: 'high',
          },
        },
        { signal },
      );

      const truncated = response.stop_reason === 'max_tokens';

      if (response.stop_reason === 'refusal') {
        throw new AuditError('AI_REFUSED', 'The model declined to analyse this page', {
          context: { category: response.stop_details?.category ?? null },
        });
      }

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === 'tool_use' && block.name === AUDIT_TOOL_NAME,
      );

      return {
        // Deliberately `unknown`: the validation layer decides whether this is
        // usable. Null when the call was cut short before the tool block landed,
        // which the caller treats as invalid output and sends to repair.
        data: toolUse ? toolUse.input : null,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
        latencyMs: Date.now() - started,
        truncated,
      };
    } catch (error) {
      throw classifyProviderError(error);
    }
  }
}

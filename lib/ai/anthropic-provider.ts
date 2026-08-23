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

/**
 * Structured output via output_config.format.
 *
 * The schema is handed to the API directly, so the model is constrained to our
 * shape rather than asked politely to follow it. We still re-validate the result
 * ourselves: JSON Schema cannot express the cross-reference rules (a priority
 * must point at an issue that exists) or the safety rules (no HTML, no
 * off-domain URLs), and a provider that could also declare its own output valid
 * would be marking its own homework.
 */
const OUTPUT_FORMAT = zodOutputFormat(auditAnalysisSchema);

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
      const response = await this.client.messages.parse(
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
          output_config: {
            format: OUTPUT_FORMAT,
            // This is analysis, not creative writing. Note that temperature is
            // NOT set: sampling parameters are rejected with a 400 on Sonnet 5
            // and the rest of the current model family. Effort is the control.
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

      return {
        // Deliberately `unknown`: the validation layer decides whether this is
        // usable. parsed_output is null when the response could not be parsed.
        data: response.parsed_output,
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

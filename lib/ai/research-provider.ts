import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodType } from 'zod';
import { PlatformError } from '@/lib/errors';
import { classifyProviderError } from './errors';

/**
 * The Anthropic call that turns research into a report.
 *
 * One of two files permitted to import the SDK, enforced by an ESLint
 * no-restricted-imports rule.
 *
 * The shape here is the one that came out of a production incident. Handing the
 * full schema to `output_config.format` — or marking the tool `strict` — makes
 * the API compile it into a constrained-decoding grammar, and these schemas are
 * far past the size that compiler accepts:
 *
 *   400 invalid_request_error: "The compiled grammar is too large, which would
 *   cause performance issues. Simplify your tool schemas or reduce the number
 *   of strict tools."
 *
 * So the schema is attached to a forced, NON-STRICT tool. That makes it
 * advisory — the model is asked to follow the shape, not made to — which is why
 * the validation layer downstream is load-bearing rather than belt-and-braces.
 * Forcing the tool still removes the free-text channel entirely, so there is no
 * prose turn for an injected instruction to be complied with.
 */

export const REPORT_TOOL_NAME = 'submit_report';

export interface SynthesisInput {
  model: string;
  systemPrompt: string;
  userMessage: string;
  schema: ZodType;
  maxOutputTokens: number;
  /** Present only on the repair attempt. */
  repair?: { previousOutput: unknown; problems: string[]; repairMessage: string };
}

export interface SynthesisResult {
  /** Deliberately unvalidated. The validation layer decides if it is usable. */
  data: unknown;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
  /** True when generation stopped because it ran out of output budget. */
  truncated: boolean;
}

/** Cache of tool definitions, keyed by schema. Zod→JSON Schema is not free. */
const toolCache = new WeakMap<ZodType, Anthropic.Tool>();

function toolFor(schema: ZodType): Anthropic.Tool {
  const cached = toolCache.get(schema);
  if (cached) return cached;

  const tool: Anthropic.Tool = {
    name: REPORT_TOOL_NAME,
    description:
      'Submit the completed research report. Call this exactly once, populating every required field. This is the only way to return the report.',
    // zodOutputFormat is used purely as a Zod → JSON Schema converter here.
    // Only `.schema` is taken, and it goes on the tool rather than into
    // output_config.
    input_schema: zodOutputFormat(schema).schema as Anthropic.Tool.InputSchema,
    // `strict` is deliberately absent. Setting it would compile the grammar and
    // reproduce the 400 described above.
  };

  toolCache.set(schema, tool);
  return tool;
}

export class AnthropicResearchProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      timeout: 300_000,
      // The pipeline owns retry policy, using the error taxonomy. Two competing
      // retry policies multiply rather than compose.
      maxRetries: 0,
    });
  }

  async synthesise(input: SynthesisInput, signal: AbortSignal): Promise<SynthesisResult> {
    const started = Date.now();

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: input.userMessage },
    ];

    if (input.repair) {
      // Replay the failed output and the specific violations rather than
      // re-asking from scratch: a mostly-correct report is worth correcting,
      // and a fresh one costs full price for the same risk.
      messages.push({
        role: 'assistant',
        content: JSON.stringify(input.repair.previousOutput).slice(0, 60_000),
      });
      messages.push({ role: 'user', content: input.repair.repairMessage });
    }

    try {
      const response = await this.client.messages.create(
        {
          model: input.model,
          max_tokens: input.maxOutputTokens,
          system: [
            {
              type: 'text',
              text: input.systemPrompt,
              // Static and well over the cacheable minimum. Across a warm
              // period this is a real saving for no added complexity.
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
          tools: [toolFor(input.schema)],
          tool_choice: { type: 'tool', name: REPORT_TOOL_NAME },
          output_config: {
            // This is analysis, not creative writing. Note that temperature is
            // NOT set: sampling parameters are rejected with a 400 on the
            // current model family. Effort is the control, and it compiles
            // nothing — unlike `format`, which is deliberately absent.
            effort: 'high',
          },
        },
        { signal },
      );

      if (response.stop_reason === 'refusal') {
        throw new PlatformError('AI_REFUSED', 'The model declined this research', {
          context: { category: response.stop_details?.category ?? null },
        });
      }

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === 'tool_use' && block.name === REPORT_TOOL_NAME,
      );

      return {
        // Null when the call was cut short before the tool block landed, which
        // the caller treats as invalid output and routes to repair.
        data: toolUse ? toolUse.input : null,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
        latencyMs: Date.now() - started,
        truncated: response.stop_reason === 'max_tokens',
      };
    } catch (error) {
      throw classifyProviderError(error);
    }
  }
}

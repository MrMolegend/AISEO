import { describe, it, expect, afterEach, vi } from 'vitest';
import { AnthropicResearchProvider, REPORT_TOOL_NAME } from '@/lib/ai/research-provider';
import { PlatformError } from '@/lib/errors';
import type { SynthesisInput } from '@/lib/ai/research-provider';
import { REPORT_SCHEMAS } from '@/schemas/research/packages';

/**
 * Regression tests for the production 400:
 *
 *   invalid_request_error: "The compiled grammar is too large, which would cause
 *   performance issues. Simplify your tool schemas or reduce the number of
 *   strict tools."
 *
 * The report schemas are far too large to be compiled into a constrained-
 * decoding grammar, so they must reach the API as an *advisory* tool schema: no
 * output_config.format, and no `strict: true` on the tool. Those two facts are
 * invisible in the type system and produce a runtime 400 rather than a build
 * failure, which is exactly why they are asserted here.
 *
 * Assertions are made against the real serialised HTTP body rather than a mocked
 * SDK method, because the wire payload is what the API rejects. The largest of
 * the four package schemas is used deliberately — if any schema is going to
 * exceed the grammar compiler, it is that one.
 */

const SYNTHESIS_INPUT: SynthesisInput = {
  model: 'claude-sonnet-5',
  systemPrompt: `You produce source-backed research reports. ${'Every claim carries a citation. '.repeat(30)}`,
  userMessage: 'Research the business described in the untrusted data block below.',
  schema: REPORT_SCHEMAS['market-pack'],
  maxOutputTokens: 16_000,
};

const TOOL_INPUT = {
  business: { name: 'Example Ltd' },
  competitors: [{ name: 'Rival Ltd' }],
};

interface CapturedRequest {
  url: string;
  body: Record<string, any>;
  signal: AbortSignal | null | undefined;
}

function messageBody(overrides: Record<string, any> = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-test',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_test',
        name: REPORT_TOOL_NAME,
        caller: { type: 'direct' },
        input: TOOL_INPUT,
      },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 4321, output_tokens: 8765 },
    ...overrides,
  };
}

/**
 * Stubs the global fetch the SDK captures at construction time, and returns the
 * list of requests it saw. The provider must be constructed after this call.
 */
function captureRequests(respond: () => unknown = messageBody): CapturedRequest[] {
  const captured: CapturedRequest[] = [];

  vi.stubGlobal('fetch', async (url: unknown, init: any) => {
    captured.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')),
      signal: init?.signal,
    });
    return new Response(JSON.stringify(respond()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  return captured;
}

/** Narrows away the `undefined` that noUncheckedIndexedAccess adds to `[0]`. */
function onlyRequest(captured: CapturedRequest[]): CapturedRequest {
  expect(captured).toHaveLength(1);
  const [first] = captured;
  if (!first) throw new Error('the provider made no request');
  return first;
}

function newProvider() {
  return new AnthropicResearchProvider('sk-ant-not-a-real-key');
}

function synthesise(overrides: Partial<SynthesisInput> = {}, signal?: AbortSignal) {
  return newProvider().synthesise(
    { ...SYNTHESIS_INPUT, ...overrides },
    signal ?? new AbortController().signal,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnthropicResearchProvider request shape', () => {
  it('sends no output_config.format — the oversized compiled grammar is the bug', async () => {
    const requests = captureRequests();
    await synthesise();

    const { body } = onlyRequest(requests);

    expect(body.output_config?.format).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('json_schema');
  });

  it('keeps effort: high, which is the only member of output_config we set', async () => {
    const requests = captureRequests();
    await synthesise();

    expect(onlyRequest(requests).body.output_config).toEqual({ effort: 'high' });
  });

  it('declares exactly one tool, named submit_report, carrying the package schema', async () => {
    const requests = captureRequests();
    await synthesise();

    const { tools } = onlyRequest(requests).body;
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('submit_report');
    expect(tools[0].input_schema.type).toBe('object');
    expect(Object.keys(tools[0].input_schema.properties ?? {})).toContain('competitors');
    // The whole point of the failure this file guards: the schema is enormous.
    expect(JSON.stringify(tools[0].input_schema).length).toBeGreaterThan(10_000);
  });

  it('forces the submit_report tool rather than leaving the choice to the model', async () => {
    const requests = captureRequests();
    await synthesise();

    expect(onlyRequest(requests).body.tool_choice).toEqual({
      type: 'tool',
      name: 'submit_report',
    });
  });

  it('does not enable strict mode on the tool', async () => {
    const requests = captureRequests();
    await synthesise();

    const { body } = onlyRequest(requests);
    const tool = body.tools[0];
    expect(tool.strict).toBeUndefined();
    expect(tool).not.toHaveProperty('strict');
    // Nothing anywhere in the payload may turn strict decoding on.
    expect(JSON.stringify(body)).not.toContain('"strict"');
  });

  it('preserves max_tokens and the cacheable system prompt block', async () => {
    const requests = captureRequests();
    await synthesise();

    const { body } = onlyRequest(requests);
    expect(body.max_tokens).toBe(16_000);
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system[0].text.length).toBeGreaterThan(500);
    // No sampling parameters: they are rejected with a 400 on this model family.
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
  });

  it('replays the failed output and the problem list on a repair attempt', async () => {
    const requests = captureRequests();
    await synthesise({
      repair: {
        previousOutput: { broken: true },
        problems: ['competitors: too few items'],
        repairMessage: 'The previous report was rejected: competitors: too few items',
      },
    });

    const { messages } = onlyRequest(requests).body;
    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('"broken":true');
    expect(messages[2].content).toContain('competitors: too few items');
  });
});

describe('AnthropicResearchProvider response handling', () => {
  it('returns the submit_report tool input as data, unvalidated', async () => {
    captureRequests();
    const result = await synthesise();

    expect(result.data).toEqual(TOOL_INPUT);
    expect(result.usage).toEqual({ inputTokens: 4321, outputTokens: 8765 });
    expect(result.model).toBe('claude-sonnet-5-test');
    expect(result.truncated).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores tool_use blocks with a different name', async () => {
    captureRequests(() =>
      messageBody({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_other',
            name: 'something_else',
            caller: { type: 'direct' },
            input: { not: 'the report' },
          },
        ],
      }),
    );

    const result = await synthesise();
    expect(result.data).toBeNull();
  });

  it('reports max_tokens as truncated so the caller can request a briefer report', async () => {
    captureRequests(() => messageBody({ stop_reason: 'max_tokens', content: [] }));

    const result = await synthesise();
    expect(result.truncated).toBe(true);
    expect(result.data).toBeNull();
  });

  it('raises AI_REFUSED on a refusal, carrying the category', async () => {
    captureRequests(() =>
      messageBody({
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'harmful_content' },
        content: [],
      }),
    );

    await expect(synthesise()).rejects.toMatchObject({ code: 'AI_REFUSED' });
  });

  it('maps a 429 onto AI_RATE_LIMITED rather than leaking the SDK error', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('{"error":{"type":"rate_limit_error"}}', {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const error = await synthesise().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlatformError);
    expect((error as PlatformError).code).toBe('AI_RATE_LIMITED');
  });
});

describe('AnthropicResearchProvider cancellation', () => {
  it('propagates the caller AbortSignal into the request', async () => {
    const controller = new AbortController();

    vi.stubGlobal(
      'fetch',
      (_url: unknown, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(
              Object.assign(new Error('The operation was aborted'), {
                name: 'AbortError',
              }),
            ),
          );
        }),
    );

    const pending = synthesise({}, controller.signal);
    controller.abort();

    const error = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlatformError);
    expect((error as PlatformError).code).toBe('AI_TIMEOUT');
  });
});

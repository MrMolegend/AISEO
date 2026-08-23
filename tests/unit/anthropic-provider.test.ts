import { describe, it, expect, afterEach, vi } from 'vitest';
import { AnthropicProvider, AUDIT_TOOL_NAME } from '@/lib/ai/anthropic-provider';
import { PlatformError } from '@/lib/errors';
import type { AuditModelInput } from '@/lib/ai/provider';

/**
 * Regression tests for the production 400:
 *
 *   invalid_request_error: "The compiled grammar is too large, which would cause
 *   performance issues. Simplify your tool schemas or reduce the number of
 *   strict tools."
 *
 * The audit schema is far too large to be compiled into a constrained-decoding
 * grammar, so it must reach the API as an *advisory* tool schema: no
 * output_config.format, and no `strict: true` on the tool. Those two facts are
 * invisible in the type system and produce a runtime 400 rather than a build
 * failure, which is exactly why they are asserted here.
 *
 * Assertions are made against the real serialised HTTP body rather than a mocked
 * SDK method, because the wire payload is what the API rejects.
 */

const AUDIT_INPUT: AuditModelInput = {
  factsJson: '{"finalUrl":"https://example.com/"}',
  nonce: 'deadbeefdeadbeef',
  jsonSchema: {},
  maxOutputTokens: 16_000,
};

const TOOL_INPUT = {
  website: { name: 'Example', industry: 'Testing' },
  issues: [{ id: 'title-length' }],
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
        name: AUDIT_TOOL_NAME,
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
  return new AnthropicProvider('sk-ant-not-a-real-key', 'claude-sonnet-5');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnthropicProvider request shape', () => {
  it('sends no output_config.format — the oversized compiled grammar is the bug', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

    const { body } = onlyRequest(requests);

    expect(body.output_config?.format).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('json_schema');
  });

  it('keeps effort: high, which is the only member of output_config we set', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

    expect(onlyRequest(requests).body.output_config).toEqual({ effort: 'high' });
  });

  it('declares exactly one tool, named submit_audit', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

    const { tools } = onlyRequest(requests).body;
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('submit_audit');
    expect(tools[0].input_schema.type).toBe('object');
    expect(Object.keys(tools[0].input_schema.properties ?? {})).toContain('issues');
  });

  it('forces the submit_audit tool rather than leaving the choice to the model', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

    expect(onlyRequest(requests).body.tool_choice).toEqual({
      type: 'tool',
      name: 'submit_audit',
    });
  });

  it('does not enable strict mode on the tool', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

    const { body } = onlyRequest(requests);
    const tool = body.tools[0];
    expect(tool.strict).toBeUndefined();
    expect(tool).not.toHaveProperty('strict');
    // Nothing anywhere in the payload may turn strict decoding on.
    expect(JSON.stringify(body)).not.toContain('"strict"');
  });

  it('preserves max_tokens and the cacheable system prompt block', async () => {
    const requests = captureRequests();
    await newProvider().runAudit(AUDIT_INPUT, new AbortController().signal);

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
    await newProvider().runAudit(
      {
        ...AUDIT_INPUT,
        repair: { previousOutput: { broken: true }, problems: ['issues: too few items'] },
      },
      new AbortController().signal,
    );

    const { messages } = onlyRequest(requests).body;
    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('"broken":true');
    expect(messages[2].content).toContain('issues: too few items');
  });
});

describe('AnthropicProvider response handling', () => {
  it('returns the submit_audit tool input as data, unvalidated', async () => {
    captureRequests();
    const result = await newProvider().runAudit(
      AUDIT_INPUT,
      new AbortController().signal,
    );

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
            input: { not: 'the audit' },
          },
        ],
      }),
    );

    const result = await newProvider().runAudit(
      AUDIT_INPUT,
      new AbortController().signal,
    );
    expect(result.data).toBeNull();
  });

  it('reports max_tokens as truncated so the caller can request a briefer audit', async () => {
    captureRequests(() => messageBody({ stop_reason: 'max_tokens', content: [] }));

    const result = await newProvider().runAudit(
      AUDIT_INPUT,
      new AbortController().signal,
    );
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

    await expect(
      newProvider().runAudit(AUDIT_INPUT, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'AI_REFUSED' });
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

    const error = await newProvider()
      .runAudit(AUDIT_INPUT, new AbortController().signal)
      .catch((e) => e);

    expect(error).toBeInstanceOf(PlatformError);
    expect(error.code).toBe('AI_RATE_LIMITED');
  });
});

describe('AnthropicProvider cancellation', () => {
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

    const provider = newProvider();
    const pending = provider.runAudit(AUDIT_INPUT, controller.signal);
    controller.abort();

    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(PlatformError);
    expect(error.code).toBe('AI_TIMEOUT');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createEditorTools } from '../src/ai/editorTools';
import { runAgentTurn } from '../src/ai/runAgentTurn';
import type { AiAssistantTurn, AiMessage, AiProvider, AiToolCall, AiToolDefinition } from '../src/ai/types';

const definitions: AiToolDefinition[] = [];

function fakeProvider(turns: AiAssistantTurn[]) {
  const requests: AiMessage[][] = [];
  const provider: AiProvider = {
    complete: vi.fn(async (messages) => {
      requests.push(structuredClone(messages));
      const turn = turns.shift();
      if (!turn) throw new Error('No assistant turn configured');
      return turn;
    }),
  };
  return { provider, requests };
}

function call(id: string, name: string, args = '{}'): AiToolCall {
  return { id, name, arguments: args };
}

function toolSet(callbacks = {
  getEmailContext: vi.fn(() => 'Email context'),
  replaceSelectedElement: vi.fn(),
  replaceEmailHtml: vi.fn(),
}) {
  return { tools: createEditorTools(callbacks), callbacks };
}

describe('runAgentTurn', () => {
  it('ends on a plain assistant response without executing tools', async () => {
    const { provider } = fakeProvider([{ content: 'Done', toolCalls: [] }]);
    const { tools, callbacks } = toolSet();
    const input: AiMessage[] = [{ role: 'user', content: 'Hello' }];

    const result = await runAgentTurn(provider, input, tools, new AbortController().signal);

    expect(result).toEqual({
      messages: [...input, { role: 'assistant', content: 'Done' }],
      limitReached: false,
    });
    expect(callbacks.getEmailContext).not.toHaveBeenCalled();
  });

  it('executes tool calls sequentially and appends tool results using each call ID', async () => {
    const order: string[] = [];
    const { provider } = fakeProvider([
      { content: null, toolCalls: [call('call-1', 'first'), call('call-2', 'second')] },
      { content: 'Finished', toolCalls: [] },
    ]);
    const tools = {
      definitions,
      executors: {
        first: async () => { order.push('first'); return 'first result'; },
        second: async () => { order.push('second'); return 'second result'; },
      },
    };
    const progress = vi.fn();

    const result = await runAgentTurn(provider, [{ role: 'user', content: 'Go' }], tools, new AbortController().signal, progress);

    expect(order).toEqual(['first', 'second']);
    expect(progress.mock.calls).toEqual([
      ['first', 'running'],
      ['first', 'complete'],
      ['second', 'running'],
      ['second', 'complete'],
    ]);
    expect(result.messages.slice(2, 4)).toEqual([
      { role: 'tool', tool_call_id: 'call-1', content: 'first result' },
      { role: 'tool', tool_call_id: 'call-2', content: 'second result' },
    ]);
  });

  it('sends the assistant tool call and prior tool result on the next provider request', async () => {
    const { provider, requests } = fakeProvider([
      { content: null, toolCalls: [call('call-1', 'lookup')] },
      { content: 'Finished', toolCalls: [] },
    ]);
    const tools = {
      definitions,
      executors: { lookup: async () => 'looked up' },
    };
    const input: AiMessage[] = [{ role: 'user', content: 'Find it' }];

    await runAgentTurn(provider, input, tools, new AbortController().signal);

    expect(requests[1]).toEqual([
      ...input,
      { role: 'assistant', content: null, tool_calls: [call('call-1', 'lookup')] },
      { role: 'tool', tool_call_id: 'call-1', content: 'looked up' },
    ]);
  });

  it('does not execute a ninth requested tool call', async () => {
    const getEmailContext = vi.fn(() => 'context');
    const { provider } = fakeProvider([{
      content: null,
      toolCalls: Array.from({ length: 9 }, (_, index) => call(`call-${index + 1}`, 'get_email_context')),
    }]);
    const { tools } = toolSet({
      getEmailContext,
      replaceSelectedElement: vi.fn(),
      replaceEmailHtml: vi.fn(),
    });

    const result = await runAgentTurn(provider, [{ role: 'user', content: 'Read context' }], tools, new AbortController().signal);

    expect(getEmailContext).toHaveBeenCalledTimes(8);
    expect(result.limitReached).toBe(true);
    expect(result.messages.filter((message) => message.role === 'tool')).toHaveLength(8);
  });

  it('stops before another provider request when cancelled after a tool call', async () => {
    const controller = new AbortController();
    const { provider } = fakeProvider([
      { content: null, toolCalls: [call('call-1', 'cancel')] },
      { content: 'Should not be requested', toolCalls: [] },
    ]);
    const tools = {
      definitions,
      executors: {
        cancel: async () => {
          controller.abort();
          return 'cancelled';
        },
      },
    };

    await expect(runAgentTurn(provider, [{ role: 'user', content: 'Stop' }], tools, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(provider.complete).toHaveBeenCalledOnce();
  });

  it('propagates cancellation that occurs while awaiting the provider', async () => {
    const controller = new AbortController();
    const provider: AiProvider = {
      complete: vi.fn(async () => {
        controller.abort();
        return { content: 'Too late', toolCalls: [] };
      }),
    };

    await expect(runAgentTurn(provider, [{ role: 'user', content: 'Stop' }], {
      definitions,
      executors: {},
    }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns provider failures as visible assistant errors', async () => {
    const provider: AiProvider = {
      complete: vi.fn().mockRejectedValue(new Error('Service unavailable')),
    };

    const result = await runAgentTurn(provider, [{ role: 'user', content: 'Try' }], {
      definitions,
      executors: {},
    }, new AbortController().signal);

    expect(result.messages.at(-1)).toEqual({ role: 'assistant', content: 'Error: Service unavailable' });
    expect(result.limitReached).toBe(false);
  });
});

describe('createEditorTools', () => {
  it('exposes only the three permitted editor tools', () => {
    const { tools } = toolSet();

    expect(tools.definitions.map(({ function: tool }) => tool.name)).toEqual([
      'get_email_context',
      'replace_selected_element',
      'replace_email_html',
    ]);
    expect(Object.keys(tools.executors)).toEqual([
      'get_email_context',
      'replace_selected_element',
      'replace_email_html',
    ]);
  });

  it('turns malformed arguments and unknown tool names into tool errors without calling editor callbacks', async () => {
    const callbacks = {
      getEmailContext: vi.fn(() => 'context'),
      replaceSelectedElement: vi.fn(),
      replaceEmailHtml: vi.fn(),
    };
    const { provider } = fakeProvider([
      {
        content: null,
        toolCalls: [
          call('bad-json', 'replace_email_html', '{'),
          call('missing-selection', 'replace_selected_element', '{"html":"<p>New</p>"}'),
          call('bad-html', 'replace_email_html', '{"html":7}'),
          call('unknown', 'delete_email', '{}'),
        ],
      },
      { content: 'Could not apply those changes', toolCalls: [] },
    ]);

    const result = await runAgentTurn(provider, [{ role: 'user', content: 'Change it' }], createEditorTools(callbacks), new AbortController().signal);

    expect(result.messages.filter((message) => message.role === 'tool')).toEqual([
      expect.objectContaining({ tool_call_id: 'bad-json', content: expect.stringMatching(/error|invalid/i) }),
      expect.objectContaining({ tool_call_id: 'missing-selection', content: expect.stringMatching(/error|selection/i) }),
      expect.objectContaining({ tool_call_id: 'bad-html', content: expect.stringMatching(/error|string/i) }),
      expect.objectContaining({ tool_call_id: 'unknown', content: expect.stringMatching(/error|unknown/i) }),
    ]);
    expect(callbacks.replaceEmailHtml).not.toHaveBeenCalled();
    expect(callbacks.replaceSelectedElement).not.toHaveBeenCalled();
    expect(callbacks.getEmailContext).not.toHaveBeenCalled();
  });

  it('parses context tool arguments before reading editor context', async () => {
    const callbacks = {
      getEmailContext: vi.fn(() => 'context'),
      replaceSelectedElement: vi.fn(),
      replaceEmailHtml: vi.fn(),
    };
    const tools = createEditorTools(callbacks);

    await expect(tools.executors.get_email_context('{')).rejects.toThrow();
    expect(callbacks.getEmailContext).not.toHaveBeenCalled();
  });

  it('passes validated replacement data to editor callbacks', async () => {
    const callbacks = {
      getEmailContext: vi.fn(() => 'context'),
      replaceSelectedElement: vi.fn(),
      replaceEmailHtml: vi.fn(),
    };
    const tools = createEditorTools(callbacks);

    await tools.executors.replace_selected_element('{"selection_token":"selection-1","html":"<p>Selected</p>"}');
    await tools.executors.replace_email_html('{"html":"<p>Whole email</p>"}');

    expect(callbacks.replaceSelectedElement).toHaveBeenCalledWith({
      selectionToken: 'selection-1',
      html: '<p>Selected</p>',
    });
    expect(callbacks.replaceEmailHtml).toHaveBeenCalledWith('<p>Whole email</p>');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../src/ai/OpenAICompatibleProvider';
import { PuterProvider } from '../src/ai/PuterProvider';
import { createProvider } from '../src/ai/createProvider';
import type { AiMessage, AiToolDefinition } from '../src/ai/types';

const messages: AiMessage[] = [{ role: 'user', content: 'Hello' }];
const tools: AiToolDefinition[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.querySelectorAll('script[src="https://js.puter.com/v2/"]').forEach((script) => script.remove());
  delete (window as Window & { puter?: unknown }).puter;
});

describe('AI provider boundary', () => {
  it('selects Puter when no endpoint is configured', () => {
    expect(createProvider({})).toBeInstanceOf(PuterProvider);
  });

  it('selects the custom provider when an endpoint is configured', () => {
    expect(createProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
      apiKey: 'secret',
    })).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it('requires a model for a configured endpoint', () => {
    expect(() => createProvider({ endpoint: 'https://ai.example.test/v1/chat/completions' }))
      .toThrow(/model/i);
  });

  it('posts the configured model, messages, tools, and bearer key', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'Hello back', tool_calls: [] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);

    const provider = new OpenAICompatibleProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
      apiKey: 'secret',
    });
    const signal = new AbortController().signal;
    await expect(provider.complete(messages, tools, signal))
      .resolves.toEqual({ content: 'Hello back', toolCalls: [] });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://ai.example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
        }),
        body: JSON.stringify({ model: 'mail-model', messages, tools }),
        signal,
      }),
    );
  });

  it('converts OpenAI function calls into provider tool calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'replace_content', arguments: '{"html":"<p>Hi</p>"}' },
          }],
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const provider = new OpenAICompatibleProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
    });

    await expect(provider.complete(messages, tools, new AbortController().signal))
      .resolves.toEqual({
        content: null,
        toolCalls: [{
          id: 'call-1',
          name: 'replace_content',
          arguments: '{"html":"<p>Hi</p>"}',
        }],
      });
  });

  it('rejects non-success HTTP responses with a visible status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
    const provider = new OpenAICompatibleProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
    });

    await expect(provider.complete(messages, tools, new AbortController().signal))
      .rejects.toThrow(/503/);
  });

  it('rejects responses without a valid assistant choice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
    const provider = new OpenAICompatibleProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
    });

    await expect(provider.complete(messages, tools, new AbortController().signal))
      .rejects.toThrow(/invalid/i);
  });

  it('does not fall back to Puter when a configured endpoint fails', async () => {
    const chat = vi.fn();
    (window as Window & { puter?: { ai: { chat: typeof chat } } }).puter = { ai: { chat } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));

    await expect(createProvider({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'mail-model',
    }).complete(messages, tools, new AbortController().signal)).rejects.toThrow(/503/);
    expect(chat).not.toHaveBeenCalled();
    expect(document.head.querySelector('script[src="https://js.puter.com/v2/"]')).toBeNull();
  });

  it('loads Puter once on the first request and passes messages, tools, and signal', async () => {
    const chat = vi.fn().mockResolvedValue({ message: { role: 'assistant', content: 'Hello back' } });
    const provider = new PuterProvider();
    const signal = new AbortController().signal;
    const first = provider.complete(messages, tools, signal);
    const second = provider.complete(messages, tools, signal);
    const scripts = document.head.querySelectorAll<HTMLScriptElement>('script[src="https://js.puter.com/v2/"]');

    expect(scripts).toHaveLength(1);
    (window as Window & { puter?: { ai: { chat: typeof chat } } }).puter = { ai: { chat } };
    scripts[0].dispatchEvent(new Event('load'));

    await expect(first).resolves.toEqual({ content: 'Hello back', toolCalls: [] });
    await expect(second).resolves.toEqual({ content: 'Hello back', toolCalls: [] });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat).toHaveBeenCalledWith(messages, expect.objectContaining({ tools, signal, normalize: true }));
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import type { AiMessage, AiToolCall } from '../src/ai/types';

const endpoint = 'https://ai.example.test/v1/chat/completions';
const editors: ArchEmailEditor[] = [];

function response(content: string | null, toolCalls: AiToolCall[] = []): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        role: 'assistant',
        content,
        ...(toolCalls.length ? {
          tool_calls: toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: { name: toolCall.name, arguments: toolCall.arguments },
          })),
        } : {}),
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function toolCall(id: string, name: string, args = '{}'): AiToolCall {
  return { id, name, arguments: args };
}

function setupEditor(options: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = ArchEmailEditor.create(container, options as never);
  editors.push(editor);
  container.querySelector<HTMLButtonElement>('.arch-btn--ai')!.click();
  const panel = container.querySelector<HTMLElement>('.arch-ai-sidepanel')!;
  const prompt = panel.querySelector<HTMLTextAreaElement>('.arch-ai-input') ?? document.createElement('textarea');
  const send = panel.querySelector<HTMLButtonElement>('#arch-ai-send') ?? document.createElement('button');
  return { container, editor, panel, prompt, send };
}

async function submit(_panel: HTMLElement, prompt: HTMLTextAreaElement, send: HTMLButtonElement, value: string) {
  prompt.value = value;
  send.click();
  await vi.waitFor(() => expect(send.disabled).toBe(true));
}

async function waitUntilDone(panel: HTMLElement, send: HTMLButtonElement) {
  await vi.waitFor(() => expect(send.disabled).toBe(false));
  return panel.querySelector<HTMLElement>('[role="log"]')?.textContent ?? '';
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as Window & { puter?: unknown }).puter;
  document.head.querySelectorAll('script[src="https://js.puter.com/v2/"]').forEach((script) => script.remove());
  document.body.querySelectorAll('.arch-editor').forEach((element) => element.remove());
});

describe('AI assistant chat', () => {
  it('does not send an empty prompt', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { panel, send } = setupEditor({ ai: { endpoint, model: 'mail-model' } });

    send.click();

    expect(fetch).not.toHaveBeenCalled();
    expect(panel.querySelector('[role="log"]')?.textContent).toBe('');
  });

  it('sends full email and selected-element context to the configured provider', async () => {
    const requests: Array<{ messages: AiMessage[]; tools: unknown[] }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      requests.push(body);
      return requests.length === 1
        ? response(null, [toolCall('context-1', 'get_email_context')])
        : response('Context received');
    }));
    const { editor, panel, prompt, send } = setupEditor({
      ai: { endpoint, model: 'mail-model' },
      initialData: undefined,
    });
    editor.importHTML('<html><body><p id="selected">Selected copy</p><p>Other copy</p></body></html>');
    const canvas = (editor as any).canvas;
    const selected = canvas.iframe.contentDocument.querySelector('#selected') as HTMLElement;
    canvas.selectUnit(selected, selected);

    await submit(panel, prompt, send, 'Improve this email');
    const text = await waitUntilDone(panel, send);
    const userMessage = requests[0].messages.find((message) => message.role === 'user')!;
    const suppliedContext = JSON.parse((userMessage.content as string).split('Current email and selection context:\n')[1]);
    const contextToolResult = JSON.parse(requests[1].messages.find((message) => message.role === 'tool')!.content as string);

    expect(suppliedContext.html).toContain('Selected copy');
    expect(suppliedContext.html).toContain('Other copy');
    expect(suppliedContext.selectedText).toBe('Selected copy');
    expect(suppliedContext.selectedHtml).toContain('id="selected"');
    expect(contextToolResult.selectionToken).toBe(suppliedContext.selectionToken);
    expect(panel.querySelector('.arch-ai-context-badge')?.textContent).toBe('Selected: Selected copy');
    expect(requests[0].tools.map((tool: any) => tool.function.name)).toEqual([
      'get_email_context',
      'replace_selected_element',
      'replace_email_html',
    ]);
    expect(text).toContain('Context received');
  });

  it('executes a custom-provider editor tool and displays the final assistant reply', async () => {
    const requests: Array<{ tools: unknown[] }> = [];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return requests.length === 1
        ? response(null, [toolCall('replace-1', 'replace_email_html', '{"html":"<p>Updated email</p>"}')])
        : response('Email updated');
    });
    vi.stubGlobal('fetch', fetch);
    const { editor, panel, prompt, send } = setupEditor({ ai: { endpoint, model: 'mail-model' } });

    await submit(panel, prompt, send, 'Update this email');
    const text = await waitUntilDone(panel, send);

    expect(editor.getHTML()).toContain('Updated email');
    expect(text).toContain('Email updated');
    expect(requests[0].tools).toHaveLength(3);
    expect(panel.querySelector('.arch-ai-message--status')?.textContent).toMatch(/replace_email_html/i);
  });

  it('shows provider errors in the transcript without deleting earlier assistant messages', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      if (callCount === 1) return response('Earlier response');
      return new Response('Unavailable', { status: 503 });
    }));
    const { panel, prompt, send } = setupEditor({ ai: { endpoint, model: 'mail-model' } });

    await submit(panel, prompt, send, 'First');
    await waitUntilDone(panel, send);
    await submit(panel, prompt, send, 'Second');
    const text = await waitUntilDone(panel, send);

    expect(text).toContain('Earlier response');
    expect(text).toMatch(/503/);
  });

  it('shows tool errors and the tool-limit status in the transcript', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      return callCount === 1
        ? response(null, [toolCall('bad-selection', 'replace_selected_element', '{"selection_token":"stale","html":"<p>New</p>"}')])
        : response('The selection was unavailable');
    }));
    const toolFailure = setupEditor({ ai: { endpoint, model: 'mail-model' } });
    await submit(toolFailure.panel, toolFailure.prompt, toolFailure.send, 'Replace selection');
    const failureText = await waitUntilDone(toolFailure.panel, toolFailure.send);
    expect(failureText).toMatch(/tool error|selected element/i);

    toolFailure.editor.destroy();
    toolFailure.container.remove();
    callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      return response(null, Array.from({ length: 9 }, (_, index) =>
        toolCall(`context-${index}`, 'get_email_context')));
    }));
    const limit = setupEditor({ ai: { endpoint, model: 'mail-model' } });
    await submit(limit.panel, limit.prompt, limit.send, 'Read context repeatedly');
    const limitText = await waitUntilDone(limit.panel, limit.send);
    expect(limitText).toMatch(/tool limit|maximum.*tool/i);
  });

  it('aborts pending work on Stop and does not execute its later tool call', async () => {
    let resolveFetch!: (value: Response) => void;
    let requestSignal: AbortSignal | undefined;
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      requestSignal = init.signal as AbortSignal;
      return new Promise<Response>((resolve) => { resolveFetch = resolve; });
    });
    vi.stubGlobal('fetch', fetch);
    const { editor, panel, prompt, send } = setupEditor({ ai: { endpoint, model: 'mail-model' } });

    prompt.value = 'Stop this';
    send.click();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const stop = panel.querySelector<HTMLButtonElement>('#arch-ai-stop')!;
    expect(stop.disabled).toBe(false);
    expect(panel.querySelector('[role="log"]')?.textContent).toMatch(/thinking/i);
    stop.click();
    expect(requestSignal?.aborted).toBe(true);
    resolveFetch(response(null, [toolCall('late', 'replace_email_html', '{"html":"<p>Too late</p>"}')]));

    await vi.waitFor(() => expect(panel.querySelector('[role="log"]')?.textContent).toMatch(/cancel/i));
    expect(editor.getHTML()).not.toContain('Too late');
    await vi.waitFor(() => expect(send.disabled).toBe(false));
    expect(send.disabled).toBe(false);
  });

  it('aborts pending work when the panel closes or the editor is destroyed', async () => {
    const pending: Array<{ resolve: (value: Response) => void; signal: AbortSignal }> = [];
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve) => {
      pending.push({ resolve, signal: init.signal as AbortSignal });
    }));
    vi.stubGlobal('fetch', fetch);
    const { editor, container, panel, prompt, send } = setupEditor({ ai: { endpoint, model: 'mail-model' } });

    prompt.value = 'Close this request';
    send.click();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    panel.querySelector<HTMLButtonElement>('#btn-ai-close')!.click();
    expect(pending[0].signal.aborted).toBe(true);

    container.querySelector<HTMLButtonElement>('.arch-btn--ai')!.click();
    const reopenedPanel = container.querySelector<HTMLElement>('.arch-ai-sidepanel')!;
    const reopenedPrompt = reopenedPanel.querySelector<HTMLTextAreaElement>('.arch-ai-input')!;
    const reopenedSend = reopenedPanel.querySelector<HTMLButtonElement>('#arch-ai-send')!;
    reopenedPrompt.value = 'Destroy this request';
    reopenedSend.click();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    editor.destroy();
    expect(pending[1].signal.aborted).toBe(true);

    for (const request of pending) {
      request.resolve(response(null, [
        toolCall('late-close', 'replace_email_html', '{"html":"<p>Must not apply</p>"}'),
      ]));
    }
    await vi.waitFor(() => expect(editor.getHTML()).not.toContain('Must not apply'));
  });

  it('renders provider configuration errors instead of throwing while the panel opens', () => {
    const { panel } = setupEditor({ ai: { endpoint } });
    const transcript = panel.querySelector('[role="log"]');
    expect(transcript).not.toBeNull();
    expect(transcript?.textContent ?? '').toMatch(/model/i);
  });

  it('allows assistant responses in read-only mode while rejecting mutation tool calls', async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce({
        message: {
          tool_calls: [{
            id: 'readonly-change',
            type: 'function',
            function: { name: 'replace_email_html', arguments: '{"html":"<p>Changed</p>"}' },
          }],
        },
      })
      .mockResolvedValueOnce({ message: { content: 'I cannot modify a read-only email' } });
    (window as Window & { puter?: unknown }).puter = { ai: { chat } };
    const { editor, panel, prompt, send } = setupEditor({ readOnly: true });
    const originalHtml = editor.getHTML();

    await submit(panel, prompt, send, 'Change this');
    const text = await waitUntilDone(panel, send);

    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[0][1].tools.map((tool: any) => tool.function.name)).toEqual([
      'get_email_context',
      'replace_selected_element',
      'replace_email_html',
    ]);
    expect(editor.getHTML()).toBe(originalHtml);
    expect(text).toMatch(/read-only/i);
    expect(text).toContain('I cannot modify a read-only email');
  });
});

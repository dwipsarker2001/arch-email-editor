import type { AiOptions } from '../types';
import { createEditorTools, type EditorToolCallbacks } from '../ai/editorTools';
import { createProvider } from '../ai/createProvider';
import { PuterProvider } from '../ai/PuterProvider';
import { runAgentTurn } from '../ai/runAgentTurn';
import type { AiMessage, AiProvider } from '../ai/types';

const SYSTEM_INSTRUCTIONS = [
  'You are an assistant for editing email content.',
  'Use the supplied email context to answer questions and make only requested changes.',
  'Use replace_selected_element for changes to the selected element and replace_email_html for whole-email changes.',
  'Never claim an edit succeeded unless the corresponding editor tool succeeded.',
].join(' ');

type EntryKind = 'user' | 'assistant' | 'error' | 'status';
let nextPromptId = 0;

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === 'string') return rec.message;
    if (typeof rec.error === 'string') return rec.error;
    if (typeof rec.error === 'object' && rec.error !== null) {
      const inner = rec.error as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
    }
  }
  return String(error);
}

export class AiAssistant {
  private readonly transcript: HTMLElement;
  private readonly prompt: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly provider: AiProvider | null;
  private readonly history: AiMessage[] = [];
  private activeController: AbortController | null = null;
  private busyEntry: HTMLElement | null = null;
  private disposed = false;
  private cancelled = false;
  private readOnly: boolean;

  constructor(
    private readonly container: HTMLElement,
    options: AiOptions,
    private readonly createCallbacks: () => EditorToolCallbacks,
    readOnly = false,
  ) {
    this.readOnly = readOnly;
    let provider: AiProvider | null = null;
    let configurationError: string | null = null;
    try {
      provider = createProvider(options);
    } catch (error) {
      configurationError = formatError(error);
    }
    this.provider = provider;
    const promptId = `arch-ai-prompt-${++nextPromptId}`;
    const attribution = provider instanceof PuterProvider
      ? '<a class="arch-ai-attribution" href="https://developer.puter.com/" target="_blank" rel="noopener noreferrer">Powered by Puter</a>'
      : '';

    this.container.classList.add('arch-ai-chat');
    this.container.innerHTML = `
      <div class="arch-ai-context" aria-live="polite"></div>
      <div class="arch-ai-transcript" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <form class="arch-ai-compose">
        <label class="arch-ai-label" for="${promptId}">Message the AI Assistant</label>
        <textarea id="${promptId}" class="arch-ai-input" rows="3" placeholder="Ask about or edit this email"></textarea>
        <div class="arch-ai-actions">
          <button type="submit" class="arch-ai-button arch-ai-send" id="arch-ai-send">Send</button>
          <button type="button" class="arch-ai-button arch-ai-stop" id="arch-ai-stop" disabled>Stop</button>
        </div>
      </form>
      ${attribution}
    `;

    this.transcript = this.container.querySelector<HTMLElement>('.arch-ai-transcript')!;
    this.prompt = this.container.querySelector<HTMLTextAreaElement>('.arch-ai-input')!;
    this.sendButton = this.container.querySelector<HTMLButtonElement>('#arch-ai-send')!;
    this.stopButton = this.container.querySelector<HTMLButtonElement>('#arch-ai-stop')!;
    this.syncReadOnlyState();
    this.sendButton.disabled = !provider;
    this.container.querySelector<HTMLFormElement>('.arch-ai-compose')!.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });
    this.stopButton.addEventListener('click', () => this.stop());

    if (configurationError) this.appendEntry('error', configurationError);
    void this.updateContextBadge();
  }

  public setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    this.syncReadOnlyState();
  }

  private syncReadOnlyState(): void {
    if (this.readOnly) {
      this.prompt.setAttribute('aria-description', 'The editor is read-only. The assistant can respond but cannot modify email content.');
    } else {
      this.prompt.removeAttribute('aria-description');
    }
  }

  private async updateContextBadge(): Promise<void> {
    try {
      this.renderContextBadge(await this.createCallbacks().getEmailContext());
    } catch {
      this.container.querySelector('.arch-ai-context')?.replaceChildren();
    }
  }

  private renderContextBadge(contextJson: string): void {
    try {
      const context = JSON.parse(contextJson) as {
        selectedText?: string | null;
        selectedHtml?: string | null;
        selectedType?: string | null;
      };
      const selectedText = context.selectedText?.trim();
      const selectedLabel = selectedText
        || (context.selectedHtml ? `Selected ${context.selectedType || 'content'}` : null);
      const badge = document.createElement('span');
      badge.className = 'arch-ai-context-badge';
      badge.textContent = selectedText ? `Selected: ${selectedText}` : selectedLabel || 'No content selected';
      this.container.querySelector('.arch-ai-context')?.replaceChildren(badge);
    } catch {
      this.container.querySelector('.arch-ai-context')?.replaceChildren();
    }
  }

  private appendEntry(kind: EntryKind, text: string): HTMLElement {
    const entry = document.createElement('div');
    entry.className = `arch-ai-message arch-ai-message--${kind}`;
    entry.textContent = text;
    this.transcript.appendChild(entry);
    this.transcript.scrollTop = this.transcript.scrollHeight;
    return entry;
  }

  private setBusy(busy: boolean): void {
    this.sendButton.disabled = busy || !this.provider;
    this.stopButton.disabled = !busy;
    this.transcript.setAttribute('aria-busy', String(busy));
    this.container.classList.toggle('is-busy', busy);
    if (busy) this.busyEntry = this.appendEntry('status', 'Thinking…');
    else {
      this.busyEntry?.remove();
      this.busyEntry = null;
    }
  }

  private async send(): Promise<void> {
    const text = this.prompt.value.trim();
    if (!text || this.activeController || !this.provider || this.disposed) return;

    const controller = new AbortController();
    this.activeController = controller;
    this.cancelled = false;
    this.setBusy(true);
    this.appendEntry('user', text);
    this.prompt.value = '';

    try {
      const callbacks = this.createCallbacks();
      const context = await callbacks.getEmailContext();
      if (controller.signal.aborted) return;
      this.renderContextBadge(context);
      const tools = createEditorTools(callbacks);
      const previousHistory = [...this.history];
      const userMessage: AiMessage = {
        role: 'user',
        content: `${text}\n\nCurrent email and selection context:\n${context}`,
      };
      const input: AiMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTIONS },
        ...previousHistory,
        userMessage,
      ];
      const firstResponseIndex = input.length;
      const result = await runAgentTurn(
        this.provider,
        input,
        tools,
        controller.signal,
        (name, status) => this.appendEntry(
          status === 'error' ? 'error' : 'status',
          `${status === 'running' ? 'Running' : status === 'complete' ? 'Completed' : 'Failed'} ${name}`,
        ),
      );
      if (controller.signal.aborted || this.disposed) return;

      this.history.splice(0, this.history.length, ...result.messages.slice(1));
      for (const message of result.messages.slice(firstResponseIndex)) {
        if (message.role === 'assistant' && typeof message.content === 'string' && message.content) {
          this.appendEntry(message.content.startsWith('Error:') ? 'error' : 'assistant', message.content);
        } else if (message.role === 'tool' && typeof message.content === 'string' && message.content.startsWith('Tool error:')) {
          this.appendEntry('error', message.content);
        }
      }
      if (result.limitReached) this.appendEntry('status', 'Tool limit reached. Send another message to continue.');
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        if (!this.cancelled && !this.disposed) this.appendEntry('status', 'Request cancelled.');
      } else if (!this.disposed) {
        this.appendEntry('error', formatError(error));
      }
    } finally {
      if (this.activeController === controller) {
        this.activeController = null;
        this.setBusy(false);
      }
    }
  }

  private stop(): void {
    if (!this.activeController) return;
    this.cancelled = true;
    this.activeController.abort();
    this.appendEntry('status', 'Request cancelled.');
  }

  public dispose(): void {
    this.disposed = true;
    this.activeController?.abort();
    this.activeController = null;
    this.history.length = 0;
    this.busyEntry = null;
    this.transcript.replaceChildren();
    this.container.replaceChildren();
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchEmailEditor } from '../src/editor';

describe('AI sidepanel', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor | null = null;
  let secondEditor: ArchEmailEditor | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    secondEditor?.destroy();
    editor = null;
    secondEditor = null;
    container.remove();
    vi.unstubAllGlobals();
    delete (window as Window & { puter?: unknown }).puter;
  });

  it('opens an accessible chat panel with controls and toggles it closed', () => {
    editor = ArchEmailEditor.create(container);
    const spark = container.querySelector<HTMLButtonElement>('.arch-btn--ai')!;

    spark.click();

    const panel = container.querySelector<HTMLElement>('.arch-ai-sidepanel');
    expect(panel?.classList.contains('is-open')).toBe(true);
    expect(panel?.querySelector('.arch-prop-title')?.textContent).toBe('AI Assistant');
    expect(panel?.querySelector('[role="log"][aria-live="polite"]')).not.toBeNull();
    const prompt = panel?.querySelector<HTMLTextAreaElement>('.arch-ai-input');
    expect(panel?.querySelector('label[for]')?.textContent).toMatch(/message/i);
    expect(panel?.querySelector('label[for]')?.getAttribute('for')).toBe(prompt?.id);
    expect(prompt).not.toBeNull();
    expect(panel?.querySelector<HTMLButtonElement>('#arch-ai-send')?.textContent).toMatch(/send/i);
    expect(panel?.querySelector<HTMLButtonElement>('#arch-ai-stop')?.disabled).toBe(true);

    panel?.querySelector<HTMLButtonElement>('#btn-ai-close')?.click();
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();

    spark.click();
    expect(container.querySelector('.arch-ai-sidepanel')).not.toBeNull();
    spark.click();
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();
  });

  it('shows Puter attribution only for the default provider and resets transcript on close', async () => {
    const chat = vi.fn().mockResolvedValue({ message: { content: 'Puter reply' } });
    (window as Window & { puter?: unknown }).puter = { ai: { chat } };
    editor = ArchEmailEditor.create(container);
    const spark = container.querySelector<HTMLButtonElement>('.arch-btn--ai')!;

    spark.click();
    let panel = container.querySelector<HTMLElement>('.arch-ai-sidepanel')!;
    const attribution = panel.querySelector('a[href="https://developer.puter.com/"]');
    expect(attribution).not.toBeNull();
    expect(attribution?.textContent ?? '').toMatch(/Powered by Puter/);
    const prompt = panel.querySelector<HTMLTextAreaElement>('.arch-ai-input')!;
    prompt.value = 'Hello';
    panel.querySelector<HTMLButtonElement>('#arch-ai-send')!.click();
    await vi.waitFor(() => expect(panel.querySelector('[role="log"]')?.textContent).toContain('Puter reply'));

    panel.querySelector<HTMLButtonElement>('#btn-ai-close')!.click();
    spark.click();
    panel = container.querySelector<HTMLElement>('.arch-ai-sidepanel')!;
    expect(panel.querySelector('[role="log"]')?.textContent).toBe('');
    expect(panel.querySelector('a[href="https://developer.puter.com/"]')).not.toBeNull();
  });

  it('omits Puter attribution for a custom provider', () => {
    editor = ArchEmailEditor.create(container, {
      ai: { endpoint: 'https://ai.example.test/v1/chat/completions', model: 'mail-model' },
    });
    container.querySelector<HTMLButtonElement>('.arch-btn--ai')!.click();

    expect(container.querySelector('.arch-ai-attribution')).toBeNull();
  });

  it('keeps prompt labels uniquely associated across editor instances', () => {
    editor = ArchEmailEditor.create(container);
    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    secondEditor = ArchEmailEditor.create(secondContainer);
    container.querySelector<HTMLButtonElement>('.arch-btn--ai')!.click();
    secondContainer.querySelector<HTMLButtonElement>('.arch-btn--ai')!.click();
    const prompts = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.arch-ai-input'));
    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.arch-ai-label'));

    expect(prompts).toHaveLength(2);
    expect(new Set(prompts.map((prompt) => prompt.id)).size).toBe(2);
    expect(labels.map((label) => label.htmlFor)).toEqual(prompts.map((prompt) => prompt.id));

    secondContainer.remove();
  });

  it('removes the panel when switching tabs or destroying the editor', () => {
    editor = ArchEmailEditor.create(container);
    editor.getSidebar()!.openAiPanel();
    expect(container.querySelector('.arch-ai-sidepanel')).not.toBeNull();

    editor.getSidebar()!.setActiveTab('settings');
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();

    editor.getSidebar()!.openAiPanel();
    editor.destroy();
    editor = null;
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();
  });
});

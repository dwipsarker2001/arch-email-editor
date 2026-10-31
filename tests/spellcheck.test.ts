import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { isSpelledCorrectly, getSpellingSuggestions, highlightSpellingErrors } from '../src/engine/spellcheck';

describe('Spellcheck Configuration & Runtime API', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    container.remove();
  });

  it('defaults to disabled spellcheck (spellcheck="false") when no option is provided', () => {
    editor = ArchEmailEditor.create(container);
    expect(editor.isSpellcheckEnabled()).toBe(false);

    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const doc = iframe?.contentDocument;
    expect(doc).toBeTruthy();
    expect(iframe?.getAttribute('spellcheck')).toBeNull();
    expect(doc?.documentElement.getAttribute('spellcheck')).toBe('false');
    expect(doc?.body.getAttribute('spellcheck')).toBe('false');

    const editables = doc?.body.querySelectorAll('[contenteditable="true"]');
    expect(editables?.length).toBeGreaterThan(0);
    editables?.forEach((el) => {
      expect(el.getAttribute('spellcheck')).toBe('false');
    });
  });

  it('enables spellcheck when spellcheck: true is configured at initialization', () => {
    editor = ArchEmailEditor.create(container, { spellcheck: true });
    expect(editor.isSpellcheckEnabled()).toBe(true);

    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const doc = iframe?.contentDocument;
    expect(doc).toBeTruthy();
    expect(iframe?.getAttribute('spellcheck')).toBe('true');
    expect(doc?.documentElement.getAttribute('lang')).toBe('en');
    expect(doc?.documentElement.getAttribute('spellcheck')).toBe('true');
    expect(doc?.body.getAttribute('spellcheck')).toBe('true');
    expect(doc?.body.getAttribute('lang')).toBe('en');

    const editables = doc?.body.querySelectorAll('[contenteditable="true"]');
    expect(editables?.length).toBeGreaterThan(0);
    editables?.forEach((el) => {
      expect(el.getAttribute('spellcheck')).toBe('true');
      expect(el.getAttribute('lang')).toBe('en');
    });
  });

  it('dynamically toggles spellcheck on and off at runtime', () => {
    editor = ArchEmailEditor.create(container);
    expect(editor.isSpellcheckEnabled()).toBe(false);

    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const doc = iframe?.contentDocument;
    expect(doc).toBeTruthy();

    editor.setSpellcheck(true);
    expect(editor.isSpellcheckEnabled()).toBe(true);
    expect(iframe?.getAttribute('spellcheck')).toBe('true');
    expect(doc?.documentElement.getAttribute('lang')).toBe('en');
    expect(doc?.documentElement.getAttribute('spellcheck')).toBe('true');
    expect(doc?.body.getAttribute('spellcheck')).toBe('true');
    expect(doc?.body.getAttribute('lang')).toBe('en');

    let editables = doc?.body.querySelectorAll('[contenteditable="true"]');
    editables?.forEach((el) => {
      expect(el.getAttribute('spellcheck')).toBe('true');
      expect(el.getAttribute('lang')).toBe('en');
    });

    editor.setSpellcheck(false);
    expect(editor.isSpellcheckEnabled()).toBe(false);
    expect(iframe?.getAttribute('spellcheck')).toBeNull();
    expect(doc?.documentElement.getAttribute('spellcheck')).toBe('false');
    expect(doc?.body.getAttribute('spellcheck')).toBe('false');
    editables = doc?.body.querySelectorAll('[contenteditable="true"]');
    editables?.forEach((el) => {
      expect(el.getAttribute('spellcheck')).toBe('false');
    });
  });

  it('ensures exported HTML never contains spellcheck attribute', () => {
    editor = ArchEmailEditor.create(container, { spellcheck: true });
    const html = editor.getHTML();
    expect(html).not.toContain('spellcheck="true"');
    expect(html).not.toContain('spellcheck="false"');
    expect(html).not.toContain('spellcheck=');
  });

  it('validates english words and suggestions using typo-js dictionary', () => {
    expect(isSpelledCorrectly('welcome')).toBe(true);
    expect(isSpelledCorrectly('wrold')).toBe(false);
    expect(isSpelledCorrectly('discount')).toBe(true);
    expect(isSpelledCorrectly('doscount')).toBe(false);

    const suggestions = getSpellingSuggestions('wrold');
    expect(suggestions).toContain('world');
  });

  it('applies spellcheck highlights on document without corrupting DOM', () => {
    editor = ArchEmailEditor.create(container, { spellcheck: true });
    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const doc = iframe?.contentDocument;
    expect(doc).toBeTruthy();

    // Verify highlighting runs cleanly
    expect(() => highlightSpellingErrors(doc || null)).not.toThrow();

    // Export remains clean
    const html = editor.getHTML();
    expect(html).not.toContain('arch-spellcheck');
  });
});

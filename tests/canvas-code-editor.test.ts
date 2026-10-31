import { afterEach, describe, expect, it } from 'vitest';
import { EditorView } from 'codemirror';
import { ArchEmailEditor } from '../src/editor';

describe('Canvas HTML code mode', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor;

  afterEach(() => {
    editor?.destroy();
    container?.remove();
  });

  function createEditor(readOnly = false): void {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new ArchEmailEditor(container, { readOnly });
    editor.importHTML('<!doctype html><html><body><p>Current email</p></body></html>');
  }

  it('loads the latest preview HTML and applies edited code when returning to Preview', () => {
    createEditor();
    const codeButton = container.querySelector<HTMLButtonElement>('.arch-btn--code');

    expect(codeButton).not.toBeNull();
    expect(codeButton?.getAttribute('aria-label')).toBe('Edit HTML source');
    codeButton?.click();

    const cmElement = container.querySelector<HTMLElement>('.cm-editor');
    const codeView = cmElement ? EditorView.findFromDOM(cmElement) : null;
    expect(codeView?.state.doc.toString()).toContain('Current email');

    codeView?.dispatch({
      changes: {
        from: 0,
        to: codeView.state.doc.length,
        insert: '<!doctype html><html><body><p>Edited email</p></body></html>'
      }
    });
    codeButton?.click();
    expect(editor.getHTML()).toContain('Edited email');

    codeButton?.click();
    const refreshedView = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-editor')!);
    if (!refreshedView) throw new Error('Expected the refreshed CodeMirror editor to be mounted');
    expect(refreshedView.state.doc.toString()).toContain('Edited email');
  });

  it('allows read-only users to inspect code without applying a changed draft', () => {
    createEditor(true);
    const codeButton = container.querySelector<HTMLButtonElement>('.arch-btn--code');
    expect(codeButton).not.toBeNull();

    codeButton?.click();
    const cmElement = container.querySelector<HTMLElement>('.cm-editor');
    const codeView = cmElement ? EditorView.findFromDOM(cmElement) : null;
    expect(codeView?.state.readOnly).toBe(true);
    expect(cmElement?.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false');

    codeView?.dispatch({
      changes: {
        from: 0,
        to: codeView.state.doc.length,
        insert: '<!doctype html><html><body><p>Unauthorized draft</p></body></html>'
      }
    });
    codeButton?.click();

    expect(editor.getHTML()).toContain('Current email');
    expect(editor.getHTML()).not.toContain('Unauthorized draft');
  });

  it('keeps the Code toggle available when the canvas is empty', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new ArchEmailEditor(container);
    editor.importHTML('');

    const codeButton = container.querySelector<HTMLButtonElement>('.arch-btn--code');
    expect(codeButton).not.toBeNull();
    codeButton?.click();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
  });
});

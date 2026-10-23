import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('UMD Distribution Bundle', () => {
  it('executes UMD bundle in browser context and attaches ArchEmailEditor with .create()', () => {
    const umdCode = readFileSync(resolve(__dirname, '../dist/arch-email-editor.umd.js'), 'utf-8');
    expect(umdCode.length).toBeGreaterThan(1000);

    // Simulate browser environment without CommonJS module/exports
    const runInBrowser = new Function('window', 'document', 'self', 'globalThis', `
      var exports = undefined;
      var module = undefined;
      var define = undefined;
      ${umdCode}
      return window.ArchEmailEditor;
    `);

    const GlobalArchEditor = runInBrowser(window, document, window, window);
    expect(GlobalArchEditor).toBeDefined();

    // The editor class is accessible with .create()
    const createFn = GlobalArchEditor.create || GlobalArchEditor.ArchEmailEditor.create;
    expect(typeof createFn).toBe('function');

    // Create an instance using the global UMD
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = createFn(container);

    expect(editor.getJSON).toBeDefined();
    expect(editor.getHTML).toBeDefined();
    const html = editor.getHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('role="presentation"');

    editor.destroy();
    container.remove();
  });
});

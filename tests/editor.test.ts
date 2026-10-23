import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { EmailDocument } from '../src/types';

describe('ArchEmailEditor Core Engine', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('initializes and mounts editor UI elements into container', () => {
    const editor = ArchEmailEditor.create(container);

    expect(container.querySelector('.arch-editor')).toBeTruthy();
    expect(container.querySelector('.arch-editor__toolbar')).toBeTruthy();
    expect(container.querySelector('.arch-editor__palette')).toBeTruthy();
    expect(container.querySelector('.arch-editor__canvas')).toBeTruthy();
    expect(container.querySelector('.arch-editor__inspector')).toBeTruthy();

    editor.destroy();
  });

  it('accepts initialData and returns it via getJSON()', () => {
    const customDoc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#f0f0f0',
        fontFamily: 'Georgia, serif',
        textColor: '#222222'
      },
      blocks: [
        {
          id: 'custom_1',
          type: 'heading',
          content: { text: 'Custom Header' },
          style: { fontSize: '32px' }
        }
      ]
    };

    const editor = ArchEmailEditor.create(container, { initialData: customDoc });
    const json = editor.getJSON();

    expect(json.version).toBe('1.0');
    expect(json.blocks.length).toBe(1);
    expect(json.blocks[0].content.text).toBe('Custom Header');

    editor.destroy();
  });

  it('returns compiled email HTML via getHTML()', () => {
    const editor = ArchEmailEditor.create(container);
    const html = editor.getHTML();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('Welcome to Your Newsletter');

    editor.destroy();
  });

  it('fires onChange callback when a new block is added', () => {
    const onChange = vi.fn();
    const editor = ArchEmailEditor.create(container, { onChange });

    // Click the button block in the palette to add a new button block
    const buttonPaletteBtn = container.querySelector('[data-block-type="button"]') as HTMLButtonElement;
    expect(buttonPaletteBtn).toBeTruthy();
    buttonPaletteBtn.click();

    expect(onChange).toHaveBeenCalled();
    const currentDoc = editor.getJSON();
    const lastBlock = currentDoc.blocks[currentDoc.blocks.length - 1];
    expect(lastBlock.type).toBe('button');

    editor.destroy();
  });

  it('destroys cleanly and empties the container', () => {
    const editor = ArchEmailEditor.create(container);
    expect(container.children.length).toBeGreaterThan(0);

    editor.destroy();
    expect(container.children.length).toBe(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ArchEmailEditor } from '../src/editor';

describe('UI Customization: Topbar Buttons & Canvas Selection HUD', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-test-container';
    document.body.appendChild(container);
    editor = new ArchEmailEditor(container);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('renders topbar right-side action buttons with required action classes and white text styling', () => {
    const actionsContainer = container.querySelector('.arch-editor__actions');
    expect(actionsContainer).not.toBeNull();

    const importBtn = actionsContainer?.querySelector('.arch-btn--import-html');
    const exportJsonBtn = actionsContainer?.querySelector('.arch-btn--export-json');
    const exportHtmlBtn = actionsContainer?.querySelector('.arch-btn--export-html');
    const clearBtn = actionsContainer?.querySelector('.arch-btn--clear');

    expect(importBtn).not.toBeNull();
    expect(exportJsonBtn).not.toBeNull();
    expect(exportHtmlBtn).not.toBeNull();
    expect(clearBtn).not.toBeNull();

    // Verify CSS rule in stylesheet specifies white text for topbar buttons
    const cssContent = readFileSync(resolve(__dirname, '../dist/arch-email-editor.css'), 'utf-8');
    expect(cssContent).toContain('.arch-editor .arch-editor__actions .arch-btn');
    expect(cssContent).toContain('color:#fff');
  });

  it('shows a border and bottom-left action bar with comment, delete, copy when an item is clicked', () => {
    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    expect(iframe).not.toBeNull();

    const ifrDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
    expect(ifrDoc).toBeDefined();

    // Find a content element inside the iframe canvas (h1, p, img, or a)
    const targetBlock = ifrDoc?.querySelector<HTMLElement>('h1, h2, h3, p, img, a') || ifrDoc?.body?.querySelector<HTMLElement>('td');
    expect(targetBlock).not.toBeNull();

    // Click to select the item
    targetBlock?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Selected item must receive the border class
    const selectedEl = ifrDoc?.querySelector('.arch-selected-element');
    expect(selectedEl).not.toBeNull();

    // Overlay must render the bottom-left action bar with 3 options: comment, delete, copy
    const bottomActions = container.querySelector<HTMLElement>('.arch-rge-bottom-actions');
    expect(bottomActions).not.toBeNull();

    const commentBtn = bottomActions?.querySelector('.btn-rge-comment');
    const deleteBtn = bottomActions?.querySelector('.btn-rge-del');
    const copyBtn = bottomActions?.querySelector('.btn-rge-dup');

    expect(commentBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();
    expect(copyBtn).not.toBeNull();

    // All 3 icons must have white stroke
    const svgs = bottomActions?.querySelectorAll('svg') || [];
    expect(svgs.length).toBe(3);
    svgs.forEach((svg) => {
      expect(svg.getAttribute('stroke')).toBe('#ffffff');
    });

    // Verify CSS rule in stylesheet specifies white svg stroke/color for bottom actions
    const cssContent = readFileSync(resolve(__dirname, '../dist/arch-email-editor.css'), 'utf-8');
    expect(cssContent).toContain('.arch-rge-action-btn svg');
  });
  it('hides default action buttons when configured via actions or show* options', () => {
    const customContainer = document.createElement('div');
    document.body.appendChild(customContainer);

    const customEditor = new ArchEmailEditor(customContainer, {
      actions: {
        importHtml: false,
        exportJson: false,
        exportHtml: false,
        clear: false
      }
    });

    const actionsContainer = customContainer.querySelector('.arch-editor__actions');
    expect(actionsContainer).not.toBeNull();
    expect(actionsContainer?.querySelector('.arch-btn--import-html')).toBeNull();
    expect(actionsContainer?.querySelector('.arch-btn--export-json')).toBeNull();
    expect(actionsContainer?.querySelector('.arch-btn--export-html')).toBeNull();
    expect(actionsContainer?.querySelector('.arch-btn--clear')).toBeNull();

    // Test runtime toggling via setActions
    customEditor.setActions({ importHtml: true, clear: true });
    expect(customContainer.querySelector('.arch-btn--import-html')).not.toBeNull();
    expect(customContainer.querySelector('.arch-btn--clear')).not.toBeNull();
    expect(customContainer.querySelector('.arch-btn--export-json')).toBeNull();

    customEditor.destroy();
    customContainer.remove();
  });

  it('renders image preview box and removes replace/effects buttons when image is selected', () => {
    const iframe = container.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const ifrDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
    expect(ifrDoc).toBeDefined();

    // Find or create an img element inside iframe
    let imgEl = ifrDoc?.querySelector<HTMLImageElement>('img');
    if (!imgEl && ifrDoc?.body) {
      imgEl = ifrDoc.createElement('img');
      imgEl.src = 'https://example.com/sample.png';
      imgEl.alt = 'Sample image';
      ifrDoc.body.appendChild(imgEl);
    }

    expect(imgEl).not.toBeNull();
    imgEl?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Verify replace and apply effects buttons are completely removed
    const replaceBtn = container.querySelector('#btn-img-replace');
    const effectsBtn = container.querySelector('#btn-img-effects');
    expect(replaceBtn).toBeNull();
    expect(effectsBtn).toBeNull();

    // Verify image preview box is rendered
    const previewBox = container.querySelector('#arch-img-preview-box');
    expect(previewBox).not.toBeNull();

    const previewTag = container.querySelector<HTMLImageElement>('#arch-img-preview-tag');
    expect(previewTag).not.toBeNull();

    // Changing the URL input updates the preview image
    const srcInput = container.querySelector<HTMLInputElement>('#inp-img-src');
    expect(srcInput).not.toBeNull();

    if (srcInput && previewTag) {
      srcInput.value = 'https://example.com/new-photo.jpg';
      srcInput.dispatchEvent(new Event('input'));
      expect(previewTag.src).toBe('https://example.com/new-photo.jpg');
    }
  });

});

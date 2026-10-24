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

  it('imports prebuilt HTML and replaces canvas blocks', () => {
    const editor = ArchEmailEditor.create(container);
    const html = '<h1>Imported Header</h1><p>Imported paragraph text</p><a href="https://example.com">CTA Button</a>';

    editor.importHTML(html);

    const doc = editor.getJSON();
    expect(doc.blocks.length).toBe(3);
    expect(doc.blocks[0].content.text).toBe('Imported Header');
    expect(doc.blocks[1].content.text).toBe('Imported paragraph text');
    expect(doc.blocks[2].content.label).toBe('CTA Button');

    editor.destroy();
  });

  it('reorders blocks when dragged and dropped on canvas', () => {
    const editor = ArchEmailEditor.create(container);
    const initialDoc = editor.getJSON();
    const firstBlockId = initialDoc.blocks[0].id;
    const secondBlockId = initialDoc.blocks[1].id;

    // Simulate drag and drop reordering
    (editor as any).reorderBlock(firstBlockId, 2); // move first block to index 2

    const updatedDoc = editor.getJSON();
    expect(updatedDoc.blocks[0].id).toBe(secondBlockId);
    expect(updatedDoc.blocks[1].id).toBe(firstBlockId);

    editor.destroy();
  });

  it('imports complex multi-column HTML email template losslessly without breaking styles or tables', () => {
    const editor = ArchEmailEditor.create(container);

    const complexTemplate = `<!DOCTYPE html>
<html>
<head>
  <style>
    @media only screen and (max-width: 600px) {
      .responsive-column { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #e2e8f0;">
  <table width="600" align="center" style="border-collapse: collapse;">
    <tr>
      <td class="responsive-column" width="300" style="padding: 16px; background-color: #ffffff;">
        <h2 style="color: #1e3a8a;">Left Column Product</h2>
        <p>Product description copy.</p>
        <a href="https://example.com/p1" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px;">Buy Left</a>
      </td>
      <td class="responsive-column" width="300" style="padding: 16px; background-color: #f8fafc;">
        <h2 style="color: #047857;">Right Column Product</h2>
        <p>Special offer details.</p>
        <a href="https://example.com/p2" style="background-color: #059669; color: #ffffff; padding: 10px 20px;">Buy Right</a>
      </td>
    </tr>
  </table>
</body>
</html>`;

    editor.importHTML(complexTemplate);

    const exportedHtml = editor.getHTML();

    // 1. Preserves head styles and media queries
    expect(exportedHtml).toContain('@media only screen and (max-width: 600px)');
    expect(exportedHtml).toContain('.responsive-column');

    // 2. Preserves table layout and both columns
    expect(exportedHtml).toContain('width="300"');
    expect(exportedHtml).toContain('Left Column Product');
    expect(exportedHtml).toContain('Right Column Product');
    expect(exportedHtml).toContain('https://example.com/p1');
    expect(exportedHtml).toContain('https://example.com/p2');

    // 3. Verifies canvas iframe loaded the live document
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const ifrDoc = iframe.contentDocument!;
    expect(ifrDoc.querySelector('h2')?.textContent).toBe('Left Column Product');

    editor.destroy();
  });

  it('enables in-place text editing and updates document', () => {
    const editor = ArchEmailEditor.create(container);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const heading = ifrDoc.querySelector('h1')!;
    expect(heading).toBeTruthy();
    expect(heading.getAttribute('contenteditable')).toBe('true');

    // User types new text in-place directly in email canvas
    heading.textContent = 'Brand New In-Place Headline';
    ifrDoc.dispatchEvent(new Event('input', { bubbles: true }));

    const updatedHtml = editor.getHTML();
    expect(updatedHtml).toContain('Brand New In-Place Headline');

    editor.destroy();
  });

  it('selects elements on click and allows inspector editing', () => {
    const editor = ArchEmailEditor.create(container);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // Click button element in canvas iframe
    const button = ifrDoc.querySelector('a')!;
    expect(button).toBeTruthy();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Check inspector panel updated with button properties
    const labelInp = container.querySelector('#inp-btn-label') as HTMLInputElement;
    expect(labelInp).toBeTruthy();
    expect(labelInp.value).toBe(button.textContent?.trim());

    // Edit button label in Inspector
    labelInp.value = 'Updated via Inspector';
    labelInp.dispatchEvent(new Event('input'));

    expect(button.textContent).toBe('Updated via Inspector');
    expect(editor.getHTML()).toContain('Updated via Inspector');

    editor.destroy();
  });

  it('exports clean HTML free of internal editor attributes or helper styles', () => {
    const editor = ArchEmailEditor.create(container);
    const html = editor.getHTML();

    expect(html).not.toContain('contenteditable');
    expect(html).not.toContain('arch-canvas-editor-style');
    expect(html).not.toContain('arch-selected-element');

    editor.destroy();
  });

  it('renders all 14 RGE content blocks and all 6 section layouts in RightPanel', () => {
    const editor = ArchEmailEditor.create(container);

    const expectedBlocks = [
      'heading', 'text', 'list', 'image', 'button', 'table',
      'divider', 'spacer', 'social', 'html', 'video', 'icons', 'menu', 'gif'
    ];
    expectedBlocks.forEach((type) => {
      const btn = container.querySelector(`[data-block-type="${type}"]`);
      expect(btn, `Missing content block button: ${type}`).toBeTruthy();
    });

    const expectedSections = [
      '1-col', '2-col-50-50', '2-col-33-67', '2-col-67-33', '3-col', '4-col'
    ];
    expectedSections.forEach((layout) => {
      const btn = container.querySelector(`[data-row-layout="${layout}"]`);
      expect(btn, `Missing section layout button: ${layout}`).toBeTruthy();
    });

    editor.destroy();
  });

  it('instantiates and inserts all block types without errors', () => {
    const editor = ArchEmailEditor.create(container);
    const newTypes = ['list', 'table', 'video', 'icons', 'menu', 'gif'] as const;

    newTypes.forEach((type) => {
      const btn = container.querySelector(`[data-block-type="${type}"]`) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      btn.click();

      const doc = editor.getJSON();
      const lastBlock = doc.blocks[doc.blocks.length - 1];
      expect(lastBlock.type).toBe(type);
    });

    const html = editor.getHTML();
    expect(html).toContain('Feature point');
    expect(html).toContain('Standard Plan');
    expect(html).toContain('Watch Video');
    expect(html).toContain('Secure');
    expect(html).toContain('HOME');
    expect(html).toContain('giphy.gif');

    editor.destroy();
  });

  it('customizes and compiles email document settings matching RGE Studio', () => {
    const editor = ArchEmailEditor.create(container);

    // Switch to Settings tab
    const settingsTab = container.querySelector('[data-tab="settings"]') as HTMLButtonElement;
    settingsTab.click();

    const widthInp = container.querySelector('#inp-doc-width') as HTMLInputElement;
    const alignSel = container.querySelector('#inp-doc-align') as HTMLSelectElement;
    const bgInp = container.querySelector('#inp-doc-bg') as HTMLInputElement;
    const contentBgInp = container.querySelector('#inp-doc-content-bg') as HTMLInputElement;
    const preheaderInp = container.querySelector('#inp-doc-preheader') as HTMLInputElement;

    expect(widthInp).toBeTruthy();
    expect(alignSel).toBeTruthy();
    expect(bgInp).toBeTruthy();
    expect(contentBgInp).toBeTruthy();
    expect(preheaderInp).toBeTruthy();

    // Update settings
    widthInp.value = '640px';
    widthInp.dispatchEvent(new Event('change'));

    alignSel.value = 'left';
    alignSel.dispatchEvent(new Event('change'));

    bgInp.value = '#112233';
    bgInp.dispatchEvent(new Event('input'));

    contentBgInp.value = '#ffffff';
    contentBgInp.dispatchEvent(new Event('input'));

    preheaderInp.value = 'Preview snippet for subscribers';
    preheaderInp.dispatchEvent(new Event('input'));

    const doc = editor.getJSON();
    expect(doc.settings.contentWidth).toBe('640px');
    expect(doc.settings.contentAlign).toBe('left');
    expect(doc.settings.backgroundColor).toBe('#112233');
    expect(doc.settings.contentBackgroundColor).toBe('#ffffff');
    expect(doc.settings.preheader).toBe('Preview snippet for subscribers');

    const compiledHtml = editor.getHTML();
    expect(compiledHtml).toContain('Preview snippet for subscribers');
    expect(compiledHtml).toContain('640px');
    expect(compiledHtml).toContain('#112233');

    editor.destroy();
  });
});

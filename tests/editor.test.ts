import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { EmailDocument } from '../src/types';
import { ColumnLayoutAdapter, buildRowLayoutHtml } from '../src/engine/adapters';

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

  it('inserts dropped palette block at exact position (before vs after target image)', () => {
    const editor = ArchEmailEditor.create(container);
    const canvas = (editor as any).canvas;
    const ifrDoc = canvas.iframe.contentDocument!;

    // 1. Target the image block at index 1
    const imgEl = ifrDoc.querySelector('img')!;
    const imageUnit = canvas.findMoveableUnit(imgEl);
    expect(imageUnit).toBeTruthy();

    // 2. Drop heading on top half of image (position: 'before') -> must land at index 1 (before image)
    (canvas as any).hoveredDropTarget = imageUnit;
    (canvas as any).hoveredDropPosition = 'before';
    canvas.executeDrop('heading');

    expect(imageUnit.previousElementSibling?.tagName.toLowerCase()).toBe('tr');
    expect(imageUnit.previousElementSibling?.textContent).toContain('New Heading');

    const docBefore = editor.getJSON();
    expect(docBefore.blocks[0].type).toBe('heading'); // original heading
    expect(docBefore.blocks[1].type).toBe('heading'); // newly inserted heading at position 1
    expect(docBefore.blocks[2].type).toBe('image');   // image moved down to position 2

    // 3. Drop paragraph on bottom half of image (position: 'after') -> must land at index 3 (after image)
    (canvas as any).hoveredDropTarget = imageUnit;
    (canvas as any).hoveredDropPosition = 'after';
    canvas.executeDrop('text');

    expect(imageUnit.nextElementSibling?.tagName.toLowerCase()).toBe('tr');
    expect(imageUnit.nextElementSibling?.textContent).toContain('Add your newsletter copy here');

    const docAfter = editor.getJSON();
    expect(docAfter.blocks[2].type).toBe('image');
    expect(docAfter.blocks[3].type).toBe('text');

    // 4. Drop multi-column row layout with 'row:2-col-50-50' above image
    (canvas as any).hoveredDropTarget = imageUnit;
    (canvas as any).hoveredDropPosition = 'before';
    canvas.executeDrop('row:2-col-50-50');

    const insertedRow = imageUnit.previousElementSibling as HTMLElement;
    expect(insertedRow).toBeTruthy();
    expect(insertedRow.querySelectorAll('.arch-empty-col-placeholder').length).toBe(2);
    expect(insertedRow.textContent).toContain('No content here. Drag content from the right.');

    // 5. Dropping a content block into the empty column replaces the drop area with that block
    const col1 = insertedRow.querySelector('td.column') as HTMLElement;
    expect(col1).toBeTruthy();
    (canvas as any).hoveredDropTarget = col1;
    (canvas as any).hoveredDropPosition = 'after';
    canvas.executeDrop('heading');

    expect(col1.querySelector('.arch-empty-col-placeholder')).toBeNull();
    expect(col1.querySelector('h1, h2, h3, h4, h5, h6, table.heading_block, table.text_block')).toBeTruthy();

    // 6. Dropping a 3-column row layout uses compact drop areas without overflowing text in narrow columns
    (canvas as any).hoveredDropTarget = imageUnit;
    (canvas as any).hoveredDropPosition = 'before';
    canvas.executeDrop('row:3-col');
    const threeColRow = imageUnit.previousElementSibling as HTMLElement;
    expect(threeColRow).toBeTruthy();
    const narrowPh = threeColRow.querySelector('.arch-empty-col-placeholder.arch-empty-col-narrow');
    expect(narrowPh).toBeTruthy();
    expect(narrowPh?.querySelector('span')).toBeNull();

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

  it('manages settings tab beautifully matching content text options (stepper, slider, icon align, typography)', () => {
    const editor = ArchEmailEditor.create(container);

    // Switch to Settings tab
    const settingsTab = container.querySelector('[data-tab="settings"]') as HTMLButtonElement;
    settingsTab.click();

    // 1. Verify Header and Badges
    const propHeader = container.querySelector('.arch-tab-panel--settings .arch-prop-header');
    expect(propHeader).toBeTruthy();
    expect(propHeader?.textContent).toContain('DOCUMENT SETTINGS');
    expect(propHeader?.textContent).toContain('GLOBAL');

    // 2. Verify Accordions (Canvas, Typography, Metadata)
    const accordions = container.querySelectorAll('.arch-tab-panel--settings .arch-accordion-header');
    expect(accordions.length).toBe(3);
    expect(accordions[0].textContent).toContain('EMAIL CANVAS');
    expect(accordions[1].textContent).toContain('DEFAULT TYPOGRAPHY');
    expect(accordions[2].textContent).toContain('EMAIL METADATA');

    // 3. Test Width Stepper (+ / -) & Range Slider sync
    const stpWidthPlus = container.querySelector('.arch-tab-panel--settings [data-stepper-id="stp-doc-width"] button[data-step="10"]') as HTMLButtonElement;
    expect(stpWidthPlus).toBeTruthy();
    stpWidthPlus.click();

    let doc = editor.getJSON();
    expect(doc.settings.contentWidth).toBe('610px');

    const rangeSlider = container.querySelector('#inp-doc-width-range') as HTMLInputElement;
    expect(rangeSlider).toBeTruthy();
    rangeSlider.value = '680';
    rangeSlider.dispatchEvent(new Event('input'));

    doc = editor.getJSON();
    expect(doc.settings.contentWidth).toBe('680px');

    // 4. Test Alignment Icon Button
    const alignLeftBtn = container.querySelector('#grp-doc-align [data-align="left"]') as HTMLButtonElement;
    expect(alignLeftBtn).toBeTruthy();
    expect(alignLeftBtn.querySelector('svg')).toBeTruthy();
    alignLeftBtn.click();

    doc = editor.getJSON();
    expect(doc.settings.contentAlign).toBe('left');
    expect(alignLeftBtn.classList.contains('is-active')).toBe(true);

    // 5. Test Typography Defaults (Font Family, Text Color, Link Color, Line Height)
    const fontSel = container.querySelector('#inp-doc-font') as HTMLSelectElement;
    expect(fontSel).toBeTruthy();
    expect(fontSel.classList.contains('arch-rge-select')).toBe(true);
    fontSel.value = 'Georgia, serif';
    fontSel.dispatchEvent(new Event('change'));

    const textColorSwatch = container.querySelector('#inp-doc-text-color') as HTMLInputElement;
    expect(textColorSwatch).toBeTruthy();
    textColorSwatch.value = '#222222';
    textColorSwatch.dispatchEvent(new Event('input'));

    doc = editor.getJSON();
    expect(doc.settings.fontFamily).toBe('Georgia, serif');
    expect(doc.settings.textColor).toBe('#222222');

    // 6. Test Background Image Toggle Switch
    const bgImgToggle = container.querySelector('#chk-doc-bg-img') as HTMLInputElement;
    const bgImgUrlRow = container.querySelector('#row-doc-bg-url') as HTMLElement;
    expect(bgImgToggle).toBeTruthy();
    expect(bgImgUrlRow).toBeTruthy();
    expect(bgImgUrlRow.style.display).toBe('none');

    bgImgToggle.checked = true;
    bgImgToggle.dispatchEvent(new Event('change'));
    expect(bgImgUrlRow.style.display).toBe('flex');

    // 7. Test Accordion Toggling and Persistence
    const firstAccordion = accordions[0] as HTMLElement;
    const firstBody = container.querySelector('#sec-design-settings') as HTMLElement;
    expect(firstBody.classList.contains('is-hidden')).toBe(false);

    firstAccordion.click();
    expect(firstBody.classList.contains('is-hidden')).toBe(true);

    firstAccordion.click();
    expect(firstBody.classList.contains('is-hidden')).toBe(false);

    editor.destroy();
  });

  it('shows floating rich text toolbar only in text edit mode and dismisses on body click', () => {
    const editor = ArchEmailEditor.create(container);
    const canvas = (editor as any).canvas;
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // 1. Single click on paragraph selects the block, but floating toolbar does NOT show
    const p = ifrDoc.querySelector('p') as HTMLElement;
    expect(p).toBeTruthy();
    p.click();

    const toolbarOnSingleClick = container.querySelector('.arch-rge-text-toolbar');
    expect(toolbarOnSingleClick).toBeNull();

    // 2. Entering text edit mode displays the floating rich text toolbar and retains the blue/purple selection border
    canvas.enterTextEditMode(p);
    const toolbarInEditMode = container.querySelector('.arch-rge-text-toolbar');
    expect(toolbarInEditMode).toBeTruthy();
    expect(p.classList.contains('arch-selected-element')).toBe(true);
    expect(p.classList.contains('arch-editing-text')).toBe(true);

    // 3. Click the outer body area -> exits edit mode, deselects and hides floating toolbar
    ifrDoc.body.click();
    const toolbarAfterBodyClick = container.querySelector('.arch-rge-text-toolbar');
    expect(toolbarAfterBodyClick).toBeNull();
    expect(ifrDoc.querySelector('.arch-selected-element')).toBeNull();

    // 4. In text edit mode, double-clicking inside the active editable text element does not collapse selection or exit edit mode
    canvas.enterTextEditMode(p);
    expect(canvas.isEditingText).toBe(true);

    const sel = ifrDoc.defaultView?.getSelection();
    if (sel) {
      const range = ifrDoc.createRange();
      const textNode = p.firstChild || p;
      if (textNode.nodeType === 3) {
        range.setStart(textNode, 0);
        range.setEnd(textNode, Math.min(4, (textNode.nodeValue || '').length));
      } else {
        range.selectNodeContents(p);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      expect(sel.isCollapsed).toBe(false);

      // Fire double-click inside p
      p.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

      // Editor must still be in text edit mode and the word selection preserved
      expect(canvas.isEditingText).toBe(true);
      expect(sel.isCollapsed).toBe(false);
    }

    editor.destroy();
  });

  it('supports interactive column drag resize, live percentage badge, and clean email export', () => {
    const editor = ArchEmailEditor.create(container);
    const canvas = (editor as any).canvas;
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // 1. Insert a 2-column layout into the email body
    const rowHtml = buildRowLayoutHtml('2-col-50-50', false);
    ifrDoc.body.insertAdjacentHTML('beforeend', rowHtml);
    canvas.onStructureChanged();

    const row = ifrDoc.querySelector('table.row') as HTMLElement;
    expect(row).toBeTruthy();

    const cols = ColumnLayoutAdapter.getColumnsInRow(row);
    expect(cols.length).toBe(2);
    expect(cols[0].getAttribute('width')).toBe('50%');
    expect(cols[1].getAttribute('width')).toBe('50%');

    // 2. Select the row to show HUD & column resize handle
    canvas.selectUnit(row, row);

    const overlay = container.querySelector('.arch-canvas-overlay') as HTMLElement;
    const handle = overlay.querySelector('.arch-col-resize-handle') as HTMLElement;
    expect(handle).toBeTruthy();

    // Mock bounding client rects for columns in test environment
    vi.spyOn(cols[0], 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 400,
      top: 50,
      bottom: 250,
      width: 300,
      height: 200,
      x: 100,
      y: 50,
      toJSON: () => {}
    });
    vi.spyOn(cols[1], 'getBoundingClientRect').mockReturnValue({
      left: 400,
      right: 700,
      top: 50,
      bottom: 250,
      width: 300,
      height: 200,
      x: 400,
      y: 50,
      toJSON: () => {}
    });
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 700,
      top: 50,
      bottom: 250,
      width: 600,
      height: 200,
      x: 100,
      y: 50,
      toJSON: () => {}
    });

    // 3. Start drag on the resize handle
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 400, button: 0 }));
    expect(handle.classList.contains('active')).toBe(true);

    // 4. Drag right by +60px (making left column 360px and right column 240px -> 60% / 40%)
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 460 }));

    expect(cols[0].getAttribute('width')).toBe('60%');
    expect(cols[0].style.width).toBe('60%');
    expect(cols[1].getAttribute('width')).toBe('40%');
    expect(cols[1].style.width).toBe('40%');

    const badge = overlay.querySelector('.arch-dimensions-pill');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('60% | 40%');

    // 5. Release mouse
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(handle.classList.contains('active')).toBe(false);
    expect(overlay.querySelector('.arch-dimensions-pill')).toBeNull();

    // 6. Verify exported email HTML contains updated percentages and ZERO resize handles
    const cleanHtml = editor.getHTML();
    expect(cleanHtml).toContain('width="60%"');
    expect(cleanHtml).toContain('width="40%"');
    expect(cleanHtml).not.toContain('arch-col-resize-handle');
    expect(cleanHtml).not.toContain('arch-col-resize-grip');

    // 7. Verify Undo reverts widths back to 50% / 50%
    editor.undo();
    const cleanHtmlAfterUndo = editor.getHTML();
    expect(cleanHtmlAfterUndo).toContain('width="50%"');

    editor.destroy();
  });

  it('supports interactive button drag resize with dimensions badge and clean email export', () => {
    const editor = ArchEmailEditor.create(container);
    const canvas = (editor as any).canvas;
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // Select the CTA Button
    const btn = ifrDoc.querySelector('a') as HTMLElement;
    expect(btn).toBeTruthy();
    canvas.selectUnit(btn, btn);

    const overlay = container.querySelector('.arch-canvas-overlay') as HTMLElement;
    // Verify right-side drag icon is removed so it does not block the right resize handle
    expect(overlay.querySelector('.arch-rge-move-handle')).toBeNull();
    const eHandle = overlay.querySelector('.arch-resize-handle--e') as HTMLElement;
    expect(eHandle).toBeTruthy();

    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      right: 360,
      top: 100,
      bottom: 144,
      width: 160,
      height: 44,
      x: 200,
      y: 100,
      toJSON: () => {}
    });

    // Start drag on right handle and drag +40px to widen button
    eHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 360, clientY: 122, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 400, clientY: 122 }));

    expect(btn.style.width).toBe('200px');
    const badge = overlay.querySelector('.arch-dimensions-pill');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('200');

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Clean export
    const cleanHtml = editor.getHTML();
    expect(cleanHtml).toContain('width: 200px');
    expect(cleanHtml).not.toContain('arch-resize-handle');

    editor.destroy();
  });

  it('supports interactive text drag resize: side handle adjusts width and corner handle scales font size', () => {
    const editor = ArchEmailEditor.create(container);
    const canvas = (editor as any).canvas;
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // Select paragraph
    const p = ifrDoc.querySelector('p') as HTMLElement;
    expect(p).toBeTruthy();
    canvas.selectUnit(p, p);

    const overlay = container.querySelector('.arch-canvas-overlay') as HTMLElement;
    const eHandle = overlay.querySelector('.arch-resize-handle--e') as HTMLElement;
    const seHandle = overlay.querySelector('.arch-resize-handle--se') as HTMLElement;
    expect(eHandle).toBeTruthy();
    expect(seHandle).toBeTruthy();

    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 500,
      top: 50,
      bottom: 90,
      width: 400,
      height: 40,
      x: 100,
      y: 50,
      toJSON: () => {}
    });

    // 1. Drag side handle to adjust line-wrap width
    eHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 500, clientY: 70, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 450, clientY: 70 })); // -50px

    expect(p.style.maxWidth).toBe('350px');
    let badge = overlay.querySelector('.arch-dimensions-pill');
    expect(badge?.textContent).toBe('Width: 350px');

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // 2. Drag corner handle to scale font size
    seHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 450, clientY: 90, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 530, clientY: 170 })); // scale up

    badge = overlay.querySelector('.arch-dimensions-pill');
    expect(badge?.textContent).toContain('Font:');

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Clean export
    const cleanHtml = editor.getHTML();
    expect(cleanHtml).toContain('max-width: 350px');
    expect(cleanHtml).not.toContain('arch-resize-handle');

    editor.destroy();
  });

  it('supports setHTML(), loadHTML(), and dynamic insertHTML() via JS API', () => {
    let changeFired = 0;
    const editor = ArchEmailEditor.create(container, {
      onChange: () => {
        changeFired++;
      }
    });

    // 1. setHTML replaces entire email content dynamically
    const newHtml = `<!DOCTYPE html><html><body><table width="600" class="row"><tr><td><h1>Dynamic Newsletter</h1></td></tr></table></body></html>`;
    editor.setHTML(newHtml);
    expect(changeFired).toBeGreaterThan(0);
    expect(editor.getHTML()).toContain('Dynamic Newsletter');

    // 2. insertHTML dynamically adds a custom HTML snippet into the email
    editor.insertHTML('<div class="promo-box" style="padding: 15px; background: #e0f2fe;"><p>50% Off Flash Sale!</p></div>');
    const updatedHtml = editor.getHTML();
    expect(updatedHtml).toContain('50% Off Flash Sale!');

    editor.destroy();
  });

  it('supports custom toolbar buttons in top-right corner with click callbacks and dynamic add/remove', () => {
    let saved = false;
    let clickedEditorInstance: any = null;

    const editor = ArchEmailEditor.create(container, {
      customButtons: [
        {
          id: 'btn-save-draft',
          label: 'Save Draft',
          icon: '💾',
          className: 'arch-btn--primary',
          title: 'Save your email template',
          onClick: (inst) => {
            saved = true;
            clickedEditorInstance = inst;
          }
        }
      ]
    });

    // Verify custom button rendered in top-right actions bar
    const saveBtn = container.querySelector('#arch-custom-btn-btn-save-draft') as HTMLButtonElement;
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.textContent).toContain('Save Draft');
    expect(saveBtn.textContent).toContain('💾');
    expect(saveBtn.classList.contains('arch-btn--primary')).toBe(true);

    // Click triggers callback with editor instance
    saveBtn.click();
    expect(saved).toBe(true);
    expect(clickedEditorInstance).toBe(editor);

    // Dynamically add a second button via JS API
    let published = false;
    editor.addCustomButton({
      id: 'btn-publish',
      label: 'Publish',
      icon: '🚀',
      onClick: () => {
        published = true;
      }
    });

    const pubBtn = container.querySelector('#arch-custom-btn-btn-publish') as HTMLButtonElement;
    expect(pubBtn).toBeTruthy();
    pubBtn.click();
    expect(published).toBe(true);

    // Dynamically remove button
    editor.addCustomButton({
      id: 'btn-back',
      label: 'Back',
      icon: 'chevron-left',
      onClick: () => {}
    });
    const backBtn = container.querySelector('#arch-custom-btn-btn-back');
    expect(backBtn).toBeTruthy();
    expect(backBtn!.querySelector('svg.arch-btn-icon-svg')).toBeTruthy();
    expect(backBtn!.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');

    editor.removeCustomButton('btn-save-draft');
    expect(container.querySelector('#arch-custom-btn-btn-save-draft')).toBeNull();
    expect(container.querySelector('#arch-custom-btn-btn-publish')).toBeTruthy();

    editor.destroy();
  });

  it('supports template name configuration, programmatic updates, and inline rename via toolbar', () => {
    let renamedTo = '';
    const editor = ArchEmailEditor.create(container, {
      templateName: 'Welcome Series 2026',
      editableTemplateName: true,
      onTemplateNameChange: (newName) => {
        renamedTo = newName;
      }
    });

    // 1. Check initial name in toolbar
    const nameEl = container.querySelector('.arch-template-name') as HTMLElement;
    expect(nameEl).toBeTruthy();
    expect(nameEl.textContent).toBe('Welcome Series 2026');
    expect(editor.getTemplateName()).toBe('Welcome Series 2026');

    // 2. Programmatically update template name
    editor.setTemplateName('Black Friday Campaign');
    expect(nameEl.textContent).toBe('Black Friday Campaign');
    expect(editor.getTemplateName()).toBe('Black Friday Campaign');
    expect(renamedTo).toBe('Black Friday Campaign');

    // 3. Inline click to rename
    nameEl.click();
    const input = container.querySelector('.arch-template-name-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Black Friday Campaign');

    input.value = 'Cyber Monday Sale';
    input.dispatchEvent(new Event('blur'));

    const updatedNameEl = container.querySelector('.arch-template-name') as HTMLElement;
    expect(updatedNameEl.textContent).toBe('Cyber Monday Sale');
    expect(renamedTo).toBe('Cyber Monday Sale');

    editor.destroy();
  });

  it('renders floating Undo and Redo buttons in the bottom-left corner of the canvas and handles undo/redo', () => {
    const editor = ArchEmailEditor.create(container);

    const floatHistory = container.querySelector('.arch-canvas-floating-history') as HTMLElement;
    expect(floatHistory).toBeTruthy();

    const undoBtn = floatHistory.querySelector('.arch-btn--undo') as HTMLButtonElement;
    const redoBtn = floatHistory.querySelector('.arch-btn--redo') as HTMLButtonElement;
    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();

    // Initially undo and redo are disabled (at initial state)
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);

    // Insert an item to push history
    editor.insertHTML('<p>New change for undo</p>');

    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);

    // Clicking floating undo reverts the change
    undoBtn.click();
    expect(editor.getHTML()).not.toContain('New change for undo');
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(false);

    // Clicking floating redo reapplies the change
    redoBtn.click();
    expect(editor.getHTML()).toContain('New change for undo');
    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);

    editor.destroy();
  });
  it('supports readOnly mode and prevents direct editing or dragging', () => {
    const roContainer = document.createElement('div');
    document.body.appendChild(roContainer);

    const roEditor = new ArchEmailEditor(roContainer, { readOnly: true });
    expect(roEditor.isReadOnly()).toBe(true);

    const rootEl = roContainer.querySelector('.arch-editor');
    expect(rootEl?.classList.contains('arch-editor--readonly')).toBe(true);

    const iframe = roContainer.querySelector<HTMLIFrameElement>('.arch-canvas-iframe');
    const ifrDoc = iframe?.contentDocument;
    expect(ifrDoc).toBeDefined();

    // In read-only mode, no elements should have contenteditable="true"
    const editableElements = ifrDoc?.querySelectorAll('[contenteditable="true"]');
    expect(editableElements?.length).toBe(0);

    // Right panel block cards should not be draggable
    const cards = roContainer.querySelectorAll('.arch-block-card');
    cards.forEach((card) => {
      expect(card.getAttribute('draggable')).toBe('false');
    });

    // Dynamic setReadOnly toggle to false
    roEditor.setReadOnly(false);
    expect(roEditor.isReadOnly()).toBe(false);
    expect(rootEl?.classList.contains('arch-editor--readonly')).toBe(false);

    // Dynamic setReadOnly toggle back to true
    roEditor.setReadOnly(true);
    expect(roEditor.isReadOnly()).toBe(true);
    expect(rootEl?.classList.contains('arch-editor--readonly')).toBe(true);

    roEditor.destroy();
    roContainer.remove();
  });

  it('supports dark theme and runtime theme switching', () => {
    const darkContainer = document.createElement('div');
    document.body.appendChild(darkContainer);

    const darkEditor = new ArchEmailEditor(darkContainer, { theme: 'dark' });
    expect(darkEditor.getTheme()).toBe('dark');

    const rootEl = darkContainer.querySelector('.arch-editor');
    expect(rootEl?.classList.contains('arch-theme--dark')).toBe(true);

    // Switch theme dynamically to light
    darkEditor.setTheme('light');
    expect(darkEditor.getTheme()).toBe('light');
    expect(rootEl?.classList.contains('arch-theme--dark')).toBe(false);

    // Switch theme dynamically back to dark
    darkEditor.setTheme('dark');
    expect(darkEditor.getTheme()).toBe('dark');
    expect(rootEl?.classList.contains('arch-theme--dark')).toBe(true);

    darkEditor.destroy();
    darkContainer.remove();
  });
});

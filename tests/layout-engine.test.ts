import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { moveUnitToTarget } from '../src/engine/glue';

const PUMPKIN_EXCERPT = `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <style>
    @media(max-width:620px) {
      .row-2 .column-1 .block-2.paragraph_block td.pad>div {
        text-align: center !important;
        font-size: 32px !important;
      }
      .row-4 .column-1 .block-2.paragraph_block td.pad>div {
        text-align: left !important;
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#fdfafa;">
  <table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tbody>
      <tr>
        <td>
          <table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tbody>
              <tr>
                <td>
                  <table class="row-content" align="center" width="600" style="width:600px;margin:0 auto;">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="50%">
                          <table class="text_block block-1" width="100%" role="presentation">
                            <tr><td class="pad"><div>Left Header Text</div></td></tr>
                          </table>
                        </td>
                        <td class="column column-2" width="50%">
                          <table class="text_block block-1" width="100%" role="presentation">
                            <tr><td class="pad"><div>Right Header Text</div></td></tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" width="600" style="width:600px;margin:0 auto;">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%">
                          <table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="pad" style="padding:36px 0 24px;width:100%;">
                                <div class="alignment" align="center">
                                  <div style="max-width: 180px;">
                                    <a href="https://www.pumpkin.care/" target="_blank">
                                      <img src="https://example.com/logo.png" style="display: block; height: auto; border: 0; width: 100%;" width="180" alt="Pumpkin" title="Pumpkin">
                                    </a>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </table>
                          <table class="paragraph_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="pad" style="padding:24px 48px;">
                                <div style="color:#1a000b;font-size:44px;text-align:center;">
                                  <p style="margin: 0;">Is <em>this</em> pet insurance plan right for Cinnamon?</p>
                                </div>
                              </td>
                            </tr>
                          </table>
                          <table class="button_block block-3" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="pad" style="padding:10px 0 35px;text-align:center;">
                                <div class="alignment" align="center">
                                  <a href="https://www.pumpkin.care/quote" target="_blank" style="color:#1a000b;text-decoration:none;">
                                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.pumpkin.care/quote" style="height:56px;width:242px;v-text-anchor:middle;" arcsize="108%" fillcolor="#eaff05"><v:stroke dashstyle="Solid" weight="1px" color="#1a000b"/><w:anchorlock/><v:textbox inset="0px,0px,0px,0px"><center dir="false" style="color:#1a000b;font-family:sans-serif;font-size:18px"><![endif]-->
                                    <span class="button" style="background-color: #eaff05; border-bottom: 1px solid #1a000b; border-left: 1px solid #1a000b; border-radius: 60px; border-right: 1px solid #1a000b; border-top: 1px solid #1a000b; color: #1a000b; display: inline-block; font-size: 18px; padding: 10px 35px; text-align: center;">
                                      <span style="word-break: break-word; line-height: 36px;"><strong>Get Cinnamon covered</strong></span>
                                    </span>
                                    <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
                                  </a>
                                </div>
                              </td>
                            </tr>
                          </table>
                          <table class="divider_block block-4" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="pad" style="padding:5px 0;">
                                <div class="alignment" align="center">
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tr>
                                      <td class="divider_inner" style="font-size: 1px; line-height: 1px; border-top: 1px solid #1a000b;"><span>&#8202;</span></td>
                                    </tr>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="row row-4" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tbody>
              <tr>
                <td>
                  <table class="row-content stack" align="center" width="600" style="width:600px;margin:0 auto;">
                    <tbody>
                      <tr>
                        <td class="column column-1" width="100%">
                          <table class="paragraph_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td class="pad"><p style="margin:0;">Row 4 existing paragraph</p></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

describe('Pro-Level HTML Email Layout & Customization Engine', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('R1 & R4: sanitizes XSS payloads on import while preserving VML namespaces, MSO comments, and DOCTYPE', () => {
    const editor = ArchEmailEditor.create(container);
    const maliciousHtml = `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <script>window.__xssExecuted = true;</script>
  <meta http-equiv="refresh" content="0;url=javascript:alert(1)">
</head>
<body>
  <img src="https://example.com/cat.png" onerror="alert('xss')" onload="alert('xss')" />
  <a href="javascript:alert('xss')" onclick="steal()">Click</a>
</body>
</html>`;

    editor.importHTML(maliciousHtml);
    const out = editor.getHTML();

    expect((window as any).__xssExecuted).toBeUndefined();
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(out).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');

    editor.destroy();
  });

  it('R2: preserves Liquid / Handlebars loop tags inside tables without foster-parenting', () => {
    const editor = ArchEmailEditor.create(container);
    const liquidTableHtml = `<!DOCTYPE html>
<html>
<body>
  <table width="600" role="presentation">
    <tbody>
      {% for item in cart.items %}
      <tr>
        <td>{{ item.title }}</td>
        <td>{% if item.price > 10 && item.in_stock %}\${{ item.price }}{% endif %}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</body>
</html>`;

    editor.importHTML(liquidTableHtml);
    const out = editor.getHTML();

    // Verify {% for %} remained inside <tbody> and was not foster-parented above <table>
    const tbodyIdx = out.indexOf('<tbody');
    const forIdx = out.indexOf('{% for item in cart.items %}');
    const trIdx = out.indexOf('<tr');
    const endForIdx = out.indexOf('{% endfor %}');
    const closeTbodyIdx = out.indexOf('</tbody>');

    expect(tbodyIdx).toBeGreaterThan(-1);
    expect(forIdx).toBeGreaterThan(tbodyIdx);
    expect(trIdx).toBeGreaterThan(forIdx);
    expect(endForIdx).toBeGreaterThan(trIdx);
    expect(closeTbodyIdx).toBeGreaterThan(endForIdx);
    expect(out).toContain('item.price > 10 && item.in_stock');

    editor.destroy();
  });

  it('R13: edits compound button label, URL, and background color while keeping <span class="button"> and MSO <v:roundrect> intact', () => {
    const editor = ArchEmailEditor.create(container);
    editor.importHTML(PUMPKIN_EXCERPT);

    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // Click the compound button in row-2
    const btnSpan = ifrDoc.querySelector('.button_block .button') as HTMLElement;
    expect(btnSpan).toBeTruthy();
    btnSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labelInp = container.querySelector('#inp-btn-label') as HTMLInputElement;
    const urlInp = container.querySelector('#inp-btn-url') as HTMLInputElement;
    const bgInp = container.querySelector('#inp-btn-bg') as HTMLInputElement;

    expect(labelInp).toBeTruthy();
    expect(labelInp.value).toBe('Get Cinnamon covered');

    // Update label, URL, and background color
    labelInp.value = 'Fetch My Plan Now';
    labelInp.dispatchEvent(new Event('input'));

    urlInp.value = 'https://www.pumpkin.care/new-plan';
    urlInp.dispatchEvent(new Event('input'));

    bgInp.value = '#ff5500';
    bgInp.dispatchEvent(new Event('input'));

    const exported = editor.getHTML();

    // 1. Inner <span class="button"> and <strong> must STILL exist!
    expect(ifrDoc.querySelector('.button_block span.button strong')?.textContent).toBe('Fetch My Plan Now');
    expect(exported).toContain('class="button"');

    // 2. MSO <v:roundrect> comment must STILL exist and have updated href & fillcolor!
    expect(exported).toContain('v:roundrect');
    expect(exported).toContain('href="https://www.pumpkin.care/new-plan"');
    expect(exported).toContain('fillcolor="#ff5500"');

    editor.destroy();
  });

  it('R14, R15, R16: never marks linked images (<a><img/></a>) contenteditable, and resizes/aligns wrapper <div style="max-width"> in sync', () => {
    const editor = ArchEmailEditor.create(container);
    editor.importHTML(PUMPKIN_EXCERPT);

    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const logoImg = ifrDoc.querySelector('.image_block img') as HTMLImageElement;
    const logoLink = logoImg.closest('a') as HTMLAnchorElement;
    expect(logoImg).toBeTruthy();
    expect(logoLink).toBeTruthy();

    // R14: Linked image anchor must NEVER be contenteditable
    expect(logoLink.getAttribute('contenteditable')).toBeNull();
    expect(logoImg.getAttribute('contenteditable')).toBeNull();

    // Click image -> Inspector shows Image controls (NOT Button controls)
    logoImg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const widthInp = container.querySelector('#inp-img-width') as HTMLInputElement;
    const alignSel = container.querySelector('#inp-img-align') as HTMLSelectElement;
    expect(widthInp).toBeTruthy();
    expect(widthInp.value).toBe('180px');

    // R15: Resize image to 260px -> updates both img[width] and <div style="max-width">
    widthInp.value = '260px';
    widthInp.dispatchEvent(new Event('input'));

    const sizeWrapper = logoLink.parentElement as HTMLElement;
    expect(logoImg.getAttribute('width')).toBe('260');
    expect(sizeWrapper.style.maxWidth).toBe('260px');

    // R16: Change alignment to right -> updates div.alignment[align="right"]
    alignSel.value = 'right';
    alignSel.dispatchEvent(new Event('change'));
    const alignWrapper = logoImg.closest('.alignment') as HTMLElement;
    expect(alignWrapper.getAttribute('align')).toBe('right');

    editor.destroy();
  });

  it('R17 & R18: does not mark table dividers contenteditable and uses single-host contenteditable on rich paragraphs', () => {
    const editor = ArchEmailEditor.create(container);
    editor.importHTML(PUMPKIN_EXCERPT);

    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // R18: Divider cell and its inner span must not be contenteditable
    const dividerCell = ifrDoc.querySelector('td.divider_inner') as HTMLElement;
    expect(dividerCell.getAttribute('contenteditable')).toBeNull();
    expect(dividerCell.querySelector('span')?.getAttribute('contenteditable')).toBeNull();

    // R17: Paragraph with <em> has contenteditable on <p>, NOT nested on <em>
    const para = ifrDoc.querySelector('.row-2 .paragraph_block p') as HTMLElement;
    const em = para.querySelector('em') as HTMLElement;
    expect(para.getAttribute('contenteditable')).toBe('true');
    expect(em.getAttribute('contenteditable')).toBeNull();

    editor.destroy();
  });

  it('R20: moves blocks up/down within a column and migrates scoped @media rules when moving across rows', () => {
    const editor = ArchEmailEditor.create(container);
    editor.importHTML(PUMPKIN_EXCERPT);

    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const col = ifrDoc.querySelector('.row-2 .column-1') as HTMLElement;
    const imgBlock = col.querySelector('table.image_block') as HTMLElement;
    const paraBlock = col.querySelector('table.paragraph_block') as HTMLElement;

    // Select paragraph block (2nd block in row-2 col-1) and move it UP above image_block
    const paraP = paraBlock.querySelector('p') as HTMLElement;
    paraP.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    editor.moveSelectedElement('up');
    expect(col.children[0]).toBe(paraBlock);
    expect(col.children[1]).toBe(imgBlock);

    // Move it back DOWN -> restores original order
    editor.moveSelectedElement('down');
    expect(col.children[0]).toBe(imgBlock);
    expect(col.children[1]).toBe(paraBlock);

    // Now move paraBlock across rows from .row-2 into .row-4
    const row4Block = ifrDoc.querySelector('.row-4 table.paragraph_block') as HTMLElement;
    const moved = moveUnitToTarget(paraBlock, row4Block, 'after');
    expect(moved).toBe(true);

    const exported = editor.getHTML();
    // Verify paraBlock was given a unique class and its 32px mobile font-size rule was migrated!
    expect(exported).toContain('arch-migrated-media-styles');
    expect(exported).toContain('font-size: 32px !important');

    editor.destroy();
  });

  it('R21: swaps multi-column cells around intervening gutter cells (<td width="20">) without collapsing spacing', () => {
    const editor = ArchEmailEditor.create(container);
    const gutterTableHtml = `<!DOCTYPE html>
<html>
<body>
  <table width="600" role="presentation">
    <tr>
      <td class="col-left" width="290"><h2>Left Column</h2></td>
      <td width="20" style="font-size:1px;line-height:1px;">&nbsp;</td>
      <td class="col-right" width="290"><h2>Right Column</h2></td>
    </tr>
  </table>
</body>
</html>`;

    editor.importHTML(gutterTableHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const leftHeading = ifrDoc.querySelector('.col-left h2') as HTMLElement;
    leftHeading.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Climb to parent Column (<td class="col-left">) and move it right ('down')
    editor.selectParentUnit();
    editor.moveSelectedElement('down');

    const tr = ifrDoc.querySelector('tr')!;
    const cells = Array.from(tr.children) as HTMLElement[];

    // Order must now be: [col-right, 20px gutter, col-left]!
    expect(cells[0].classList.contains('col-right')).toBe(true);
    expect(cells[1].getAttribute('width')).toBe('20');
    expect(cells[2].classList.contains('col-left')).toBe(true);

    editor.destroy();
  });

  it('supports div-only / modern layouts, MSO ghost-table envelopes, and Undo/Redo', () => {
    const editor = ArchEmailEditor.create(container);
    const divLayoutHtml = `<!DOCTYPE html>
<html>
<body>
  <div class="email-wrapper" style="max-width:600px;margin:0 auto;">
    <div class="card-a"><p>First Card</p></div>
    <!--[if mso]><table width="600"><tr><td><![endif]-->
    <div class="card-b"><p>Second Card with MSO Envelope</p></div>
    <!--[if mso]></td></tr></table><![endif]-->
  </div>
</body>
</html>`;

    editor.importHTML(divLayoutHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // Click Second Card and move it UP above First Card
    const secondP = ifrDoc.querySelector('.card-b p') as HTMLElement;
    secondP.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.moveSelectedElement('up');

    const movedHtml = editor.getHTML();
    // Verify Second Card and its MSO opener comment both precede First Card
    expect(movedHtml.indexOf('<!--[if mso]><table width="600">')).toBeLessThan(movedHtml.indexOf('card-b'));
    expect(movedHtml.indexOf('card-b')).toBeLessThan(movedHtml.indexOf('card-a'));

    // Undo restores First Card before Second Card
    editor.undo();
    const undoneHtml = editor.getHTML();
    expect(undoneHtml.indexOf('card-a')).toBeLessThan(undoneHtml.indexOf('card-b'));

    // Redo re-applies the move
    editor.redo();
    expect(editor.getHTML().indexOf('card-b')).toBeLessThan(editor.getHTML().indexOf('card-a'));

    editor.destroy();
  });

  it('supports drag & move on imported Taskrabbit-style templates (rebinds events after importHTML, escalates single-block columns/rows, skips .desktop_hide duplicates, and strips draggable on export)', () => {
    const editor = ArchEmailEditor.create(container);
    const taskrabbitExcerpt = `<!DOCTYPE html>
<html>
<head>
  <style>
    .desktop_hide, .desktop_hide table { display: none; max-height: 0; overflow: hidden; }
  </style>
</head>
<body>
  <table class="nl-container" width="100%" role="presentation">
    <tbody>
      <tr>
        <td>
          <table class="row row-1" width="100%" role="presentation">
            <tbody><tr><td>
              <table class="row-content" width="600" role="presentation">
                <tbody><tr>
                  <td class="column column-1" width="100%">
                    <table class="image_block block-1" width="100%" role="presentation">
                      <tr><td class="pad"><img src="https://example.com/logo.png" width="150"></td></tr>
                    </table>
                  </td>
                </tr></tbody>
              </table>
            </td></tr></tbody>
          </table>

          <table class="row row-2" width="100%" role="presentation">
            <tbody><tr><td>
              <table class="row-content" width="600" role="presentation">
                <tbody><tr>
                  <td class="column column-1" width="100%">
                    <table class="heading_block block-1" width="100%" role="presentation">
                      <tr><td class="pad"><h1>Unsubscribe Header</h1></td></tr>
                    </table>
                  </td>
                </tr></tbody>
              </table>
            </td></tr></tbody>
          </table>

          <table class="row row-4" width="100%" role="presentation">
            <tbody><tr><td>
              <table class="row-content" width="600" role="presentation">
                <tbody><tr>
                  <td class="column column-1" width="50%">
                    <table class="image_block block-1" width="100%" role="presentation">
                      <tr><td class="pad"><img class="col1-img" src="https://example.com/phone.png" width="200"></td></tr>
                    </table>
                  </td>
                  <td class="column column-2" width="50%">
                    <table class="heading_block block-1" width="100%" role="presentation">
                      <tr><td class="pad"><h2 class="col2-h2">Right Column Heading</h2></td></tr>
                    </table>
                  </td>
                </tr></tbody>
              </table>
            </td></tr></tbody>
          </table>

          <table class="row row-11" width="100%" role="presentation">
            <tbody><tr><td>
              <table class="row-content" width="600" role="presentation">
                <tbody><tr>
                  <td class="column column-1" width="100%">
                    <div class="border">
                      <table class="heading_block block-1 mobile_hide" width="100%" role="presentation">
                        <tr><td class="pad"><h1 class="vis-first">Desktop Heading</h1></td></tr>
                      </table>
                      <table class="heading_block block-2 desktop_hide" style="display:none;" width="100%" role="presentation">
                        <tr><td class="pad"><h1>Hidden Mobile Duplicate</h1></td></tr>
                      </table>
                      <table class="heading_block block-3" width="100%" role="presentation">
                        <tr><td class="pad"><h1 class="vis-second">Subheading Paragraph</h1></td></tr>
                      </table>
                    </div>
                  </td>
                </tr></tbody>
              </table>
            </td></tr></tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

    // Importing AFTER initial creation must re-bind all iframe listeners even after ifrDoc.open()
    editor.importHTML(taskrabbitExcerpt);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // 1. Clicking single-block row-2 heading and moving UP escalates to row-2 and swaps it above row-1
    const row2H1 = ifrDoc.querySelector('.row-2 h1') as HTMLElement;
    row2H1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.moveSelectedElement('up');

    const rowsAfterRowSwap = Array.from(ifrDoc.querySelectorAll('table.row'));
    expect(rowsAfterRowSwap[0].classList.contains('row-2')).toBe(true);
    expect(rowsAfterRowSwap[1].classList.contains('row-1')).toBe(true);

    // 2. Clicking single-block column-1 in row-4 and moving DOWN/RIGHT escalates to column-1 and swaps with column-2
    const col1Img = ifrDoc.querySelector('.row-4 .col1-img') as HTMLElement;
    col1Img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.moveSelectedElement('down');

    const row4Cols = Array.from(ifrDoc.querySelectorAll('.row-4 td.column'));
    expect(row4Cols[0].classList.contains('column-2')).toBe(true);
    expect(row4Cols[1].classList.contains('column-1')).toBe(true);

    // 3. Clicking block-1 in row-11 and moving DOWN moves BOTH block-1 (.mobile_hide) AND its paired twin block-2 (.desktop_hide) after block-3!
    const visFirst = ifrDoc.querySelector('.row-11 .vis-first') as HTMLElement;
    visFirst.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.moveSelectedElement('down');

    const row11Blocks = Array.from(ifrDoc.querySelectorAll('.row-11 .border > table'));
    expect(row11Blocks[0].classList.contains('block-3')).toBe(true);
    expect(row11Blocks[1].classList.contains('block-1')).toBe(true);
    expect(row11Blocks[2].classList.contains('block-2')).toBe(true);

    // 4. Dropping a block onto <div class="border"> or <td class="column"> places it INSIDE <div class="border"> (Auto-Layout Slot)
    const row2Block = ifrDoc.querySelector('.row-2 table.heading_block') as HTMLElement;
    const row11Border = ifrDoc.querySelector('.row-11 .border') as HTMLElement;
    const movedIntoSlot = moveUnitToTarget(row2Block, row11Border, 'after');
    expect(movedIntoSlot).toBe(true);
    expect(row11Border.contains(row2Block)).toBe(true);

    // 5. Figma Layers Tree in left sidebar lists all Rows, Columns, and Blocks and syncs selection on click
    const layerRows = container.querySelectorAll('.arch-layer-row');
    expect(layerRows.length).toBeGreaterThan(3);
    (layerRows[0] as HTMLElement).click();
    expect(ifrDoc.querySelector('.arch-selected-element')).toBeTruthy();

    // 6. Exported HTML must not leak draggable="true"
    const exported = editor.getHTML();
    expect(exported).not.toContain('draggable=');

    editor.destroy();
  });

  it('preserves card cap borders (border-top / border-bottom) when reordering slice rows and adapts text contrast across dark/light sections', () => {
    const editor = ArchEmailEditor.create(container);
    const cardSlicesHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="nl-container" width="100%" role="presentation">
    <tbody><tr><td>
      <table class="row row-2" width="100%" role="presentation">
        <tbody><tr><td>
          <table class="row-content" style="background-color:#0d4635;border-top:1px solid #0d4635;border-left:1px solid #0d4635;border-right:1px solid #0d4635;">
            <tbody><tr><td class="column column-1">
              <table class="heading_block block-1"><tr><td><h1 class="hero-h1" style="color:#ffffff;">White Text on Dark Green</h1></td></tr></table>
            </td></tr></tbody>
          </table>
        </td></tr></tbody>
      </table>
      <table class="row row-3" width="100%" role="presentation">
        <tbody><tr><td>
          <table class="row-content" style="background-color:#ffffff;border-bottom:1px solid #0d4635;border-left:1px solid #0d4635;border-right:1px solid #0d4635;">
            <tbody><tr><td class="column column-1">
              <table class="paragraph_block block-1"><tr><td><p class="light-p" style="color:#0d4635;">Body copy on white card</p></td></tr></table>
            </td></tr></tbody>
          </table>
        </td></tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(cardSlicesHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    // 1. Move row-3 UP above row-2 -> border-top stays on the top row (row-3) and border-bottom stays on the bottom row (row-2)!
    const row3 = ifrDoc.querySelector('table.row-3') as HTMLElement;
    const row2 = ifrDoc.querySelector('table.row-2') as HTMLElement;
    editor.selectParentUnit();
    moveUnitToTarget(row3, row2, 'before');

    const orderedRows = Array.from(ifrDoc.querySelectorAll('table.row'));
    expect(orderedRows[0]).toBe(row3);
    expect(orderedRows[1]).toBe(row2);

    const topContent = orderedRows[0].querySelector('table.row-content') as HTMLElement;
    const bottomContent = orderedRows[1].querySelector('table.row-content') as HTMLElement;
    expect(topContent.style.borderTop).toContain('1px solid');
    expect(topContent.style.borderBottom).toBe('');
    expect(bottomContent.style.borderBottom).toContain('1px solid');
    expect(bottomContent.style.borderTop).toBe('');

    // 2. Move the white heading block from dark-green row-2 into white-background row-3 -> text color adapts to dark so it stays visible!
    const heroBlock = ifrDoc.querySelector('.row-2 table.heading_block') as HTMLElement;
    const lightBlock = ifrDoc.querySelector('.row-3 table.paragraph_block') as HTMLElement;
    moveUnitToTarget(heroBlock, lightBlock, 'before');

    const heroH1 = heroBlock.querySelector('.hero-h1') as HTMLElement;
    expect(heroH1.style.color).not.toBe('#ffffff');
    expect(heroH1.style.color).not.toBe('rgb(255, 255, 255)');

    editor.destroy();
  });

  it('supports Figma Top-Down Container Drill-Down (Row -> Column -> Block -> Inline Text Edit), Horizontal Column Frame Drag-Swap, and Direct Button Text Selection', () => {
    const editor = ArchEmailEditor.create(container);
    const figmaFrameHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="nl-container" width="100%" role="presentation">
    <tbody><tr><td>
      <table class="row row-5" width="100%" role="presentation">
        <tbody><tr><td>
          <table class="row-content" width="600" role="presentation">
            <tbody><tr class="reverse">
              <td class="column column-1 first" width="50%">
                <div class="border" style="padding:20px 0 20px 35px;">
                  <table class="heading_block block-1" width="100%" role="presentation">
                    <tr><td class="pad"><h1>Furniture Assembly</h1></td></tr>
                  </table>
                  <table class="button_block block-2" width="100%" role="presentation">
                    <tr><td class="pad">
                      <div class="alignment" align="left">
                        <a href="https://example.com/book" class="button" style="background-color:#0d4635;color:#ffffff;display:inline-block;">
                          <span style="padding-left:20px;padding-right:20px;"><span class="btn-label">Book Assembly Now</span></span>
                        </a>
                      </div>
                    </td></tr>
                  </table>
                </div>
              </td>
              <td class="column column-2 last" width="50%">
                <div class="border" style="padding:0;">
                  <table class="image_block block-1" width="100%" role="presentation">
                    <tr><td class="pad"><img class="col2-img" src="https://example.com/chair.png" width="250"></td></tr>
                  </table>
                </div>
              </td>
            </tr></tbody>
          </table>
        </td></tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(figmaFrameHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const row5 = ifrDoc.querySelector('table.row-5') as HTMLElement;
    const col1 = ifrDoc.querySelector('td.column-1') as HTMLElement;
    const col2 = ifrDoc.querySelector('td.column-2') as HTMLElement;
    const btnBlock = ifrDoc.querySelector('table.button_block') as HTMLElement;
    const btnAnchor = ifrDoc.querySelector('a.button') as HTMLElement;
    const btnLabel = ifrDoc.querySelector('.btn-label') as HTMLElement;

    // Button anchor must have draggable="false" so native browser link drag never blocks text selection
    expect(btnAnchor.getAttribute('draggable')).toBe('false');

    // LEVEL 1: First single click (detail: 1) inside the button selects the outermost Top Container (Row Frame: row-5)
    btnLabel.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(row5);

    // LEVEL 2: First double-click drills down from Row Frame -> Column Frame (col-1)
    btnLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1);

    // Clicking inside sibling column (col-2) while at Column depth switches directly to sibling Column Frame (col-2)!
    const col2Img = ifrDoc.querySelector('.col2-img') as HTMLElement;
    col2Img.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col2);

    // Switch back to col-1 at Column depth
    btnLabel.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1);

    // HORIZONTAL COLUMN FRAME SWAP: Dragging/moving col-1 onto col-2 (even with 'before' on adjacent sibling) swaps the two columns
    const swapped = moveUnitToTarget(col1, col2, 'before');
    expect(swapped).toBe(true);
    const colsAfterSwap = Array.from(ifrDoc.querySelectorAll('.row-5 td.column'));
    expect(colsAfterSwap[0]).toBe(col2);
    expect(colsAfterSwap[1]).toBe(col1);

    // Positional classes (.first / .last) and asymmetric .border horizontal padding are mirrored cleanly
    expect(col2.classList.contains('first')).toBe(true);
    expect(col1.classList.contains('last')).toBe(true);
    const col1Border = col1.querySelector('.border') as HTMLElement;
    expect(col1Border.style.paddingLeft).toBe('0px');
    expect(col1Border.style.paddingRight).toBe('35px');

    // Dragging the sole image block inside col-2 onto a block inside col-1 ALSO swaps the two Column Frames instead of emptying col-2
    const col2ImageBlock = col2.querySelector('table.image_block') as HTMLElement;
    const swappedBack = moveUnitToTarget(col2ImageBlock, btnBlock, 'after');
    expect(swappedBack).toBe(true);
    const colsAfterSwapBack = Array.from(ifrDoc.querySelectorAll('.row-5 td.column'));
    expect(colsAfterSwapBack[0]).toBe(col1);
    expect(colsAfterSwapBack[1]).toBe(col2);

    // LEVEL 3: Second double-click on the button drills down from Column Frame (col-1) -> Block Frame (button_block)
    btnLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(btnBlock);

    // LEVEL 4: Third double-click drills down inside Block/td to select the `<a class="button">` tag itself!
    btnLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(btnAnchor);

    // LEVEL 5: Fourth double-click (or clicking inside the already-selected `<a>` tag) enters Inline Text Edit Mode on the button text!
    btnLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    const editingEl = ifrDoc.querySelector('.arch-editing-text') as HTMLElement;
    expect(editingEl).toBeTruthy();
    expect(editingEl.getAttribute('contenteditable')).toBe('true');
    expect(editingEl.textContent).toContain('Book Assembly Now');

    // Pressing Escape once exits Inline Text Edit Mode while keeping the `<a>` tag selected
    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(btnAnchor);

    // Pressing Escape climbs up step-by-step: Link (`<a>`) -> Block Frame -> Column Frame -> Row Frame
    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(btnBlock);
    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1);
    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(row5);

    editor.destroy();
  });

  it('drills down past <td> into inner <a> tags and smoothly reorders 3-column rows horizontally while preserving divider borders', () => {
    const editor = ArchEmailEditor.create(container);
    const threeColHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="nl-container" width="100%" role="presentation">
    <tbody><tr><td>
      <table class="row row-13" width="100%" role="presentation">
        <tbody><tr><td>
          <table class="row-content" width="600" style="background-color:#65ccb2;" role="presentation">
            <tbody><tr>
              <td class="column column-1" width="33.33%" style="border-right:1px solid #0a2b14;">
                <table class="heading_block block-1" width="100%" role="presentation">
                  <tr><td class="pad td-col-1">
                    <h1><a class="link-1" href="https://example.com/mounting"><span>Mounting ❯</span></a></h1>
                  </td></tr>
                </table>
              </td>
              <td class="column column-2" width="33.33%" style="border-right:1px solid #0a2b14;">
                <table class="heading_block block-1" width="100%" role="presentation">
                  <tr><td class="pad td-col-2">
                    <h1><span><a class="link-2" href="https://example.com/assembly"><span><span>Furniture Assembly ❯</span></span></a></span></h1>
                  </td></tr>
                </table>
              </td>
              <td class="column column-3" width="33.33%">
                <table class="heading_block block-1" width="100%" role="presentation">
                  <tr><td class="pad td-col-3">
                    <h1><a class="link-3" href="https://example.com/cleaning"><span>Cleaning ❯</span></a></h1>
                  </td></tr>
                </table>
              </td>
            </tr></tbody>
          </table>
        </td></tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(threeColHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;

    const row13 = ifrDoc.querySelector('table.row-13') as HTMLElement;
    const col1 = ifrDoc.querySelector('td.column-1') as HTMLElement;
    const col2 = ifrDoc.querySelector('td.column-2') as HTMLElement;
    const col3 = ifrDoc.querySelector('td.column-3') as HTMLElement;
    const tdCol1 = ifrDoc.querySelector('.td-col-1') as HTMLElement;
    const link1 = ifrDoc.querySelector('a.link-1') as HTMLElement;

    // 1. Double-clicking on the empty left/right padding space of `<td class="pad">` (`tdCol1`)
    //    drills down: Row 13 -> Column 1 -> Heading Block (`td`) and STOPS at the parent (never selects child `link1`)!
    tdCol1.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(row13);

    tdCol1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1);

    tdCol1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1.querySelector('table.heading_block'));

    // Double-clicking AGAIN on the parent's empty space (`tdCol1`) keeps the parent selected and does NOT select `link1`
    tdCol1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(col1.querySelector('table.heading_block'));

    // Only when actually double-clicking ON the child `link1` (`<a class="link-1">`) does `link1` get selected!
    link1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(link1);

    // 2. When `<a class="link-1">` is selected, the Inspector displays Link/Button (`<a>`) controls
    const labelInput = container.querySelector('#inp-btn-label') as HTMLInputElement;
    const urlInput = container.querySelector('#inp-btn-url') as HTMLInputElement;
    expect(labelInput).toBeTruthy();
    expect(labelInput.value).toBe('Mounting ❯');
    expect(urlInput.value).toBe('https://example.com/mounting');

    labelInput.value = 'TV Mounting ❯';
    labelInput.dispatchEvent(new Event('input'));
    expect(link1.textContent).toBe('TV Mounting ❯');

    // 3. Moving horizontally in a 3-column row:
    //    a) Moving `link1` (or `col1`) onto `col3` (even with `'before'`) places `col1` at the end (`[col2, col3, col1]`)
    //       and updates `border-right` dividers so `col2` and `col3` have `border-right` and `col1` (now rightmost) has none!
    moveUnitToTarget(link1, col3, 'before');
    let cols = Array.from(ifrDoc.querySelectorAll('.row-13 td.column')) as HTMLElement[];
    expect(cols).toEqual([col2, col3, col1]);
    expect(cols[0].style.borderRight).toContain('1px solid');
    expect(cols[1].style.borderRight).toContain('1px solid');
    expect(cols[2].style.borderRight).toBe('');

    //    b) Moving `col1` (now at index 2) leftward onto `col2` (at index 0, even with `'after'`) places `col1` back at index 0!
    moveUnitToTarget(col1, col2, 'after');
    cols = Array.from(ifrDoc.querySelectorAll('.row-13 td.column')) as HTMLElement[];
    expect(cols).toEqual([col1, col2, col3]);
    expect(cols[0].style.borderRight).toContain('1px solid');
    expect(cols[1].style.borderRight).toContain('1px solid');
    expect(cols[2].style.borderRight).toBe('');

    editor.destroy();
  });

  it('prevents link navigation on click/drag-release and supports live image resize via corner handles and inspector', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new ArchEmailEditor(container);

    const linkedImgHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="row row-1" width="100%">
    <tbody><tr><td>
      <table class="row-content stack" width="600">
        <tbody><tr>
          <td class="column column-1" width="100%">
            <table class="image_block block-1" width="100%">
              <tbody><tr><td class="pad">
                <div class="alignment" align="center">
                  <div class="fullWidth" style="max-width: 300px;">
                    <a href="https://example.com/promo" target="_blank" class="promo-link">
                      <img src="https://example.com/banner.png" style="display: block; height: auto; border: 0; width: 100%;" width="300" alt="Promo" />
                    </a>
                  </div>
                </div>
              </td></tr></tbody>
            </table>
          </td>
        </tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(linkedImgHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;
    const img = ifrDoc.querySelector('img') as HTMLImageElement;
    const sizeWrapper = ifrDoc.querySelector('.fullWidth') as HTMLElement;

    // 1. Clicking on an image inside `<a href="...">` MUST prevent browser link navigation (`defaultPrevented === true`)
    //    and select ONLY the outer Row Frame (NOT `td` and `img` together!)
    const clickEv = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    img.dispatchEvent(clickEv);
    expect(clickEv.defaultPrevented).toBe(true);
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('table.row-1'));
    expect(container.querySelector('.arch-resize-handle--se')).toBeNull();

    // 2. Even after a drag/mouseup that sets `suppressNextClick`, the subsequent click MUST still prevent link navigation!
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    img.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 120 }));
    img.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const postDragClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    img.dispatchEvent(postDragClick);
    expect(postDragClick.defaultPrevented).toBe(true);

    // 3. Double-clicking drills down one by one: Row -> Image Block (td) -> Link (<a>) -> Image (<img>)!
    //    While on Image Block (td) or Link (<a>), `img` resize handles are NOT shown (never selects td and img together)
    img.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('table.image_block'));
    expect(container.querySelector('.arch-resize-handle--se')).toBeNull();

    img.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('a.promo-link'));
    expect(container.querySelector('.arch-resize-handle--se')).toBeNull();

    // Next double-click selects ONLY `<img>` and renders the 4 corner `.arch-resize-handle` handles on `<img>`
    img.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(img);
    const seHandle = container.querySelector('.arch-resize-handle--se') as HTMLElement;
    expect(seHandle).toBeTruthy();

    // Dragging the SE corner handle right by +80px resizes the image and its `.alignment > div` wrapper from 300px to 380px
    seHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 280, clientY: 200 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(img.getAttribute('width')).toBe('380');
    expect(img.style.maxWidth).toBe('380px');
    expect(sizeWrapper.style.maxWidth).toBe('380px');

    // 4. Using the Inspector range slider or preset buttons also resizes the image cleanly
    const preset50 = container.querySelector('[data-width-preset="50%"]') as HTMLButtonElement;
    expect(preset50).toBeTruthy();
    preset50.click();
    expect(sizeWrapper.style.maxWidth).toBe('50%');
    expect(img.style.width).toBe('50%');

    editor.destroy();
  });

  it('selects text parent to child (Row -> td/Block -> p) and enters text edit mode only on double-clicking selected p', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new ArchEmailEditor(container);

    const sampleHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="row row-1" width="100%">
    <tbody><tr><td>
      <table class="text_block" width="100%">
        <tbody><tr><td class="pad">
          <p class="para-text">Click to select, double click to edit me!</p>
        </td></tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(sampleHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;
    const p = ifrDoc.querySelector('.para-text') as HTMLElement;
    expect(p).toBeTruthy();

    // 1. Single click on text selects the outer Row frame, does NOT enter edit mode
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('table.row-1'));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();

    // 2. Clicking again while selected keeps it selected, still does NOT enter edit mode
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('table.row-1'));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();

    // 3. 1st Double-click drills down to the parent `td`/Block (`table.text_block`), NOT edit mode
    p.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('.text_block'));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();

    // Double-clicking in the empty left/right space of parent `td.pad` keeps the parent selected (does NOT select `<p>`)
    const tdPad = ifrDoc.querySelector('td.pad') as HTMLElement;
    tdPad.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('.text_block'));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();

    // 4. Actually double-clicking ON `<p>` drills down from `td`/Block to select `<p>` itself (still NOT edit mode!)
    p.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(p);
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();

    // 5. 3rd Double-click (while `<p>` is selected) makes `<p>` editable (`.arch-editing-text` is active)
    p.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBe(p);

    // 6. Pressing Escape exits text edit mode while keeping `<p>` selected, then climbs up `p -> td/Block -> Row`
    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-editing-text')).toBeNull();
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(p);

    ifrDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ifrDoc.querySelector('.arch-selected-element')).toBe(ifrDoc.querySelector('.text_block'));

    editor.destroy();
  });

  it('animates 3-column displacement transitions live during left/right drag and cleans up on drop & export', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new ArchEmailEditor(container);

    const threeColHtml = `<!DOCTYPE html>
<html>
<body>
  <table class="row row-1" width="100%">
    <tbody><tr><td>
      <table class="row-content" width="600">
        <tbody><tr>
          <td class="column column-1" width="33.33%"><p class="p1">Col 1</p></td>
          <td class="column column-2" width="33.33%"><p class="p2">Col 2</p></td>
          <td class="column column-3" width="33.33%"><p class="p3">Col 3</p></td>
        </tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`;

    editor.importHTML(threeColHtml);
    const iframe = container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement;
    const ifrDoc = iframe.contentDocument!;
    const col1 = ifrDoc.querySelector('td.column-1') as HTMLElement;
    const col2 = ifrDoc.querySelector('td.column-2') as HTMLElement;
    const col3 = ifrDoc.querySelector('td.column-3') as HTMLElement;
    const canvas = (editor as any).canvas;

    // 1. Start dragging `col2` and hover over `col1` (moving LEFT):
    //    `col1` smoothly slides to the RIGHT (`+200px`), while `col2` slides to the LEFT (`-200px`)!
    canvas.draggedUnit = col2;
    canvas.updateDropTargetForElement(col1, 40, 20);

    expect(col1.classList.contains('arch-col-displace-ready')).toBe(true);
    expect(col1.dataset.archDisplaced).toBe('right');
    expect(col1.style.transform).toBe('translate3d(200px, 0, 0)');
    expect(col2.dataset.archDisplaced).toBe('left');
    expect(col2.style.transform).toBe('translate3d(-200px, 0, 0)');
    expect(col3.dataset.archDisplaced).toBeUndefined();

    // 2. Dragging `col3` all the way LEFT onto `col1`:
    //    Both `col1` and `col2` slide to the RIGHT (`+200px`), while `col3` slides LEFT (`-400px`)!
    canvas.draggedUnit = col3;
    canvas.updateDropTargetForElement(col1, 40, 20);

    expect(col1.dataset.archDisplaced).toBe('right');
    expect(col1.style.transform).toBe('translate3d(200px, 0, 0)');
    expect(col2.dataset.archDisplaced).toBe('right');
    expect(col2.style.transform).toBe('translate3d(200px, 0, 0)');
    expect(col3.dataset.archDisplaced).toBe('left');
    expect(col3.style.transform).toBe('translate3d(-400px, 0, 0)');

    // 3. Exported HTML while mid-drag or after drop strips all temporary transition classes and transforms
    const exportedMidDrag = editor.getHTML();
    expect(exportedMidDrag).not.toContain('arch-col-displace-ready');
    expect(exportedMidDrag).not.toContain('data-arch-displaced');
    expect(exportedMidDrag).not.toContain('translate3d');

    // 4. Executing drop commits the reorder (`[col3, col1, col2]`) and removes all inline transforms
    canvas.executeDrop('arch-move-unit');
    const colsAfterDrop = Array.from(ifrDoc.querySelectorAll('td.column'));
    expect(colsAfterDrop).toEqual([col3, col1, col2]);
    expect(col1.style.transform).toBe('');
    expect(col2.style.transform).toBe('');
    expect(col3.style.transform).toBe('');

    editor.destroy();
  });
});

describe('Figma vertical displacement', () => {
  it('slides sibling rows/blocks vertically during up/down drag, ignores displaced geometry when hit-testing, and cleans up on drop & export', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new ArchEmailEditor(container);

    editor.importHTML(`<!DOCTYPE html>
<html><body>
  <table class="nl-container" width="100%"><tbody><tr><td>
    <table class="row row-1" width="100%"><tbody><tr><td><p>One</p></td></tr></tbody></table>
    <table class="row row-2" width="100%"><tbody><tr><td><p>Two</p></td></tr></tbody></table>
    <table class="row row-3" width="100%"><tbody><tr><td><p>Three</p></td></tr></tbody></table>
  </td></tr></tbody></table>
</body></html>`);

    const ifrDoc = (container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement).contentDocument!;
    const [r1, r2, r3] = ['row-1', 'row-2', 'row-3'].map((c) => ifrDoc.querySelector(`.${c}`) as HTMLElement);
    const canvas = (editor as any).canvas;

    // jsdom has no layout: three 100px-tall rows stacked at 0/100/200, rects follow the live displacement
    [r1, r2, r3].forEach((el, i) => {
      el.getBoundingClientRect = () => {
        const dy = parseFloat(el.dataset.archDisplaceY || '0') || 0;
        return { left: 0, right: 600, width: 600, height: 100, top: i * 100 + dy, bottom: i * 100 + 100 + dy } as DOMRect;
      };
    });
    r1.parentElement!.getBoundingClientRect = () =>
      ({ left: 0, right: 600, width: 600, height: 300, top: 0, bottom: 300 }) as DOMRect;

    // Drag row-3 up onto row-1: rows 1 & 2 slide DOWN 100px, row-3 slides UP 200px
    canvas.draggedUnit = r3;
    canvas.updateDropTargetForElement(r1, 40, 20);
    expect(r1.dataset.archDisplaced).toBe('down');
    expect(r1.style.transform).toBe('translate3d(0, 100px, 0)');
    expect(r2.style.transform).toBe('translate3d(0, 100px, 0)');
    expect(r3.dataset.archDisplaced).toBe('up');
    expect(r3.style.transform).toBe('translate3d(0, -200px, 0)');

    // Pointer now sits over displaced row-2 geometry (y=150 is row-2's untransformed slot) -> hit-test uses slots, no oscillation
    canvas.updateDropTargetForElement(r1, 40, 150);
    expect(canvas.hoveredDropTarget).toBe(r2);

    // Back over its own home slot: everything glides home
    canvas.updateDropTargetForElement(r3, 40, 250);
    expect(r1.style.transform).toBe('');
    expect(r3.style.transform).toBe('');

    canvas.updateDropTargetForElement(r1, 40, 20);
    const exported = editor.getHTML();
    expect(exported).not.toContain('translate3d');
    expect(exported).not.toContain('data-arch-displace');

    canvas.executeDrop('arch-move-unit');
    expect(Array.from(ifrDoc.querySelectorAll('table.row'))).toEqual([r3, r1, r2]);
    expect(r1.style.transform).toBe('');
    editor.destroy();
  });
});

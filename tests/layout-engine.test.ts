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

    // 3. Clicking block-1 in row-11 and moving DOWN skips the hidden .desktop_hide block-2 and moves after block-3
    const visFirst = ifrDoc.querySelector('.row-11 .vis-first') as HTMLElement;
    visFirst.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.moveSelectedElement('down');

    const row11Blocks = Array.from(ifrDoc.querySelectorAll('.row-11 .border > table'));
    expect(row11Blocks[row11Blocks.length - 1].classList.contains('block-1')).toBe(true);

    // 4. Exported HTML must not leak draggable="true"
    const exported = editor.getHTML();
    expect(exported).not.toContain('draggable=');

    editor.destroy();
  });
});

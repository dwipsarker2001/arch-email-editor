/**
 * Arch Email Editor - Universal Layout-Agnostic Structural Taxonomy & Unit Resolution
 *
 * Works across all HTML email layout paradigms without relying solely on vendor classes:
 * 1. Nested ESP tables (BeeFree, Stripo, Iterable, Pumpkin: table.row > table.row-content > td.column > table.*_block)
 * 2. Classic 600px table rows (tbody > tr > td > h1/p/table)
 * 3. Multi-column tables with or without gutter spacer cells (<td width="20">)
 * 4. Hybrid / MJML / Cerberus fluid divs with MSO ghost-table comments
 * 5. Modern div-only, Flexbox, CSS Grid, and plain-body emails
 *
 * Solves R13, R14, R17, R18, R19, R21.
 */

import { BreadcrumbItem, LayerNode, SelectedElementInfo, UnitRole } from '../types';

const HAIR_AND_NBSP_REGEX = /[\s\u00A0\u2000-\u200D\uFEFF]+/g;

/**
 * Strips whitespace, non-breaking spaces, and zero-width / hair spaces (`&#8202;`).
 */
export function getVisibleText(el: Node | null): string {
  if (!el) return '';
  return (el.textContent || '').replace(HAIR_AND_NBSP_REGEX, '').trim();
}

/**
 * Checks if an element is an internal editor helper node.
 */
export function isEditorHelperNode(el: Element): boolean {
  return (
    el.id === 'arch-canvas-editor-style' ||
    el.classList.contains('arch-floating-toolbar')
  );
}

/**
 * Returns meaningful element children of `parent`, ignoring `<br>`, `<style>`, `<script>`,
 * and internal editor nodes.
 */
export function getMeaningfulChildren(parent: Element): HTMLElement[] {
  const result: HTMLElement[] = [];
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement;
    const tag = child.tagName.toLowerCase();
    if (tag === 'br' || tag === 'style' || tag === 'script' || tag === 'meta' || tag === 'link') {
      continue;
    }
    if (isEditorHelperNode(child)) continue;
    result.push(child);
  }
  return result;
}

/**
 * Detects whether a `<td>`, `<th>`, or `<div>` is an empty inter-column gutter / spacer cell (Fixes R21).
 */
export function isGutterCell(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'td' && tag !== 'th' && tag !== 'div') return false;

  // Must have no visible text and no media/interactive children
  if (getVisibleText(el).length > 0) return false;
  if (el.querySelector('img, a, button, hr, input, iframe')) return false;

  // Check explicit width attribute or inline style width
  const widthAttr = (el.getAttribute('width') || '').trim();
  const styleWidth = (el.style?.width || '').trim();
  const rawWidth = styleWidth || widthAttr;

  if (!rawWidth) {
    // Also check if class is explicitly a spacer/gutter between sibling cells
    if (/gutter|spacer/i.test(el.className) && el.parentElement && el.parentElement.children.length >= 3) {
      return true;
    }
    return false;
  }

  if (rawWidth.endsWith('%')) {
    const pct = parseFloat(rawWidth);
    return !isNaN(pct) && pct > 0 && pct <= 8;
  }

  const px = parseFloat(rawWidth);
  return !isNaN(px) && px >= 0 && px <= 48;
}

/**
 * Detects if an element is part of or represents a Divider block (Fixes R18).
 */
export function isDividerComponent(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'hr') return true;
  if (el.closest('table.divider_block, .divider_block')) return true;
  if (el.classList.contains('divider_inner')) return true;

  // Generic table/div divider: no visible text, no images, and has a 1px-8px top or bottom border
  if ((tag === 'td' || tag === 'div' || tag === 'table') && getVisibleText(el).length === 0 && !el.querySelector('img, a')) {
    const borderTop = el.style?.borderTop || el.style?.borderTopWidth || '';
    const borderBottom = el.style?.borderBottom || el.style?.borderBottomWidth || '';
    if ((borderTop && borderTop !== '0px' && borderTop !== 'none') || (borderBottom && borderBottom !== '0px' && borderBottom !== 'none')) {
      return true;
    }
  }
  return false;
}

/**
 * Detects if an element is a vertical Spacer block (Fixes R18).
 */
export function isSpacerComponent(el: HTMLElement): boolean {
  if (el.closest('table.spacer_block, div.spacer_block, .spacer_block')) return true;
  const tag = el.tagName.toLowerCase();
  if ((tag === 'div' || tag === 'td') && !isGutterCell(el) && !isDividerComponent(el)) {
    if (getVisibleText(el).length === 0 && !el.querySelector('img, a, hr, table')) {
      const h = parseFloat(el.style?.height || el.getAttribute('height') || el.style?.lineHeight || '0');
      if (h >= 4) return true;
    }
  }
  return false;
}

/**
 * Detects if an element or block is a Social Icon Strip (2+ inline linked small icons, no body copy) (Fixes R19).
 */
export function isSocialStripComponent(el: HTMLElement): boolean {
  if (el.closest('table.social_block, .social_block')) return true;

  // Check if `el` or a compact wrapper around `el` holds >= 2 `a > img` icons and no text
  const container = el.closest('table, td, div, p') as HTMLElement | null;
  if (!container) return false;

  const linkedImgs = container.querySelectorAll('a > img');
  if (linkedImgs.length >= 2 && getVisibleText(container).length === 0) {
    // Verify the icons are reasonably small (<= 64px)
    const allIcons = Array.from(linkedImgs).every((img) => {
      const w = parseFloat(img.getAttribute('width') || (img as HTMLElement).style.width || '32');
      return isNaN(w) || w <= 64;
    });
    if (allIcons) return true;
  }
  return false;
}

/**
 * Detects if an element is an Image or a linked image wrapper (`<a><img/></a>`) (Fixes R14).
 */
export function isImageComponent(el: HTMLElement): boolean {
  if (el.tagName.toLowerCase() === 'img') return true;
  if (el.closest('table.image_block')) return true;

  // An <a> or <div> that wraps an <img> and has no visible text is an Image component, NEVER a button!
  const imgs = el.querySelectorAll('img');
  if (imgs.length === 1 && getVisibleText(el).length === 0) {
    return true;
  }
  return false;
}

/**
 * Detects if an element is a Button component (Fixes R13 & R14).
 */
export function isButtonComponent(el: HTMLElement): boolean {
  if (isImageComponent(el) || isSocialStripComponent(el)) return false;
  if (el.closest('table.button_block, .button_block')) return true;

  const anchor = (el.tagName.toLowerCase() === 'a' ? el : el.closest('a')) as HTMLElement | null;
  if (!anchor) return false;

  // Never classify an <a> wrapping an <img> as a button
  if (anchor.querySelector('img')) return false;

  // Explicit .button class on anchor or inner span (BeeFree/Stripo/Pumpkin pattern)
  if (anchor.classList.contains('button') || anchor.querySelector('.button')) return true;

  // Check if anchor contains MSO VML roundrect comment
  for (let i = 0; i < anchor.childNodes.length; i++) {
    const n = anchor.childNodes[i];
    if (n.nodeType === 8 && /v:roundrect|v:rect/i.test(n.nodeValue || '')) {
      return true;
    }
  }

  // Check if anchor has button-like visual styles
  const st = anchor.style;
  if (
    st.backgroundColor ||
    st.background ||
    st.padding ||
    st.borderRadius ||
    (st.display && st.display.includes('inline-block'))
  ) {
    return true;
  }

  // Check if parent <td> is a bulletproof button cell with bgcolor / background-color
  const parentTd = anchor.closest('td');
  if (parentTd && (parentTd.hasAttribute('bgcolor') || parentTd.style.backgroundColor)) {
    if (getVisibleText(parentTd) === getVisibleText(anchor)) {
      return true;
    }
  }

  // Standalone <a> directly inside a container (not inline inside a <p>, <h1>-<h6>, or <li> with other text)
  const inlineTextParent = anchor.closest('p, h1, h2, h3, h4, h5, h6, li');
  if (!inlineTextParent) {
    return true;
  }

  return false;
}

/**
 * Checks whether `el` is the outer 100%-width email wrapper table (`table.nl-container`, etc.).
 */
export function isOuterWrapperTable(el: HTMLElement): boolean {
  if (el.tagName.toLowerCase() !== 'table') return false;
  if (el.classList.contains('nl-container')) return true;
  const parent = el.parentElement;
  if (parent && parent.tagName.toLowerCase() === 'body') {
    const width = el.getAttribute('width') || el.style.width || '';
    // If it's a 100% outer wrapper table that wraps inner 600px tables
    if (width === '100%' && el.querySelector('table')) {
      return true;
    }
  }
  return false;
}

/**
 * Detects whether `el` represents a Column / Slot in a Row.
 */
export function isColumnElement(el: HTMLElement): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (isGutterCell(el)) return false;
  if (el.classList.contains('pad')) return false;

  // 1. Explicit column class (e.g. BeeFree/Stripo/MJML `.column`, `.mj-column-*`, `.responsive-column`)
  if (
    (tag === 'td' || tag === 'th' || tag === 'div') &&
    /(?:^|\s)(?:column(?:-\d+)?|col(?:-\d+)?|responsive-column|mj-column(?:-[^\s]+)?)(?=\s|$)/i.test(el.className)
  ) {
    return true;
  }

  // 2. Table cell <td>/<th> in a <tr> that has >= 2 non-gutter content cells
  if ((tag === 'td' || tag === 'th') && el.parentElement?.tagName.toLowerCase() === 'tr') {
    const tr = el.parentElement;
    const contentCells = Array.from(tr.children).filter(
      (c) => (c.tagName.toLowerCase() === 'td' || c.tagName.toLowerCase() === 'th') && !isGutterCell(c as HTMLElement)
    );
    if (contentCells.length >= 2) {
      return true;
    }
  }

  // 3. Direct child of a multi-column flex/grid container
  const parent = el.parentElement;
  if (parent && tag === 'div') {
    const pDisplay = parent.style?.display || '';
    if (pDisplay.includes('flex') || pDisplay.includes('grid')) {
      const siblings = getMeaningfulChildren(parent).filter((c) => !isGutterCell(c));
      if (siblings.length >= 2) return true;
    }
    // Hybrid inline-block column divs
    if ((el.style?.display || '').includes('inline-block') && getMeaningfulChildren(parent).length >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Detects whether `el` represents a horizontal Section / Row band.
 */
export function isRowElement(el: HTMLElement): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();

  // 1. Explicit `table.row` (BeeFree / Stripo / Iterable / Pumpkin pattern)
  if (tag === 'table' && /\brow\b/i.test(el.className) && !/\brow-content\b/i.test(el.className)) {
    return true;
  }

  // 2. Semantic <section>
  if (tag === 'section') return true;

  // 3. A `<tr>` that directly holds >= 2 Columns (multi-column row in a single-table email)
  if (tag === 'tr') {
    const cols = Array.from(el.children).filter((c) => isColumnElement(c as HTMLElement));
    if (cols.length >= 2) {
      // Only if this `<tr>` is not already wrapped inside a dedicated `table.row`
      const outerRowTable = el.closest('table.row');
      if (!outerRowTable) return true;
    }
  }

  // 4. A flex/grid row div holding >= 2 columns
  if (tag === 'div') {
    const disp = el.style?.display || '';
    if ((disp.includes('flex') || disp.includes('grid')) && getMeaningfulChildren(el).length >= 2) {
      return true;
    }
  }

  return false;
}

const ESP_BLOCK_SELECTOR =
  'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block, table.list_block';

/**
 * Checks if `el` is an inner structural padding/border wrapper inside a Column
 * (such as `<div class="border" style="padding:35px 25px 25px 50px;">` in Taskrabbit/BeeFree)
 * or `table.row-content` inside `table.row`.
 * These wrappers belong to the enclosing Column/Row Frame and must NEVER be detached as blocks!
 */
export function isStructuralSlotWrapper(el: HTMLElement): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();

  // `table.row-content` (and its `tbody`/`tr`/`td` shell) is part of the `table.row` Frame
  if (tag === 'table' && /\brow-content\b/i.test(el.className)) {
    return true;
  }

  // A `div` directly inside a Column (`td.column`) that either has class `border`/`column-inner`
  // or wraps ESP block tables (`table.*_block`)
  if (tag === 'div' && el.parentElement && isColumnElement(el.parentElement)) {
    if (/\b(border|column-inner|col-inner|column-content)\b/i.test(el.className)) {
      return true;
    }
    if (el.querySelector(ESP_BLOCK_SELECTOR)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the canonical Auto-Layout Slot Container inside a Column (or single-column Row)
 * where child Block units actually live.
 * - For Taskrabbit `td.column > div.border`, returns `div.border` so moved/inserted blocks
 *   stay inside `.border` and retain the column's 50px/35px padding.
 * - Otherwise returns the Column itself.
 */
export function getColumnSlotContainer(colOrContainer: HTMLElement): HTMLElement {
  if (!colOrContainer || !colOrContainer.tagName) return colOrContainer;

  if (isRowElement(colOrContainer)) {
    const firstCol = colOrContainer.querySelector<HTMLElement>('td.column, th.column, div.column');
    if (firstCol) {
      return getColumnSlotContainer(firstCol);
    }
  }

  if (isColumnElement(colOrContainer)) {
    const children = getMeaningfulChildren(colOrContainer);
    if (children.length === 1 && isStructuralSlotWrapper(children[0])) {
      return children[0];
    }
  }

  return colOrContainer;
}

/**
 * Resolves any clicked or targeted DOM node inside the email into its clean,
 * self-contained moveable structural unit (Block, Column, or Row).
 *
 * Rules:
 * 1. If `target` is already a Row or Column, returns `target`.
 * 2. If `target` is a structural slot wrapper (`div.border`, `table.row-content`), resolves to its
 *    child block (if single) or enclosing Column/Row Frame — never detaching `.border`!
 * 3. If inside a known ESP block table (`table.*_block`), returns that block table.
 * 4. Climbs out of compound inner parts (`<a><img></a>`, `<span class="button">`, etc.).
 * 5. Climbs single-child wrapper parents up to the child of the enclosing Column Slot, Row, or Body stack.
 */
export function resolveUnit(target: HTMLElement): HTMLElement {
  if (!target || !target.tagName) return target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return target;

  // If the caller explicitly targeted a Row or Column (e.g. via Breadcrumb, Layer Tree, or Select Parent)
  if (isRowElement(target) || isColumnElement(target)) {
    return target;
  }

  // If the user clicked/hovered directly on a structural slot wrapper (`div.border` or `table.row-content`)
  if (isStructuralSlotWrapper(target)) {
    const childBlocks = Array.from(target.querySelectorAll<HTMLElement>(ESP_BLOCK_SELECTOR)).filter(
      (b) => !b.classList.contains('desktop_hide') && (b.style?.display || '').toLowerCase() !== 'none'
    );
    if (childBlocks.length === 1) {
      return childBlocks[0];
    }
    const parentColOrRow = target.closest<HTMLElement>('td.column, th.column, div.column, table.row, section');
    if (parentColOrRow) {
      return parentColOrRow;
    }
  }

  // 1. Check for standard ESP block wrapper tables first (BeeFree, Stripo, Pumpkin, Unlayer)
  const espBlockTable = target.closest<HTMLElement>(ESP_BLOCK_SELECTOR);
  if (espBlockTable) {
    return espBlockTable;
  }

  // If the user clicked on empty padding of `table.row-content` or its `tr`/`td` outside `td.column`
  const enclosingRow = target.closest<HTMLElement>('table.row');
  if (enclosingRow && !target.closest('td.column, th.column, div.column')) {
    return enclosingRow;
  }

  // 2. Start from target and climb out of inline/compound internals first
  let current: HTMLElement = target;

  // If inside an anchor (e.g. button `<span>` or linked `<img>`), climb to at least the `<a>`
  const enclosingAnchor = current.closest('a') as HTMLElement | null;
  if (enclosingAnchor) {
    // Only climb to `<a>` if `<a>` is a button or image wrapper (not an inline link inside a paragraph)
    const inlineHost = enclosingAnchor.closest('p, h1, h2, h3, h4, h5, h6, li');
    if (inlineHost) {
      current = inlineHost as HTMLElement;
    } else {
      current = enclosingAnchor;
    }
  } else {
    // If inside inline formatting (`<strong>`, `<em>`, `<u>`, `<span>`) inside `<p>` or `<h1..h6>`
    const textHost = current.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote') as HTMLElement | null;
    if (textHost) {
      current = textHost;
    }
  }

  // 3. Climb single-child wrapper chain (`div.alignment`, `div[style*="max-width"]`, bulletproof button `table`, single-cell `tr`/`td`)
  while (current.parentElement) {
    const parent = current.parentElement;
    const pTag = parent.tagName.toLowerCase();

    if (pTag === 'body' || pTag === 'html' || pTag === 'head') break;
    if (isOuterWrapperTable(parent)) break;

    // Never climb *into* a Column, Row, or Structural Slot Wrapper (`div.border`) when resolving a Block!
    if (isColumnElement(parent) || isRowElement(parent) || isStructuralSlotWrapper(parent)) break;

    // If current is a `<tr>` inside a `<tbody>` or `<table>` that has multiple `<tr>` rows, stop at `<tr>`!
    if (current.tagName.toLowerCase() === 'tr' && (pTag === 'tbody' || pTag === 'table')) {
      const siblingRows = getMeaningfulChildren(parent).filter((c) => c.tagName.toLowerCase() === 'tr');
      if (siblingRows.length >= 2) {
        break;
      }
      // Also if the parent table is the main 600px container table, keep `<tr>` as the block unit
      const parentTable = pTag === 'table' ? parent : parent.closest('table');
      if (parentTable && parentTable.parentElement?.closest('table')) {
        // Check if parentTable is the main content container (not a tiny button table)
        const w = parentTable.getAttribute('width') || parentTable.style.maxWidth || '';
        if (w.includes('600') || w.includes('640') || parentTable.classList.contains('row-content')) {
          break;
        }
      }
    }

    // Check how many meaningful children `parent` has
    const meaningful = getMeaningfulChildren(parent);
    if (meaningful.length === 1) {
      current = parent;
      continue;
    }

    break;
  }

  return current;
}

/**
 * Finds the nearest enclosing Column (`td.column`, multi-cell `<td>`, or flex/grid column `<div>`) for `el`.
 */
export function findEnclosingColumn(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && cur.tagName && cur.tagName.toLowerCase() !== 'body' && cur.tagName.toLowerCase() !== 'html') {
    if (isColumnElement(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Climbs one structural level up in the 5-level taxonomy (`Leaf (a/img)` -> `Block (td/table)` -> `Column` -> `Row` -> `Body`).
 */
export function getParentStructuralUnit(unit: HTMLElement): HTMLElement | null {
  if (!unit || !unit.parentElement) return null;
  const tag = unit.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return null;

  const chain = getContainerChain(unit);
  const idx = chain.indexOf(unit);
  if (idx > 0) {
    return chain[idx - 1];
  }

  const currentRole = classifyUnitRole(unit);

  if (currentRole === 'leaf') {
    const blockUnit = resolveUnit(unit);
    if (blockUnit && blockUnit !== unit) {
      return blockUnit;
    }
  }

  let cursor: HTMLElement | null = unit.parentElement;
  while (cursor && cursor.tagName.toLowerCase() !== 'html') {
    if (cursor.tagName.toLowerCase() === 'body') {
      return cursor;
    }
    if (currentRole === 'block' || currentRole === 'leaf') {
      if (isColumnElement(cursor) || isRowElement(cursor)) {
        return cursor;
      }
    } else if (currentRole === 'column') {
      if (isRowElement(cursor)) {
        return cursor;
      }
    }
    cursor = cursor.parentElement;
  }

  return unit.ownerDocument?.body || null;
}

/**
 * Classifies a structural unit into the 5-level taxonomy (`body`, `row`, `column`, `block`, `leaf`).
 */
export function classifyUnitRole(unit: HTMLElement): UnitRole {
  if (!unit || !unit.tagName) return 'block';
  const tag = unit.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html' || isOuterWrapperTable(unit)) return 'body';
  if (isRowElement(unit)) return 'row';
  if (isColumnElement(unit)) return 'column';
  if (
    tag === 'a' ||
    tag === 'img' ||
    tag === 'p' ||
    /^h[1-6]$/.test(tag) ||
    tag === 'li' ||
    tag === 'blockquote' ||
    tag === 'span' ||
    tag === 'strong' ||
    tag === 'em' ||
    tag === 'hr'
  ) {
    const blockUnit = resolveUnit(unit);
    if (blockUnit !== unit) return 'leaf';
  }
  return 'block';
}

/**
 * Determines whether a unit moves vertically (`up`/`down`) or horizontally (`left`/`right`).
 */
export function detectAxis(unit: HTMLElement): 'vertical' | 'horizontal' {
  if (isColumnElement(unit)) return 'horizontal';

  const unitDisp = (unit.style?.display || '').toLowerCase();
  const unitFloat = (unit.style?.cssFloat || unit.style?.float || '').toLowerCase();

  if (
    unitDisp.includes('inline') ||
    unitFloat === 'left' ||
    unitFloat === 'right' ||
    isSocialStripComponent(unit)
  ) {
    return 'horizontal';
  }

  const parent = unit.parentElement;
  if (parent) {
    if (isSocialStripComponent(parent)) {
      return 'horizontal';
    }
    const pDisp = (parent.style?.display || '').toLowerCase();
    if (pDisp.includes('flex') && (!parent.style.flexDirection || parent.style.flexDirection.startsWith('row'))) {
      return 'horizontal';
    }
    if (
      parent.classList.contains('menu-links') ||
      parent.classList.contains('menu') ||
      parent.classList.contains('nav') ||
      parent.classList.contains('social-links') ||
      parent.classList.contains('social')
    ) {
      return 'horizontal';
    }

    const peers = getMeaningfulChildren(parent).filter((c) => !isGutterCell(c));
    if (peers.length >= 2) {
      if (
        peers.some((p) => {
          const d = (p.style?.display || '').toLowerCase();
          const f = (p.style?.cssFloat || p.style?.float || '').toLowerCase();
          const a = (p.getAttribute('align') || '').toLowerCase();
          return d.includes('inline') || f === 'left' || f === 'right' || a === 'left' || a === 'right';
        })
      ) {
        return 'horizontal';
      }
      const r0 = peers[0].getBoundingClientRect();
      const r1 = peers[1].getBoundingClientRect();
      if ((r0.width > 0 || r0.height > 0) && (r1.width > 0 || r1.height > 0)) {
        const dx = Math.abs(r1.left - r0.left);
        const dy = Math.abs(r1.top - r0.top);
        if (dx > dy && dx > 8) {
          return 'horizontal';
        }
      }
    }
  }

  const tag = unit.tagName.toLowerCase();
  if ((tag === 'a' || tag === 'img' || tag === 'span') && parent) {
    const peers = getMeaningfulChildren(parent).filter((c) => !isGutterCell(c));
    if (peers.length >= 2 && peers.every((p) => p.tagName.toLowerCase() === tag)) {
      return 'horizontal';
    }
  }

  return 'vertical';
}

/**
 * Classifies the semantic component type for the Inspector panel.
 */
export function classifyElementType(
  selectable: HTMLElement,
  unit: HTMLElement
): SelectedElementInfo['type'] {
  const role = classifyUnitRole(unit);
  if (role === 'row') return 'row';
  if (role === 'column') return 'column';
  if (role === 'body') return 'section';

  // If the user explicitly drilled down to an `<a>` tag (or selected an `<a>` tag directly)
  if (unit.tagName.toLowerCase() === 'a') {
    if (unit.querySelector('img') && getVisibleText(unit).length === 0) {
      return 'image';
    }
    return 'button';
  }
  if (unit.tagName.toLowerCase() === 'img') {
    return 'image';
  }

  // Check compound component types on either `selectable` or `unit`
  if (isSocialStripComponent(selectable) || isSocialStripComponent(unit)) return 'social';
  if (isDividerComponent(selectable) || isDividerComponent(unit)) return 'divider';
  if (isSpacerComponent(selectable) || isSpacerComponent(unit)) return 'spacer';
  if (isImageComponent(selectable) || isImageComponent(unit)) return 'image';
  if (isButtonComponent(selectable) || isButtonComponent(unit)) return 'button';

  const sTag = selectable.tagName.toLowerCase();
  if (/^h[1-6]$/.test(sTag) || unit.querySelector('h1, h2, h3, h4, h5, h6')) {
    return 'heading';
  }
  if (
    sTag === 'p' ||
    sTag === 'span' ||
    sTag === 'li' ||
    sTag === 'blockquote' ||
    unit.classList.contains('paragraph_block') ||
    unit.classList.contains('text_block')
  ) {
    return 'text';
  }

  if (sTag === 'td' || sTag === 'tr' || sTag === 'table' || sTag === 'div' || sTag === 'section') {
    // If it only contains text and no nested tables/images, treat as text
    if (getVisibleText(selectable).length > 0 && !selectable.querySelector('table, img, hr')) {
      return 'text';
    }
    return 'section';
  }

  return 'other';
}

/**
 * Builds the human-readable ancestry breadcrumb (`Body › Row › Column › Block › Link (a)`) for any unit.
 */
export function getUnitAncestry(unit: HTMLElement, selectedLeaf?: HTMLElement | null): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  const blockUnit = resolveUnit(unit);
  let cursor: HTMLElement | null = unit;

  while (cursor && cursor.tagName && cursor.tagName.toLowerCase() !== 'html') {
    const tag = cursor.tagName.toLowerCase();
    if (tag === 'body') {
      items.unshift({ label: 'Body', role: 'body', element: cursor });
      break;
    }
    if (cursor === unit || cursor === blockUnit || isColumnElement(cursor) || isRowElement(cursor)) {
      const role = classifyUnitRole(cursor);
      let label = tag.toUpperCase();
      if (role === 'row') {
        const rowMatch = cursor.className.match(/\brow-(\d+)\b/i);
        label = rowMatch ? `Row ${rowMatch[1]}` : 'Row';
      } else if (role === 'column') {
        const colMatch = cursor.className.match(/\bcolumn-(\d+)\b/i);
        const colSide =
          cursor.className.match(/\bcol-(left|right|center)\b/i) ||
          cursor.getAttribute('align')?.match(/\b(left|right|center)\b/i);
        if (colMatch) {
          label = `Column ${colMatch[1]}`;
        } else if (colSide) {
          label = `Column (${colSide[1].charAt(0).toUpperCase() + colSide[1].slice(1)})`;
        } else {
          label = 'Column';
        }
      } else if (tag === 'a') {
        label = 'Link (a)';
      } else if (tag === 'img') {
        label = 'Image (img)';
      } else {
        const type = classifyElementType(cursor, cursor);
        label = type.charAt(0).toUpperCase() + type.slice(1);
      }
      if (!items.some((it) => it.element === cursor)) {
        items.unshift({ label, role, element: cursor });
      }
    }
    cursor = cursor.parentElement;
  }

  // If the user clicked on or inside a deeper element (like `<a href="...">`) while a parent container
  // (`Row`, `Column`, or `Block/td`) is currently selected, append the deeper `Block` and `Link (a)` to the
  // breadcrumb trail so the user can jump directly to `Link (a)` with 1 click!
  if (selectedLeaf && unit.contains(selectedLeaf) && selectedLeaf !== unit) {
    const leafBlock = resolveUnit(selectedLeaf);
    if (leafBlock && unit.contains(leafBlock) && !items.some((it) => it.element === leafBlock)) {
      const bType = classifyElementType(leafBlock, leafBlock);
      items.push({
        label: bType.charAt(0).toUpperCase() + bType.slice(1),
        role: 'block',
        element: leafBlock
      });
    }
    const anchor =
      selectedLeaf.tagName.toLowerCase() === 'a'
        ? selectedLeaf
        : selectedLeaf.closest<HTMLElement>('a') ||
          (unit.querySelectorAll('a').length === 1 ? unit.querySelector<HTMLElement>('a') : null);
    if (anchor && unit.contains(anchor) && !items.some((it) => it.element === anchor)) {
      items.push({
        label: 'Link (a)',
        role: 'leaf',
        element: anchor
      });
    }
  }

  // Disambiguate identical column labels in nested hierarchies (e.g. nested tables)
  const colItems = items.filter((it) => it.role === 'column');
  if (colItems.length >= 2) {
    colItems.forEach((col, idx) => {
      if (col.label === 'Column') {
        col.label = idx === 0 ? 'Column (Outer)' : `Column (Inner)`;
      }
    });
  }

  return items;
}

/**
 * Determines whether a DOM node should be given `contenteditable="true"` (Fixes R14, R17, R18).
 *
 * Guarantees:
 * - Linked images (`<a><img/></a>`) are NEVER `contenteditable`.
 * - Dividers (`td.divider_inner`, `.divider_block`) and Spacers are NEVER `contenteditable`.
 * - Social icon strips are NEVER `contenteditable`.
 * - Only a single host per text block (`<p>`, `<h1>`..`<h6>`, `<li>`, or button text leaf) gets
 *   `contenteditable="true"`, never nesting `contenteditable` on child `<span>`, `<em>`, `<strong>`.
 */
export function isEditableTextHost(el: HTMLElement): boolean {
  if (!el || !el.tagName) return false;
  if (isEditorHelperNode(el)) return false;

  const tag = el.tagName.toLowerCase();

  // Never make dividers, spacers, images, or social icon strips contenteditable
  if (
    tag === 'img' ||
    tag === 'hr' ||
    isDividerComponent(el) ||
    isSpacerComponent(el) ||
    isSocialStripComponent(el) ||
    isGutterCell(el)
  ) {
    return false;
  }

  // Never make an element contenteditable if it contains an <img> or <table/ul/ol/hr>
  if (el.querySelector('img, table, ul, ol, hr')) {
    return false;
  }

  // Standard block text hosts: h1..h6, p, li, blockquote
  if (/^(h[1-6]|p|li|blockquote)$/.test(tag)) {
    return true;
  }

  // For buttons (`<a>` or inner `<span class="button">`), make the single deepest element
  // that holds the complete visible button label text editable (handles `<strong>`, `<span>`, `<br>`).
  if (isButtonComponent(el)) {
    if (!/^(a|span|strong|b|em|td)$/.test(tag)) return false;
    // Do not place contenteditable directly on an `<a>` that contains MSO conditional comments
    if (tag === 'a') {
      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 8) return false;
      }
    }
    const anchor = (el.tagName.toLowerCase() === 'a' ? el : el.closest('a')) || el.closest('table.button_block') || el;
    const fullText = getVisibleText(anchor);
    if (!fullText || getVisibleText(el) !== fullText) return false;
    const childWithFullText = Array.from(el.children).find((c) => getVisibleText(c) === fullText);
    return !childWithFullText;
  }

  // Do not mark inline children (`span`, `a`, `strong`, `em`) inside a `<p>`, `<h1..h6>`, or `<li>`
  // because their parent block host is already `contenteditable="true"`!
  if (el.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote')) {
    return false;
  }

  // Leaf `div` or `td` or `th` that directly contains visible text and no child block elements
  if ((tag === 'div' || tag === 'td' || tag === 'th' || tag === 'span' || tag === 'a') && el.children.length === 0) {
    return getVisibleText(el).length > 0;
  }

  // Also a leaf `div` or `td` that only contains inline formatting tags (`strong`, `em`, `span`, `a`, `br`)
  if (tag === 'div' || tag === 'td') {
    const hasBlockDescendant = el.querySelector('div, p, h1, h2, h3, h4, h5, h6, table, ul, ol, hr');
    if (!hasBlockDescendant && getVisibleText(el).length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the editable text host (`[contenteditable="true"]`) for a clicked target or block unit,
 * searching both upward and downward so clicking button padding (`<span class="button">`) or an
 * inner `<a href="...">` inside an `<h1>`/`<p>` always finds the editable text host!
 */
export function findEditableTextHost(target: HTMLElement | null, unit?: HTMLElement | null): HTMLElement | null {
  if (target) {
    if (target.getAttribute('contenteditable') === 'true') return target;
    const up = target.closest<HTMLElement>('[contenteditable="true"]');
    if (up) return up;
    const down = target.querySelector<HTMLElement>('[contenteditable="true"]');
    if (down) return down;
  }
  if (unit) {
    if (unit.getAttribute('contenteditable') === 'true') return unit;
    const up = unit.closest<HTMLElement>('[contenteditable="true"]');
    if (up) return up;
    return unit.querySelector<HTMLElement>('[contenteditable="true"]');
  }
  return null;
}

/**
 * Builds the Top-Down Figma Container Hierarchy Chain (`[Row Frame, Column Frame, Block Frame, Inner <a/img>]`)
 * for any clicked DOM node so single-click selects the outermost container and double-clicking
 * drills down step-by-step (`Row -> Column -> Block (td) -> Link (a) / Image (img) -> Inline Text`).
 */
export function getContainerChain(target: HTMLElement): HTMLElement[] {
  if (!target || !target.tagName) return [];
  const tag = target.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return [];

  const innerUnit = resolveUnit(target);
  const chain: HTMLElement[] = [];

  // 1. Collect all enclosing Row and Column ancestors from `target` up to `body`
  const ancestorRows: HTMLElement[] = [];
  const ancestorCols: HTMLElement[] = [];

  let cur: HTMLElement | null = target;
  while (cur && cur.tagName && cur.tagName.toLowerCase() !== 'body' && cur.tagName.toLowerCase() !== 'html') {
    if (isRowElement(cur)) {
      ancestorRows.unshift(cur);
    } else if (isColumnElement(cur)) {
      const colParent = cur.parentElement;
      const siblingCols = colParent
        ? Array.from(colParent.children).filter((c) => isColumnElement(c as HTMLElement))
        : [cur];
      if (siblingCols.length >= 2 || innerUnit === cur) {
        ancestorCols.unshift(cur);
      }
    }
    cur = cur.parentElement;
  }

  if (ancestorRows.length > 0) {
    chain.push(ancestorRows[0]);
  }

  // Push any Column that wraps `innerUnit` (e.g. `td.column` in a 2-column or 3-column row)
  for (const col of ancestorCols) {
    if (!innerUnit.contains(col) && !chain.includes(col)) {
      chain.push(col);
    }
  }

  // 2. Push `innerUnit` (`table.*_block`, `tr`, `td`, `div` block)
  if (!chain.includes(innerUnit)) {
    chain.push(innerUnit);
  }

  // 3. Push any nested Column inside `innerUnit` (e.g. a 6-column social icon `<td>` inside `table.html_block`)
  for (const col of ancestorCols) {
    if (innerUnit !== col && innerUnit.contains(col) && !chain.includes(col)) {
      chain.push(col);
    }
  }

  // 4. Push inner semantic sub-elements (`<td>`, `<p>/<h1..h6>`, `<a href="...">`, `<img>`) inside `deepestContainer`
  //    ONLY when `target` is actually on/inside that child element (`target.closest(...)`).
  //    Never use downward `querySelector` fallbacks so double-clicking empty left/right padding space on a parent
  //    container never accidentally selects an unclicked child!
  const deepestContainer = chain[chain.length - 1];

  // If `deepestContainer` is a generic `<table>` or `<tr>` (not a Beefree `*_block` table), include the enclosing `<td>` cell
  const dTag = deepestContainer.tagName.toLowerCase();
  if ((dTag === 'table' || dTag === 'tr' || dTag === 'tbody') && !/_block\b/i.test(deepestContainer.className)) {
    const enclosingCell = target.closest<HTMLElement>('td, th');
    if (enclosingCell && deepestContainer.contains(enclosingCell) && !chain.includes(enclosingCell)) {
      chain.push(enclosingCell);
    }
  }

  const textBlock = target.closest<HTMLElement>('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  if (
    textBlock &&
    deepestContainer.contains(textBlock) &&
    textBlock !== deepestContainer &&
    !chain.includes(textBlock)
  ) {
    const anchorsInText = textBlock.querySelectorAll('a');
    const anchorText = anchorsInText.length === 1 ? getVisibleText(anchorsInText[0]) : '';
    if (anchorsInText.length !== 1 || getVisibleText(textBlock) !== anchorText) {
      chain.push(textBlock);
    }
  }

  const targetAnchor = target.closest<HTMLElement>('a');
  if (targetAnchor && deepestContainer.contains(targetAnchor) && !chain.includes(targetAnchor)) {
    chain.push(targetAnchor);
  }

  const targetImg = target.closest<HTMLElement>('img');
  if (targetImg && deepestContainer.contains(targetImg) && !chain.includes(targetImg)) {
    chain.push(targetImg);
  }

  return chain;
}

/**
 * Generates a short human-readable summary (`label` + `sublabel`) for a Block, Column, Row, or Inner `<a>` Link
 * in the Figma Layer Tree and Ghost Drag Card.
 */
export function describeUnitForLayer(
  unit: HTMLElement,
  fallbackIndex = 1
): { label: string; sublabel: string; role: UnitRole; type: SelectedElementInfo['type'] } {
  const role = classifyUnitRole(unit);
  const type = classifyElementType(unit, unit);

  if (role === 'row') {
    const rowMatch = unit.className.match(/\brow-(\d+)\b/i);
    const label = rowMatch ? `Row ${rowMatch[1]}` : `Row ${fallbackIndex}`;
    const cols = unit.querySelectorAll('td.column, th.column, div.column');
    const sublabel = cols.length > 1 ? `${cols.length} Columns` : 'Section Frame';
    return { label, sublabel, role, type: 'row' };
  }

  if (role === 'column') {
    const colMatch = unit.className.match(/\bcolumn-(\d+)\b/i);
    const label = colMatch ? `Column ${colMatch[1]}` : `Column ${fallbackIndex}`;
    const w = unit.getAttribute('width') || unit.style?.width || '';
    const sublabel = w ? `${Math.round(parseFloat(w))}${w.includes('%') ? '%' : 'px'}` : 'Auto-Layout';
    return { label, sublabel, role, type: 'column' };
  }

  const uTag = unit.tagName.toLowerCase();
  if (uTag === 'a') {
    const rawText = (unit.textContent || '').replace(/\s+/g, ' ').trim();
    const img = unit.querySelector('img');
    const sublabel =
      rawText.length > 0
        ? rawText.slice(0, 26)
        : (img?.getAttribute('alt') || unit.getAttribute('href') || 'Link').slice(0, 24);
    return { label: 'Link (a)', sublabel, role: 'leaf', type };
  }

  if (uTag === 'img') {
    const alt = (unit.getAttribute('alt') || unit.getAttribute('title') || '').trim();
    const src = unit.getAttribute('src') || '';
    const file = src.split('/').pop()?.split('?')[0] || 'Image';
    return { label: 'Image (img)', sublabel: (alt || file).slice(0, 24), role: 'leaf', type: 'image' };
  }

  if (uTag === 'p' || /^h[1-6]$/.test(uTag) || uTag === 'li' || uTag === 'blockquote') {
    const rawText = (unit.textContent || '').replace(/\s+/g, ' ').trim();
    const sublabel = rawText.length > 28 ? `${rawText.slice(0, 28)}…` : rawText;
    const tagLabel = uTag === 'p' ? 'Paragraph (p)' : /^h[1-6]$/.test(uTag) ? `Heading (${uTag})` : `Text (${uTag})`;
    return { label: tagLabel, sublabel, role, type };
  }

  const prettyType = type.charAt(0).toUpperCase() + type.slice(1);
  let sublabel = '';

  if (type === 'image') {
    const img = (unit.tagName.toLowerCase() === 'img' ? unit : unit.querySelector('img')) as HTMLImageElement | null;
    const alt = (img?.getAttribute('alt') || img?.getAttribute('title') || '').trim();
    if (alt) {
      sublabel = alt.slice(0, 26);
    } else {
      const src = img?.getAttribute('src') || '';
      const file = src.split('/').pop()?.split('?')[0] || 'Image';
      sublabel = file.slice(0, 24);
    }
  } else if (type === 'divider') {
    sublabel = 'Horizontal Line';
  } else if (type === 'spacer') {
    sublabel = 'Vertical Space';
  } else if (type === 'social') {
    const count = unit.querySelectorAll('a > img').length;
    sublabel = `${count || ''} Social Icons`.trim();
  } else {
    const rawText = (unit.textContent || '').replace(/\s+/g, ' ').trim();
    sublabel = rawText.length > 28 ? `${rawText.slice(0, 28)}…` : rawText;
  }

  return { label: prettyType, sublabel, role, type };
}

/**
 * Builds the Figma-style hierarchical Layer Tree (`Row › Column › Block › Link (a)`) from the live iframe DOM.
 */
export function buildLayerTree(doc: Document): LayerNode[] {
  if (!doc || !doc.body) return [];

  let nodeCounter = 1;
  const isHidden = (el: HTMLElement) =>
    el.classList.contains('desktop_hide') ||
    el.classList.contains('arch-hide-desktop') ||
    (el.style?.display || '').trim().toLowerCase() === 'none';

  const buildInnerAnchorNodes = (blockEl: HTMLElement): LayerNode[] => {
    const anchors = Array.from(blockEl.querySelectorAll<HTMLElement>('a')).filter(
      (a) => a !== blockEl && !isHidden(a)
    );
    return anchors.map((aEl, aIdx) => {
      const aDesc = describeUnitForLayer(aEl, aIdx + 1);
      return {
        id: `layer-${nodeCounter++}`,
        label: aDesc.label,
        sublabel: aDesc.sublabel,
        role: 'leaf',
        type: aDesc.type,
        element: aEl,
        children: []
      };
    });
  };

  const buildBlockNodes = (slotContainer: HTMLElement): LayerNode[] => {
    const children = getMeaningfulChildren(slotContainer).filter(
      (c) => !isGutterCell(c) && !isHidden(c)
    );
    return children.map((blockEl, bIdx) => {
      const desc = describeUnitForLayer(blockEl, bIdx + 1);
      return {
        id: `layer-${nodeCounter++}`,
        label: desc.label,
        sublabel: desc.sublabel,
        role: 'block',
        type: desc.type,
        element: blockEl,
        children: buildInnerAnchorNodes(blockEl)
      };
    });
  };

  // Case 1: Explicit `table.row` or `<section>` layout (BeeFree / Taskrabbit / Pumpkin / Multi-Row)
  const explicitRows = Array.from(doc.body.querySelectorAll<HTMLElement>('table.row, section')).filter(
    (r) => !r.classList.contains('row-content') && !isHidden(r)
  );

  if (explicitRows.length > 0) {
    return explicitRows.map((rowEl, rIdx) => {
      const rowDesc = describeUnitForLayer(rowEl, rIdx + 1);
      const cols = Array.from(rowEl.querySelectorAll<HTMLElement>('td.column, th.column, div.column')).filter(
        (c) => c.closest('table.row, section') === rowEl && !isGutterCell(c) && !isHidden(c)
      );

      let rowChildren: LayerNode[] = [];
      if (cols.length > 1) {
        rowChildren = cols.map((colEl, cIdx) => {
          const colDesc = describeUnitForLayer(colEl, cIdx + 1);
          const slot = getColumnSlotContainer(colEl);
          return {
            id: `layer-${nodeCounter++}`,
            label: colDesc.label,
            sublabel: colDesc.sublabel,
            role: 'column',
            type: 'column',
            element: colEl,
            children: buildBlockNodes(slot)
          };
        });
      } else if (cols.length === 1) {
        const slot = getColumnSlotContainer(cols[0]);
        rowChildren = buildBlockNodes(slot);
      } else {
        rowChildren = buildBlockNodes(rowEl);
      }

      return {
        id: `layer-${nodeCounter++}`,
        label: rowDesc.label,
        sublabel: rowDesc.sublabel,
        role: 'row',
        type: 'row',
        element: rowEl,
        children: rowChildren
      };
    });
  }

  // Case 2: Classic 600px single-table (`tbody > tr`) or div-only (`div.email-wrapper > div`)
  let primary: HTMLElement = doc.body;
  const tables = Array.from(doc.body.querySelectorAll<HTMLElement>('table'));
  for (const t of tables) {
    if (isOuterWrapperTable(t)) continue;
    const w = t.getAttribute('width') || t.style?.maxWidth || t.style?.width || '';
    if (w.includes('600') || w.includes('640') || !t.parentElement?.closest('table')) {
      primary = (t.querySelector('tbody') as HTMLElement) || t;
      break;
    }
  }
  if (primary === doc.body) {
    const bodyChildren = getMeaningfulChildren(doc.body);
    if (bodyChildren.length === 1 && bodyChildren[0].tagName.toLowerCase() === 'div') {
      primary = bodyChildren[0];
    }
  }

  const topUnits = getMeaningfulChildren(primary).filter((c) => !isGutterCell(c) && !isHidden(c));
  return topUnits.map((unitEl, uIdx) => {
    const desc = describeUnitForLayer(unitEl, uIdx + 1);
    const cols = Array.from(unitEl.children).filter((c) => isColumnElement(c as HTMLElement)) as HTMLElement[];
    const children: LayerNode[] =
      cols.length >= 2
        ? cols.map((colEl, cIdx) => {
            const colDesc = describeUnitForLayer(colEl, cIdx + 1);
            return {
              id: `layer-${nodeCounter++}`,
              label: colDesc.label,
              sublabel: colDesc.sublabel,
              role: 'column',
              type: 'column',
              element: colEl,
              children: buildBlockNodes(getColumnSlotContainer(colEl))
            };
          })
        : [];

    return {
      id: `layer-${nodeCounter++}`,
      label: desc.label,
      sublabel: desc.sublabel,
      role: desc.role,
      type: desc.type,
      element: unitEl,
      children
    };
  });
}

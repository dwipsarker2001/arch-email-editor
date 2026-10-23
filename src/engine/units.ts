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

import { BreadcrumbItem, SelectedElementInfo, UnitRole } from '../types';

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

  // 1. Explicit column class (e.g. BeeFree/Stripo/MJML `.column`, `.mj-column-*`, `.responsive-column`)
  if ((tag === 'td' || tag === 'th' || tag === 'div') && /\b(column|col|responsive-column|mj-column)\b/i.test(el.className)) {
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

/**
 * Resolves any clicked or targeted DOM node inside the email into its clean,
 * self-contained moveable structural unit (Block, Column, or Row).
 *
 * Rules:
 * 1. If `target` is already a Row or Column, returns `target`.
 * 2. If inside a known ESP block table (`table.*_block`), returns that block table.
 * 3. Climbs out of compound inner parts (`<a><img></a>`, `<span class="button">`, etc.).
 * 4. Climbs single-child wrapper parents up to the child of the enclosing Column, Row, or Body stack.
 */
export function resolveUnit(target: HTMLElement): HTMLElement {
  if (!target || !target.tagName) return target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return target;

  // If the caller explicitly targeted a Row or Column (e.g. via Breadcrumb or Select Parent)
  if (isRowElement(target) || isColumnElement(target)) {
    return target;
  }

  // 1. Check for standard ESP block wrapper tables first (BeeFree, Stripo, Pumpkin, Unlayer)
  const espBlockTable = target.closest<HTMLElement>(
    'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block, table.list_block'
  );
  if (espBlockTable) {
    return espBlockTable;
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

    // Never climb *into* a Column or Row when resolving a Block (the Column/Row is the container)
    if (isColumnElement(parent) || isRowElement(parent)) break;

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
 * Climbs one structural level up in the 5-level taxonomy (`Block` -> `Column` -> `Row` -> `Body`).
 */
export function getParentStructuralUnit(unit: HTMLElement): HTMLElement | null {
  if (!unit || !unit.parentElement) return null;
  const tag = unit.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return null;

  const currentRole = classifyUnitRole(unit);

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
  return 'block';
}

/**
 * Determines whether a unit moves vertically (`up`/`down`) or horizontally (`left`/`right`).
 */
export function detectAxis(unit: HTMLElement): 'vertical' | 'horizontal' {
  if (isColumnElement(unit)) return 'horizontal';
  const parent = unit.parentElement;
  if (parent) {
    const disp = parent.style?.display || '';
    if (disp.includes('flex') && (!parent.style.flexDirection || parent.style.flexDirection.startsWith('row'))) {
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
 * Builds the human-readable ancestry breadcrumb (`Body › Row › Column › Block`) for any unit.
 */
export function getUnitAncestry(unit: HTMLElement): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  let cursor: HTMLElement | null = unit;

  while (cursor && cursor.tagName && cursor.tagName.toLowerCase() !== 'html') {
    const tag = cursor.tagName.toLowerCase();
    if (tag === 'body') {
      items.unshift({ label: 'Body', role: 'body', element: cursor });
      break;
    }
    if (cursor === unit || isColumnElement(cursor) || isRowElement(cursor)) {
      const role = classifyUnitRole(cursor);
      let label = tag.toUpperCase();
      if (role === 'row') {
        const rowMatch = cursor.className.match(/\brow-(\d+)\b/i);
        label = rowMatch ? `Row ${rowMatch[1]}` : 'Row';
      } else if (role === 'column') {
        const colMatch = cursor.className.match(/\bcolumn-(\d+)\b/i);
        label = colMatch ? `Column ${colMatch[1]}` : 'Column';
      } else {
        const type = classifyElementType(cursor, cursor);
        label = type.charAt(0).toUpperCase() + type.slice(1);
      }
      items.unshift({ label, role, element: cursor });
    }
    cursor = cursor.parentElement;
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

  // For buttons (`<a>` or inner `<span class="button">`), make only the deepest text element editable,
  // or the `<a>` itself if it has no child elements and no MSO comments.
  if (isButtonComponent(el)) {
    if (tag === 'a') {
      const hasElementChildren = el.children.length > 0;
      return !hasElementChildren;
    }
    // Inner span/strong inside a button: only the innermost element holding the label
    if ((tag === 'span' || tag === 'strong' || tag === 'b' || tag === 'em') && el.children.length === 0) {
      return getVisibleText(el).length > 0;
    }
    return false;
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

/**
 * Arch Email Editor - Pro-Level Smart Component Adapters & Context-Aware Inserter
 *
 * Solves:
 * - R3:  Context-aware block & multi-column row insertion matching the target container's content model.
 * - R13: Compound Button Adapter (updates textLeaf, <span class="button">, td[bgcolor], and MSO <v:roundrect> together).
 * - R14: Never treats linked images (<a><img/></a>) as buttons.
 * - R15: Updates enclosing <div style="max-width: Xpx"> alongside <img width="X"> when resizing images.
 * - R16: Syncs HTML `align` attribute + `style.textAlign` + block margins on image/button/block alignment.
 * - R17: Preserves inline formatting (<em>, <strong>, <a>, <span>) in text blocks.
 * - R18: Smart Divider (<hr> and td.divider_inner) & Spacer height controllers.
 * - R19: Social Icon Strip controller (edit/add/remove/size social links).
 * - R21: Column & Row controller with multi-column width presets (50/50, 33/67, 67/33, 33/33/33).
 */

import { BlockType, RowLayoutType, ViewportMode } from '../types';
import {
  isRowElement,
  isGutterCell,
  isOuterWrapperTable,
  isEditorHelperNode,
  isHiddenBlockElement,
  getColumnSlotContainer
} from './units';
import { setResponsiveStyle } from './cssScope';

/**
 * 1. SMART BUTTON ADAPTER (Fixes R13)
 */
export interface ButtonAnatomy {
  unit: HTMLElement;
  anchor: HTMLElement;
  visualBox: HTMLElement;
  textLeaf: HTMLElement;
  padCell: HTMLElement | null;
  alignWrapper: HTMLElement | null;
  msoComments: Comment[];
}

export function resolveButtonAnatomy(el: HTMLElement, unit?: HTMLElement): ButtonAnatomy {
  const root = (unit || el.closest('table.button_block') || el) as HTMLElement;
  const anchor = (
    el.tagName.toLowerCase() === 'a'
      ? el
      : root.querySelector('a') || el.closest('a') || el
  ) as HTMLElement;

  //BeeFree/Stripo/Pumpkin wraps a `<span class="button">` inside `<a>`
  const buttonSpan = anchor.querySelector<HTMLElement>('.button');
  const visualBox = buttonSpan || anchor;

  // Find the deepest single-branch text container inside visualBox (e.g. `<span><strong>Label</strong></span>`)
  let textLeaf: HTMLElement = visualBox;
  while (textLeaf.children.length === 1) {
    const child = textLeaf.children[0] as HTMLElement;
    const cTag = child.tagName.toLowerCase();
    if (cTag === 'span' || cTag === 'strong' || cTag === 'b' || cTag === 'em' || cTag === 'i' || cTag === 'font') {
      textLeaf = child;
    } else {
      break;
    }
  }

  const padCell = (anchor.closest('td.pad') || anchor.closest('td')) as HTMLElement | null;
  const alignWrapper = (anchor.closest('div.alignment') || padCell) as HTMLElement | null;

  // Collect MSO VML roundrect comments inside anchor or root
  const msoComments: Comment[] = [];
  const walker = (root.ownerDocument || document).createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (/v:roundrect|v:rect/i.test(currentNode.nodeValue || '')) {
      msoComments.push(currentNode as Comment);
    }
    currentNode = walker.nextNode();
  }

  return { unit: root, anchor, visualBox, textLeaf, padCell, alignWrapper, msoComments };
}

export const ButtonAdapter = {
  getLabel(el: HTMLElement, unit?: HTMLElement): string {
    const { textLeaf } = resolveButtonAnatomy(el, unit);
    return (textLeaf.textContent || '').trim();
  },

  setLabel(el: HTMLElement, value: string, unit?: HTMLElement): void {
    const { anchor, textLeaf, msoComments } = resolveButtonAnatomy(el, unit);

    if (textLeaf !== anchor) {
      // Safe: updating the inner `<strong>`/`<span>` preserves `<span class="button">` and MSO comments on `anchor`!
      textLeaf.textContent = value;
    } else {
      // `textLeaf` is `anchor` itself — check if `anchor` has comment nodes (MSO VML)
      const hasComments = Array.from(anchor.childNodes).some((n) => n.nodeType === 8);
      if (hasComments) {
        let textNode = Array.from(anchor.childNodes).find((n) => n.nodeType === 3) as Text | undefined;
        if (textNode) {
          textNode.nodeValue = value;
        } else {
          anchor.appendChild((anchor.ownerDocument || document).createTextNode(value));
        }
      } else {
        anchor.textContent = value;
      }
    }

    // Also update label inside MSO `<v:roundrect>...<center>Label</center>` if present
    for (const c of msoComments) {
      if (c.nodeValue && /<center\b[^>]*>[\s\S]*?<\/center>/i.test(c.nodeValue)) {
        c.nodeValue = c.nodeValue.replace(
          /(<center\b[^>]*>)[\s\S]*?(<\/center>)/i,
          `$1${value}$2`
        );
      }
    }
  },

  getUrl(el: HTMLElement, unit?: HTMLElement): string {
    const { anchor } = resolveButtonAnatomy(el, unit);
    return anchor.getAttribute('href') || '';
  },

  setUrl(el: HTMLElement, url: string, unit?: HTMLElement): void {
    const { anchor, msoComments } = resolveButtonAnatomy(el, unit);
    anchor.setAttribute('href', url);
    for (const c of msoComments) {
      if (c.nodeValue && /href\s*=\s*["'][^"']*["']/i.test(c.nodeValue)) {
        c.nodeValue = c.nodeValue.replace(/href\s*=\s*["'][^"']*["']/i, `href="${url}"`);
      }
    }
  },

  getBackgroundColor(el: HTMLElement, unit?: HTMLElement): string {
    const { anchor, visualBox, padCell } = resolveButtonAnatomy(el, unit);
    return (
      visualBox.style.backgroundColor ||
      anchor.style.backgroundColor ||
      (padCell && !padCell.classList.contains('pad') ? padCell.style.backgroundColor || padCell.getAttribute('bgcolor') || '' : '')
    );
  },

  setBackgroundColor(el: HTMLElement, color: string, unit?: HTMLElement): void {
    const { anchor, visualBox, padCell, msoComments } = resolveButtonAnatomy(el, unit);
    visualBox.style.backgroundColor = color;
    if (visualBox === anchor && anchor.style.borderColor) {
      anchor.style.borderColor = color;
    }
    // Only set bgcolor on parent `<td>` if it is a tight bulletproof-button cell (not a full-width `td.pad` wrapper)
    if (padCell && !padCell.classList.contains('pad')) {
      padCell.setAttribute('bgcolor', color);
      padCell.style.backgroundColor = color;
    }
    for (const c of msoComments) {
      if (c.nodeValue && /fillcolor\s*=\s*["'][^"']*["']/i.test(c.nodeValue)) {
        c.nodeValue = c.nodeValue.replace(/fillcolor\s*=\s*["'][^"']*["']/i, `fillcolor="${color}"`);
      }
    }
  },

  getTextColor(el: HTMLElement, unit?: HTMLElement): string {
    const { anchor, visualBox, textLeaf } = resolveButtonAnatomy(el, unit);
    return textLeaf.style.color || visualBox.style.color || anchor.style.color || '';
  },

  setTextColor(el: HTMLElement, color: string, unit?: HTMLElement): void {
    const { anchor, visualBox, textLeaf, msoComments } = resolveButtonAnatomy(el, unit);
    visualBox.style.color = color;
    anchor.style.color = color;
    if (textLeaf !== visualBox) {
      textLeaf.style.color = color;
    }
    for (const c of msoComments) {
      if (c.nodeValue && /color\s*:\s*[^;"]+/i.test(c.nodeValue)) {
        c.nodeValue = c.nodeValue.replace(/color\s*:\s*[^;"]+/i, `color:${color}`);
      }
    }
  },

  getBorderRadius(el: HTMLElement, unit?: HTMLElement): string {
    const { anchor, visualBox } = resolveButtonAnatomy(el, unit);
    return visualBox.style.borderRadius || anchor.style.borderRadius || '6px';
  },

  setBorderRadius(el: HTMLElement, radius: string, unit?: HTMLElement): void {
    const { anchor, visualBox, padCell, msoComments } = resolveButtonAnatomy(el, unit);
    visualBox.style.borderRadius = radius;
    if (visualBox !== anchor && anchor.style.borderRadius) {
      anchor.style.borderRadius = radius;
    }
    if (padCell && !padCell.classList.contains('pad') && padCell.style.borderRadius) {
      padCell.style.borderRadius = radius;
    }
    const px = parseFloat(radius);
    if (!isNaN(px)) {
      const arcPct = Math.min(100, Math.round((px / 42) * 100));
      for (const c of msoComments) {
        if (c.nodeValue && /arcsize\s*=\s*["'][^"']*["']/i.test(c.nodeValue)) {
          c.nodeValue = c.nodeValue.replace(/arcsize\s*=\s*["'][^"']*["']/i, `arcsize="${arcPct}%"`);
        }
      }
    }
  },

  getAlignment(el: HTMLElement, unit?: HTMLElement): string {
    const { alignWrapper } = resolveButtonAnatomy(el, unit);
    return alignWrapper?.getAttribute('align') || alignWrapper?.style.textAlign || 'center';
  },

  setAlignment(el: HTMLElement, align: 'left' | 'center' | 'right', unit?: HTMLElement): void {
    const { alignWrapper, padCell } = resolveButtonAnatomy(el, unit);
    if (alignWrapper) {
      alignWrapper.setAttribute('align', align);
      alignWrapper.style.textAlign = align;
    }
    if (padCell) {
      padCell.setAttribute('align', align);
      padCell.style.textAlign = align;
    }
  }
};

/**
 * 2. SMART IMAGE ADAPTER (Fixes R14, R15, R16)
 */
export interface ImageAnatomy {
  img: HTMLElement;
  link: HTMLAnchorElement | null;
  sizeWrapper: HTMLElement | null;
  alignWrapper: HTMLElement | null;
  padCell: HTMLElement | null;
}

export function resolveImageAnatomy(el: HTMLElement, unit?: HTMLElement): ImageAnatomy {
  const root = unit || el.closest('table.image_block') || el;
  const img = (
    el.tagName.toLowerCase() === 'img'
      ? el
      : root.querySelector('img') || el
  ) as HTMLElement;

  const link = img.closest('a') as HTMLAnchorElement | null;
  const candidateAfterLink = (link ? link.parentElement : img.parentElement) as HTMLElement | null;

  // BeeFree / Stripo / Pumpkin wraps `<div style="max-width: 180px"><a><img width="180" style="width:100%"></a></div>`
  let sizeWrapper: HTMLElement | null = null;
  if (
    candidateAfterLink &&
    candidateAfterLink.tagName.toLowerCase() === 'div' &&
    !candidateAfterLink.classList.contains('alignment') &&
    candidateAfterLink.style.maxWidth
  ) {
    sizeWrapper = candidateAfterLink;
  }

  const alignWrapper = (
    img.closest('div.alignment') ||
    sizeWrapper?.parentElement?.closest('div.alignment, td') ||
    img.closest('td')
  ) as HTMLElement | null;

  const padCell = (img.closest('td.pad') || img.closest('td')) as HTMLElement | null;

  return { img, link, sizeWrapper, alignWrapper, padCell };
}

export const ImageAdapter = {
  findImage(el: HTMLElement, unit?: HTMLElement): HTMLImageElement | null {
    const img = resolveImageAnatomy(el, unit).img;
    return img.tagName.toLowerCase() === 'img' ? (img as HTMLImageElement) : null;
  },

  getSrc(el: HTMLElement, unit?: HTMLElement): string {
    return resolveImageAnatomy(el, unit).img.getAttribute('src') || '';
  },

  setSrc(el: HTMLElement, src: string, unit?: HTMLElement): void {
    resolveImageAnatomy(el, unit).img.setAttribute('src', src);
  },

  getAlt(el: HTMLElement, unit?: HTMLElement): string {
    return resolveImageAnatomy(el, unit).img.getAttribute('alt') || '';
  },

  setAlt(el: HTMLElement, alt: string, unit?: HTMLElement): void {
    const { img } = resolveImageAnatomy(el, unit);
    img.setAttribute('alt', alt);
    if (img.hasAttribute('title')) {
      img.setAttribute('title', alt);
    }
  },

  getLinkUrl(el: HTMLElement, unit?: HTMLElement): string {
    return resolveImageAnatomy(el, unit).link?.getAttribute('href') || '';
  },

  setLinkUrl(el: HTMLElement, url: string, unit?: HTMLElement): void {
    const { img, link } = resolveImageAnatomy(el, unit);
    const trimmed = url.trim();
    if (link) {
      if (trimmed) {
        link.setAttribute('href', trimmed);
      } else {
        link.removeAttribute('href');
      }
    } else if (trimmed && img.parentElement) {
      const doc = img.ownerDocument || document;
      const a = doc.createElement('a');
      a.setAttribute('href', trimmed);
      a.setAttribute('target', '_blank');
      img.parentElement.insertBefore(a, img);
      a.appendChild(img);
    }
  },

  getWidth(el: HTMLElement, unit?: HTMLElement): string {
    const { img, sizeWrapper } = resolveImageAnatomy(el, unit);
    if (sizeWrapper?.style.maxWidth) return sizeWrapper.style.maxWidth;
    if (img.style.maxWidth) return img.style.maxWidth;
    const wAttr = img.getAttribute('width');
    if (wAttr) return wAttr.endsWith('%') || wAttr.endsWith('px') ? wAttr : `${wAttr}px`;
    return img.style.width || '100%';
  },

  setWidth(el: HTMLElement, rawVal: string, unit?: HTMLElement): void {
    const { img, sizeWrapper } = resolveImageAnatomy(el, unit);
    const val = rawVal.trim();
    if (!val) return;

    const normalized = /^\d+$/.test(val) ? `${val}px` : val;

    if (normalized.endsWith('px')) {
      const numStr = normalized.replace(/px$/i, '').trim();
      img.setAttribute('width', numStr);
      if (sizeWrapper) {
        sizeWrapper.style.maxWidth = normalized;
        img.style.maxWidth = normalized;
        img.style.width = '100%';
      } else {
        img.style.maxWidth = normalized;
        img.style.width = normalized;
      }
      img.style.height = 'auto';
      if (img.hasAttribute('height') && img.getAttribute('height') !== 'auto') {
        img.setAttribute('height', 'auto');
      }
    } else if (normalized.endsWith('%')) {
      if (sizeWrapper) {
        sizeWrapper.style.maxWidth = normalized;
      }
      img.style.maxWidth = normalized;
      img.style.width = normalized;
      img.style.height = 'auto';
    }
  },

  getAlignment(el: HTMLElement, unit?: HTMLElement): string {
    const { alignWrapper, padCell } = resolveImageAnatomy(el, unit);
    return (
      alignWrapper?.getAttribute('align') ||
      alignWrapper?.style.textAlign ||
      padCell?.getAttribute('align') ||
      padCell?.style.textAlign ||
      'center'
    );
  },

  setAlignment(el: HTMLElement, align: 'left' | 'center' | 'right', unit?: HTMLElement): void {
    const { img, sizeWrapper, alignWrapper, padCell } = resolveImageAnatomy(el, unit);
    if (alignWrapper) {
      alignWrapper.setAttribute('align', align);
      alignWrapper.style.textAlign = align;
    }
    if (padCell) {
      padCell.setAttribute('align', align);
      padCell.style.textAlign = align;
    }
    const marginVal = align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0 auto 0 0';
    if (sizeWrapper) {
      sizeWrapper.style.margin = marginVal;
    } else {
      img.style.margin = marginVal;
    }
  }
};

/**
 * 3. SMART TEXT ADAPTER (Fixes R17 & R22)
 */
export const TextAdapter = {
  getTextHost(el: HTMLElement, unit?: HTMLElement): HTMLElement {
    const tag = el.tagName.toLowerCase();
    if (/^(h[1-6]|p|li|blockquote)$/.test(tag)) return el;
    const insideHost = el.closest<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, blockquote');
    if (insideHost) return insideHost;
    if (unit) {
      const childHost = unit.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, blockquote');
      if (childHost) return childHost;
    }
    return el;
  },

  hasRichFormatting(el: HTMLElement, unit?: HTMLElement): boolean {
    const host = this.getTextHost(el, unit);
    return !!host.querySelector('em, i, strong, b, u, a');
  },

  setText(el: HTMLElement, text: string, unit?: HTMLElement): void {
    const host = this.getTextHost(el, unit);
    // If host has a single `<span style="...">` wrapper child and no rich `em`/`strong`/`a`, update the inner span
    if (host.children.length === 1 && host.children[0].tagName.toLowerCase() === 'span' && !this.hasRichFormatting(el, unit)) {
      host.children[0].textContent = text;
    } else {
      host.textContent = text;
    }
  },

  setFontSize(el: HTMLElement, size: string, viewport: ViewportMode = 'desktop', unit?: HTMLElement): void {
    const host = this.getTextHost(el, unit);
    setResponsiveStyle(host, 'font-size', size, viewport);
    if (viewport === 'desktop') {
      // Also update inner wrapper divs/spans that set explicit font-size
      const parentDiv = host.parentElement;
      if (parentDiv && parentDiv.tagName.toLowerCase() === 'div' && parentDiv.style.fontSize) {
        parentDiv.style.fontSize = size;
      }
      host.querySelectorAll<HTMLElement>('span[style*="font-size"]').forEach((sp) => {
        sp.style.fontSize = size;
      });
    }
  },

  setColor(el: HTMLElement, color: string, unit?: HTMLElement): void {
    const host = this.getTextHost(el, unit);
    host.style.color = color;
    const parentDiv = host.parentElement;
    if (parentDiv && parentDiv.tagName.toLowerCase() === 'div' && parentDiv.style.color) {
      parentDiv.style.color = color;
    }
    host.querySelectorAll<HTMLElement>('span[style*="color"]').forEach((sp) => {
      sp.style.color = color;
    });
  },

  setAlignment(el: HTMLElement, align: 'left' | 'center' | 'right', viewport: ViewportMode = 'desktop', unit?: HTMLElement): void {
    const host = this.getTextHost(el, unit);
    setResponsiveStyle(host, 'text-align', align, viewport);
    const parentDiv = host.parentElement;
    if (parentDiv && parentDiv.tagName.toLowerCase() === 'div') {
      setResponsiveStyle(parentDiv, 'text-align', align, viewport);
    }
    const padCell = host.closest('td');
    if (padCell && viewport === 'desktop') {
      padCell.setAttribute('align', align);
      padCell.style.textAlign = align;
    }
  }
};

/**
 * 4. SMART DIVIDER & SPACER ADAPTERS (Fixes R18)
 */
export const DividerAdapter = {
  getLineElement(el: HTMLElement, unit?: HTMLElement): HTMLElement {
    const root = unit || el.closest('table.divider_block') || el;
    if (el.tagName.toLowerCase() === 'hr') return el;
    return (
      root.querySelector<HTMLElement>('hr, td.divider_inner, [style*="border-top"]') ||
      el
    );
  },

  getColor(el: HTMLElement, unit?: HTMLElement): string {
    const line = this.getLineElement(el, unit);
    return line.style.borderTopColor || line.style.borderColor || '#cbd5e1';
  },

  setColor(el: HTMLElement, color: string, unit?: HTMLElement): void {
    const line = this.getLineElement(el, unit);
    const width = line.style.borderTopWidth || '1px';
    const style = line.style.borderTopStyle || 'solid';
    line.style.borderTop = `${width} ${style} ${color}`;
  },

  getThickness(el: HTMLElement, unit?: HTMLElement): string {
    const line = this.getLineElement(el, unit);
    return line.style.borderTopWidth || '1px';
  },

  setThickness(el: HTMLElement, thickness: string, unit?: HTMLElement): void {
    const line = this.getLineElement(el, unit);
    const norm = /^\d+$/.test(thickness.trim()) ? `${thickness.trim()}px` : thickness.trim();
    const color = line.style.borderTopColor || '#cbd5e1';
    const style = line.style.borderTopStyle || 'solid';
    line.style.borderTop = `${norm} ${style} ${color}`;
  }
};

export const SpacerAdapter = {
  getTarget(el: HTMLElement, unit?: HTMLElement): HTMLElement {
    const root = unit || el;
    return root.querySelector<HTMLElement>('.spacer_block, [style*="height"]') || root;
  },

  getHeight(el: HTMLElement, unit?: HTMLElement): string {
    const target = this.getTarget(el, unit);
    return target.style.height || target.getAttribute('height') || target.style.lineHeight || '24px';
  },

  setHeight(el: HTMLElement, height: string, unit?: HTMLElement): void {
    const target = this.getTarget(el, unit);
    const norm = /^\d+$/.test(height.trim()) ? `${height.trim()}px` : height.trim();
    target.style.height = norm;
    target.style.lineHeight = norm;
    if (target.hasAttribute('height')) {
      target.setAttribute('height', norm.replace('px', ''));
    }
  }
};

/**
 * 5. SMART SOCIAL STRIP ADAPTER (Fixes R19)
 */
export interface SocialItem {
  anchor: HTMLAnchorElement;
  img: HTMLImageElement;
  href: string;
  src: string;
  alt: string;
}

export const SocialAdapter = {
  getItems(unit: HTMLElement): SocialItem[] {
    const links = Array.from(unit.querySelectorAll('a'));
    const items: SocialItem[] = [];
    for (const a of links) {
      const img = a.querySelector('img');
      if (img) {
        items.push({
          anchor: a as HTMLAnchorElement,
          img: img as HTMLImageElement,
          href: a.getAttribute('href') || '',
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || img.getAttribute('title') || 'Social'
        });
      }
    }
    return items;
  },

  addIcon(unit: HTMLElement, platform = 'Website', href = 'https://example.com'): void {
    const items = this.getItems(unit);
    if (items.length === 0) return;
    const lastAnchor = items[items.length - 1].anchor;
    const clone = lastAnchor.cloneNode(true) as HTMLAnchorElement;
    clone.setAttribute('href', href);
    const img = clone.querySelector('img');
    if (img) {
      img.setAttribute('alt', platform);
      img.setAttribute('title', platform);
    }
    lastAnchor.insertAdjacentElement('afterend', clone);
  }
};

/**
 * 6. MULTI-COLUMN & ROW LAYOUT CONTROLLER (Fixes R21 & §3.3)
 */
export const ColumnLayoutAdapter = {
  /**
   * Returns all non-gutter column elements inside a Row (or the row surrounding `el`).
   */
  getColumnsInRow(elOrRow: HTMLElement): HTMLElement[] {
    const row = isRowElement(elOrRow)
      ? elOrRow
      : (elOrRow.closest('table.row, tr, section') as HTMLElement | null) || elOrRow;

    // Look for `td.column` inside `table.row-content` or direct `<td>` children of `<tr>`
    const tr = row.tagName.toLowerCase() === 'tr' ? row : row.querySelector('tr');
    if (tr) {
      const cells = Array.from(tr.children).filter(
        (c) => (c.tagName.toLowerCase() === 'td' || c.tagName.toLowerCase() === 'th') && !isGutterCell(c as HTMLElement)
      ) as HTMLElement[];
      if (cells.length >= 1) return cells;
    }

    return Array.from(row.children).filter((c) => !isGutterCell(c as HTMLElement)) as HTMLElement[];
  },

  /**
   * Applies a multi-column width preset (`1-col`, `2-col-50-50`, `2-col-33-67`, `2-col-67-33`, `3-col`)
   * to the row containing `elOrRow`, creating or merging columns as needed without losing content!
   */
  applyRowPreset(elOrRow: HTMLElement, preset: RowLayoutType): void {
    const widthsMap: Record<RowLayoutType, number[]> = {
      '1-col': [100],
      '2-col-50-50': [50, 50],
      '2-col-33-67': [33.33, 66.67],
      '2-col-67-33': [66.67, 33.33],
      '3-col': [33.33, 33.33, 33.33],
      '4-col': [25, 25, 25, 25]
    };
    const targetWidths = widthsMap[preset];
    if (!targetWidths) return;

    const cols = this.getColumnsInRow(elOrRow);
    if (cols.length === 0) return;

    const parentTr = cols[0].parentElement;
    if (!parentTr) return;

    // If we need more columns than currently exist, clone the last column shell (with an empty placeholder drop area)
    while (cols.length < targetWidths.length) {
      const templateCol = cols[cols.length - 1];
      const newCol = templateCol.cloneNode(false) as HTMLElement;
      newCol.innerHTML = buildEmptyColumnPlaceholderHtml();
      parentTr.appendChild(newCol);
      cols.push(newCol);
    }

    // If we have more columns than targetWidths, move children of extra columns into the last kept column before removing
    while (cols.length > targetWidths.length) {
      const removedCol = cols.pop()!;
      const keepCol = cols[cols.length - 1];
      while (removedCol.firstChild) {
        keepCol.appendChild(removedCol.firstChild);
      }
      // Also remove any preceding gutter cell
      const prev = removedCol.previousElementSibling as HTMLElement | null;
      if (prev && isGutterCell(prev)) prev.remove();
      removedCol.remove();
    }

    // Update widths on all kept columns
    cols.forEach((col, i) => {
      const pct = targetWidths[i];
      const pctStr = `${pct}%`;
      col.setAttribute('width', pctStr);
      col.style.width = pctStr;
    });
  }
};

/**
 * 7. CONTEXT-AWARE BLOCK & ROW LAYOUT INSERTION (Fixes R3)
 */
export function findPrimaryContentContainer(doc: Document): HTMLElement {
  const body = doc.body;
  // 1. Prefer the last column in a BeeFree/Stripo template (`td.column`)
  const columns = body.querySelectorAll<HTMLElement>('td.column, div.column');
  if (columns.length > 0) {
    return columns[columns.length - 1];
  }

  // 2. Prefer the 600px/640px inner content table's `<tbody>` (never the outer 100% wrapper table!)
  const allTables = Array.from(body.querySelectorAll<HTMLElement>('table'));
  for (const t of allTables) {
    if (isOuterWrapperTable(t)) continue;
    const w = t.getAttribute('width') || t.style.maxWidth || '';
    if (w.includes('600') || w.includes('640') || !t.querySelector('table')) {
      return (t.querySelector('tbody') || t) as HTMLElement;
    }
  }

  return body;
}

/**
 * Generates inner HTML for a block type, wrapped appropriately for the destination container (`<tr><td>` vs `<table class="*_block">` vs `<div>`).
 */
export function buildContextAwareBlockHtml(
  type: BlockType,
  containerTag: string
): string {
  const inner = getRawBlockInnerMarkup(type);

  // If inserting directly into a `<tbody>` or `<table>`, wrap in `<tr><td>...</td></tr>`
  if (containerTag === 'tbody' || containerTag === 'table') {
    return `<tr><td style="padding: 12px 20px;">${inner}</td></tr>`;
  }

  // If inserting into a `<td>` column or `<div>`, wrap in a self-contained 100% block table
  return `<table class="${type}_block" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;"><tbody><tr><td class="pad" style="padding: 12px 20px;">${inner}</td></tr></tbody></table>`;
}

function getRawBlockInnerMarkup(type: BlockType): string {
  switch (type) {
    case 'heading':
      return `<h2 style="margin: 0; font-family: Arial, sans-serif; font-size: 22px; color: #0f172a; font-weight: bold; text-align: left;">New Heading</h2>`;
    case 'text':
      return `<p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #475569; line-height: 1.6; text-align: left;">Add your newsletter copy here. Click to edit directly in the email.</p>`;
    case 'button':
      return `<div class="alignment" align="center" style="text-align: center;"><a href="https://example.com" target="_blank" style="background-color: #2563eb; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Click Here</a></div>`;
    case 'image':
      return `<div class="alignment" align="center" style="text-align: center;"><div style="max-width: 560px; margin: 0 auto;"><img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80" alt="Banner visual" width="560" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 6px; border: 0;" /></div></div>`;
    case 'divider':
      return `<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 0;" />`;
    case 'spacer':
      return `<div class="spacer_block" style="height: 28px; line-height: 28px; font-size: 1px;">&#8202;</div>`;
    case 'social':
      return `<div class="alignment" align="center" style="text-align: center;"><a href="https://instagram.com" target="_blank" style="display:inline-block;margin:0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" width="28" style="width:28px;height:auto;display:block;border:0;" /></a><a href="https://twitter.com" target="_blank" style="display:inline-block;margin:0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="X" width="28" style="width:28px;height:auto;display:block;border:0;" /></a><a href="https://linkedin.com" target="_blank" style="display:inline-block;margin:0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" width="28" style="width:28px;height:auto;display:block;border:0;" /></a></div>`;
    case 'html':
      return `<div style="padding: 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-size: 13px;">Custom HTML Section</div>`;
    case 'list':
      return `<ul style="margin: 0; padding-left: 20px; font-family: Arial, sans-serif; font-size: 15px; color: #334155; line-height: 1.6;"><li style="margin-bottom: 6px;">Feature point or key takeaway</li><li style="margin-bottom: 6px;">Second highlighted bullet</li><li>Final actionable recommendation</li></ul>`;
    case 'table':
      return `<table width="100%" border="0" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; color: #334155;"><thead><tr style="background-color: #f1f5f9; color: #0f172a; border-bottom: 2px solid #cbd5e1; font-weight: bold;"><th align="left" style="padding: 10px 12px;">Item</th><th align="left" style="padding: 10px 12px;">Description</th><th align="right" style="padding: 10px 12px;">Price</th></tr></thead><tbody><tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">Standard Plan</td><td style="padding: 10px 12px;">Monthly subscription</td><td align="right" style="padding: 10px 12px; font-weight: 600;">$29.00</td></tr><tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">Pro Add-on</td><td style="padding: 10px 12px;">Advanced analytics & export</td><td align="right" style="padding: 10px 12px; font-weight: 600;">$15.00</td></tr></tbody></table>`;
    case 'video':
      return `<div class="alignment" align="center" style="text-align: center;"><a href="https://youtube.com" target="_blank" style="display: block; position: relative; max-width: 560px; margin: 0 auto; text-decoration: none;"><img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80" alt="Watch Video" width="560" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 8px; border: 0;" /><div style="background-color: rgba(15, 23, 42, 0.85); color: #ffffff; padding: 10px 20px; border-radius: 999px; display: inline-block; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; margin-top: -38px; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">▶ Watch Video (3:20)</div></a></div>`;
    case 'icons':
      return `<div class="alignment" align="center" style="text-align: center;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; display: inline-table;"><tr><td align="center" style="padding: 0 12px;"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077035.png" alt="Secure" width="32" height="32" style="display:block;border:0;width:32px;height:32px;" /><p style="margin: 6px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #475569; font-weight: 500;">Secure</p></td><td align="center" style="padding: 0 12px;"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077042.png" alt="Fast" width="32" height="32" style="display:block;border:0;width:32px;height:32px;" /><p style="margin: 6px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #475569; font-weight: 500;">Instant</p></td><td align="center" style="padding: 0 12px;"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077063.png" alt="Support" width="32" height="32" style="display:block;border:0;width:32px;height:32px;" /><p style="margin: 6px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #475569; font-weight: 500;">Support</p></td></tr></table></div>`;
    case 'menu':
      return `<div class="menu-links" align="center" style="text-align: center; padding: 6px 0;"><a href="https://example.com/home" style="display: inline-block; padding: 6px 14px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; text-decoration: none; letter-spacing: 0.5px;">HOME</a><a href="https://example.com/features" style="display: inline-block; padding: 6px 14px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; text-decoration: none; letter-spacing: 0.5px;">FEATURES</a><a href="https://example.com/pricing" style="display: inline-block; padding: 6px 14px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; text-decoration: none; letter-spacing: 0.5px;">PRICING</a><a href="https://example.com/contact" style="display: inline-block; padding: 6px 14px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; text-decoration: none; letter-spacing: 0.5px;">CONTACT</a></div>`;
    case 'gif':
      return `<div class="alignment" align="center" style="text-align: center;"><img src="https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif" alt="Animated sticker" width="280" style="width: 280px; max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 8px; border: 0;" /></div>`;
  }
}

/**
 * Inserts a new multi-column Row Section into the document.
 */
export function buildEmptyColumnPlaceholderHtml(isNarrow = false): string {
  const narrowClass = isNarrow ? ' arch-empty-col-narrow' : '';
  const textHtml = isNarrow
    ? ''
    : `<span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 500; color: #64748b; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: block;">No content here. Drag content from the right.</span>`;

  return `<div class="arch-empty-col-placeholder${narrowClass}" data-arch-placeholder="true" title="No content here. Drag content from the right." style="box-sizing: border-box; border: 1px dashed #cbd5e1; background-color: #f8fafc; border-radius: 0; padding: ${isNarrow ? '24px 8px' : '24px 14px'}; text-align: center; cursor: pointer; user-select: none; -webkit-user-select: none; min-height: 80px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin: 0; overflow: hidden;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="2 2" style="display: block; flex-shrink: 0;">
      <rect x="3" y="3" width="18" height="18" rx="0"></rect>
      <line x1="12" y1="8" x2="12" y2="16" stroke-dasharray="none"></line>
      <line x1="8" y1="12" x2="16" y2="12" stroke-dasharray="none"></line>
    </svg>
    ${textHtml}
  </div>`;
}

export function ensureEmptyColumnPlaceholders(root: Document | HTMLElement): void {
  const columns = root.querySelectorAll<HTMLElement>('td.column, th.column, div.column');
  columns.forEach((col) => {
    if (isGutterCell(col) || isEditorHelperNode(col)) return;

    const slot = getColumnSlotContainer(col);
    const visibleBlocks = Array.from(slot.children).filter((c) => {
      if (isEditorHelperNode(c)) return false;
      if (c.classList.contains('arch-empty-col-placeholder') || c.hasAttribute('data-arch-placeholder')) return false;
      if (isHiddenBlockElement(c as HTMLElement)) return false;
      const tag = c.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || tag === 'br') return false;
      return true;
    });

    if (visibleBlocks.length === 0) {
      const existing = slot.querySelector('.arch-empty-col-placeholder, [data-arch-placeholder="true"]');
      if (!existing) {
        const wAttr = col.getAttribute('width') || col.style?.width || '';
        const wVal = parseFloat(wAttr);
        const isNarrow = !isNaN(wVal) && wVal <= 35;
        slot.insertAdjacentHTML('beforeend', buildEmptyColumnPlaceholderHtml(isNarrow));
      }
    } else {
      slot.querySelectorAll('.arch-empty-col-placeholder, [data-arch-placeholder="true"]').forEach((el) => el.remove());
    }
  });
}

export function buildRowLayoutHtml(layout: RowLayoutType, wrapInTr: boolean): string {
  const widthsMap: Record<RowLayoutType, number[]> = {
    '1-col': [100],
    '2-col-50-50': [50, 50],
    '2-col-33-67': [33.33, 66.67],
    '2-col-67-33': [66.67, 33.33],
    '3-col': [33.33, 33.33, 33.33],
    '4-col': [25, 25, 25, 25]
  };
  const cols = widthsMap[layout] || [100];

  const colsHtml = cols
    .map(
      (w, idx) => `
      <td class="column column-${idx + 1}" width="${w}%" valign="top" style="box-sizing: border-box; padding: 0; vertical-align: top;">
        ${buildEmptyColumnPlaceholderHtml(w <= 35)}
      </td>`
    )
    .join('');

  const rowTable = `
    <table class="row" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;">
      <tbody>
        <tr>
          <td>
            <table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; color: #000000; width: 600px; margin: 0 auto; border-collapse: collapse;" width="600">
              <tbody>
                <tr>
                  ${colsHtml}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>`;

  return wrapInTr ? `<tr><td>${rowTable}</td></tr>` : rowTable;
}

/**
 * Arch Email Editor - Scoped @media Rule Migration & Responsive Style Manager
 *
 * Solves:
 * - R20: ESP templates (BeeFree, Stripo, Iterable, Pumpkin) scope mobile `@media` rules
 *        using `.row-2 .column-1 .block-2.paragraph_block` and reuse `.block-1`, `.block-2`
 *        in every row. Moving a block across rows/columns loses its mobile rules and collides
 *        with the destination row's `.block-X` rules unless migrated.
 * - R22: Supports Desktop inline styling vs Mobile `@media (max-width: 620px)` `!important` overrides.
 */

import { ViewportMode } from '../types';

let uniqueCounter = 1;

/**
 * Ensures `el` has a unique selector class (`arch-u-N`) for scoped CSS targeting.
 */
export function ensureUniqueClass(el: HTMLElement, prefix = 'arch-u'): string {
  const existing = Array.from(el.classList).find((c) => c.startsWith(`${prefix}-`));
  if (existing) return existing;
  const cls = `${prefix}-${uniqueCounter++}`;
  el.classList.add(cls);
  return cls;
}

function findAncestorWithClassPattern(el: HTMLElement | null, pattern: RegExp): { element: HTMLElement; className: string } | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const match = Array.from(cur.classList || []).find((c) => pattern.test(c));
    if (match) return { element: cur, className: match };
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Extracts flat `(selectorGroup, body, isMedia)` rules from raw CSS text,
 * properly descending into `@media(...) { ... }` blocks so the first rule inside `@media` is never skipped.
 */
function extractCssRuleEntries(cssText: string): Array<{ selectorGroup: string; body: string; isMedia: boolean }> {
  const entries: Array<{ selectorGroup: string; body: string; isMedia: boolean }> = [];
  const parseFlatRules = (chunk: string, isMedia: boolean) => {
    const flatRegex = /([^{}]+)\{([^{}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = flatRegex.exec(chunk)) !== null) {
      const sel = m[1].trim();
      const body = m[2].trim();
      if (sel && !sel.startsWith('@')) {
        entries.push({ selectorGroup: sel, body, isMedia });
      }
    }
  };

  let idx = 0;
  while (idx < cssText.length) {
    const mediaPos = cssText.indexOf('@media', idx);
    if (mediaPos === -1) {
      parseFlatRules(cssText.slice(idx), false);
      break;
    }
    if (mediaPos > idx) {
      parseFlatRules(cssText.slice(idx, mediaPos), false);
    }
    const openBrace = cssText.indexOf('{', mediaPos);
    if (openBrace === -1) break;
    let depth = 1;
    let cur = openBrace + 1;
    while (cur < cssText.length && depth > 0) {
      if (cssText[cur] === '{') depth++;
      else if (cssText[cur] === '}') depth--;
      cur++;
    }
    const innerMedia = cssText.slice(openBrace + 1, cur - 1);
    parseFlatRules(innerMedia, true);
    idx = cur;
  }

  return entries;
}

/**
 * Migrates ancestor-scoped CSS / `@media` rules when `unit` is moved or duplicated
 * into `targetContainer` (e.g. moving `.block-2` from `.row-2 .column-1` to `.row-4 .column-1`).
 */
export function migrateScopedMediaRules(unit: HTMLElement, targetContainer: HTMLElement): void {
  const doc = unit.ownerDocument;
  if (!doc || !doc.head) return;

  const oldRowInfo = findAncestorWithClassPattern(unit, /^row-\d+$/);
  const newRowInfo = findAncestorWithClassPattern(targetContainer, /^row-\d+$/);
  const oldColInfo = findAncestorWithClassPattern(unit, /^column-\d+$/);
  const newColInfo = findAncestorWithClassPattern(targetContainer, /^column-\d+$/);

  // If moving within the exact same row and column, no ancestor scope changes
  if (oldRowInfo?.element === newRowInfo?.element && oldColInfo?.element === newColInfo?.element) return;

  const oldRowClass = oldRowInfo?.className || null;
  const oldColClass = oldColInfo?.className || null;
  const blockClass = Array.from(unit.classList).find((c) => /^block-\d+$/.test(c));

  if (!oldRowClass || !blockClass) return;

  // Assign a collision-free class to `unit`
  const uniqueClass = ensureUniqueClass(unit, 'arch-u');

  // Collect matching rules from `<style>` elements that reference `.oldRowClass` and `.blockClass`
  const migratedRules: string[] = [];
  const prefixPattern = new RegExp(
    `\\.${oldRowClass}(?:\\s+\\.${oldColClass})?\\s+\\.${blockClass}(?:\\.[a-zA-Z0-9_-]+)?([^,{]*)`,
    'g'
  );

  const styleTags = Array.from(doc.querySelectorAll('style'));
  for (const styleEl of styleTags) {
    if (styleEl.id === 'arch-migrated-media-styles') continue;
    const cssText = styleEl.textContent || '';
    if (!cssText.includes(oldRowClass) || !cssText.includes(blockClass)) continue;

    const entries = extractCssRuleEntries(cssText);
    for (const entry of entries) {
      if (!entry.selectorGroup.includes(`.${oldRowClass}`) || !entry.selectorGroup.includes(`.${blockClass}`)) {
        continue;
      }

      const selectors = entry.selectorGroup.split(',').map((s) => s.trim());
      for (const sel of selectors) {
        prefixPattern.lastIndex = 0;
        const match = prefixPattern.exec(sel);
        if (match) {
          const descendantSuffix = match[1] || '';
          migratedRules.push(`.${uniqueClass}${descendantSuffix} { ${entry.body} }`);
        }
      }
    }
  }

  // Remove the old `.block-X` class from `unit` if `targetContainer` is in a different row/col
  // so destination `.row-Y .column-Z .block-X` rules cannot accidentally collide with `unit`!
  unit.classList.remove(blockClass);

  if (migratedRules.length > 0) {
    let customStyle = doc.getElementById('arch-migrated-media-styles') as HTMLStyleElement | null;
    if (!customStyle) {
      customStyle = doc.createElement('style');
      customStyle.id = 'arch-migrated-media-styles';
      doc.head.appendChild(customStyle);
    }
    const mediaBlock = `\n@media (max-width: 620px) {\n  ${migratedRules.join('\n  ')}\n}`;
    customStyle.textContent = (customStyle.textContent || '') + mediaBlock;
  }
}

/**
 * Mirrors asymmetric horizontal inline padding (`paddingLeft` <-> `paddingRight`) on an element
 * when a column moves from the left side of a card to the right side (or vice versa).
 */
function mirrorHorizontalPadding(el: HTMLElement | null): void {
  if (!el || !el.style) return;
  const pl = el.style.paddingLeft;
  const pr = el.style.paddingRight;
  if ((pl || pr) && pl !== pr) {
    el.style.paddingLeft = pr || '0px';
    el.style.paddingRight = pl || '0px';
  }
}

/**
 * Synchronizes positional classes (`.first` / `.last`), inter-column divider borders (`border-right`),
 * and outer edge padding when columns inside a 2-column or 3-column row are swapped or reordered horizontally
 * (e.g. Taskrabbit `row-5`, `row-9`, `row-11`, and 3-column `row-13`).
 */
export function syncColumnSwapStyles(colA: HTMLElement, colB: HTMLElement): void {
  if (!colA || !colB || colA.parentElement !== colB.parentElement) return;
  const parent = colA.parentElement;
  if (!parent) return;

  const cols = Array.from(parent.children).filter(
    (c) => c.classList.contains('column') || c.tagName.toLowerCase() === 'td' || c.tagName.toLowerCase() === 'th'
  ) as HTMLElement[];

  // 1. Update `.first` and `.last` positional classes to match new visual column order
  const hadFirstOrLast = cols.some((c) => c.classList.contains('first') || c.classList.contains('last'));
  if (hadFirstOrLast) {
    cols.forEach((col, i) => {
      col.classList.toggle('first', i === 0);
      col.classList.toggle('last', i === cols.length - 1);
    });
  }

  // 2. Preserve inter-column `border-right` dividers in 2-col / 3-col rows (such as Taskrabbit `row-13`
  //    where `col-1` and `col-2` have `border-right: 1px solid #0a2b14` and the last column has none)
  if (cols.length >= 2) {
    const dividerBorders = cols
      .map((c) => c.style.borderRight)
      .filter((b) => b && b !== 'none' && b !== '0px' && !b.startsWith('0px'));
    const hasEmptyRightBorder = cols.some((c) => !c.style.borderRight || c.style.borderRight === 'none' || c.style.borderRight.startsWith('0px'));
    const hasAnyLeftBorder = cols.some((c) => c.style.borderLeft && c.style.borderLeft !== 'none' && !c.style.borderLeft.startsWith('0px'));

    if (dividerBorders.length > 0 && hasEmptyRightBorder && !hasAnyLeftBorder) {
      const dividerStyle = dividerBorders[0];
      cols.forEach((col, i) => {
        col.style.borderRight = i < cols.length - 1 ? dividerStyle : '';
      });
    }
  }

  // 3. Mirror asymmetric outer card padding on the swapped columns and their `.border` inner wrappers
  if (cols.length === 2) {
    mirrorHorizontalPadding(colA);
    mirrorHorizontalPadding(colB);
    mirrorHorizontalPadding(colA.querySelector<HTMLElement>(':scope > .border'));
    mirrorHorizontalPadding(colB.querySelector<HTMLElement>(':scope > .border'));
  }
}

/**
 * Preserves contiguous bordered-card top and bottom borders (`border-top` / `border-bottom` on `table.row-content`)
 * when `table.row` sections inside a sliced card (like Taskrabbit `row-2`..`row-12`) are reordered or collapsed.
 */
export function normalizeCardGroupBorders(root: ParentNode | null): void {
  if (!root) return;
  const rows = Array.from(root.querySelectorAll<HTMLElement>('table.row')).filter(
    (r) => !r.classList.contains('row-content')
  );
  if (rows.length < 2) return;

  // Group contiguous rows whose `.row-content` has both `border-left` and `border-right`
  let group: Array<{ row: HTMLElement; content: HTMLElement }> = [];
  const flushGroup = () => {
    if (group.length >= 2) {
      let savedTopBorder = '';
      let savedBottomBorder = '';
      for (const item of group) {
        const bt = item.content.style.borderTop;
        const bb = item.content.style.borderBottom;
        if (bt && bt !== 'none' && bt !== '0px' && !savedTopBorder) {
          savedTopBorder = bt;
        }
        if (bb && bb !== 'none' && bb !== '0px' && !savedBottomBorder) {
          savedBottomBorder = bb;
        }
      }
      if (savedTopBorder || savedBottomBorder) {
        group.forEach((item, idx) => {
          if (savedTopBorder) {
            item.content.style.borderTop = idx === 0 ? savedTopBorder : '';
          }
          if (savedBottomBorder) {
            item.content.style.borderBottom = idx === group.length - 1 ? savedBottomBorder : '';
          }
        });
      }
    }
    group = [];
  };

  for (const row of rows) {
    const content = row.querySelector<HTMLElement>('table.row-content');
    const bl = content?.style.borderLeft || '';
    const br = content?.style.borderRight || '';
    if (content && bl && bl !== 'none' && bl !== '0px' && br && br !== 'none' && br !== '0px') {
      group.push({ row, content });
    } else {
      flushGroup();
    }
  }
  flushGroup();
}

/**
 * Parses a hex or `rgb(...)` color into `[r, g, b]` (`0..255`), or returns `null` if unknown/transparent.
 */
function parseColorRgb(colorStr: string | null | undefined): [number, number, number] | null {
  if (!colorStr) return null;
  const s = colorStr.trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  return null;
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function findEffectiveBackgroundRgb(el: HTMLElement | null): [number, number, number] | null {
  let cur: HTMLElement | null = el;
  while (cur && cur.tagName) {
    const bgStyle = cur.style?.backgroundColor || cur.getAttribute('bgcolor') || '';
    const rgb = parseColorRgb(bgStyle);
    if (rgb) return rgb;
    // If element has a hero background image (like Taskrabbit `row-3`), treat as dark backdrop if no bg color
    if (cur.style?.backgroundImage && cur.style.backgroundImage !== 'none') {
      return [60, 70, 80];
    }
    cur = cur.parentElement;
  }
  return [255, 255, 255];
}

/**
 * Ensures text inside `unit` never becomes invisible (e.g. white text moved onto a white card,
 * or dark-green text moved onto a dark-green banner) when moved across containers with different backgrounds.
 */
export function preserveBlockLegibilityOnMove(unit: HTMLElement, targetContainer: HTMLElement): void {
  // Never alter button text colors (buttons have their own self-contained pill background!)
  if (unit.classList.contains('button_block') || unit.querySelector('.button')) return;

  const targetBg = findEffectiveBackgroundRgb(targetContainer);
  if (!targetBg) return;
  const targetLum = getRelativeLuminance(targetBg);

  const textNodes = [
    unit,
    ...Array.from(unit.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, span, div, td, a'))
  ];

  for (const node of textNodes) {
    if (node.classList.contains('button') || node.closest('.button')) continue;
    const inlineColor = node.style?.color;
    if (!inlineColor) continue;

    const textRgb = parseColorRgb(inlineColor);
    if (!textRgb) continue;
    const textLum = getRelativeLuminance(textRgb);

    // If contrast difference in luminance is < 0.18 (e.g. white #fff on #fff/#f3f5f6, or dark #0d4635 on #0d4635)
    if (Math.abs(textLum - targetLum) < 0.18) {
      if (targetLum > 0.6) {
        // Light destination background -> use dark readable color
        node.style.color = '#0d4635';
      } else {
        // Dark destination background -> use crisp white color
        node.style.color = '#ffffff';
      }
    }
  }
}

/**
 * Applies a style property to `el` either as a desktop inline style or a mobile `@media` override (Fixes R22).
 */
export function setResponsiveStyle(
  el: HTMLElement,
  prop: string,
  value: string,
  viewport: ViewportMode = 'desktop'
): void {
  if (viewport !== 'mobile') {
    el.style.setProperty(prop, value);
    return;
  }

  const doc = el.ownerDocument;
  if (!doc || !doc.head) {
    el.style.setProperty(prop, value);
    return;
  }

  const respClass = ensureUniqueClass(el, 'arch-m');
  let styleEl = doc.getElementById('arch-responsive-styles') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'arch-responsive-styles';
    doc.head.appendChild(styleEl);
  }

  const ruleText = `@media (max-width: 620px) { .${respClass} { ${prop}: ${value} !important; } }`;
  const existing = styleEl.textContent || '';
  const propPattern = new RegExp(
    `@media\\s*\\(max-width:\\s*620px\\)\\s*\\{\\s*\\.${respClass}\\s*\\{\\s*${prop}:[^}]+\\}\\s*\\}`,
    'i'
  );

  if (propPattern.test(existing)) {
    styleEl.textContent = existing.replace(propPattern, ruleText);
  } else {
    styleEl.textContent = (existing ? existing + '\n' : '') + ruleText;
  }
}

/**
 * Toggles desktop or mobile visibility classes (`.desktop_hide`, `.mobile_hide`) on a unit.
 */
export function setUnitVisibility(
  unit: HTMLElement,
  target: 'desktop' | 'mobile',
  visible: boolean
): void {
  const doc = unit.ownerDocument;
  if ( doc && doc.head && !doc.getElementById('arch-visibility-helpers')) {
    const st = doc.createElement('style');
    st.id = 'arch-visibility-helpers';
    st.textContent = `
      .arch-hide-desktop { display: none !important; max-height: 0 !important; overflow: hidden !important; mso-hide: all !important; }
      @media (max-width: 620px) {
        .arch-hide-desktop { display: block !important; max-height: none !important; overflow: visible !important; }
        .arch-hide-mobile, .mobile_hide { display: none !important; max-height: 0 !important; overflow: hidden !important; }
      }
    `;
    doc.head.appendChild(st);
  }

  if (target === 'mobile') {
    unit.classList.toggle('mobile_hide', !visible);
    unit.classList.toggle('arch-hide-mobile', !visible);
  } else {
    unit.classList.toggle('arch-hide-desktop', !visible);
  }
}

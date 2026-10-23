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
    const cssText = styleEl.textContent || '';
    if (!cssText.includes(oldRowClass) || !cssText.includes(blockClass)) continue;

    // Search inside @media blocks or top-level rules
    const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(cssText)) !== null) {
      const selectorGroup = m[1].trim();
      const body = m[2].trim();
      if (!selectorGroup.includes(`.${oldRowClass}`) || !selectorGroup.includes(`.${blockClass}`)) {
        continue;
      }

      const selectors = selectorGroup.split(',').map((s) => s.trim());
      for (const sel of selectors) {
        prefixPattern.lastIndex = 0;
        const match = prefixPattern.exec(sel);
        if (match) {
          const descendantSuffix = match[1] || '';
          migratedRules.push(`.${uniqueClass}${descendantSuffix} { ${body} }`);
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

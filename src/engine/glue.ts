/**
 * Arch Email Editor - Three-Class Conditional Comment Engine & Gutter-Aware Unit Mover
 *
 * Solves:
 * - R8:  Handles MSO conditional comments (self-contained, single-unit wrapper envelopes,
 *        and multi-column ghost-table separator groups) + template-tag envelopes.
 * - R20: Migrates scoped `@media` rules when moving blocks across rows/columns.
 * - R21: Swaps columns around inter-column gutter cells (`<td width="20">`) and MSO
 *        separator comments (`<!--[if mso]></td><td...><![endif]-->`) without collapsing spacing.
 * - Single-Block Escalation & Hidden-Block Skipping:
 *        1. Skips `.desktop_hide` / `display: none` hidden sibling blocks so Move Up/Down
 *           always produces an immediate visual change.
 *        2. When a selected block is the only visible block inside its column/row,
 *           automatically escalates movement to its enclosing Column or Row so single-block
 *           sections (like Taskrabbit's logo, unsubscribe bar, CTA rows, and 3-column links)
 *           can always be moved and dragged!
 */

import {
  findEnclosingColumn,
  getColumnSlotContainer,
  isColumnElement,
  isEditorHelperNode,
  isGutterCell,
  isRowElement,
  isStructuralSlotWrapper,
  resolveUnit
} from './units';
import {
  migrateScopedMediaRules,
  normalizeCardGroupBorders,
  preserveBlockLegibilityOnMove,
  syncColumnSwapStyles
} from './cssScope';

export interface UnitEnvelope {
  leadingNodes: Node[];
  unit: HTMLElement;
  trailingNodes: Node[];
}

/**
 * Checks if an element is hidden via `display: none` or `.desktop_hide` (e.g. mobile-only duplicate blocks).
 */
export function isHiddenBlockElement(el: HTMLElement): boolean {
  if (el.classList.contains('desktop_hide') || el.classList.contains('arch-hide-desktop')) {
    return true;
  }
  const inlineDisplay = (el.style?.display || '').trim().toLowerCase();
  if (inlineDisplay === 'none') {
    return true;
  }
  return false;
}

/**
 * Checks if a comment node is an MSO ghost-table column separator (`</td>...<td`).
 */
export function isMsoColumnSeparatorComment(node: Node): boolean {
  if (node.nodeType !== 8) return false;
  const val = node.nodeValue || '';
  return /<\/td>[\s\S]*?<td\b/i.test(val);
}

/**
 * Checks if a comment node opens a wrapper (MSO ghost table opener, downlevel-revealed opener, or template block opener).
 */
export function isEnvelopeOpenerComment(node: Node): boolean {
  if (node.nodeType !== 8) return false;
  const val = (node.nodeValue || '').trim();
  if (isMsoColumnSeparatorComment(node)) return false;

  if (/^\[if\b[^\]]*\]><!--$/i.test(val)) return true;

  if (/^\[if\b/i.test(val)) {
    const opensTable = /<table\b/i.test(val) && !/<\/table>/i.test(val);
    const opensTr = /<tr\b/i.test(val) && !/<\/tr>/i.test(val);
    const opensTd = /<td\b/i.test(val) && !/<\/td>/i.test(val);
    if (opensTable || opensTr || opensTd) return true;
  }

  return false;
}

/**
 * Checks if a comment node closes a wrapper (MSO ghost table closer or downlevel-revealed closer).
 */
export function isEnvelopeCloserComment(node: Node): boolean {
  if (node.nodeType !== 8) return false;
  const val = (node.nodeValue || '').trim();
  if (isMsoColumnSeparatorComment(node)) return false;

  if (/^<!\[endif\]$/i.test(val)) return true;

  if (/\[if\b/i.test(val)) {
    const closesTable = /<\/table>/i.test(val) && !/<table\b/i.test(val);
    const closesTr = /<\/tr>/i.test(val) && !/<tr\b/i.test(val);
    const closesTd = /<\/td>/i.test(val) && !/<td\b/i.test(val);
    if (closesTable || closesTr || closesTd) return true;
  }

  return false;
}

/**
 * Collects the atomic `UnitEnvelope` (`[leadingComments, unit, trailingComments]`)
 * for a single unit when a balanced opener comment immediately precedes `unit`
 * and a balanced closer comment immediately follows `unit`.
 */
export function collectUnitEnvelope(unit: HTMLElement): UnitEnvelope {
  const leadingNodes: Node[] = [];
  const trailingNodes: Node[] = [];

  const tempLeading: Node[] = [];
  let prev = unit.previousSibling;
  let foundOpener = false;
  while (prev) {
    if (prev.nodeType === 3 && !(prev.nodeValue || '').trim()) {
      tempLeading.unshift(prev);
      prev = prev.previousSibling;
      continue;
    }
    if (isEnvelopeOpenerComment(prev)) {
      tempLeading.unshift(prev);
      foundOpener = true;
    }
    break;
  }

  const tempTrailing: Node[] = [];
  let next = unit.nextSibling;
  let foundCloser = false;
  while (next) {
    if (next.nodeType === 3 && !(next.nodeValue || '').trim()) {
      tempTrailing.push(next);
      next = next.nextSibling;
      continue;
    }
    if (isEnvelopeCloserComment(next)) {
      tempTrailing.push(next);
      foundCloser = true;
    }
    break;
  }

  if (foundOpener && foundCloser) {
    leadingNodes.push(...tempLeading);
    trailingNodes.push(...tempTrailing);
  }

  // Group responsive twin siblings (`.mobile_hide` immediately paired with `.desktop_hide` of the same tag)
  // so moving, duplicating, or deleting a heading in Taskrabbit `row-9`/`row-11` moves its mobile twin in lockstep!
  if (unit.classList?.contains('mobile_hide') || unit.classList?.contains('arch-hide-mobile')) {
    const twinTrail: Node[] = [];
    let cur = (trailingNodes.length > 0 ? trailingNodes[trailingNodes.length - 1] : unit).nextSibling;
    while (cur) {
      if (cur.nodeType === 3 && !(cur.nodeValue || '').trim()) {
        twinTrail.push(cur);
        cur = cur.nextSibling;
        continue;
      }
      if (
        cur.nodeType === 1 &&
        (cur as HTMLElement).tagName === unit.tagName &&
        isHiddenBlockElement(cur as HTMLElement)
      ) {
        twinTrail.push(cur);
        trailingNodes.push(...twinTrail);
      }
      break;
    }
  }

  return { leadingNodes, unit, trailingNodes };
}

/**
 * Returns all nodes belonging to a `UnitEnvelope` in document order.
 */
export function getEnvelopeNodes(env: UnitEnvelope): Node[] {
  return [...env.leadingNodes, env.unit, ...env.trailingNodes];
}

/**
 * Returns the ordered list of visible moveable sibling units inside `unit.parentElement`,
 * skipping gutter cells (`<td width="20">`), hidden `.desktop_hide` blocks, and editor elements.
 */
export function getMoveableSiblings(unit: HTMLElement): HTMLElement[] {
  const parent = unit.parentElement;
  if (!parent) return [unit];

  const siblings: HTMLElement[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i] as HTMLElement;
    const tag = child.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script' || tag === 'meta' || tag === 'link' || tag === 'br') {
      continue;
    }
    if (isEditorHelperNode(child)) continue;
    if (isGutterCell(child) && child !== unit) continue;
    // Skip hidden `display: none` / `.desktop_hide` duplicate blocks so Move Up/Down always moves visibly
    if (isHiddenBlockElement(child) && child !== unit) continue;
    siblings.push(child);
  }
  return siblings;
}

/**
 * Resolves the effective moveable unit for `unit`.
 * If `unit` has visible siblings in its own parent container (`peers.length > 1`), returns `unit`.
 * If `unit` is the ONLY visible block in its container (`peers.length <= 1`), climbs up to the
 * nearest enclosing Column (in a multi-column row) or Row (in a multi-row email) that has
 * multiple siblings so single-block sections and columns are always moveable!
 */
export function resolveEffectiveMoveUnit(unit: HTMLElement): HTMLElement {
  const directPeers = getMoveableSiblings(unit);
  if (directPeers.length > 1) {
    return unit;
  }

  // If `unit` is an inner leaf (`<a>`, `<img>`, `<p>`, `<h1>`) inside a Block (`table.*_block`),
  // check if that enclosing Block has sibling Blocks in its Column first!
  const blockUnit = resolveUnit(unit);
  if (blockUnit && blockUnit !== unit) {
    const blockPeers = getMoveableSiblings(blockUnit);
    if (blockPeers.length > 1) {
      return blockUnit;
    }
  }

  let cursor: HTMLElement | null = unit.parentElement;
  while (cursor && cursor.tagName && cursor.tagName.toLowerCase() !== 'body' && cursor.tagName.toLowerCase() !== 'html') {
    const cTag = cursor.tagName.toLowerCase();
    const isTableRowInMultiRowBody =
      cTag === 'tr' &&
      (cursor.parentElement?.tagName.toLowerCase() === 'tbody' ||
        cursor.parentElement?.tagName.toLowerCase() === 'table') &&
      !cursor.closest('table.row');
    if (isColumnElement(cursor) || isRowElement(cursor) || isTableRowInMultiRowBody) {
      const peers = getMoveableSiblings(cursor);
      if (peers.length > 1) {
        return cursor;
      }
    }
    cursor = cursor.parentElement;
  }

  return unit;
}

/**
 * Checks whether `unit` (or its escalated single-child Column/Row) can move in `direction` (`up`/`down`).
 */
export function canMoveUnit(unit: HTMLElement, direction: 'up' | 'down'): boolean {
  const effective = resolveEffectiveMoveUnit(unit);
  const peers = getMoveableSiblings(effective);
  const idx = peers.indexOf(effective);
  if (idx === -1) return false;
  return direction === 'up' ? idx > 0 : idx < peers.length - 1;
}

/**
 * Swaps two `UnitEnvelope`s in place inside the same parent container,
 * preserving any intervening gutter cells (`<td width="20">`) or MSO ghost-table separator comments!
 */
export function swapEnvelopesInPlace(envA: UnitEnvelope, envB: UnitEnvelope): void {
  const parent = envA.unit.parentNode;
  if (!parent || parent !== envB.unit.parentNode) return;

  const doc = envA.unit.ownerDocument;
  if (!doc) return;

  const markerA = doc.createComment('arch-swap-a');
  const markerB = doc.createComment('arch-swap-b');

  const nodesA = getEnvelopeNodes(envA);
  const nodesB = getEnvelopeNodes(envB);

  parent.insertBefore(markerA, nodesA[0]);
  parent.insertBefore(markerB, nodesB[0]);

  for (const n of nodesB) {
    parent.insertBefore(n, markerA);
  }
  for (const n of nodesA) {
    parent.insertBefore(n, markerB);
  }

  markerA.remove();
  markerB.remove();
}

/**
 * Moves `unit` (or its escalated single-child Column/Row) up/left (`'up'`) or down/right (`'down'`).
 * Preserves MSO conditional envelopes, template-tag envelopes, inter-column gutter cells,
 * column `.first`/`.last` positional classes, and bordered-card top/bottom caps.
 */
export function moveUnit(unit: HTMLElement, direction: 'up' | 'down'): boolean {
  const effective = resolveEffectiveMoveUnit(unit);
  const peers = getMoveableSiblings(effective);
  const idx = peers.indexOf(effective);
  if (idx === -1) return false;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= peers.length) return false;

  const targetPeer = peers[targetIdx];
  const envUnit = collectUnitEnvelope(effective);
  const envPeer = collectUnitEnvelope(targetPeer);

  swapEnvelopesInPlace(envUnit, envPeer);

  if (isColumnElement(effective) && isColumnElement(targetPeer)) {
    syncColumnSwapStyles(effective, targetPeer);
  } else if (isRowElement(effective)) {
    normalizeCardGroupBorders(effective.ownerDocument?.body || effective.parentElement);
  }

  return true;
}

/**
 * Given a `draggedUnit` and a hovered DOM element `rawTarget`, resolves the best compatible
 * structural drop target unit:
 * - If `draggedUnit` (or its effective unit) is a Row, resolves to the enclosing Row of `rawTarget`.
 * - If `draggedUnit` is a Column, resolves to the enclosing Column of `rawTarget`.
 * - Otherwise resolves to the hovered Block unit or Column Slot (allowing cross-row and cross-column block drops!).
 */
export function resolveCompatibleDropTarget(
  draggedUnit: HTMLElement,
  rawTarget: HTMLElement
): HTMLElement | null {
  if (!rawTarget || !rawTarget.tagName) return null;
  const tag = rawTarget.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html') return null;

  // 1. If explicitly dragging a Row (`table.row`), target the hovered Row
  if (isRowElement(draggedUnit)) {
    const effectiveRow = resolveEffectiveMoveUnit(draggedUnit);
    if (effectiveRow.tagName.toLowerCase() === 'tr' && effectiveRow.parentElement) {
      let cur: HTMLElement | null = rawTarget;
      while (cur && cur.parentElement && cur.parentElement !== effectiveRow.parentElement) {
        cur = cur.parentElement;
      }
      if (cur && cur.parentElement === effectiveRow.parentElement && cur !== effectiveRow) {
        return cur;
      }
    }
    const targetRow = rawTarget.closest<HTMLElement>('table.row, section') || resolveUnit(rawTarget);
    if (targetRow && targetRow !== draggedUnit && !draggedUnit.contains(targetRow)) {
      return targetRow;
    }
    return null;
  }

  // 1b. If dragging a `<tr>` row inside a multi-row `<tbody>`/`<table>` (e.g. Default Template or 2-Column Sample),
  //     always resolve `rawTarget` to the sibling `<tr>` in that same `<tbody>` (even when hovering nested button/grid tables).
  if (draggedUnit.tagName.toLowerCase() === 'tr' && draggedUnit.parentElement) {
    let cur: HTMLElement | null = rawTarget;
    while (cur && cur.parentElement && cur.parentElement !== draggedUnit.parentElement) {
      cur = cur.parentElement;
    }
    if (cur && cur.parentElement === draggedUnit.parentElement && cur !== draggedUnit) {
      return cur;
    }
  }

  // 2. If explicitly dragging a Column (`td.column` or multi-cell `<td>`), target a sibling/peer Column
  if (isColumnElement(draggedUnit)) {
    const targetCol = findEnclosingColumn(rawTarget) || resolveUnit(rawTarget);
    if (targetCol && targetCol !== draggedUnit && !draggedUnit.contains(targetCol) && isColumnElement(targetCol)) {
      return targetCol;
    }
    // If cursor is on the row padding between columns in the same row, pick the sibling column
    const enclosingRow = draggedUnit.closest('table.row, section');
    if (enclosingRow && enclosingRow.contains(rawTarget)) {
      const siblingCols = getMoveableSiblings(draggedUnit).filter((c) => c !== draggedUnit);
      if (siblingCols.length === 1) return siblingCols[0];
    }
    return null;
  }

  // 3. Dragging a Block (`table.*_block`, `tr`, `div`, `p`, `a`, etc.)
  // If `draggedUnit` (or its effective move unit) is a Column of a multi-column row, and the user hovers
  // over a sibling Column in the SAME row, resolve to that sibling Column so dragging swaps/reorders the Columns!
  const effectiveForDrag = resolveEffectiveMoveUnit(draggedUnit);
  if (isColumnElement(effectiveForDrag)) {
    const hoveredCol = findEnclosingColumn(rawTarget);
    if (hoveredCol && hoveredCol !== effectiveForDrag && hoveredCol.parentElement === effectiveForDrag.parentElement) {
      return hoveredCol;
    }
  }

  const targetBlock = resolveUnit(rawTarget);

  // If the user hovered over empty padding of a Column (`td.column`) or `<div class="border">`,
  // resolve to the last visible block inside `getColumnSlotContainer(col)`, or the Column itself if empty!
  if (isColumnElement(targetBlock) || isStructuralSlotWrapper(targetBlock)) {
    const slot = getColumnSlotContainer(targetBlock);
    const children = Array.from(slot.children).filter(
      (c) => !isEditorHelperNode(c) && !isHiddenBlockElement(c as HTMLElement)
    ) as HTMLElement[];
    if (children.length > 0) {
      const candidate = children[children.length - 1];
      if (candidate !== draggedUnit && !draggedUnit.contains(candidate)) {
        return candidate;
      }
    }
    return targetBlock;
  }

  // If the user hovered over empty padding of a Row (`table.row`),
  // find the last visible block inside that Row's slot container!
  if (isRowElement(targetBlock)) {
    const effectiveDragged = resolveEffectiveMoveUnit(draggedUnit);
    if (isRowElement(effectiveDragged) && effectiveDragged !== targetBlock) {
      return targetBlock;
    }
    const innerBlocks = Array.from(
      targetBlock.querySelectorAll<HTMLElement>(
        'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block, table.list_block'
      )
    ).filter((b) => !isHiddenBlockElement(b));
    if (innerBlocks.length > 0) {
      return innerBlocks[innerBlocks.length - 1];
    }
  }

  if (targetBlock && targetBlock !== draggedUnit && !draggedUnit.contains(targetBlock)) {
    return targetBlock;
  }

  return null;
}

/**
 * Moves `sourceUnit` before or after `targetUnit` (supporting both same-container and cross-container moves).
 */
export function moveUnitToTarget(
  sourceUnit: HTMLElement,
  targetUnit: HTMLElement,
  position: 'before' | 'after'
): boolean {
  if (!sourceUnit || !targetUnit || sourceUnit === targetUnit) return false;

  // If sourceUnit is a Row (e.g., a multi-column `<tr>` or `table.row` wrapped in `<tr><td>`) and targetUnit is a `<tr>` in `<tbody>`,
  // escalate sourceUnit to its enclosing `<tr>` sibling so they reorder at the `<tbody>` level.
  if (isRowElement(sourceUnit) && sourceUnit.parentElement !== targetUnit.parentElement) {
    const effSource = resolveEffectiveMoveUnit(sourceUnit);
    if (effSource.parentElement && effSource.parentElement === targetUnit.parentElement) {
      sourceUnit = effSource;
    }
  }

  // If targetUnit is a Row (`table.row`) and sourceUnit is a Block inside another Row,
  // check if sourceUnit is the sole block of its Row -> move the entire Row!
  if (isRowElement(targetUnit) && !isRowElement(sourceUnit)) {
    const effective = resolveEffectiveMoveUnit(sourceUnit);
    if (isRowElement(effective)) {
      sourceUnit = effective;
    }
  }

  // If sourceUnit is the sole block (or inner leaf `<a>`) inside a Column of a multi-column row and targetUnit is in a sibling Column
  // of the SAME row (or targetUnit is that sibling Column), escalate both to Column so they swap/reorder cleanly as Columns!
  if (!isRowElement(sourceUnit) && !isColumnElement(sourceUnit)) {
    const effectiveSource = resolveEffectiveMoveUnit(sourceUnit);
    if (isColumnElement(effectiveSource)) {
      const targetCol = isColumnElement(targetUnit) ? targetUnit : findEnclosingColumn(targetUnit);
      if (targetCol && targetCol !== effectiveSource && targetCol.parentElement === effectiveSource.parentElement) {
        sourceUnit = effectiveSource;
        targetUnit = targetCol;
      }
    }
  }

  // If sourceUnit is a Column and targetUnit is a Block/Leaf inside a sibling Column, escalate targetUnit to that Column!
  if (isColumnElement(sourceUnit) && !isColumnElement(targetUnit)) {
    const targetCol = findEnclosingColumn(targetUnit);
    if (targetCol && targetCol !== sourceUnit) {
      targetUnit = targetCol;
    }
  }

  // If sourceUnit is an inner leaf (`<a>`, `<img>`, `<p>`, `<h1>`) inside a Block and targetUnit is another Block,
  // escalate sourceUnit to its enclosing Block so we never detach an `<a>` from its `<td>` wrapper!
  const sourceBlock = resolveUnit(sourceUnit);
  if (sourceBlock && sourceBlock !== sourceUnit && sourceUnit.parentElement !== targetUnit.parentElement) {
    sourceUnit = sourceBlock;
  }

  // If sourceUnit is a Block and targetUnit resolved to a Column or Structural Slot Wrapper (`div.border`),
  // redirect targetUnit to the last/first child inside `getColumnSlotContainer(targetUnit)` (or append into slot if empty!)
  if (!isRowElement(sourceUnit) && !isColumnElement(sourceUnit) && (isColumnElement(targetUnit) || isStructuralSlotWrapper(targetUnit))) {
    const slot = getColumnSlotContainer(targetUnit);
    const slotChildren = Array.from(slot.children).filter(
      (c) => !isEditorHelperNode(c) && !isHiddenBlockElement(c as HTMLElement)
    ) as HTMLElement[];
    if (slotChildren.length > 0) {
      targetUnit = position === 'before' ? slotChildren[0] : slotChildren[slotChildren.length - 1];
    } else {
      const oldRow = sourceUnit.closest<HTMLElement>('table.row');
      migrateScopedMediaRules(sourceUnit, slot);
      preserveBlockLegibilityOnMove(sourceUnit, slot);
      const envSource = collectUnitEnvelope(sourceUnit);
      for (const n of getEnvelopeNodes(envSource)) {
        slot.appendChild(n);
      }
      cleanupEmptiedSourceRow(oldRow);
      normalizeCardGroupBorders(slot.ownerDocument?.body || null);
      return true;
    }
  }

  if (sourceUnit === targetUnit) return false;
  if (sourceUnit.contains(targetUnit) || targetUnit.contains(sourceUnit)) return false;

  const sourceParent = sourceUnit.parentElement;
  const targetParent = targetUnit.parentElement;
  if (!sourceParent || !targetParent) return false;

  // Same parent container: reorder directly
  if (sourceParent === targetParent) {
    const envSource = collectUnitEnvelope(sourceUnit);
    const envTarget = collectUnitEnvelope(targetUnit);

    const peers = getMoveableSiblings(sourceUnit);
    const sIdx = peers.indexOf(sourceUnit);
    const tIdx = peers.indexOf(targetUnit);

    // Adjacent sibling swap (covers 2-column swaps, adjacent 3-column swaps, adjacent row swaps, and adjacent block swaps
    // regardless of whether the cursor was in the first 50% or second 50% of `targetUnit`!)
    if (sIdx !== -1 && tIdx !== -1 && Math.abs(sIdx - tIdx) === 1) {
      swapEnvelopesInPlace(envSource, envTarget);
      if (isColumnElement(sourceUnit) && isColumnElement(targetUnit)) {
        syncColumnSwapStyles(sourceUnit, targetUnit);
      } else if (isRowElement(sourceUnit)) {
        normalizeCardGroupBorders(sourceUnit.ownerDocument?.body || targetParent);
      }
      return true;
    }

    // For non-adjacent siblings in the same container (e.g. moving Column 1 to Column 3 or Column 3 to Column 1 in a 3-column row),
    // place `sourceUnit` at `targetUnit`'s position (`after` when moving rightward/downward, `before` when moving leftward/upward)!
    const effectivePosition =
      sIdx !== -1 && tIdx !== -1 ? (sIdx < tIdx ? 'after' : 'before') : position;

    const sourceNodes = getEnvelopeNodes(envSource);
    const targetNodes = getEnvelopeNodes(envTarget);
    const refNode =
      effectivePosition === 'before'
        ? targetNodes[0]
        : targetNodes[targetNodes.length - 1].nextSibling;

    for (const n of sourceNodes) {
      targetParent.insertBefore(n, refNode);
    }

    if (isColumnElement(sourceUnit) && isColumnElement(targetUnit)) {
      syncColumnSwapStyles(sourceUnit, targetUnit);
    } else if (isRowElement(sourceUnit)) {
      normalizeCardGroupBorders(sourceUnit.ownerDocument?.body || targetParent);
    }
    return true;
  }

  // Cross-container move (e.g. moving a Block from Column 1 to Column 2 or Row 3 to Row 4)
  const oldEnclosingRow = !isRowElement(sourceUnit) ? sourceUnit.closest<HTMLElement>('table.row') : null;
  const envSource = collectUnitEnvelope(sourceUnit);

  // 1. Migrate any ancestor-scoped @media CSS rules before moving (Fixes R20)
  //    Also migrate rules for any paired responsive twin inside `envSource.trailingNodes`!
  migrateScopedMediaRules(sourceUnit, targetParent);
  for (const n of envSource.trailingNodes) {
    if (n.nodeType === 1) {
      migrateScopedMediaRules(n as HTMLElement, targetParent);
    }
  }

  // 2. Preserve text legibility when moving between dark and light sections
  preserveBlockLegibilityOnMove(sourceUnit, targetParent);

  // 3. Ensure HTML content-model compatibility between sourceUnit and targetParent
  const adaptedUnit = adaptUnitForContainer(sourceUnit, targetParent);
  const envTarget = collectUnitEnvelope(targetUnit);
  const targetNodes = getEnvelopeNodes(envTarget);
  const refNode =
    position === 'before'
      ? targetNodes[0]
      : targetNodes[targetNodes.length - 1].nextSibling;

  if (adaptedUnit === sourceUnit) {
    for (const n of getEnvelopeNodes(envSource)) {
      targetParent.insertBefore(n, refNode);
    }
  } else {
    targetParent.insertBefore(adaptedUnit, refNode);
    removeEnvelope(envSource);
  }

  // 4. If moving a Block across rows left the old `table.row` completely empty of blocks, collapse it cleanly
  //    and normalize any card-group top/bottom borders!
  if (oldEnclosingRow && oldEnclosingRow !== targetParent.closest('table.row')) {
    cleanupEmptiedSourceRow(oldEnclosingRow);
  }
  normalizeCardGroupBorders(targetParent.ownerDocument?.body || targetParent);

  return true;
}

/**
 * If a `table.row` had its last block moved out into another row, removes the emptied `table.row` shell
 * so no dead empty padding/border gap remains behind.
 */
function cleanupEmptiedSourceRow(rowEl: HTMLElement | null): void {
  if (!rowEl || !rowEl.parentElement) return;
  const remainingBlocks = rowEl.querySelectorAll(
    'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block, table.list_block, img, p, h1, h2, h3, h4, h5, h6, ul, ol, hr, a'
  );
  if (remainingBlocks.length === 0 && (rowEl.textContent || '').trim().length === 0) {
    const env = collectUnitEnvelope(rowEl);
    removeEnvelope(env);
  }
}

/**
 * Adapts `unit` when moving between containers with different HTML content models
 * (e.g., `<tr>` from a `<tbody>` into a `<td>`/`<div>` column, or a block into a `<tbody>`),
 * and ensures responsive `max-width: 100%` on images so narrow columns never overflow.
 */
function adaptUnitForContainer(unit: HTMLElement, targetContainer: HTMLElement): HTMLElement {
  const doc = unit.ownerDocument;
  if (!doc) return unit;

  // Ensure any image inside `unit` scales fluidly inside narrower columns
  const imgs = unit.tagName.toLowerCase() === 'img' ? [unit] : Array.from(unit.querySelectorAll<HTMLElement>('img'));
  for (const img of imgs) {
    if (!img.style.maxWidth) {
      img.style.maxWidth = '100%';
    }
    if (!img.style.height) {
      img.style.height = 'auto';
    }
  }

  const uTag = unit.tagName.toLowerCase();
  const cTag = targetContainer.tagName.toLowerCase();

  // Case 1: Target container is `<tbody>` or `<table>` (requires `<tr>` child)
  if ((cTag === 'tbody' || cTag === 'table') && uTag !== 'tr') {
    const tr = doc.createElement('tr');
    const td = doc.createElement('td');
    td.appendChild(unit.cloneNode(true));
    tr.appendChild(td);
    return tr;
  }

  // Case 2: Source unit is `<tr>`, but target container is `<td>`, `<th>`, or `<div>`
  if (uTag === 'tr' && (cTag === 'td' || cTag === 'th' || cTag === 'div' || cTag === 'section' || cTag === 'body')) {
    const table = doc.createElement('table');
    table.setAttribute('width', '100%');
    table.setAttribute('border', '0');
    table.setAttribute('cellpadding', '0');
    table.setAttribute('cellspacing', '0');
    table.setAttribute('role', 'presentation');
    const tbody = doc.createElement('tbody');
    tbody.appendChild(unit.cloneNode(true));
    table.appendChild(tbody);
    return table;
  }

  return unit;
}

/**
 * Duplicates `unit` (and its MSO/template envelope) immediately after itself.
 */
export function duplicateUnit(unit: HTMLElement): HTMLElement | null {
  const parent = unit.parentElement;
  if (!parent) return null;

  const env = collectUnitEnvelope(unit);
  const nodes = getEnvelopeNodes(env);
  const afterRef = nodes[nodes.length - 1].nextSibling;

  let clonedUnit: HTMLElement | null = null;
  for (const n of nodes) {
    const clone = n.cloneNode(true);
    if (n === unit) {
      clonedUnit = clone as HTMLElement;
      if (clonedUnit.hasAttribute('id')) {
        clonedUnit.removeAttribute('id');
      }
      clonedUnit.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    }
    parent.insertBefore(clone, afterRef);
  }

  return clonedUnit;
}

/**
 * Removes an envelope cleanly from the DOM.
 */
export function removeEnvelope(env: UnitEnvelope): void {
  for (const n of getEnvelopeNodes(env)) {
    if (n.parentNode) {
      n.parentNode.removeChild(n);
    }
  }
}

/**
 * Removes `unit` and its paired envelope comments (plus any orphaned gutter cell if `unit` is a column).
 */
export function removeUnit(unit: HTMLElement): void {
  const parent = unit.parentElement;
  if (!parent) return;

  if (isColumnElement(unit)) {
    const nextEl = unit.nextElementSibling as HTMLElement | null;
    const prevEl = unit.previousElementSibling as HTMLElement | null;
    if (nextEl && isGutterCell(nextEl)) {
      nextEl.remove();
    } else if (prevEl && isGutterCell(prevEl)) {
      prevEl.remove();
    }
  }

  const env = collectUnitEnvelope(unit);
  removeEnvelope(env);
}

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

import { isEditorHelperNode, isGutterCell, isColumnElement, isRowElement, resolveUnit } from './units';
import { migrateScopedMediaRules } from './cssScope';

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

  let cursor: HTMLElement | null = unit.parentElement;
  while (cursor && cursor.tagName && cursor.tagName.toLowerCase() !== 'body' && cursor.tagName.toLowerCase() !== 'html') {
    if (isColumnElement(cursor) || isRowElement(cursor)) {
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
 * Preserves MSO conditional envelopes, template-tag envelopes, and inter-column gutter cells.
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
  return true;
}

/**
 * Given a `draggedUnit` and a hovered DOM element `rawTarget`, resolves the best compatible
 * structural drop target unit:
 * - If `draggedUnit` (or its effective unit) is a Row, resolves to the enclosing Row of `rawTarget`.
 * - If `draggedUnit` is a Column, resolves to the enclosing Column of `rawTarget`.
 * - Otherwise resolves to the hovered Block unit (allowing cross-row and cross-column block drops!).
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
    const targetRow = rawTarget.closest<HTMLElement>('table.row, section') || resolveUnit(rawTarget);
    if (targetRow && targetRow !== draggedUnit && !draggedUnit.contains(targetRow)) {
      return targetRow;
    }
    return null;
  }

  // 2. If explicitly dragging a Column (`td.column`), target a sibling/peer Column
  if (isColumnElement(draggedUnit)) {
    const targetCol = rawTarget.closest<HTMLElement>('td.column, th.column, div.column') || resolveUnit(rawTarget);
    if (targetCol && targetCol !== draggedUnit && !draggedUnit.contains(targetCol)) {
      return targetCol;
    }
    return null;
  }

  // 3. Dragging a Block (`table.*_block`, `tr`, `div`, `p`, etc.)
  const targetBlock = resolveUnit(rawTarget);

  // If the user hovered over empty padding of a Row (`table.row`) or Column (`td.column`),
  // find the last block inside that Row/Column or if dragging between single-block rows, match the Row!
  if (isRowElement(targetBlock)) {
    const effectiveDragged = resolveEffectiveMoveUnit(draggedUnit);
    if (isRowElement(effectiveDragged) && effectiveDragged !== targetBlock) {
      return targetBlock;
    }
    const innerBlocks = targetBlock.querySelectorAll<HTMLElement>(
      'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block'
    );
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

  // If targetUnit is a Row (`table.row`) and sourceUnit is a Block inside another Row,
  // check if sourceUnit is the sole block of its Row -> move the entire Row!
  if (isRowElement(targetUnit) && !isRowElement(sourceUnit)) {
    const effective = resolveEffectiveMoveUnit(sourceUnit);
    if (isRowElement(effective)) {
      sourceUnit = effective;
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
    if (Math.abs(sIdx - tIdx) === 1 && isColumnElement(sourceUnit)) {
      swapEnvelopesInPlace(envSource, envTarget);
      return true;
    }

    const sourceNodes = getEnvelopeNodes(envSource);
    const targetNodes = getEnvelopeNodes(envTarget);
    const refNode =
      position === 'before'
        ? targetNodes[0]
        : targetNodes[targetNodes.length - 1].nextSibling;

    for (const n of sourceNodes) {
      targetParent.insertBefore(n, refNode);
    }
    return true;
  }

  // Cross-container move (e.g. moving a Block from Column 1 to Column 2 or Row 3 to Row 4)
  // 1. Migrate any ancestor-scoped @media CSS rules before moving (Fixes R20)
  migrateScopedMediaRules(sourceUnit, targetParent);

  // 2. Ensure HTML content-model compatibility between sourceUnit and targetParent
  const adaptedUnit = adaptUnitForContainer(sourceUnit, targetParent);
  const envTarget = collectUnitEnvelope(targetUnit);
  const targetNodes = getEnvelopeNodes(envTarget);
  const refNode =
    position === 'before'
      ? targetNodes[0]
      : targetNodes[targetNodes.length - 1].nextSibling;

  if (adaptedUnit === sourceUnit) {
    const envSource = collectUnitEnvelope(sourceUnit);
    for (const n of getEnvelopeNodes(envSource)) {
      targetParent.insertBefore(n, refNode);
    }
  } else {
    const envSource = collectUnitEnvelope(sourceUnit);
    targetParent.insertBefore(adaptedUnit, refNode);
    removeEnvelope(envSource);
  }

  return true;
}

/**
 * Adapts `unit` when moving between containers with different HTML content models
 * (e.g., `<tr>` from a `<tbody>` into a `<td>`/`<div>` column, or a block into a `<tbody>`).
 */
function adaptUnitForContainer(unit: HTMLElement, targetContainer: HTMLElement): HTMLElement {
  const doc = unit.ownerDocument;
  if (!doc) return unit;

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

# Single-Cell Row Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow palette blocks and existing canvas blocks to be dropped inside an unmarked single-cell `<tr>` without changing the table structure.

**Architecture:** Add drop-specific recognition for an unmarked single-content-cell `<td>`/`<th>` without changing general column classification. Use that shared recognition in target resolution, canvas insertion, and existing-block movement, while preserving before/after placement on a hovered block and appending when the pointer targets empty cell space.

**Tech Stack:** TypeScript, DOM APIs, Vitest, jsdom.

## Global Constraints

- The cell remains in its original row; the drop must not create a sibling row or insert content beside the row.
- Existing multi-column and explicitly marked column behavior remains unchanged.
- Cells inside known block tables and outer structural wrapper cells (including the cell containing `.row-content`) are not treated as single-cell drop slots. An unmarked content cell inside `.row-content` may be a drop slot.
- Do not change row ordering, row nesting, selected-unit escalation, or the general definition of `isColumnElement`.

---

### Task 1: Resolve and move blocks into single-cell slots

**Files:**
- Modify: `src/engine/units.ts`
- Modify: `src/engine/glue.ts`
- Test: `tests/layout-engine.test.ts`

**Interfaces:**
- Produces: `findSingleCellDropSlot(target: HTMLElement): HTMLElement | null`, returning the eligible single-cell `<td>`/`<th>` ancestor or `null`.
- Consumes: Existing `resolveUnit`, `isGutterCell`, `isColumnElement`, `moveUnitToTarget`, and `resolveCompatibleDropTarget`.

- [ ] **Step 1: Add failing regressions for target resolution and canvas moves**

In `tests/layout-engine.test.ts`, extend the existing import from `../src/engine/glue` to include `resolveCompatibleDropTarget`, then add tests using the fixture below. The `<td>` inside each `.row-content` is intentionally unmarked:

```ts
const html = `<!DOCTYPE html><html><body>
  <table class="row"><tbody><tr><td>
    <table class="row-content"><tbody><tr><td id="empty-slot"></td></tr></tbody></table>
  </td></tr></tbody></table>
  <table class="row"><tbody><tr><td>
    <table class="row-content"><tbody><tr><td id="populated-slot">
      <table class="heading_block" id="existing"><tbody><tr><td><h2>Existing</h2></td></tr></tbody></table>
    </td></tr></tbody></table>
  </td></tr></tbody></table>
  <table class="row"><tbody><tr><td class="column">
    <table class="text_block" id="source"><tbody><tr><td><p>Move me</p></td></tr></tbody></table>
  </td></tr></tbody></table>
  <table class="row"><tbody><tr><td class="column">
    <table class="text_block" id="source-empty"><tbody><tr><td><p>Move me too</p></td></tr></tbody></table>
  </td></tr></tbody></table>
</body></html>`;
```

The test body should parse the fixture and exercise both target paths:

```ts
const doc = new DOMParser().parseFromString(html, 'text/html');
const emptySlot = doc.querySelector('#empty-slot') as HTMLElement;
const populatedSlot = doc.querySelector('#populated-slot') as HTMLElement;
const sourceEmpty = doc.querySelector('#source-empty') as HTMLElement;
const source = doc.querySelector('#source') as HTMLElement;
const existing = doc.querySelector('#existing') as HTMLElement;

const emptyTarget = resolveCompatibleDropTarget(sourceEmpty, emptySlot, true);
expect(emptyTarget).toBe(emptySlot);
if (!emptyTarget) throw new Error('Expected the empty cell to resolve as a drop slot');
expect(moveUnitToTarget(sourceEmpty, emptyTarget, 'after', true)).toBe(true);
expect(emptySlot.contains(sourceEmpty)).toBe(true);

const populatedTarget = resolveCompatibleDropTarget(source, existing, true);
expect(populatedTarget).toBe(existing);
if (!populatedTarget) throw new Error('Expected the hovered block to remain the target');
expect(moveUnitToTarget(source, populatedTarget, 'after', true)).toBe(true);
expect(existing.nextElementSibling).toBe(source);
expect(populatedSlot.contains(source)).toBe(true);

const innerBlockCell = existing.querySelector('td') as HTMLElement;
expect(resolveCompatibleDropTarget(sourceEmpty, innerBlockCell, true)).toBe(existing);
const outerWrapperCell = emptySlot.closest('table.row-content')?.parentElement as HTMLElement;
expect(resolveCompatibleDropTarget(sourceEmpty, outerWrapperCell, true)).not.toBe(outerWrapperCell);
expect(emptySlot.closest('table.row-content')?.querySelectorAll(':scope > tbody > tr')).toHaveLength(1);
expect(populatedSlot.closest('table.row-content')?.querySelectorAll(':scope > tbody > tr')).toHaveLength(1);
```

- [ ] **Step 2: Run the focused regression and confirm it fails**

Run from `G:\projects\cms_pro\features\custom_email_editor\arch-email-editor`:

```powershell
npm test -- tests/layout-engine.test.ts -t "single-cell"
```

Expected: the new target-resolution and move assertions fail because the unmarked target cell currently resolves to an enclosing row instead of a content slot.

- [ ] **Step 3: Implement drop-specific slot recognition**

In `src/engine/units.ts`, add `findSingleCellDropSlot` next to `findEnclosingColumn` and import it into `src/engine/glue.ts`. Walk from `target` through its ancestors and return the first cell that meets all these conditions:

```ts
const tag = current.tagName.toLowerCase();
const isCell = tag === 'td' || tag === 'th';
const cells = current.parentElement
  ? Array.from(current.parentElement.children).filter((child) => {
      const childTag = child.tagName.toLowerCase();
      return (childTag === 'td' || childTag === 'th') && !isGutterCell(child as HTMLElement);
    })
  : [];
```

The candidate must be a direct child of a `<tr>`, be the only non-gutter cell in that row, not be a gutter or already-recognized column, not be inside an `ESP_BLOCK_SELECTOR` table, and not contain a descendant `table.row-content`. Return `null` if no candidate qualifies. Do not change `isColumnElement`.

- [ ] **Step 4: Use the slot in shared drop-target resolution and move insertion**

In `src/engine/glue.ts`, after resolving `targetBlock`, preserve the hovered block when it is inside the eligible cell; otherwise return the eligible cell as the drop target:

```ts
const singleCellSlot = findSingleCellDropSlot(rawTarget);
if (singleCellSlot && (targetBlock === singleCellSlot || !singleCellSlot.contains(targetBlock))) {
  return singleCellSlot;
}
```

Extend the existing column/structural-slot insertion branch in `moveUnitToTarget` to also accept `findSingleCellDropSlot(targetUnit) === targetUnit`. For a single-cell slot, use `targetUnit` itself as the insertion container; for existing columns and structural wrappers, continue using `getColumnSlotContainer`. Preserve the existing empty-slot append, populated-slot before/after selection, adaptation, and envelope handling.

- [ ] **Step 5: Re-run the focused regressions**

Run:

```powershell
npm test -- tests/layout-engine.test.ts -t "single-cell"
```

Expected: the new resolver and move tests pass, including the guard that block-table cells are not selected as drop slots.

- [ ] **Step 6: Commit the shared-resolution change**

```powershell
git add src/engine/units.ts src/engine/glue.ts tests/layout-engine.test.ts
git commit -m "fix(drag): resolve single-cell row drop slots" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Insert palette blocks into single-cell slots

**Files:**
- Modify: `src/components/Canvas.ts`
- Test: `tests/editor.test.ts`

**Interfaces:**
- Consumes: `findSingleCellDropSlot(target: HTMLElement): HTMLElement | null` from Task 1.
- Produces: Palette drops resolved to an existing single-cell `<td>` insert the generated block inside that cell.

- [ ] **Step 1: Add a failing palette-drop regression**

Add a test in `tests/editor.test.ts` that imports an email containing a `.row-content` table with an unmarked one-cell `<tr>`. Import `resolveCompatibleDropTarget` from `../src/engine/glue` only if the test uses it; the palette target path should instead be exercised through `canvas.updateDropTargetForElement`. Use this test body after creating the editor:

```ts
editor.importHTML(`<!DOCTYPE html><html><body>
  <table class="row"><tbody><tr><td>
    <table class="row-content"><tbody>
      <tr><td id="empty-cell"></td></tr>
      <tr><td id="populated-cell">
        <table class="heading_block" id="existing-heading"><tbody><tr><td><h2>Existing</h2></td></tr></tbody></table>
      </td></tr>
    </tbody></table>
  </td></tr></tbody></table>
</body></html>`);

const canvas = (editor as any).canvas;
const doc = canvas.iframe.contentDocument as Document;
const emptyCell = doc.querySelector('#empty-cell') as HTMLElement;
const populatedCell = doc.querySelector('#populated-cell') as HTMLElement;
const existingHeading = doc.querySelector('#existing-heading') as HTMLElement;

canvas.updateDropTargetForElement(emptyCell, 0, 1);
canvas.executeDrop('text');
const emptyCellBlock = emptyCell.querySelector(':scope > table.text_block') as HTMLElement;
expect(emptyCellBlock).toBeTruthy();

canvas.updateDropTargetForElement(existingHeading, 0, -1);
canvas.executeDrop('text');
const beforeBlock = existingHeading.previousElementSibling as HTMLElement;
expect(beforeBlock.matches('table.text_block')).toBe(true);

canvas.updateDropTargetForElement(existingHeading, 0, 1);
canvas.executeDrop('text');
const afterBlock = existingHeading.nextElementSibling as HTMLElement;
expect(afterBlock.matches('table.text_block')).toBe(true);

expect(populatedCell.contains(beforeBlock)).toBe(true);
expect(populatedCell.contains(afterBlock)).toBe(true);
expect(emptyCell.closest('tr')?.children).toHaveLength(1);
expect(populatedCell.closest('tr')?.children).toHaveLength(1);
```

Destroy the editor at the end of the test. The assertions ensure both the empty-cell append and populated-cell before/after paths remain inside the original cells.

- [ ] **Step 2: Run the palette regression and confirm it fails**

Run:

```powershell
npm test -- tests/editor.test.ts -t "single-cell"
```

Expected: the empty-cell case does not insert inside the target cell until the palette insertion path recognizes it as a slot.

- [ ] **Step 3: Route palette insertion through the shared slot path**

In `src/components/Canvas.ts`, import `findSingleCellDropSlot` from `../engine/units`. In `Canvas.updateDropTargetForElement`, use the eligible cell for palette drops only when the ordinary resolved target is outside the cell. Keep a resolved block inside the cell as the target so pointer placement remains relative to that block:

```ts
const singleCellSlot = findSingleCellDropSlot(rawTarget);
let targetUnit = effectiveDragged
  ? resolveCompatibleDropTarget(effectiveDragged, rawTarget, preserveSourceUnit)
  : this.findMoveableUnit(rawTarget);

if (!effectiveDragged && singleCellSlot && !singleCellSlot.contains(targetUnit)) {
  targetUnit = singleCellSlot;
}
```

Then in `Canvas.insertBlock`, extend the existing column branch to recognize a single-cell slot, retaining the current column slot behavior:

```ts
} else if (isColumnElement(refUnit) || findSingleCellDropSlot(refUnit) === refUnit) {
  const slot = isColumnElement(refUnit) ? getColumnSlotContainer(refUnit) : refUnit;
  slot.querySelectorAll('.arch-empty-col-placeholder, [data-arch-placeholder]').forEach((p) => p.remove());
  const snippet = buildContextAwareBlockHtml(type, slot.tagName.toLowerCase());
  const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
  slot.insertAdjacentHTML(insertPosition, snippet);
  insertedEl =
    position === 'before' ? (slot.firstElementChild as HTMLElement) : (slot.lastElementChild as HTMLElement);
}
```

Keep the existing placeholder branch first, and preserve the ordinary sibling-insertion branch for non-slot targets.

- [ ] **Step 4: Re-run palette, layout, and editor tests**

Run:

```powershell
npm test -- tests/editor.test.ts tests/layout-engine.test.ts
```

Expected: all selected tests pass, and the palette insertion tests verify that content stays inside the original cell.

- [ ] **Step 5: Commit palette insertion support**

```powershell
git add src/components/Canvas.ts tests/editor.test.ts
git commit -m "fix(canvas): insert palette blocks into single-cell rows" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Verify the full library behavior

**Files:**
- No additional files; run the repository's configured checks.

**Interfaces:**
- Consumes: The shared target-resolution and palette-insertion behavior from Tasks 1 and 2.
- Produces: Verified build and full test results without changing unrelated files.

- [ ] **Step 1: Run the library build**

Run:

```powershell
npm run build
```

Expected: Vite build and TypeScript declaration generation complete successfully.

- [ ] **Step 2: Run the full library suite**

Run:

```powershell
npm test
```

Expected: all Vitest tests pass, including existing row-nesting, selected-unit dragging, column, and palette insertion regressions.

- [ ] **Step 3: Review the final diff**

Run:

```powershell
git status --short
git diff --check
git diff -- src/engine/units.ts src/engine/glue.ts src/components/Canvas.ts tests/layout-engine.test.ts tests/editor.test.ts
```

Expected: only the scoped implementation and regression tests are present, with no whitespace errors. Do not push unless requested.

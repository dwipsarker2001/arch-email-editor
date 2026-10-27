# Nested Row Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow dragging an intact row into the column under the pointer inside another row.

**Architecture:** Keep the selected row as the source unit through pointer drag. Resolve a row dropped over another row's content to the hovered block or column slot, then insert the whole source row within that slot. Reuse existing envelope movement and slot helpers so block, column, palette, and keyboard behavior remains unchanged.

**Tech Stack:** TypeScript, Vitest, jsdom.

## Global Constraints

- Dropping a selected row on another row nests the intact source row inside the column under the pointer. Insert it before or after the hovered block, or at the end of the column when dropped on empty space.
- A row cannot be dropped into itself or one of its descendants.
- Other move interactions, including Move Up/Down, retain their existing single-child escalation behavior.
- Existing structural safeguards in cross-container moves remain in place so email table markup stays valid.

---

### Task 1: Nest a selected row in the hovered column

**Files:**
- Modify: `src/engine/glue.ts`
- Test: `tests/layout-engine.test.ts`

**Interfaces:**
- `resolveCompatibleDropTarget(draggedUnit, rawTarget, preserveSourceUnit?)` resolves row drops over another row's content to the hovered block or column slot, not the enclosing row.
- `moveUnitToTarget(sourceUnit, targetUnit, position, preserveSourceUnit?)` inserts the intact row into the target column slot and rejects self/descendant drops.

- [x] **Step 1: Add a failing pointer-drop regression**

Add this test in the `Figma vertical displacement` describe block in `tests/layout-engine.test.ts`:

```typescript
it('nests a dragged row in the column under the pointer', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = new ArchEmailEditor(container);
  editor.importHTML(`<div id="source-host">
    <table class="row" id="source-row"><tbody><tr>
      <td class="column"><table class="paragraph_block"><tbody><tr><td><p>Source</p></td></tr></tbody></table></td>
    </tr></tbody></table>
  </div>
  <div id="target-host">
    <table class="row" id="target-row"><tbody><tr>
      <td class="column" id="target-column"><table class="paragraph_block" id="target-block"><tbody><tr><td><p>Target</p></td></tr></tbody></table></td>
    </tr></tbody></table>
  </div>`);

  const doc = (container.querySelector('iframe.arch-canvas-iframe') as HTMLIFrameElement).contentDocument!;
  const sourceRow = doc.querySelector('#source-row') as HTMLElement;
  const targetRow = doc.querySelector('#target-row') as HTMLElement;
  const targetColumn = doc.querySelector('#target-column') as HTMLElement;
  const targetContent = targetColumn.querySelector('p') as HTMLElement;
  const canvas = (editor as any).canvas;

  sourceRow.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  sourceRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
  canvas.handlePointerDragMove(10, 30);
  canvas.updateDropTargetForElement(targetContent, 10, 10);
  expect(canvas.hoveredDropTarget).not.toBe(targetRow);

  canvas.finishPointerDrag();
  expect(targetColumn.contains(sourceRow)).toBe(true);
  expect(targetRow.contains(sourceRow)).toBe(true);
  expect(sourceRow.querySelector('p')!.textContent).toBe('Source');
  editor.destroy();
});
```

- [x] **Step 2: Run the regression and confirm it fails for sibling placement**

Run: `npx vitest run tests/layout-engine.test.ts -t "nests a dragged row in the column under the pointer"`

Expected: FAIL because row target resolution selects the enclosing row and the committed source remains outside the target column.

- [x] **Step 3: Resolve row drops to hovered content or the column slot**

In the row-specific branch of `resolveCompatibleDropTarget`, when the raw target is inside a column not contained by the dragged row, resolve the raw target with the existing unit helpers and return that block or column slot. Keep self/descendant targets invalid and preserve existing row handling when there is no eligible destination column.

- [x] **Step 4: Insert a row into a target column slot**

In `moveUnitToTarget`, handle a row source targeting a column or structural slot wrapper. For a populated slot, use the resolved block and existing envelope-aware before/after insertion. For an empty slot, append the source envelope to `getColumnSlotContainer(targetUnit)`, adapting a `<tr>` source with `adaptUnitForContainer` when needed. Preserve the existing containment guard so a row cannot be inserted into itself or a descendant.

- [x] **Step 5: Run the regression and related tests**

Run: `npx vitest run tests/layout-engine.test.ts tests/editor.test.ts`

Expected: all selected-row, block-drag, layout, and editor tests pass.

- [x] **Step 6: Run the library build and full test suite**

Run: `npm run build`

Expected: Vite build and TypeScript declaration generation complete successfully.

Run: `npm test`

Expected: all library tests pass.

- [x] **Step 7: Review the final change**

Run: `git diff --check; git status --short; git diff --stat`

Expected: only the row-drop implementation and its regression test are changed for this task; no generated `dist` files are included.

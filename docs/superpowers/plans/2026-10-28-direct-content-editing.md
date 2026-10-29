# Direct Canvas Content Editing and Moving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one click on nested text enter inline editing, select images on one click, and let users drag text by its nearest movable parent with a text-host fallback.

**Architecture:** Add direct-content click handling to `Canvas.handleIframeClick` before structural hierarchy resolution. Reuse existing editable-host, inline-edit, image-selection, inspector, and custom pointer-drag paths. Add a parent-overlay move handle positioned at the right edge of the selected text frame; ordinary text gestures remain dedicated to editing and text selection.

**Tech Stack:** TypeScript, DOM APIs, Vitest, Vite.

## Global Constraints

- A single click on text selects its editable text host and immediately enters inline text-edit mode, placing the caret at the click when possible.
- A single click on an image selects the image and displays its image inspector controls. It does not open the crop editor automatically.
- Clicks on empty layout areas and structural containers retain the current hierarchy selection behavior.
- Read-only mode remains non-editable.
- Once text editing has started, normal browser caret placement and double-click word selection continue to work.
- A text move handle drags the nearest movable structural parent; when no structural parent exists, it drags the text host.
- The selection outline and move handle position match the exact unit the handle will drag; while editing, do not outline the text leaf as the move target.
- Ordinary clicks and drags on text are not intercepted by the move handle.
- Use the existing editable-host lookup, text-edit entry, image selection, inspector update, and custom pointer-drag paths. Preserve the selection model for non-content areas.

---

## File Structure

- `src\components\Canvas.ts` — Add direct text and image handling in the iframe click handler and the text move handle; keep the existing fallback hierarchy logic.
- `src\style.css` — Style the accessible move handle in the parent overlay.
- `tests\layout-engine.test.ts` — Update text/image interaction and pointer-drag setup tests that currently assume content clicks select a parent row first.
- `tests\editor.test.ts` — Assert that a text click in read-only mode does not enter inline editing.

## Task 1: Enter Inline Editing on a Text Click

**Files:**
- Modify: `tests\layout-engine.test.ts` — replace the old multi-double-click text drill-down expectations and preserve structural selection and drag-unit tests.
- Modify: `tests\editor.test.ts` — extend the existing read-only interaction test.
- Modify: `src\components\Canvas.ts` — direct content handling inside `handleIframeClick`.

**Interfaces:**
- Consumes: `findEditableTextHost(target)`, `findMoveableUnit(host)`, `enterTextEditMode(host, moveUnit, clickCoords)`, and existing selection callbacks.
- Produces: A single click on an editable text host selects it and enters inline text editing; clicks on structural whitespace still follow the hierarchy selection path.

- [ ] **Step 1: Change the text interaction test first**

In the existing nested text fixtures, replace the expectation that a paragraph click selects the row with:

```ts
p.dispatchEvent(new MouseEvent('click', {
  bubbles: true,
  detail: 1,
  clientX: 24,
  clientY: 18
}));
expect(canvas.isEditingText).toBe(true);
expect(p.classList.contains('arch-editing-text')).toBe(true);
expect(ifrDoc.querySelector('.arch-selected-element')).toBe(p);
expect(overlay.querySelector('.arch-selection-overlay')).toBeNull();
```

Add `const canvas = (editor as any).canvas` where the nested-text test does not already define it. Use the overlay assertion only in the Figma model test, which already has an `overlay` variable. Then double-click `p` and assert editing remains active; dispatch Escape and assert editing ends. Finally, click the text block's padding `<td>` and assert the row is selected. Update the duplicate Figma model test to retain its hover assertions, verify that a paragraph click immediately selects and edits the paragraph, and verify that double-clicking while editing leaves editing active; remove its old row-to-block-to-paragraph drill-down assertions.

Update the button/link text interaction test to expect one click on `.btn-label` to select and edit its editable label; remove its obsolete row/column drill-down assertions while keeping its programmatic move/swap assertions. Keep the existing caret-range mock and move click-coordinate assertions into that single-click path in the menu-link text test; double-click while editing must not drill into a parent. Update the bottom-action test's single-click target expectation and geometry to match the selected paragraph instead of the row. For pointer-drag tests whose setup clicks a paragraph only to select its row, click the row itself before starting the drag; keep those tests focused on their row/block drag behavior. In the existing read-only test in `tests\editor.test.ts`, click an `h1` with `detail: 1` and assert it does not gain `.arch-editing-text`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/layout-engine.test.ts tests/editor.test.ts`

Expected: The nested text interaction test fails because a single click selects the row and `canvas.isEditingText` remains false. The revised button and menu-link tests also fail until direct text handling is implemented.

- [ ] **Step 3: Add direct text-host handling**

In `Canvas.handleIframeClick`, after the existing body/background and modifier-click handling but before `getContainerChain`, handle only a host containing the click target. Do not search downward from a clicked structural container, so clicks on padding do not start text editing:

```ts
const textHost = target.closest<HTMLElement>('[contenteditable="true"]');
if (!this.readOnly && textHost) {
  this.exitTextEditMode();
  const moveUnit = this.findMoveableUnit(textHost);
  this.enterTextEditMode(textHost, moveUnit, {
    clientX: e.clientX,
    clientY: e.clientY
  });
  return;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- tests/layout-engine.test.ts tests/editor.test.ts`

Expected: The revised text test passes; text starts editing on one click, Escape exits, and padding clicks still select the row.

- [ ] **Step 5: Commit the text interaction**

```powershell
git add -- src\components\Canvas.ts tests\layout-engine.test.ts tests\editor.test.ts
git commit -m "fix(canvas): edit text on single click" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Select Nested Images on a Single Click

**Files:**
- Modify: `tests\layout-engine.test.ts` — update linked-image, social-image, and image-inspector assertions that currently depend on row-first clicks.
- Modify: `src\components\Canvas.ts` — add direct image selection next to direct text handling.

**Interfaces:**
- Consumes: `Canvas.selectUnit(image, image)`, which publishes selected-element information to the inspector and renders the existing image selection controls.
- Produces: A single click on an image at any nesting depth selects that image and shows image controls; link navigation remains prevented.

- [ ] **Step 1: Change image-click tests first**

In the existing linked-image click test, keep the cancelable click and navigation assertion, but assert that the selected element is the clicked image and that the image resize handle is present:

```ts
const clickEv = new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  detail: 1
});
img.dispatchEvent(clickEv);
expect(clickEv.defaultPrevented).toBe(true);
expect(ifrDoc.querySelector('.arch-selected-element')).toBe(img);
expect(container.querySelector('.arch-resize-handle--se')).toBeTruthy();
expect(container.querySelector('#inp-img-width')).toBeTruthy();
```

In the social-image interaction test, replace the row-first selection assertion with an assertion that the clicked nested image is selected. Then click its containing icon table to select that structural drag unit before starting the drag assertions; this keeps the drag test focused on icon movement while separately verifying direct image selection.

In the linked-image test, remove the old three-double-click row/block/link/image drill-down assertions; the first click now selects the image and exposes its controls. In the social-image test, remove the row/column/icon double-click drill-down expectations and retain the complete drag/drop assertions. Change the linked-image inspector and image-padding tests to use `detail: 1` so they exercise real single-click routing. In the nested-image inspector test, assert that the image controls appear from the first click.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/layout-engine.test.ts`

Expected: The linked-image and social-image tests fail because a single click selects the outer row rather than the image.

- [ ] **Step 3: Add direct image selection**

Before the text-host branch and before structural hierarchy resolution in `Canvas.handleIframeClick`, select an image click target directly. Image handling must precede text-host handling so an image inside an editable ancestor still selects the image:

```ts
const image = target.closest<HTMLImageElement>('img');
if (image) {
  this.exitTextEditMode();
  this.selectUnit(image, image);
  return;
}
```

- [ ] **Step 4: Run the focused canvas tests**

Run: `npm test -- tests/layout-engine.test.ts`

Expected: The linked-image and social-image tests pass, including link prevention and existing drag assertions.

- [ ] **Step 5: Commit the image interaction**

```powershell
git add -- src\components\Canvas.ts tests\layout-engine.test.ts
git commit -m "fix(canvas): select images on single click" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Add Parent-First Text Drag Handle

**Files:**
- Modify: `tests\layout-engine.test.ts` — verify the move handle appears during text editing and targets the correct unit.
- Modify: `src\components\Canvas.ts` — create, position, and clean up the accessible move handle; initialize the existing pointer-drag candidate from it.
- Modify: `src\style.css` — style the handle and its grab/grabbing states.

**Interfaces:**
- Consumes: `findMoveableUnit(host)`, `resolveEffectiveMoveUnit(unit)`, `pointerDragCandidate`, `handlePointerDragMove`, and `positionFloatingToolbar`.
- Produces: An `HTMLButtonElement` with class `arch-canvas-move-handle`, `aria-label="Drag to move text parent"`, and `title="Drag to move text parent"`. Its pointer-down sets the existing drag candidate's `unit` to the nearest effective structural parent, or to the host when that host has no structural parent.

- [ ] **Step 1: Add a nested-parent drag-handle test**

In the nested text interaction test, after the single click enters edit mode, assert that the handle exists, start a drag from it, and verify that the candidate uses the text block rather than the paragraph:

```ts
const moveHandle = overlay.querySelector<HTMLButtonElement>('.arch-canvas-move-handle');
expect(moveHandle).toBeTruthy();
moveHandle!.dispatchEvent(new MouseEvent('mousedown', {
  bubbles: true,
  cancelable: true,
  button: 0,
  clientX: 40,
  clientY: 20
}));
expect((canvas as any).pointerDragCandidate.unit).toBe(ifrDoc.querySelector('.text_block'));
window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
```

In a separate test, import a standalone `<p>` directly under `<body>`, assert that `canvas.findMoveableUnit(p)` returns `p`, and dispatch the same single click followed by handle `mousedown`. Assert that the candidate unit is the paragraph. Also assert that read-only text has no move handle. This exercises the real resolver and click path without mocks.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/layout-engine.test.ts`

Expected: The new assertions fail because no `.arch-canvas-move-handle` is rendered.

- [ ] **Step 3: Add the move handle to the parent overlay**

Add a `private moveHandle: HTMLButtonElement | null = null` field. In `renderFloatingToolbar`, after resolving `editableHost`, create the handle only when an editable text host is directly selected or `this.isEditingText` is true; do not show it for a structural-container-only selection. Use a labeled button and keep it available while the selection tint is hidden during text editing:

```ts
const moveHandle = document.createElement('button');
moveHandle.type = 'button';
moveHandle.className = 'arch-canvas-move-handle';
moveHandle.textContent = '+';
moveHandle.setAttribute('aria-label', 'Drag to move text parent');
moveHandle.title = 'Drag to move text parent';
moveHandle.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 0 || this.readOnly) return;
  e.preventDefault();
  e.stopPropagation();
  const parentUnit = this.findMoveableUnit(editableHost);
  const dragUnit = parentUnit === editableHost
    ? editableHost
    : resolveEffectiveMoveUnit(parentUnit);
  this.pointerDragCandidate = {
    unit: dragUnit,
    startTarget: editableHost,
    startX: e.clientX,
    startY: e.clientY,
    active: false
  };
});
this.overlayLayer.appendChild(moveHandle);
this.moveHandle = moveHandle;
```

When positioning overlays, use the same resolved drag unit for the selection outline and handle. Place the handle at the vertical center of that unit, aligned to its right edge, and clamp its position inside `containerRect`. Keep the coordinates in the parent document's viewport space so they match the existing `window` pointer listeners. Remove the text host's inline editing outline so it cannot be mistaken for the move target. Set the handle position to `absolute`.

- [ ] **Step 4: Style and clean up the handle**

Add these rules beside `.arch-selection-overlay` in `src\style.css`, matching the existing purple canvas controls:

```css
.arch-canvas-move-handle {
  position: absolute;
  z-index: 10000;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: #7747ff;
  color: #fff;
  cursor: grab;
  pointer-events: auto;
  line-height: 1;
}

.arch-canvas-move-handle:active {
  cursor: grabbing;
}
```

In `removeFloatingToolbar`, remove `moveHandle` and set the field to `null`. Confirm the handle remains visible during text editing, is absent in read-only mode, and is recreated after the existing toolbar refresh path.

- [ ] **Step 5: Run the focused canvas tests**

Run: `npm test -- tests/layout-engine.test.ts`

Expected: The nested fixture starts a drag candidate for `.text_block`; the no-parent fixture starts a drag candidate for the text host; existing drag tests still pass.

- [ ] **Step 6: Commit the move handle**

```powershell
git add -- src\components\Canvas.ts src\style.css tests\layout-engine.test.ts
git commit -m "feat(canvas): add parent text move handle" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Verify the Complete Canvas Interaction

**Files:**
- Test: `tests\layout-engine.test.ts`
- Test: `tests\editor.test.ts`

**Interfaces:**
- Consumes: The direct content click and move-handle behavior from Tasks 1-3.
- Produces: Verified text editing, image selection, parent-first dragging, fallback dragging, and preserved structural/read-only behavior.

- [ ] **Step 1: Run the focused interaction tests**

Run: `npm test -- tests/layout-engine.test.ts tests/editor.test.ts`

Expected: Both test files pass.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: Vitest reports all tests passing.

- [ ] **Step 3: Build the production package**

Run: `npm run build`

Expected: Vite bundling and TypeScript declaration generation complete successfully.

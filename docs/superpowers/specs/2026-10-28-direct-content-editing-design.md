# Direct Canvas Content Editing and Moving

## Goal

Make nested text directly editable with one click, make images directly selectable, and provide a reliable way to move text without accidentally moving only its text leaf.

## Design

Handle content clicks before the canvas's existing structural hierarchy selection logic:

- A single click on text selects its editable text host and immediately enters inline text-edit mode, placing the caret at the click when possible.
- A single click on an image selects the image and displays its image inspector controls. It does not open the crop editor automatically.
- Clicks on empty layout areas and structural containers retain the current hierarchy selection behavior.
- Read-only mode remains non-editable.
- Once text editing has started, normal browser caret placement and double-click word selection continue to work.

Show an outline around the same unit the text move handle will move, not just around the text leaf. Place a visible, accessible "+" move handle on that outlined frame's right edge. Dragging this handle moves the nearest movable structural parent. If no movable parent exists, outline and move the text host itself. Start this drag only from the handle so ordinary text clicks and drags remain available for caret placement, text selection, and editing.

Use the existing editable-host lookup, text-edit entry, image selection, inspector update, and custom pointer-drag paths where possible. Do not change the selection model for non-content areas.

## Validation

Update focused canvas interaction tests to verify that one click on deeply nested text enters edit mode and selects its text host; the move handle targets the nearest movable parent and falls back to the text host when no parent exists; and one click on a nested image selects it and shows image inspector controls. Preserve coverage for structural container selection, read-only behavior, caret placement, and text word selection. Run focused tests, the full test suite, and the production build.

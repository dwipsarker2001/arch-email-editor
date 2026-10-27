# Selected Unit Drag Design

## Goal

Dragging a selected item in the email canvas moves that selected Figma hierarchy unit, not an enclosing table cell, column, or row.

## Behavior

- Pointer dragging preserves the current selection depth: a selected block moves as a block, while an explicitly selected column or row moves as that container.
- Pointer-drag target resolution must not automatically promote a selected single-child block to its enclosing column or row.
- Dropping a selected row on another row nests the intact source row inside the column under the pointer. Insert it before or after the hovered block, or at the end of the column when dropped on empty space.
- A row cannot be dropped into itself or one of its descendants.
- Other move interactions, including Move Up/Down, retain their existing single-child escalation behavior.
- Existing structural safeguards in cross-container moves remain in place so email table markup stays valid.

## Implementation Scope

Update the pointer-drag flow in `src/components/Canvas.ts` to preserve the selected unit through drag activation and target preview. Adjust shared drop logic so row drops resolve to the hovered column slot and commit the intact row there.

Add regressions for dragging a selected single-child block and nesting a selected row into the column under the pointer. Verify the block moves without moving its enclosing cell or row, and the intact source row becomes a child of the target column. Keep existing column, palette-drop, and keyboard-move behavior unchanged.

## Validation

Run the focused drag regression test, the relevant layout/editor tests, and the library build.

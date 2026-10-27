# Selected Unit Drag Design

## Goal

Dragging a selected item in the email canvas moves that selected Figma hierarchy unit, not an enclosing table cell, column, or row.

## Behavior

- Pointer dragging preserves the current selection depth: a selected block moves as a block, while an explicitly selected column or row moves as that container.
- Pointer-drag target resolution must not automatically promote a selected single-child block to its enclosing column or row.
- Dropping a selected row on another row inserts it before or after the target at the target's parent level; rows must never be nested inside another row's cells.
- Other move interactions, including Move Up/Down, retain their existing single-child escalation behavior.
- Existing structural safeguards in cross-container moves remain in place so email table markup stays valid.

## Implementation Scope

Update the pointer-drag flow in `src/components/Canvas.ts` to preserve the selected unit through drag activation and target preview. Adjust shared drop logic so row drops resolve to the target row and are committed at its parent level, never inside its cells.

Add regressions for dragging a selected single-child block and reordering a selected row over another row. Verify the block moves without moving its enclosing cell or row, and rows remain siblings after a drop. Keep existing column, palette-drop, and keyboard-move behavior unchanged.

## Validation

Run the focused drag regression test, the relevant layout/editor tests, and the library build.

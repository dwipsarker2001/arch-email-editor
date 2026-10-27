# Selected Unit Drag Design

## Goal

Dragging a selected item in the email canvas moves that selected Figma hierarchy unit, not an enclosing table cell, column, or row.

## Behavior

- Pointer dragging preserves the current selection depth: a selected block moves as a block, while an explicitly selected column or row moves as that container.
- Pointer-drag target resolution must not automatically promote a selected single-child block to its enclosing column or row.
- Other move interactions, including Move Up/Down, retain their existing single-child escalation behavior.
- Existing structural safeguards in cross-container moves remain in place so email table markup stays valid.

## Implementation Scope

Update the pointer-drag flow in `src/components/Canvas.ts` to preserve the selected unit through drag activation and target preview. Adjust shared drop logic only if a regression test proves it overrides the selected unit in the reported scenario.

Add a regression test for dragging a selected single-child block and verify the block moves without moving its enclosing cell or row. Keep existing row, column, palette-drop, and keyboard-move behavior unchanged.

## Validation

Run the focused drag regression test, the relevant layout/editor tests, and the library build.

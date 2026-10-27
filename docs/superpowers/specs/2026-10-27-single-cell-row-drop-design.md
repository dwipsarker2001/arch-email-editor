# Single-Cell Row Drop Design

## Goal

Allow users to drop a palette block or move an existing canvas block into a `<tr>` whose single content `<td>` is not explicitly marked as a column.

## Behavior

- Dropping on existing content inserts before or after that content, inside the single content cell.
- Dropping on empty space in the cell appends the block inside that cell.
- The cell remains in its original row; the drop must not create a sibling row or insert content beside the row.
- Existing multi-column and explicitly marked column behavior remains unchanged.
- Cells inside known block tables and outer structural wrapper cells (including the cell containing `.row-content`) are not treated as single-cell drop slots. An unmarked content cell inside `.row-content` may be a drop slot.

## Design

Use drop-specific recognition for an unmarked, single-content-cell row instead of globally changing column classification. Resolve the cell as the drop slot for both palette and canvas drag target paths. Reuse the existing insertion and move operations so content-model adaptation, selection, and structure-change handling remain consistent.

The slot check must exclude gutter cells, known ESP block tables, and structural wrapper cells (including the outer cell that contains `.row-content`). The unmarked cell within `.row-content` remains eligible when it is the content cell for a one-cell row. Hovering a block within a qualifying cell retains the existing before/after placement behavior; hovering the cell's empty area resolves to the cell slot itself.

## Implementation Scope

Update shared drop-target resolution and the canvas insertion path so palette blocks and existing movable blocks use the same single-cell slot rules. Do not change row ordering, row nesting, selected-unit escalation, or the general definition of `isColumnElement`.

Add regressions for a palette block dropped into a single-cell row and an existing canvas block moved into that row. Cover placement relative to existing content and empty-cell insertion, and verify that the inserted block remains inside the original `<td>` without changing the enclosing row structure. Include a guard for cells inside known block or structural wrapper tables.

## Validation

Run the focused drop tests, the related layout/editor tests, the library build, and the full library test suite.

# Direct Canvas Content Editing

## Goal

Make text and images directly editable/selectable with one click, regardless of how deeply they are nested in the email layout.

## Design

Handle clicks on text and images before the canvas's existing structural hierarchy selection logic:

- A single click on text selects its editable text host and immediately enters inline text-edit mode, placing the caret at the click when possible.
- A single click on an image selects the image and displays its image inspector controls. It does not open the crop editor automatically.
- Clicks on empty layout areas and structural containers retain the current hierarchy selection behavior.
- Read-only mode remains non-editable.
- Once text editing has started, normal browser caret placement and double-click word selection continue to work.

Use the existing editable-host lookup, text-edit entry, image selection, and inspector update paths. Avoid changing drag behavior or the selection model for non-content areas.

## Validation

Update the focused canvas interaction test to verify that one click on deeply nested text enters edit mode and selects its text host. Add coverage that one click on a nested image selects the image and shows image inspector controls. Preserve coverage for structural container selection, read-only behavior, and text word selection. Run the focused tests, the full test suite, and the production build.

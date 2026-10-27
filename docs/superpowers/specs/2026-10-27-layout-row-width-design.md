# Layout Row Width Design

## Goal

Adding a two-, three-, or four-column row from the content tabs must not widen the existing email template.

## Behavior

- A newly inserted multi-column row inherits the nearest relevant template `.row-content` width and alignment instead of always using a fixed 600px width.
- Existing column proportions remain unchanged.
- If no template content width can be found, retain the current 600px default.
- Existing rows and templates are not resized as a side effect of insertion.

## Implementation Scope

Update row-layout generation and insertion so the insertion path supplies the nearest target template's content width. Keep the existing default behavior for callers without an inherited width. Add regression coverage for insertion into a narrower template and for fallback behavior when no target width is available.

## Validation

Run the focused row-layout tests, related editor/layout tests, the library build, and the full library test suite.

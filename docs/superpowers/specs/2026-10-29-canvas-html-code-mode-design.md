# Canvas HTML Code Mode

## Goal

Let users inspect and edit the current email's HTML directly in the canvas, then switch back to the rendered design preview.

## Design

Add a `</>` Code button with a Lucide code icon to the existing vertical canvas toolbar. The canvas alternates between Preview and Code modes using that same button:

- In Preview mode, clicking Code replaces the preview with a full-size, light-themed HTML editor populated with the latest email HTML.
- In Code mode, clicking Preview applies the editor contents to the email and restores the rendered canvas.
- The button's accessible name and title describe the mode it will switch to.
- Read-only editors may inspect HTML but cannot apply edits.

Use CodeMirror 6 with HTML language support, a light theme, line numbers, indentation, and standard keyboard editing. Add only the CodeMirror packages required for HTML editing; do not use Monaco, whose editor workers and larger bundle are unnecessary for this focused feature. A dedicated modal or right-sidebar editor is not used because neither provides the requested full-canvas mode toggle.

## Data Flow

Canvas exposes callbacks to retrieve current HTML and apply edited HTML. The editor wires these to its existing `getHTML()` and `importHTML()` methods. CodeMirror loads the current HTML when entering Code mode. `importHTML()` remains the single application path so sanitization, rendering, change events, and undo/history behavior remain consistent.

Switching from Code back to Preview applies the draft and returns to Preview. Switching from Preview to Code reads the current serialized canvas again, so later Code sessions start with current markup. Closing is not a separate operation; the toggle back to Preview is the apply action.

## Error and Read-Only Behavior

Imported markup continues through the existing sanitizer and HTML parser. Read-only mode configures CodeMirror as non-editable and makes the Code-to-Preview toggle return to Preview without applying modified source.

## Testing

Verify:

1. Preview-to-Code initializes CodeMirror with the current serialized HTML and HTML editing support.
2. Source edits apply to the canvas when toggling back to Preview.
3. Re-entering Code mode loads the latest preview HTML.
4. Read-only mode prevents source edits from changing the canvas.
5. Existing tests and the production build remain green.

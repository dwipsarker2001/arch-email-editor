# Canvas HTML Code Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Code/Preview toggle to the canvas so users can edit the current email HTML with CodeMirror 6 and apply changes back to the rendered email.

**Architecture:** Add a small CodeMirror wrapper component, then wire it into the existing canvas toolbar and editor HTML APIs. Code-to-Preview applies through `importHTML()` so existing sanitization, rendering, callbacks, and history stay authoritative.

**Tech Stack:** TypeScript, CodeMirror 6 (`codemirror`, `@codemirror/lang-html`), Vite, Vitest.

## Global Constraints

- Add a `</>` Code button with a Lucide code icon to the existing vertical canvas toolbar.
- Preview-to-Code loads the latest serialized email HTML into a full-size, light-themed editor.
- Code-to-Preview applies the editor contents and returns to the rendered canvas.
- CodeMirror provides HTML language support, a light theme, line numbers, indentation, and standard keyboard editing.
- Read-only editors may inspect HTML but cannot edit or apply changes.
- Reuse `getHTML()` and `importHTML()`; do not add another sanitizer/parser path.
- Do not add Monaco or a separate modal/right-sidebar code editor.

---

## Files

- `package.json`, `package-lock.json` — Add CodeMirror 6, state management, and HTML language support.
- `src/components/CanvasCodeEditor.ts` — Own the CodeMirror editor lifecycle and expose its current value.
- `src/components/Canvas.ts` — Add toolbar toggle, code-mode state, editor mount/destroy, and HTML callbacks.
- `src/editor.ts` — Wire canvas callbacks to `getHTML()` and `importHTML()`.
- `src/style.css` — Size the editor to the canvas and style a light code surface.
- `tests/canvas-code-editor.test.ts` — Verify CodeMirror editing and read-only setup.

## Task 1: CodeMirror Component

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/CanvasCodeEditor.ts`
- Create: `tests/canvas-code-editor.test.ts`

**Interface:**
- `new CanvasCodeEditor(container: HTMLElement, html: string, readOnly: boolean)`
- `getValue(): string`
- `setValue(html: string): void`
- `setReadOnly(readOnly: boolean): void`
- `destroy(): void`

- [ ] **Step 1: Add public-surface tests first.** Create an editor instance and verify the Code button, current source, edit/apply/refresh flow, and read-only inspection without apply through the canvas toggle.
- [ ] **Step 2: Run the focused test and confirm it fails because the component/dependencies do not exist.** Run `npm test -- tests/canvas-code-editor.test.ts`.
- [ ] **Step 3: Add the minimal CodeMirror dependencies.** Run `npm install codemirror @codemirror/lang-html @codemirror/state`.
- [ ] **Step 4: Implement the wrapper.** Construct `EditorView` with `basicSetup`, `html()`, initial `doc`, `EditorState.readOnly.of(readOnly)`, `EditorView.editable.of(!readOnly)`, and a small light `EditorView.theme` for full-size monospace editing. Implement value access, replacement via a document change transaction, and `destroy()`.
- [ ] **Step 5: Wire the canvas toggle and editor callbacks.** Implement the Code/Preview button and lifecycle, route source through `getHTML()` and `importHTML()`, and ensure read-only users can open Code while other read-only toolbar actions stay hidden.
- [ ] **Step 6: Run the focused test and confirm it passes.** Run `npm test -- tests/canvas-code-editor.test.ts`.

## Task 2: Canvas Code/Preview Toggle

**Files:**
- Modify: `src/components/Canvas.ts`
- Modify: `src/editor.ts`
- Modify: `src/style.css`

**Canvas callback contract:**
- `getHtml: () => string`
- `applyHtml: (html: string) => void`

- [ ] **Step 1: Style the code surface.** Make the CodeMirror host fill the canvas area, scroll independently, use a light background and readable code font, and ensure the floating toolbar remains above it. Hide the iframe and preview-only HUD while Code mode is active.
- [ ] **Step 2: Run the focused integration tests and confirm Preview/Code transitions and read-only behavior pass.** Run `npm test -- tests/canvas-code-editor.test.ts`.

## Task 3: Full Verification

**Files:** No additional files expected.

- [ ] **Step 1: Run the complete test suite.** Run `npm test`; expected result is all tests passing.
- [ ] **Step 2: Build production bundles and declarations.** Run `npm run build`; expected exit code is 0.
- [ ] **Step 3: Check whitespace and inspect the final patch.** Run `git diff --check` and inspect `git status --short`.

## Self-Review

- Spec coverage: toolbar icon, full-canvas mode, CodeMirror HTML editing, auto-apply on Preview, refreshing HTML on re-entry, read-only inspection without apply, existing sanitizer/history path, and automated verification are covered.
- Placeholder scan: no TBD/TODO implementation placeholders.
- Interface consistency: `CanvasCodeEditor` methods and `CanvasEvents` callback names are defined above and used consistently in the tasks.

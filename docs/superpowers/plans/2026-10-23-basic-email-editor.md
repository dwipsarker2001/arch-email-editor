# Basic Framework-Agnostic Email Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a very basic, lightweight, framework-agnostic email editor that can be embedded into plain HTML via a `<script>` tag or used in React and Vue applications.

**Architecture:** A pure TypeScript core engine (`packages/core`) that manages a structured email block AST (heading, text, button, image, divider), renders a DOM-based drag-and-drop canvas with a property inspector, and compiles the document into email-safe table HTML and JSON. Minimal thin adapter components provide instant integration for React and Vue.

**Tech Stack:** TypeScript, Vite, Vitest, Vanilla DOM APIs, React 19 (peer), Vue 3 (peer).

**Spec:** `docs/superpowers/specs/2026-10-23-framework-agnostic-email-editor-design.md`

## Global Constraints
- Pure TypeScript core with zero UI-framework dependencies (no React or Vue in core).
- Email HTML compiler must output valid table-based layouts with inline styles compatible with major email clients.
- Distribution must provide both UMD bundle (`dist/arch-email-editor.umd.js`) for browser `<script>` tags and ESM bundle (`dist/index.mjs`) for modern bundlers.
- Single CSS stylesheet (`dist/style.css`) namespaced with `arch-editor__` prefix.

## Review Focus
1. HTML output rendering in email clients without Flexbox/Grid — verified table wrapper and inlined CSS attributes.
2. Complete destruction and cleanup on `editor.destroy()` — no lingering global event listeners or orphaned DOM elements.
3. React wrapper strict mode safety — handles double-mounting in React 18/19 without duplicating the editor DOM.
4. Empty or invalid JSON input handling — gracefully initializes with default starter template.
5. External image URL sanitization — prevents script injection in `src` attributes.

---

### Task 1: Scaffolding and Build Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: NPM scripts `npm run build`, `npm test`, `npm run dev`

- [ ] **Step 1: Initialize root package.json with dev dependencies**
Setup package.json with Vite, Vitest, TypeScript, and library build targets.

- [ ] **Step 2: Configure TypeScript compiler (tsconfig.json)**
Setup modern DOM + ES2022 configuration with strict type checking and declaration generation.

- [ ] **Step 3: Configure Vite for UMD & ESM library bundle (vite.config.ts)**
Setup entry at `src/index.ts`, output formats `['es', 'umd']`, name `ArchEmailEditor`, outputting `dist/arch-email-editor.js` and `dist/style.css`.

- [ ] **Step 4: Verify test runner setup**
Run: `npm test`
Expected: Passes with no test files or sample test pass.

- [ ] **Step 5: Commit scaffolding**
```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts
git commit -m "chore: setup project scaffolding with Vite and Vitest"
```

---

### Task 2: Core Document Types and Email HTML Compiler

**Files:**
- Create: `src/types.ts`
- Create: `src/compiler.ts`
- Test: `tests/compiler.test.ts`

**Interfaces:**
- Consumes: `EmailDocument`, `BlockNode` definitions from `src/types.ts`
- Produces: `compileToEmailHtml(doc: EmailDocument): string` and `getDefaultDocument(): EmailDocument`

- [ ] **Step 1: Write failing tests for compiler**
Write tests verifying:
- Compiles empty document to standard email outer table (width 600px, centered, background color).
- Compiles 'heading', 'text', 'button', 'image', 'divider' blocks to inline-styled table rows.
- Button renders as a bulletproof email button (`<table cellpadding="0" cellspacing="0">...<a style="...">`).
- Image renders with `alt`, `border="0"`, and max-width.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/compiler.test.ts`
Expected: FAIL ("compiler not found")

- [ ] **Step 3: Implement types in `src/types.ts`**
Define `BlockType`, `BlockNode`, `EmailDocument`, `EditorOptions`.

- [ ] **Step 4: Implement email compiler in `src/compiler.ts`**
Generate email-client-ready HTML using table structures and inlined styles for maximum client compatibility.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npx vitest run tests/compiler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/types.ts src/compiler.ts tests/compiler.test.ts
git commit -m "feat: implement email document model and table HTML compiler"
```

---

### Task 3: Core Vanilla Editor Engine (UI, Drag-Drop/Click-Add, Inspector)

**Files:**
- Create: `src/editor.ts`
- Create: `src/style.css`
- Create: `src/index.ts`
- Test: `tests/editor.test.ts`

**Interfaces:**
- Consumes: `EmailDocument`, `BlockNode` from `src/types.ts`, `compileToEmailHtml` from `src/compiler.ts`
- Produces: `class ArchEmailEditor { static create(container, options): ArchEmailEditor; getJSON(); getHTML(); destroy(); }`

- [ ] **Step 1: Write failing tests for `ArchEmailEditor` lifecycle**
Test initialization into a container, `getJSON()` returning initial or default document, `getHTML()` returning email HTML string, and `destroy()` removing elements from container.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/editor.test.ts`
Expected: FAIL ("ArchEmailEditor is not defined")

- [ ] **Step 3: Implement Vanilla Editor in `src/editor.ts` and `src/style.css`**
- Layout: Top toolbar (Export JSON, Export HTML, Clear), Left palette (Heading, Text, Button, Image, Divider), Center Canvas (interactive preview), Right Inspector (live property editing for active block).
- Interactions: Click or drag blocks from palette into canvas; click block to edit text/colors/URL in inspector; delete block button.
- Clean lifecycle: `destroy()` tears down DOM and listener references.

- [ ] **Step 4: Export public interface from `src/index.ts`**
Export `ArchEmailEditor`, `compileToEmailHtml`, and TypeScript types.

- [ ] **Step 5: Run tests and build library**
Run: `npx vitest run tests/editor.test.ts && npm run build`
Expected: PASS and creates `dist/arch-email-editor.umd.js`, `dist/index.mjs`, and `dist/style.css`.

- [ ] **Step 6: Commit**
```bash
git add src/editor.ts src/style.css src/index.ts tests/editor.test.ts
git commit -m "feat: implement Vanilla email editor with canvas and inspector"
```

---

### Task 4: React and Vue 3 Adapters

**Files:**
- Create: `packages/react/EmailEditor.tsx`
- Create: `packages/react/index.ts`
- Create: `packages/vue/EmailEditor.vue`
- Create: `packages/vue/index.ts`
- Test: `tests/adapters.test.ts`

**Interfaces:**
- Consumes: `ArchEmailEditor` from `../../src/index`
- Produces: `<EmailEditor initialData={...} onChange={...} />` for React and `<EmailEditor :initial-data="..." @change="..." />` for Vue

- [ ] **Step 1: Write test for adapter mounting contracts**
Verify React and Vue wrappers correctly invoke `ArchEmailEditor.create` on mount and call `destroy()` on unmount.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/adapters.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement React wrapper in `packages/react/EmailEditor.tsx`**
Uses `useRef` and `useEffect` with cleanup function calling `editor.destroy()`.

- [ ] **Step 4: Implement Vue wrapper in `packages/vue/EmailEditor.vue`**
Uses `ref`, `onMounted`, and `onBeforeUnmount` with cleanup.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npx vitest run tests/adapters.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add packages/react packages/vue tests/adapters.test.ts
git commit -m "feat: implement React and Vue 3 email editor adapters"
```

---

### Task 5: Live HTML Demo & End-to-End Verification

**Files:**
- Create: `examples/index.html` (Vanilla HTML demo using the built UMD bundle)
- Create: `examples/react-demo.html` (Standalone React CDN demo)
- Create: `examples/vue-demo.html` (Standalone Vue 3 CDN demo)

**Interfaces:**
- Consumes: `dist/arch-email-editor.umd.js` and `dist/style.css`
- Produces: Live runnable examples for HTML, React, and Vue

- [ ] **Step 1: Build the complete distribution artifacts**
Run: `npm run build`
Expected: Produces `dist/arch-email-editor.umd.js` and `dist/style.css`.

- [ ] **Step 2: Create `examples/index.html`**
Direct `<script src="../dist/arch-email-editor.umd.js">` and `<link rel="stylesheet" href="../dist/style.css">`.
Include container `<div id="editor"></div>` and preview output modal/section for exported HTML and JSON.

- [ ] **Step 3: Create `examples/react-demo.html` & `examples/vue-demo.html`**
Demonstrate importing and embedding in React and Vue.

- [ ] **Step 4: Run Vite dev server / test server and verify functionality**
Verify:
1. Adding blocks (Heading, Text, Button, Image).
2. Selecting a block and changing its text/styles in the inspector.
3. Exporting HTML and confirming table-based email output.
4. Exporting JSON and re-importing.

- [ ] **Step 5: Commit**
```bash
git add examples/
git commit -m "feat: add runnable examples for Vanilla HTML, React, and Vue"
```

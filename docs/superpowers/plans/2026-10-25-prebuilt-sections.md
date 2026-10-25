# Prebuilt Modular Sections Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the right sidebar's second tab from `ROWS` to `SECTIONS`, displaying a rich library of prebuilt, email-safe modular sections (Headers, Heroes, Features, CTAs, Footers, and Empty Layouts) customizable via `EditorOptions.sections` / `EditorOptions.customSections` and dynamic runtime JS methods (`editor.addSection()`, `editor.setSections()`).

**Architecture:** 
- A dedicated, self-contained sections catalog module (`src/engine/sections.ts`) containing default email-client-bulletproof prebuilt templates with table layouts, inline styles, and preview thumbnails.
- Extend `EditorOptions` and `RightPanel` to consume and render prebuilt and custom sections with category filtering (All, Header, Hero, Features, CTA, Footer, Empty Rows).
- Seamless click-to-insert and drag-and-drop integration using the canvas's resilient `insertHTML()` pipeline.
- Synchronized React (`packages/react`) and Vue (`packages/vue`) component props and ref methods.

**Tech Stack:** TypeScript, standard DOM API, CSS with CSS isolation barrier, Vitest test suite.

---

## Global Constraints
- **Zero browser-use MCP tools**: Run automated unit tests (`npm test`) and production build (`npm run build`) to verify.
- **Strict email-safe HTML**: All prebuilt sections must use standard table row markup (`<table role="presentation" class="row">...</table>`) with cross-client styles (MSO, Gmail, Apple Mail, Outlook).
- **Backward compatibility**: Preserve `'rows'` tab alias for any existing code calling `setActiveTab('rows')` or listening to row events.
- **Ponytail discipline**: Minimal code, native DOM, no heavy third-party UI dependencies, maximum reusability of existing `insertHTML()` and drag-drop machinery.

---

## Review Focus (Edge Cases & Failure Modes)
1. **Custom Sections Without Categories**: If a user supplies a custom section without a category or with a novel category, it must automatically create or group under a clean fallback category (e.g. "Custom" or "General") without throwing errors.
2. **HTML Context Preservation**: Inserting a section when an element inside a column is selected must insert cleanly without corrupting parent table hierarchies.
3. **Empty / Minimal HTML**: If a custom section contains a single element or snippet, `wrapContextAwareHtmlSnippet()` must wrap it safely in table row/column structures.
4. **Dynamic Section Updates**: Calling `editor.setSections()` or `editor.addSection()` after initialization must dynamically re-render the sections tab and update the category filter.
5. **Drag-and-Drop Resolution**: Dropping a section onto the canvas must look up the section HTML by ID and execute `canvas.insertHTML()` at the drop target.

---

## File Structure & Responsibilities

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Define `PrebuiltSection`, `PrebuiltSectionCategory`, extend `EditorOptions` with `sections` and `customSections`. |
| `src/engine/sections.ts` | Curated library of bulletproof, email-safe default sections (Header, Hero, 2-Col Features, 3-Col Features, CTA, Footer). |
| `src/components/RightPanel.ts` | Upgrade `ROWS` tab to `SECTIONS` with Lucide icon; render category chips/selector, section cards, empty row layouts, search/filter, and click/drag listeners. |
| `src/components/Canvas.ts` | Handle `section:<id>` drop in canvas drop handler; resolve section and insert via `insertHTML()`. |
| `src/editor.ts` | Expose `getSections()`, `setSections()`, `addSection()`, `removeSection()`, and route `onInsertSection` to `canvas.insertHTML()`. |
| `src/style.css` | Sleek CSS styling for `.arch-section-card`, `.arch-section-preview`, `.arch-category-chip`, and hover states. |
| `packages/react/EmailEditor.tsx` | Add `sections` & `customSections` props and expose section methods on ref. |
| `packages/vue/EmailEditor.vue` | Add `sections` & `customSections` props and expose section methods on component. |
| `tests/sections.test.ts` | Comprehensive unit tests for prebuilt sections, custom sections, category filtering, click-to-insert, drag-and-drop, and dynamic JS methods. |
| `README.md` | Document `sections`, `customSections`, and programmatic section methods with practical code examples. |

---

## Tasks

### Task 1: Section Types & Default Prebuilt Email Sections Module
**Files:**
- Modify: `src/types.ts`
- Create: `src/engine/sections.ts`
- Test: `tests/sections.test.ts`

- [ ] **Step 1.1**: Define `PrebuiltSection` interface in `src/types.ts` with `id`, `name`, `category`, `thumbnail?`, `description?`, and `html`. Extend `EditorOptions` with `sections?: PrebuiltSection[]` and `customSections?: PrebuiltSection[]`.
- [ ] **Step 1.2**: Implement `src/engine/sections.ts` with curated, cross-client email-safe prebuilt sections:
  - Header: Simple logo + online link; Brand centered + navigation.
  - Hero: Headline + body + CTA button + image.
  - Features: 2-column feature highlight; 3-column benefit cards.
  - Call to Action: Full-width vibrant CTA banner with bulletproof button.
  - Footer: Social links row + copyright + unsubscribe legal statement.
- [ ] **Step 1.3**: Write unit tests verifying that all default sections parse into valid HTML, contain proper table/row structures, and have non-empty IDs, names, and categories.

---

### Task 2: RightPanel Tab Transformation & Section Cards UI
**Files:**
- Modify: `src/components/RightPanel.ts`
- Modify: `src/style.css`

- [ ] **Step 2.1**: Update tab 2 in `RightPanel.ts`:
  - Change label from `ROWS` to `SECTIONS`.
  - Update icon to Lucide `LayoutTemplate` SVG.
  - Update tooltip to `Prebuilt Sections & Layouts`.
  - Retain alias compatibility for `'rows'` in `setActiveTab()`.
- [ ] **Step 2.2**: Build the `SECTIONS` panel markup and dynamic renderer:
  - Category selector/chips (All, Header, Hero, Features, CTA, Footer, Empty Rows).
  - Search or filter mechanism by category and keyword.
  - Section card list with visual SVG preview silhouettes, category badges, and title.
  - Collapsible / selectable "Empty Row Layouts" (1-col, 2-col, 3-col, 4-col) so existing row layout capability remains 100% accessible.
- [ ] **Step 2.3**: Bind click-to-insert and dragstart events (`dataTransfer.setData('text/plain', 'section:' + section.id)`).
- [ ] **Step 2.4**: Implement `setSections(sections)`, `addSection(section)`, `removeSection(id)`, and `getSections()` in `RightPanel.ts`.
- [ ] **Step 2.5**: Add styling in `src/style.css` for section cards, preview thumbnails, category filter pills, and hover/active states.

---

### Task 3: Canvas Drop Handling & Editor API Integration
**Files:**
- Modify: `src/components/Canvas.ts`
- Modify: `src/editor.ts`

- [ ] **Step 3.1**: In `Canvas.ts`:
  - Update `onDrop()` to recognize `arch-section:` and `section:` data transfers.
  - Resolve section HTML and insert via `this.insertHTML(section.html, targetUnit, position)`.
- [ ] **Step 3.2**: In `src/editor.ts`:
  - Initialize `RightPanel` with merged sections (`options.sections || getDefaultSections()`, plus `options.customSections || []`).
  - Pass section resolver to `Canvas`.
  - Implement public methods on `ArchEmailEditor`:
    - `editor.getSections(): PrebuiltSection[]`
    - `editor.setSections(sections: PrebuiltSection[]): void`
    - `editor.addSection(section: PrebuiltSection): void`
    - `editor.removeSection(id: string): void`
  - Connect `onInsertSection` from `RightPanel` to `this.insertHTML(section.html)`.

---

### Task 4: React & Vue Adapters Synchronization & Documentation
**Files:**
- Modify: `packages/react/EmailEditor.tsx`
- Modify: `packages/vue/EmailEditor.vue`
- Modify: `README.md`

- [ ] **Step 4.1**: Update `packages/react/EmailEditor.tsx` with `sections` and `customSections` props, and forward section methods on the exported ref.
- [ ] **Step 4.2**: Update `packages/vue/EmailEditor.vue` with `sections` and `customSections` props and defineExpose methods.
- [ ] **Step 4.3**: Update `README.md` with:
  - Guide on custom sections array in `options.customSections`.
  - Runtime API examples (`editor.addSection(...)`).
  - Ready-to-copy code snippet for a custom branded section.

---

### Task 5: Automated Testing & Verification
**Files:**
- Create: `tests/sections.test.ts`
- Run: `npm test && npm run build`

- [ ] **Step 5.1**: Write tests verifying:
  - Sidebar renders `SECTIONS` tab with appropriate Lucide icon.
  - Built-in sections render and categorize properly.
  - Filtering categories updates visible cards.
  - Clicking a section card inserts the section markup into the canvas.
  - Custom sections provided via options appear in the list.
  - Programmatic `editor.addSection()` adds a new section and updates UI.
  - Programmatic `editor.setSections()` completely updates sections.
  - Canvas drag-and-drop handles `section:<id>`.
  - Email HTML output remains 100% clean and free of editor UI artifacts.
- [ ] **Step 5.2**: Run full test suite (`npm test`) and production build (`npm run build`). Verify 0 failures and 0 warnings.

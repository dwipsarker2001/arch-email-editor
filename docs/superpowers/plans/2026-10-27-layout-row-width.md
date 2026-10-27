# Layout Row Width Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep newly inserted multi-column layout rows within the width and alignment of the existing email template.

**Architecture:** Extend `buildRowLayoutHtml` with optional inherited row-content presentation values while preserving its existing 600px/centered defaults. In `Canvas.insertRowLayout`, read width and alignment from the nearest existing `.row-content` and pass those values to the builder.

**Tech Stack:** TypeScript, Vitest, jsdom.

## Global Constraints

- A newly inserted multi-column row inherits the nearest relevant template `.row-content` width and alignment instead of always using a fixed 600px width.
- Existing column proportions remain unchanged.
- If no template content width can be found, retain the current 600px default.
- Existing rows and templates are not resized as a side effect of insertion.

---

### Task 1: Inherit existing template width when adding a layout row

**Files:**
- Modify: `src/engine/adapters.ts`
- Modify: `src/components/Canvas.ts`
- Test: `tests/editor.test.ts`

**Interfaces:**
- `buildRowLayoutHtml(layout: RowLayoutType, wrapInTr: boolean, contentWidth?: string, contentAlign?: string): string`; `contentWidth` is a validated CSS width such as `480px` or `100%`; omitted width/alignment preserve current output defaults.
- `Canvas.insertRowLayout` locates the target `.row-content`, normalizes its inline `style.width` or HTML `width` attribute to a CSS width, reads its `align` attribute, and passes the values to `buildRowLayoutHtml`.

- [x] **Step 1: Add a failing insertion regression**

Add a test in `tests/editor.test.ts` that imports a template with a 480px `.row-content`, inserts a two-column layout before its row, and asserts the inserted `.row-content` has width `480` (attribute and inline style) and the inherited alignment. Also assert the existing template row remains at 480px. Example setup:

```typescript
editor.importHTML(`<table class="row" id="existing-row"><tbody><tr><td>
  <table class="row-content" align="left" width="480" style="width:480px;margin:0;">
    <tbody><tr><td class="column"><p>Existing</p></td></tr></tbody>
  </table>
</td></tr></tbody></table>`);
const existingRow = doc.querySelector('#existing-row') as HTMLElement;
const existingContent = doc.querySelector('.row-content') as HTMLElement;
canvas.insertRowLayout('2-col-50-50', existingRow, 'before');
const insertedRow = existingRow.previousElementSibling as HTMLElement;
const insertedContent = insertedRow.querySelector('.row-content') as HTMLElement;
expect(insertedContent.getAttribute('width')).toBe('480');
expect(insertedContent.style.width).toBe('480px');
expect(insertedContent.getAttribute('align')).toBe('left');
expect(existingContent.getAttribute('width')).toBe('480');

const defaultWrapper = doc.createElement('div');
defaultWrapper.innerHTML = buildRowLayoutHtml('2-col-50-50', false);
const defaultContent = defaultWrapper.querySelector('.row-content') as HTMLElement;
expect(defaultContent.getAttribute('width')).toBe('600');
expect(defaultContent.getAttribute('align')).toBe('center');
```

- [x] **Step 2: Run the insertion regression and confirm it fails**

Name the test `inherits template row-content width when adding a layout`, then run: `npx vitest run tests/editor.test.ts -t "inherits template row-content width when adding a layout"`

Expected: FAIL because inserted layout `.row-content` currently has width `600` and centered alignment.

- [x] **Step 3: Add optional inherited width and alignment to the row builder**

Update the signature of `buildRowLayoutHtml` and use the supplied values on the inner `.row-content` table. The width attribute is the numeric part of pixel widths, or the unchanged percentage for percentage widths:

```typescript
const widthAttribute = contentWidth.endsWith('px') ? contentWidth.slice(0, -2) : contentWidth;
```

Preserve the current `600px` width and `center` alignment defaults when arguments are omitted. Accept only numeric pixel or percentage widths from the template; if the extracted value is not one of those forms, leave the width undefined so the builder uses its default. Keep column widths and other generated markup unchanged.

- [x] **Step 4: Pass the nearest template width and alignment from row insertion**

In `Canvas.insertRowLayout`, find `.row-content` inside the target row; if there is no target row, use the first `.row-content` in the document. Read `style.width` first, then its `width` attribute. Normalize a numeric attribute such as `480` to `480px`, preserve a percentage such as `100%`, and pass only `^\d+(?:\.\d+)?(?:px|%)$` values. If neither source has a valid width, pass `undefined` so the builder uses its default. Pass `align` only when it is one of `left`, `center`, or `right`; otherwise use the builder default.

- [x] **Step 5: Run focused and related tests**

Run: `npx vitest run tests/editor.test.ts tests/layout-engine.test.ts`

Expected: all tests pass, including the inherited-width regression, existing 600px builder default, and row-layout insertion tests.

- [x] **Step 6: Run the build and full library suite**

Run: `npm run build`

Expected: Vite build and TypeScript declaration generation complete successfully.

Run: `npm test`

Expected: all library tests pass.

- [x] **Step 7: Check the final diff**

Run: `git diff --check; git status --short; git diff --stat`

Expected: only row-layout generation, row insertion, and directly related tests are changed for this task; no generated `dist` files are included.

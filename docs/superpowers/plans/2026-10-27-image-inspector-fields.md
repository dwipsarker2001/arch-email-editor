# Image Inspector Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the image inspector Alt text and Link fields match the Email Metadata Preheader field layout.

**Architecture:** Reuse the existing Email Metadata field-row styling directly in the two image inspector fields. Keep the existing image value adapters and event listeners unchanged; update the UI regression test to verify the layout.

**Tech Stack:** TypeScript, HTML template strings, Vitest.

## Global Constraints

- Keep the change limited to Alt text and Link fields in the image inspector.
- Preserve existing field labels, link prefix, values, and input behavior.
- Match the metadata row's lighter label, 14px vertical and 18px horizontal padding, vertical layout, full-width control, and 8px gap.

---

### Task 1: Match image inspector fields to email metadata

**Files:**
- Modify: `src/components/inspector/ImageInspector.ts`
- Test: `tests/ui-customization.test.ts`

**Interfaces:**
- Consumes: Existing `ImageInspector.renderImageElementControls` markup and `DocumentInspector` metadata field styling.
- Produces: Alt text and Link field groups with the same layout as the metadata Preheader field.

- [ ] **Step 1: Write the failing layout assertions**

In the existing image inspector UI test, assert both field groups match the Email Metadata row's inline layout:

```ts
for (const id of ['inp-img-alt', 'inp-img-link']) {
  const field = container.querySelector<HTMLInputElement>(`#${id}`);
  const group = field?.closest<HTMLElement>('.arch-form-group');
  expect(group?.getAttribute('style')).toContain('flex-direction: column');
  expect(group?.getAttribute('style')).toContain('gap: 8px');
  expect(group?.getAttribute('style')).toContain('padding: 14px 18px');
  expect(group?.querySelector('label')?.classList.contains('arch-rge-label')).toBe(true);
  expect(field?.style.width).toBe('100%');
}
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/ui-customization.test.ts -t "renders image preview box"`

Expected: FAIL because the current image inspector groups do not use the metadata row layout.

- [ ] **Step 3: Update both image field groups**

In `src/components/inspector/ImageInspector.ts`, apply the same row layout used by `#sec-metadata` to each group, use `arch-rge-label` for each label, and set each input width to 100%. Preserve label text, URL prefix, placeholders, values, and listeners.

```html
<div class="arch-form-group" style="flex-direction: column; align-items: stretch; gap: 8px; min-height: auto; padding: 14px 18px;">
  <label class="arch-rge-label" style="font-weight: 500;">Alt text</label>
  <input type="text" class="arch-input" id="inp-img-alt" style="width: 100%; box-sizing: border-box;" />
</div>
```

- [ ] **Step 4: Verify the focused test and production build**

Run: `npm test -- tests/ui-customization.test.ts -t "renders image preview box"`

Expected: PASS.

Run: `npm run build`

Expected: Vite build and TypeScript declaration generation complete successfully.

- [ ] **Step 5: Commit the implementation**

```powershell
git add -- src/components/inspector/ImageInspector.ts tests/ui-customization.test.ts
git commit -m "fix(inspector): align image fields with email metadata" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

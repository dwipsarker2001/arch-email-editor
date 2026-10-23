# Figma-style Vertical Displacement Implementation Plan

**Goal:** Rows and blocks slide smoothly up/down while dragging (like columns do left/right), and ▲▼◀▶ button moves glide instead of snapping.

**Architecture:** One axis-generic `applySiblingDisplacementPreview` (x for columns, y for rows/blocks) in `Canvas.ts`. Displacement is stored in `data-arch-displace-x|y`; `getSlotRect` subtracts it so hit-testing and the insertion line always use the stable untransformed slot (no oscillation). Existing perf guards (rAF, slot memo) apply unchanged.

**Spec:** user request 2026-10-24 ("vertical movement ... figma like").

## Global Constraints
- Transitions: `200ms cubic-bezier(0.2, 0, 0, 1)`, `transform` only (GPU).
- Export (`serializeCleanDocument`) must contain no `transform`, `data-arch-displace*`, `arch-col-*`.
- No new dependencies.

## Review Focus
- Pointer in the gap between siblings: keep the current slot (no flicker).
- Pointer back on the dragged item's home slot: everything glides home.
- Unequal heights / gaps: advance = next-top − top (gap included).
- Cross-container drops (different parent): no displacement, only the insertion line.
- Mid-drag export / drop: clean HTML, no leftover inline transform.

### Task 1: Vertical displacement
**Files:** Modify `src/components/Canvas.ts`, `src/engine/sanitize.ts`; Test `tests/layout-engine.test.ts`
**Produces:** `getSlotRect(el)`, `applySiblingDisplacementPreview(dragged, target, position)`

- [x] Failing test: `slides sibling rows/blocks vertically ... cleans up on drop & export`
- [x] Generalize column displacement to both axes, add vertical slot hit-test with gap hold
- [x] Strip `data-arch-displace-y` on export
- [x] `npm test && npm run build`

### Task 2: FLIP for ▲▼◀▶
- [x] Snapshot all moveable siblings' left/top in `moveSelectedElement`, invert → reflow → play

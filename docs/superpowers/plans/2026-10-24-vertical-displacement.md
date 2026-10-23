# Figma-style Vertical & Horizontal Displacement — Root-Cause Audit & Fix Plan

**Goal:** Eliminate the "items look so far during vertical drag" bug and make all vertical/horizontal drag & button movements smooth, accurate, and oscillation-free across every email template structure.

## Root-Cause Audit & Fixes
1. **Mid-Transition `getBoundingClientRect()` Corruption:** Cache untransformed sibling slot rects in `slotRectCache` before applying `translate3d` transforms; compute displacements from exact cached slot endpoints (`slot(destIdx).start - slot(dragIdx).start` and `slot(dragIdx).end - slot(dragIdx - 1).end`).
2. **Dual Drop Lines & Destination Slot Alignment:** Omit `.arch-drop-line-top/bottom` on sliding siblings and place `.arch-figma-drop-indicator` at the true destination slot edge.
3. **Directional Entry Threshold & Hysteresis:** Prevent 1px boundary jumps when touching a tall sibling row.
4. **`draggedUnit` Escalation & HUD Cleanup:** Escalate `draggedUnit` to `resolveEffectiveMoveUnit` and hide floating toolbar/handles while dragging.
5. **`<tr>` Wrapper Escalation & Row Insertion:** Allow `resolveEffectiveMoveUnit` and `resolveCompatibleDropTarget` to climb to multi-row `<tr>` wrappers, and prevent `insertRowLayout` from inserting 600px rows inside a narrow `td.column`.

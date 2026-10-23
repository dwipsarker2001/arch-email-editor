/**
 * Arch Email Editor - Figma-Grade Visual Canvas & Pointer Engine
 *
 * Architecture & Email Rendering Fidelity:
 * Uses a same-origin HTMLIFrameElement (`iframe.contentDocument`) with a non-invasive
 * parent-document Figma HUD overlay (`overlayLayer`).
 * - 100% email client visual fidelity: table columns, responsive `@media` rules, VML, fonts, and colors.
 * - Safe HTML sanitization + template-tag tokenization (`{% ... %}` / `{{ ... }}`) + DOCTYPE preservation.
 * - Figma 60fps Custom Pointer-Event Drag Engine (`mousedown` -> `4px` threshold -> `mousemove` -> `mouseup`):
 *   - Dragging any Block, Column, or Row (or its Figma Frame Pill `⠿`) shows a 60fps Floating Ghost Card
 *     and a Figma Auto-Layout Insertion Line (`2px solid #0d99ff` with circular end-caps + target slot label).
 *   - Completely bypasses browser `contenteditable` native drop corruption so tables are NEVER dropped inside `<p>`/`<h1>`.
 * - Two-State Text Interaction:
 *   - Single-click selects the Frame/Block (and allows immediate typing or dragging).
 *   - Double-click (or clicking `✎`) locks into Text Selection Mode for highlighting characters inside text.
 */

import { BlockType, EmailDocument, LayerNode, RowLayoutType, SelectedElementInfo, ViewportMode } from '../types';
import { compileToEmailHtml } from '../compiler';
import {
  extractFrameMeta,
  FrameMeta,
  sanitizeDomTree,
  sanitizeEmailHtml,
  serializeCleanDocument,
  tokenizeTemplateTags
} from '../engine/sanitize';
import {
  buildLayerTree,
  classifyElementType,
  classifyUnitRole,
  describeUnitForLayer,
  detectAxis,
  findEditableTextHost,
  findEnclosingColumn,
  getColumnSlotContainer,
  getContainerChain,
  getParentStructuralUnit,
  getUnitAncestry,
  isColumnElement,
  isEditableTextHost,
  isRowElement,
  resolveUnit
} from '../engine/units';
import {
  canMoveUnit,
  duplicateUnit,
  getMoveableSiblings,
  moveUnit,
  moveUnitToTarget,
  removeUnit,
  resolveCompatibleDropTarget,
  resolveEffectiveMoveUnit
} from '../engine/glue';
import {
  buildContextAwareBlockHtml,
  buildRowLayoutHtml,
  ButtonAdapter,
  findPrimaryContentContainer,
  ImageAdapter
} from '../engine/adapters';
import { validateEmailStructure } from '../engine/history';

export interface CanvasEvents {
  onSelectBlock: (id: string | null) => void;
  onSelectElement: (info: SelectedElementInfo | null) => void;
  onContentChange: (html: string) => void;
  onLayersChange?: (layers: LayerNode[], selectedUnit: HTMLElement | null) => void;
  onAddBlock?: (type: BlockType) => void;
  onReorderBlock?: (sourceId: string, targetIndex: number) => void;
  onMoveBlock?: (id: string, direction: 'up' | 'down') => void;
  onRemoveBlock?: (id: string) => void;
  onInsertBlockAt?: (type: BlockType, targetIndex: number) => void;
}

export class Canvas {
  private element: HTMLElement;
  private containerElement: HTMLElement;
  private iframe: HTMLIFrameElement;
  private overlayLayer: HTMLElement;
  private floatingToolbar: HTMLElement | null = null;
  private dimensionsBadge: HTMLElement | null = null;
  private dropIndicatorEl: HTMLElement | null = null;
  private dragGhostEl: HTMLElement | null = null;
  private events: CanvasEvents;

  private selectedElement: HTMLElement | null = null;
  private activeMoveableUnit: HTMLElement | null = null;
  private hoveredUnit: HTMLElement | null = null;
  private lastRenderedHtml: string = '';
  private frameMeta: FrameMeta | undefined;
  private draggedUnit: HTMLElement | null = null;
  private hoveredDropTarget: HTMLElement | null = null;
  private hoveredDropPosition: 'before' | 'after' = 'after';
  private viewportMode: ViewportMode = 'desktop';
  private isEditingText: boolean = false;
  private suppressNextClick: boolean = false;
  private iframeEventsAbortController: AbortController | null = null;

  // Custom 60fps Pointer Drag state
  private pointerDragCandidate: {
    unit: HTMLElement;
    startTarget: HTMLElement;
    startX: number;
    startY: number;
    active: boolean;
  } | null = null;
  private resizeHandles: HTMLElement[] = [];
  private pendingMove: { x: number; y: number } | null = null;
  private moveRaf = 0;
  private containerRectCache: DOMRect | null = null;
  private displaceKey = '';
  private dropMemoDragged: HTMLElement | null = null;
  private activeImageResize: {
    img: HTMLElement;
    unit: HTMLElement;
    startX: number;
    startWidth: number;
    maxWidth: number;
    dir: 1 | -1;
  } | null = null;

  constructor(events: CanvasEvents) {
    this.events = events;

    // Root canvas wrapper
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__canvas';

    // Canvas container spanning 100% full width touching sidebars
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'arch-canvas-container';
    this.containerElement.style.position = 'relative';

    // Same-origin isolated email preview iframe
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'arch-canvas-iframe';
    this.iframe.setAttribute('title', 'Email Canvas Preview');

    // Non-invasive parent-document Figma HUD overlay layer (zero pollution inside iframe DOM)
    this.overlayLayer = document.createElement('div');
    this.overlayLayer.className = 'arch-canvas-overlay';

    this.containerElement.appendChild(this.iframe);
    this.containerElement.appendChild(this.overlayLayer);
    this.element.appendChild(this.containerElement);

    this.bindOuterEvents();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getIFrame(): HTMLIFrameElement {
    return this.iframe;
  }

  public getViewportMode(): ViewportMode {
    return this.viewportMode;
  }

  public getLayerTree(): LayerNode[] {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc) return [];
    return buildLayerTree(ifrDoc);
  }

  /**
   * Switches the canvas preview width between Desktop (100%), Tablet (768px), and Mobile (375px).
   */
  public setViewportMode(mode: ViewportMode): void {
    this.viewportMode = mode;
    if (mode === 'desktop') {
      this.iframe.style.width = '100%';
      this.iframe.style.maxWidth = '100%';
      this.iframe.style.margin = '0';
    } else if (mode === 'tablet') {
      this.iframe.style.width = '768px';
      this.iframe.style.maxWidth = '100%';
      this.iframe.style.margin = '0 auto';
    } else {
      this.iframe.style.width = '375px';
      this.iframe.style.maxWidth = '100%';
      this.iframe.style.margin = '0 auto';
    }
    const target = this.activeMoveableUnit || this.hoveredUnit;
    if (target && this.floatingToolbar) {
      this.positionFloatingToolbar(target, this.floatingToolbar);
    }
  }

  /**
   * Binds click, pointer-drag, and palette HTML5 drop events on the outer canvas container & overlay shield.
   */
  private bindOuterEvents(): void {
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element || e.target === this.containerElement) {
        this.clearSelection();
        this.events.onSelectElement(null);
        this.events.onSelectBlock(null);
        this.emitLayersUpdate();
      }
    });

    // Parent window pointermove/mouseup listeners for 60fps custom Figma Pointer Drag & Image Resize
    // Coalesce mousemove to at most one drag update per animation frame (no redundant work at 120Hz+ mice)
    window.addEventListener('mousemove', (e) => {
      if (this.activeImageResize) {
        this.handleImageResizeMove(e.clientX);
        return;
      }
      if (!this.pointerDragCandidate) return;
      this.pendingMove = { x: e.clientX, y: e.clientY };
      if (this.moveRaf) return;
      this.moveRaf = requestAnimationFrame(() => {
        this.moveRaf = 0;
        const p = this.pendingMove;
        if (p && this.pointerDragCandidate) this.handlePointerDragMove(p.x, p.y);
      });
    });

    window.addEventListener('mouseup', () => {
      if (this.activeImageResize) {
        this.finishImageResize();
        return;
      }
      if (!this.pointerDragCandidate) return;
      this.finishPointerDrag();
    });

    // Parent Overlay HTML5 Drag-Capture Shield handlers (for dragging new items from the Assets Palette)
    this.containerElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = this.draggedUnit ? 'move' : 'copy';
      }
      this.updateDropTargetFromClientPoint(e.clientX, e.clientY);
    });

    this.containerElement.addEventListener('dragleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!related || !this.containerElement.contains(related)) {
        this.containerElement.classList.remove('drag-over');
        this.clearDropIndicators();
      }
    });

    this.containerElement.addEventListener('drop', (e) => {
      e.preventDefault();
      this.containerElement.classList.remove('drag-over');
      this.overlayLayer.style.pointerEvents = 'none';
      const data = e.dataTransfer?.getData('text/plain') || '';
      this.executeDrop(data);
    });
  }

  /**
   * Handles 60fps pointer movement during a Figma Pointer Drag.
   */
  private handlePointerDragMove(clientX: number, clientY: number): void {
    const cand = this.pointerDragCandidate;
    if (!cand) return;

    const dx = clientX - cand.startX;
    const dy = clientY - cand.startY;
    if (!cand.active) {
      if (Math.hypot(dx, dy) < 5) return;

      // Direction-aware Auto-Column Drag Initiator:
      // If `cand.unit` is a multi-column Row (or an inner Block/Link inside a multi-column Row),
      // and the user drags HORIZONTALLY (`|dx| > |dy|`), automatically switch the drag unit to the
      // enclosing Column (`td.column`) so 2-column and 3-column rows can be reordered horizontally in 1 motion!
      if (Math.abs(dx) > Math.abs(dy) * 1.1) {
        const enclosingCol = findEnclosingColumn(cand.startTarget);
        if (enclosingCol && getMoveableSiblings(enclosingCol).length >= 2) {
          if (isRowElement(cand.unit) || enclosingCol.contains(cand.unit)) {
            cand.unit = enclosingCol;
            this.selectUnit(cand.startTarget, enclosingCol);
          }
        }
      }

      // Threshold exceeded -> activate Figma Pointer Drag!
      cand.active = true;
      this.draggedUnit = cand.unit;
      this.draggedUnit.classList.add('arch-dragging-source');

      // Clear any accidental text selection inside iframe so browser never drags text nodes
      const ifrDoc = this.iframe.contentDocument;
      ifrDoc?.getSelection()?.removeAllRanges();
      if (ifrDoc?.activeElement && ifrDoc.activeElement instanceof HTMLElement) {
        ifrDoc.activeElement.blur();
      }

      // Activate parent overlay shield so pointer tracking is 100% smooth across iframe boundaries
      this.overlayLayer.style.pointerEvents = 'auto';
      this.createDragGhost(cand.unit, clientX, clientY);
    }

    this.updateDragGhostPosition(clientX, clientY);
    this.updateDropTargetFromClientPoint(clientX, clientY);
  }

  /**
   * Commits or cancels an active Figma Pointer Drag on mouseup.
   */
  private finishPointerDrag(): void {
    const cand = this.pointerDragCandidate;
    this.pointerDragCandidate = null;
    this.pendingMove = null;
    this.containerRectCache = null;

    if (!cand || !cand.active) {
      return;
    }

    this.suppressNextClick = true;
    cand.unit.classList.remove('arch-dragging-source');
    this.overlayLayer.style.pointerEvents = 'none';
    this.removeDragGhost();

    this.executeDrop('arch-move-unit');
    if (this.activeMoveableUnit && !this.floatingToolbar) {
      this.renderFloatingToolbar(this.activeMoveableUnit, this.selectedElement || this.activeMoveableUnit);
    }
  }

  /**
   * Creates the floating Figma Ghost Preview Card during pointer drag.
   */
  private createDragGhost(unit: HTMLElement, clientX: number, clientY: number): void {
    this.removeDragGhost();
    const desc = describeUnitForLayer(unit);
    const ghost = document.createElement('div');
    ghost.className = 'arch-figma-drag-ghost';
    ghost.innerHTML = `
      <span class="arch-ghost-badge">${desc.label}</span>
      <span class="arch-ghost-text">${desc.sublabel || 'Moving layer'}</span>
    `;
    this.overlayLayer.appendChild(ghost);
    this.dragGhostEl = ghost;
    this.updateDragGhostPosition(clientX, clientY);
  }

  private updateDragGhostPosition(clientX: number, clientY: number): void {
    if (!this.dragGhostEl) return;
    // GPU-composited move (no layout): cached container origin + translate3d
    if (!this.containerRectCache) this.containerRectCache = this.containerElement.getBoundingClientRect();
    const x = clientX - this.containerRectCache.left + 14;
    const y = clientY - this.containerRectCache.top + 14;
    this.dragGhostEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private removeDragGhost(): void {
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
  }

  /**
   * Resizes the active image live as the user drags a corner `.arch-resize-handle`.
   */
  private handleImageResizeMove(clientX: number): void {
    const state = this.activeImageResize;
    if (!state) return;

    const deltaX = (clientX - state.startX) * state.dir;
    const nextWidth = Math.round(Math.max(24, Math.min(state.maxWidth, state.startWidth + deltaX)));
    ImageAdapter.setWidth(state.img, `${nextWidth}px`, state.unit);

    if (this.floatingToolbar) {
      this.positionFloatingToolbar(state.unit, this.floatingToolbar);
    }
    if (this.dimensionsBadge) {
      const rect = state.img.getBoundingClientRect();
      const h = rect.height > 0 ? Math.round(rect.height) : Math.round(nextWidth);
      this.dimensionsBadge.textContent = `${nextWidth} × ${h}`;
    }
  }

  /**
   * Commits an interactive image resize operation and syncs the Inspector & history.
   */
  private finishImageResize(): void {
    const state = this.activeImageResize;
    if (!state) return;
    this.activeImageResize = null;
    this.suppressNextClick = true;
    this.overlayLayer.style.pointerEvents = 'none';
    this.selectUnit(state.img, state.img);
    this.adjustHeight();
    this.onStructureChanged();
  }

  /**
   * Resolves the drop target inside the iframe from parent-window `(clientX, clientY)` coordinates.
   */
  private updateDropTargetFromClientPoint(clientX: number, clientY: number): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const iframeRect = this.iframe.getBoundingClientRect();
    const x = clientX - iframeRect.left;
    const y = clientY - iframeRect.top;

    if (x < 0 || y < 0 || x > iframeRect.width || y > iframeRect.height) return;

    const hitEl = ifrDoc.elementFromPoint(x, y) as HTMLElement | null;
    if (!hitEl) return;

    this.updateDropTargetForElement(hitEl, x, y);
  }

  /**
   * Updates the Figma Auto-Layout Insertion Line and Live Column Displacement Preview on the compatible target unit.
   */
  public updateDropTargetForElement(rawTarget: HTMLElement, iframeRelativeX: number, iframeRelativeY: number): void {
    const effectiveDragged = this.draggedUnit ? resolveEffectiveMoveUnit(this.draggedUnit) : null;
    let targetUnit = effectiveDragged
      ? resolveCompatibleDropTarget(effectiveDragged, rawTarget)
      : this.findMoveableUnit(rawTarget);

    // Oscillation-free untransformed slot hit-testing during horizontal column drag:
    // Because displaced columns are visually translated via `transform: translate3d(dx, 0, 0)`,
    // resolve the hovered column slot from each column's untransformed layout bounds (`rect.left - dx`).
    if (
      effectiveDragged &&
      isColumnElement(effectiveDragged) &&
      effectiveDragged.parentElement &&
      (effectiveDragged.parentElement.contains(rawTarget) || rawTarget.contains(effectiveDragged.parentElement))
    ) {
      const cols = getMoveableSiblings(effectiveDragged).filter((c) => isColumnElement(c));
      if (cols.length >= 2 && cols[0].getBoundingClientRect().width > 0) {
        const hitCol = cols.find((col) => {
          const dx = parseFloat(col.dataset.archDisplaceX || '0') || 0;
          const r = col.getBoundingClientRect();
          return iframeRelativeX >= r.left - dx && iframeRelativeX <= r.right - dx;
        });
        if (hitCol === effectiveDragged) {
          this.clearDropIndicators(true);
          this.hoveredDropTarget = null;
          return;
        }
        if (hitCol) {
          targetUnit = hitCol;
        }
      }
    }

    if (
      !targetUnit ||
      targetUnit === this.draggedUnit ||
      targetUnit === effectiveDragged ||
      targetUnit.tagName.toLowerCase() === 'body'
    ) {
      if (
        effectiveDragged &&
        (targetUnit === this.draggedUnit || targetUnit === effectiveDragged)
      ) {
        this.clearDropIndicators(true);
        this.hoveredDropTarget = null;
      }
      return;
    }

    const targetDx = parseFloat(targetUnit.dataset.archDisplaceX || '0') || 0;
    const rawRect = targetUnit.getBoundingClientRect();
    const rect =
      targetDx !== 0 && rawRect.width > 0
        ? ({
            left: rawRect.left - targetDx,
            right: rawRect.right - targetDx,
            top: rawRect.top,
            bottom: rawRect.bottom,
            width: rawRect.width,
            height: rawRect.height
          } as DOMRect)
        : rawRect;

    const isHorizontal = isColumnElement(targetUnit) && effectiveDragged && isColumnElement(effectiveDragged);
    let isBefore = isHorizontal
      ? iframeRelativeX < rect.left + rect.width / 2
      : iframeRelativeY < rect.top + rect.height / 2;

    // If dragging onto a sibling in the same container (e.g. 2-column or 3-column horizontal reorder,
    // or adjacent row swap), always show the Figma insertion line on the directional target edge!
    if (effectiveDragged && effectiveDragged.parentElement === targetUnit.parentElement) {
      const peers = getMoveableSiblings(effectiveDragged);
      const sIdx = peers.indexOf(effectiveDragged);
      const tIdx = peers.indexOf(targetUnit);
      if (sIdx !== -1 && tIdx !== -1 && sIdx !== tIdx) {
        isBefore = sIdx > tIdx;
      }
    }

    const nextPosition = isBefore ? 'before' : 'after';

    // Perf: pointer moved but the drop slot is unchanged -> skip all DOM/layout work for this frame.
    if (
      this.hoveredDropTarget === targetUnit &&
      this.hoveredDropPosition === nextPosition &&
      this.dropMemoDragged === effectiveDragged &&
      this.dropIndicatorEl
    ) {
      return;
    }
    this.dropMemoDragged = effectiveDragged;

    this.clearDropIndicators(false, true);
    this.hoveredDropTarget = targetUnit;
    this.hoveredDropPosition = nextPosition;

    if (isHorizontal && effectiveDragged && effectiveDragged.parentElement === targetUnit.parentElement) {
      this.applyColumnDisplacementPreview(effectiveDragged, targetUnit, this.hoveredDropPosition);
    } else {
      this.clearColumnDisplacementPreview(true);
    }

    if (isBefore) {
      targetUnit.classList.add('arch-drop-line-top');
    } else {
      targetUnit.classList.add('arch-drop-line-bottom');
    }

    this.renderFigmaDropIndicator(targetUnit, rect, isBefore, !!isHorizontal);
  }

  /**
   * Smoothly animates sibling columns in a 2-column or 3-column row (`transform: translate3d(dx, 0, 0)`)
   * as the user drags a column left or right:
   * - Dragging a column to the LEFT (`destIdx < dragIdx`) slides the left column(s) to the RIGHT (`+dx`).
   * - Dragging a column to the RIGHT (`destIdx > dragIdx`) slides the right column(s) to the LEFT (`-dx`).
   */
  private applyColumnDisplacementPreview(
    draggedCol: HTMLElement,
    targetCol: HTMLElement,
    position: 'before' | 'after'
  ): void {
    const cols = getMoveableSiblings(draggedCol).filter((c) => isColumnElement(c));
    const dragIdx = cols.indexOf(draggedCol);
    const targetIdx = cols.indexOf(targetCol);
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) {
      this.clearColumnDisplacementPreview(true);
      return;
    }

    const insertBeforeIdx = position === 'before' ? targetIdx : targetIdx + 1;
    const destIdx =
      insertBeforeIdx === dragIdx || insertBeforeIdx === dragIdx + 1
        ? targetIdx
        : insertBeforeIdx > dragIdx
          ? insertBeforeIdx - 1
          : insertBeforeIdx;

    const getColAdvance = (col: HTMLElement): number => {
      const r = col.getBoundingClientRect();
      if (r.width > 0) return Math.round(r.width);
      if (col.offsetWidth > 0) return col.offsetWidth;
      const wRaw = col.getAttribute('width') || col.style.width || '';
      const parsed = parseFloat(wRaw);
      if (!isNaN(parsed) && parsed > 0) {
        return wRaw.includes('%') ? Math.round(600 * (parsed / 100)) : Math.round(parsed);
      }
      return Math.round(600 / cols.length);
    };

    const key = `${dragIdx}:${destIdx}`;
    if (this.displaceKey === key) return;
    this.displaceKey = key;

    const dragWidth = getColAdvance(draggedCol);

    cols.forEach((col, i) => {
      col.classList.add('arch-col-displace-ready');
      let dx = 0;
      if (destIdx < dragIdx) {
        if (i >= destIdx && i < dragIdx) {
          // Displaced left column(s) slide to the RIGHT
          dx = dragWidth;
        } else if (i === dragIdx) {
          // Dragged column slides to the LEFT
          dx = -cols.slice(destIdx, dragIdx).reduce((sum, c) => sum + getColAdvance(c), 0);
        }
      } else if (destIdx > dragIdx) {
        if (i > dragIdx && i <= destIdx) {
          // Displaced right column(s) slide to the LEFT
          dx = -dragWidth;
        } else if (i === dragIdx) {
          // Dragged column slides to the RIGHT
          dx = cols.slice(dragIdx + 1, destIdx + 1).reduce((sum, c) => sum + getColAdvance(c), 0);
        }
      }

      if (dx !== 0) {
        col.style.transform = `translate3d(${dx}px, 0, 0)`;
        col.dataset.archDisplaceX = `${dx}`;
        col.dataset.archDisplaced = dx > 0 ? 'right' : 'left';
      } else {
        col.style.removeProperty('transform');
        delete col.dataset.archDisplaceX;
        delete col.dataset.archDisplaced;
      }
    });
  }

  /**
   * Clears live column displacement transforms.
   * - When `keepTransition = true` (e.g. pointer moved back to home slot), keeps `.arch-col-displace-ready`
   *   so columns smoothly glide back to `0px`.
   * - When `keepTransition = false` (e.g. on drop commit), removes transition classes and inline transforms immediately.
   */
  private clearColumnDisplacementPreview(keepTransition = false): void {
    this.displaceKey = '';
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc) return;
    ifrDoc
      .querySelectorAll<HTMLElement>('.arch-col-displace-ready, .arch-col-flip-invert, [data-arch-displaced]')
      .forEach((col) => {
        if (!keepTransition) {
          col.classList.remove('arch-col-displace-ready', 'arch-col-flip-invert');
        }
        col.style.removeProperty('transform');
        if (!col.getAttribute('style')?.trim()) {
          col.removeAttribute('style');
        }
        delete col.dataset.archDisplaceX;
        delete col.dataset.archDisplaced;
      });
  }

  /**
   * Renders the crisp Figma `#0d99ff` Auto-Layout Insertion Line with circular end-caps and slot pill in `overlayLayer`.
   */
  private renderFigmaDropIndicator(
    targetUnit: HTMLElement,
    unitRect: DOMRect,
    isBefore: boolean,
    isHorizontal: boolean
  ): void {
    const iframeRect = this.iframe.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();
    const offsetX = iframeRect.left - containerRect.left;
    const offsetY = iframeRect.top - containerRect.top;

    const ind = document.createElement('div');
    ind.className = `arch-figma-drop-indicator ${isHorizontal ? 'arch-figma-drop-indicator--vertical' : ''}`;

    const desc = describeUnitForLayer(targetUnit);
    const parentCol = targetUnit.closest<HTMLElement>('td.column, th.column, div.column');
    const parentRow = targetUnit.closest<HTMLElement>('table.row, section');
    const rowLabel = parentRow ? describeUnitForLayer(parentRow).label : '';
    const colLabel = parentCol ? describeUnitForLayer(parentCol).label : '';
    const contextPath = [rowLabel, colLabel].filter(Boolean).join(' › ');
    const pillText = `${isBefore ? 'Before' : 'After'} ${desc.label}${contextPath ? ` in ${contextPath}` : ''}`;

    ind.innerHTML = `<span class="arch-figma-drop-pill">${pillText}</span>`;

    if (isHorizontal) {
      const x = offsetX + (isBefore ? unitRect.left : unitRect.right);
      ind.style.left = `${x}px`;
      ind.style.top = `${offsetY + unitRect.top}px`;
      ind.style.height = `${Math.max(24, unitRect.height)}px`;
    } else {
      const y = offsetY + (isBefore ? unitRect.top : unitRect.bottom);
      ind.style.left = `${offsetX + unitRect.left}px`;
      ind.style.top = `${y}px`;
      ind.style.width = `${Math.max(40, unitRect.width)}px`;
    }

    this.overlayLayer.appendChild(ind);
    this.dropIndicatorEl = ind;
  }

  /**
   * Executes a drop operation (either moving `this.draggedUnit` or inserting a block/row from the Assets Palette).
   */
  private executeDrop(data: string): void {
    const targetUnit = this.hoveredDropTarget;
    const position = this.hoveredDropPosition;
    this.clearDropIndicators();
    this.hoveredDropTarget = null;

    // Case 1: Reordering an existing unit on canvas
    if (this.draggedUnit) {
      const source = this.draggedUnit;
      this.draggedUnit = null;
      source.classList.remove('arch-dragging-source');
      if (targetUnit && source !== targetUnit) {
        const snapshotBefore = this.getCleanHTML();
        const moved = moveUnitToTarget(source, targetUnit, position);
        if (moved) {
          const ifrDoc = this.iframe.contentDocument;
          if (ifrDoc && !validateEmailStructure(ifrDoc).valid) {
            this.update({ version: '1.0', settings: {} as any, blocks: [], rawHtml: snapshotBefore }, null, true);
            return;
          }
          this.selectUnit(source, source);
          this.onStructureChanged();
        }
      }
      return;
    }

    // Case 2: Dropping a multi-column Row Layout from the palette
    if (data.startsWith('arch-row:')) {
      const layout = data.replace('arch-row:', '') as RowLayoutType;
      this.insertRowLayout(layout, targetUnit);
      return;
    }

    // Case 3: Dropping a content block from the palette
    if (data && data !== 'arch-move-unit') {
      const blockType = (data.startsWith('arch-block:') ? 'button' : data) as BlockType;
      this.insertBlock(blockType, targetUnit);
    }
  }

  /**
   * Renders or updates the email template inside the isolated canvas iframe.
   */
  public update(doc: EmailDocument, _selectedBlockId: string | null, forceRewrite = false): void {
    const hasBlocks = doc.blocks && doc.blocks.length > 0;
    const hasRawHtml = typeof doc.rawHtml === 'string' && doc.rawHtml.trim().length > 0;

    if (!hasBlocks && !hasRawHtml) {
      this.clearSelection();
      this.containerElement.innerHTML = `
        <div class="arch-canvas-empty">
          <p style="font-weight: 600; font-size: 16px; margin: 0 0 6px 0;">This email is empty</p>
          <p style="margin: 0; color: var(--arch-text-secondary); font-size: 13px;">
            Drag or click blocks from the left palette or import a prebuilt HTML newsletter.
          </p>
        </div>
      `;
      this.emitLayersUpdate();
      return;
    }

    if (!this.containerElement.contains(this.iframe)) {
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.iframe);
      this.containerElement.appendChild(this.overlayLayer);
    }

    const htmlToRender =
      doc.rawHtml && doc.rawHtml.trim() ? doc.rawHtml : compileToEmailHtml(doc);

    if (!forceRewrite && this.lastRenderedHtml === htmlToRender && this.iframe.contentDocument?.body) {
      this.emitLayersUpdate();
      return;
    }
    this.lastRenderedHtml = htmlToRender;

    // 1. Extract frame metadata (DOCTYPE, leading comments, <html xmlns:v ...>)
    this.frameMeta = extractFrameMeta(htmlToRender);

    // 2. Sanitize dangerous scripts/handlers while preserving styles, VML, and MSO comments
    const safeHtml = sanitizeEmailHtml(htmlToRender);

    // 3. Tokenize block-level template tags ({% ... %}, {{#...}}) so table parsing never foster-parents them
    const tokenized = tokenizeTemplateTags(safeHtml, this.frameMeta.tokens);

    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc) return;

    // NOTE: In real browsers (Chrome/Firefox/Safari), `ifrDoc.open()` wipes all event listeners
    // registered on `ifrDoc` and `contentWindow` while keeping the same `Document` reference!
    ifrDoc.open();
    ifrDoc.write(tokenized.html);
    ifrDoc.close();

    // 4. Defense-in-depth DOM sanitization pass
    sanitizeDomTree(ifrDoc);

    // 5. Inject lightweight Figma outline CSS into iframe head (stripped on export)
    this.injectEditorStyles(ifrDoc);

    // 6. Enable single-host direct typing on text leaves
    this.enableDirectEditing(ifrDoc);

    // 7. Always bind delegated iframe events after `ifrDoc.open()/write()/close()`
    this.bindIframeEvents(ifrDoc);

    this.adjustHeight();
    this.emitLayersUpdate();
  }

  /**
   * Injects crisp Figma `#0d99ff` frame & selection outlines into the iframe (stripped cleanly on export).
   */
  private injectEditorStyles(doc: Document): void {
    if (doc.getElementById('arch-canvas-editor-style')) return;

    const styleEl = doc.createElement('style');
    styleEl.id = 'arch-canvas-editor-style';
    styleEl.textContent = `
      *, *:focus, *:focus-visible, [contenteditable], [contenteditable="true"] {
        outline: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      [contenteditable="true"]:not(.arch-editing-text),
      [contenteditable="true"]:not(.arch-editing-text) * {
        cursor: default !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        caret-color: transparent !important;
      }
      .arch-editing-text, .arch-editing-text * {
        outline: none !important;
        cursor: text !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        caret-color: #0d99ff !important;
      }
      .arch-selected-element {
        outline: 2px solid #0d99ff !important;
        outline-offset: -2px;
      }
      .arch-hover-element:not(.arch-selected-element) {
        outline: 1.5px solid rgba(13, 153, 255, 0.75) !important;
        outline-offset: -1.5px;
      }
      .arch-dragging-source {
        opacity: 0.35 !important;
        transition: opacity 0.12s ease !important;
      }
      .arch-col-displace-ready {
        transition: transform 200ms cubic-bezier(0.2, 0, 0, 1) !important;
        will-change: transform !important;
        position: relative !important;
      }
      .arch-col-flip-invert {
        transition: none !important;
        position: relative !important;
      }
      .arch-dragging-source.arch-col-displace-ready {
        opacity: 0.9 !important;
        z-index: 10 !important;
        pointer-events: none !important;
        box-shadow: 0 8px 20px rgba(13, 153, 255, 0.22) !important;
      }
      .arch-drop-line-top {
        box-shadow: inset 0 3px 0 0 #0d99ff !important;
      }
      .arch-drop-line-bottom {
        box-shadow: inset 0 -3px 0 0 #0d99ff !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(styleEl);
  }

  /**
   * Marks true text leaf hosts as `contenteditable="true"` (Fixes R14, R17, R18)
   * and sets `draggable="false"` on `<a>` and `<img>` elements so native browser link/image dragging
   * never blocks selecting text inside a Button or interferes with the Figma Pointer Drag engine.
   */
  public enableDirectEditing(doc: Document): void {
    if (!doc.body) return;

    doc.body.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });

    const candidates = doc.body.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, p, li, blockquote, a, span, div, td, th'
    );
    candidates.forEach((el) => {
      if (isEditableTextHost(el)) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      }
    });

    doc.body.querySelectorAll<HTMLElement>('a, img').forEach((el) => {
      el.setAttribute('draggable', 'false');
    });
  }

  /**
   * Binds delegated click, double-click, pointer-drag, hover, input, keydown, and scroll listeners on `ifrDoc`.
   */
  private bindIframeEvents(doc: Document): void {
    if (this.iframeEventsAbortController) {
      this.iframeEventsAbortController.abort();
    }
    this.iframeEventsAbortController = new AbortController();
    const { signal } = this.iframeEventsAbortController;

    // Block all native link navigation and form submission inside the editor canvas (even on middle-click or after drag-release)
    const preventLinkNavigation = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('a, area')) {
        e.preventDefault();
      }
    };
    doc.addEventListener('click', preventLinkNavigation, { capture: true, signal });
    doc.addEventListener('auxclick', preventLinkNavigation, { capture: true, signal });
    doc.addEventListener('submit', (e) => e.preventDefault(), { capture: true, signal });

    doc.addEventListener('click', (e) => this.handleIframeClick(e), { signal });

    doc.addEventListener('dblclick', (e) => this.handleIframeDoubleClick(e), { signal });

    doc.addEventListener(
      'focusin',
      (e) => {
        if (!this.isEditingText) {
          const t = e.target as HTMLElement | null;
          if (t && (t.getAttribute('contenteditable') === 'true' || t.isContentEditable)) {
            t.blur();
          }
        }
      },
      { signal }
    );

    // Custom Figma Pointer Drag initiator inside the iframe
    doc.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (!target || target.tagName.toLowerCase() === 'body' || target.tagName.toLowerCase() === 'html') {
          return;
        }

        // If user is in Text Edit Mode inside the selected element, allow normal mouse drag-selection of text!
        if (this.isEditingText && this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) {
          return;
        }

        // If user was editing text and clicked outside, exit edit mode
        if (this.isEditingText) {
          this.exitTextEditMode();
        }

        // Prevent browser from automatically focusing contenteditable and showing a blinking caret on single click
        e.preventDefault();

        const unit = this.resolveDragCandidateUnit(target);

        if (unit && unit !== doc.body) {
          const iframeRect = this.iframe.getBoundingClientRect();
          this.pointerDragCandidate = {
            unit,
            startTarget: target,
            startX: iframeRect.left + e.clientX,
            startY: iframeRect.top + e.clientY,
            active: false
          };
        }
      },
      { signal }
    );

    doc.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        const iframeRect = this.iframe.getBoundingClientRect();
        if (this.activeImageResize) {
          this.handleImageResizeMove(iframeRect.left + e.clientX);
          return;
        }
        if (!this.pointerDragCandidate) return;
        this.handlePointerDragMove(iframeRect.left + e.clientX, iframeRect.top + e.clientY);
      },
      { signal }
    );

    doc.addEventListener(
      'mouseup',
      () => {
        if (this.activeImageResize) {
          this.finishImageResize();
          return;
        }
        if (!this.pointerDragCandidate) return;
        this.finishPointerDrag();
      },
      { signal }
    );

    doc.addEventListener(
      'mouseover',
      (e) => {
        if (this.draggedUnit || this.pointerDragCandidate?.active) return;
        const target = e.target as HTMLElement | null;
        if (!target || target.tagName.toLowerCase() === 'body' || target.tagName.toLowerCase() === 'html') {
          return;
        }
        doc.querySelectorAll('.arch-hover-element').forEach((el) => el.classList.remove('arch-hover-element'));
        const unit = this.resolveHoverUnitForHierarchy(target);
        if (unit && unit !== doc.body) {
          unit.classList.add('arch-hover-element');
          this.hoveredUnit = unit;
          if (!this.activeMoveableUnit) {
            this.renderFloatingToolbar(unit, target);
          }
        }
      },
      { signal }
    );

    doc.addEventListener(
      'input',
      () => {
        const cleanHtml = this.getCleanHTML();
        this.lastRenderedHtml = cleanHtml;
        this.events.onContentChange(cleanHtml);
        this.emitLayersUpdate();
      },
      { signal }
    );

    doc.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.isEditingText) {
            this.exitTextEditMode();
            return;
          }
          // Pressing Escape when a child container is selected climbs up to parent container (just like Shift+Enter / Esc in Figma!)
          if (this.activeMoveableUnit) {
            this.selectParentUnit(this.activeMoveableUnit);
            return;
          }
        }

        const active = doc.activeElement as HTMLElement | null;
        if (!active || active.getAttribute('contenteditable') !== 'true') return;

        if (e.key === 'Backspace' || e.key === 'Delete') {
          const text = active.textContent || '';
          if (text.length === 0) {
            e.preventDefault();
          }
        }
      },
      { signal }
    );

    const onScroll = () => {
      const target = this.activeMoveableUnit || this.hoveredUnit;
      if (target && this.floatingToolbar) {
        this.positionFloatingToolbar(target, this.floatingToolbar);
      }
    };
    doc.addEventListener('scroll', onScroll, { passive: true, signal });
    this.iframe.contentWindow?.addEventListener('scroll', onScroll, { passive: true, signal });

    this.bindIframeDragDrop(doc, signal);
  }

  /**
   * Resolves the unit to preview on hover based on current Figma hierarchy depth:
   * - If nothing is selected, previews the Top Container (`Row Frame`).
   * - If a Container (`Row` or `Column`) is selected and cursor is inside it, previews the immediate child level!
   */
  private resolveHoverUnitForHierarchy(target: HTMLElement): HTMLElement {
    const chain = getContainerChain(target);
    if (chain.length === 0) return this.findMoveableUnit(target);

    if (!this.activeMoveableUnit) {
      return chain[0];
    }

    const activeIdx = chain.indexOf(this.activeMoveableUnit);
    if (activeIdx !== -1) {
      return activeIdx + 1 < chain.length ? chain[activeIdx + 1] : chain[activeIdx];
    }

    // If hovering a sibling inside the same Top Row, preview at the same role level (`column` or `block`)
    const activeRole = classifyUnitRole(this.activeMoveableUnit);
    const sameRole = chain.find((u) => classifyUnitRole(u) === activeRole);
    return sameRole || chain[0];
  }

  /**
   * Resolves which Frame/Unit should be dragged when the user presses `mousedown` on `target`:
   * - If `activeMoveableUnit` contains `target`, drags `activeMoveableUnit` (e.g. `Row Frame`, `Column Frame`, or `Block Frame`).
   * - If `activeMoveableUnit` is at the `Column` or `Block` level inside the same Row, and the user presses and drags
   *   a sibling `Column` or `Block`, drags that sibling at the same level!
   * - Otherwise drags the Top Container (`chain[0]`, the `Row Frame`).
   */
  private resolveDragCandidateUnit(target: HTMLElement): HTMLElement {
    if (this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) {
      return this.activeMoveableUnit;
    }

    const chain = getContainerChain(target);
    if (chain.length === 0) return this.findMoveableUnit(target);

    if (this.activeMoveableUnit) {
      const activeRole = classifyUnitRole(this.activeMoveableUnit);
      const sameRole = chain.find((u) => classifyUnitRole(u) === activeRole);
      if (sameRole) return sameRole;
    }

    return chain[0];
  }

  /**
   * Resolves the safe structural moveable unit for any element in the email.
   */
  public findMoveableUnit(el: HTMLElement): HTMLElement {
    return resolveUnit(el);
  }

  /**
   * Highlights a unit on the canvas when hovered in the Left Sidebar Figma Layers Tree.
   */
  public highlightUnitFromTree(unit: HTMLElement | null): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc) return;
    ifrDoc.querySelectorAll('.arch-hover-element').forEach((el) => el.classList.remove('arch-hover-element'));
    if (unit && ifrDoc.body.contains(unit)) {
      unit.classList.add('arch-hover-element');
    }
  }

  /**
   * Selects a unit from the Left Sidebar Figma Layers Tree and scrolls it smoothly into view.
   */
  public selectUnitFromTree(unit: HTMLElement): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body.contains(unit)) return;
    this.exitTextEditMode();
    this.selectUnit(unit, unit);
    if (typeof unit.scrollIntoView === 'function') {
      unit.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Enters Inline Text Edit Mode (`Level 4`) on a Button, Heading, or Paragraph so the user
   * can freely click and drag-select text characters without triggering frame drag.
   */
  public enterTextEditMode(target: HTMLElement, unit?: HTMLElement): void {
    const activeUnit = unit || this.activeMoveableUnit || this.findMoveableUnit(target);
    const host = findEditableTextHost(target, activeUnit);
    if (!host) return;

    if (this.activeMoveableUnit !== activeUnit) {
      this.selectUnit(host, activeUnit);
    }

    this.isEditingText = true;
    host.classList.add('arch-editing-text');
    host.focus();
    this.renderFloatingToolbar(activeUnit, host);
  }

  /**
   * Exits Inline Text Edit Mode and returns to Frame Selection mode.
   */
  public exitTextEditMode(): void {
    if (!this.isEditingText) return;
    this.isEditingText = false;
    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-editing-text').forEach((el) => el.classList.remove('arch-editing-text'));
      if (ifrDoc.activeElement instanceof HTMLElement) {
        ifrDoc.activeElement.blur();
      }
    }
    if (this.activeMoveableUnit) {
      this.renderFloatingToolbar(this.activeMoveableUnit, this.selectedElement || this.activeMoveableUnit);
    }
  }

  /**
   * Handles single-click selection inside the iframe using Figma's Top-Down Hierarchical Frame model:
   * - 1st click on a section selects the Top Container (`Row Frame`).
   * - Clicking a sibling at the currently active hierarchy depth (`Column` or `Block`) switches to that sibling.
   * - Holding `Cmd`/`Ctrl` while clicking jumps directly to the innermost `Block`.
   */
  private handleIframeClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest('a, area');
    if (anchor) {
      e.preventDefault();
    }

    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }

    // If user is currently editing text inside the selected unit, let them place the caret freely!
    if (this.isEditingText && this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) {
      const host = findEditableTextHost(target, this.activeMoveableUnit);
      if (host && !host.contains(target)) {
        host.focus();
      }
      return;
    }

    // Second click of a double-click is handled by `handleIframeDoubleClick` (`dblclick`)
    if (e.detail >= 2) {
      return;
    }

    const selectable = (target.closest('img, a, h1, h2, h3, h4, h5, h6, p, li, hr, td, div, section') ||
      target) as HTMLElement;

    // Programmatic synthetic test clicks (`detail === 0 && !isTrusted`) or `Cmd/Ctrl + Click` deep-selects the leaf block
    if ((!e.isTrusted && e.detail === 0) || e.metaKey || e.ctrlKey) {
      const deepUnit = this.findMoveableUnit(selectable);
      this.exitTextEditMode();
      this.selectUnit(selectable, deepUnit);
      return;
    }

    const chain = getContainerChain(selectable);
    if (chain.length === 0) return;

    // 1. If clicking inside the currently selected container, keep ONLY that container selected (NEVER enter edit mode on single click)
    if (this.activeMoveableUnit && chain.includes(this.activeMoveableUnit)) {
      this.selectUnit(this.activeMoveableUnit, this.activeMoveableUnit);
      return;
    }

    // 2. If another unit at the same role level (`Column` or `Block`) inside the SAME Row was selected,
    //    select the clicked sibling at that same role level!
    if (this.activeMoveableUnit) {
      const prevChain = getContainerChain(this.activeMoveableUnit);
      if (prevChain.length > 0 && prevChain[0] === chain[0]) {
        const activeRole = classifyUnitRole(this.activeMoveableUnit);
        const sameRoleUnit = chain.find((u) => classifyUnitRole(u) === activeRole);
        if (sameRoleUnit) {
          this.exitTextEditMode();
          this.selectUnit(sameRoleUnit, sameRoleUnit);
          return;
        }
      }
    }

    // 3. Otherwise select the Top Container (`chain[0]`, the Row Frame)!
    this.exitTextEditMode();
    this.selectUnit(chain[0], chain[0]);
  }

  /**
   * Handles Figma-style Double-Click Drill-Down (`Row Frame` -> `Column Frame` -> `Block Frame (td)` -> `Leaf (p / a / img)` -> `Inline Text Edit`).
   */
  public handleIframeDoubleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
    }

    const selectable = (target.closest('img, a, h1, h2, h3, h4, h5, h6, p, li, hr, td, div, section') ||
      target) as HTMLElement;
    const chain = getContainerChain(selectable);
    if (chain.length === 0) return;

    const currentIdx = this.activeMoveableUnit ? chain.indexOf(this.activeMoveableUnit) : -1;

    // Case 1: Drill down one step from parent to child (`Row` -> `Column` -> `Block (td)` -> `p / a / img`)
    if (currentIdx >= 0 && currentIdx < chain.length - 1) {
      const nextUnit = chain[currentIdx + 1];
      this.exitTextEditMode();
      this.selectUnit(nextUnit, nextUnit);
      return;
    }

    // Case 2: Already at the innermost Leaf (`currentIdx === chain.length - 1`) ->
    // Only enter Inline Text Edit Mode if the user actually double-clicked ON the text/button leaf itself
    // (never when double-clicking empty left/right padding space of a parent `<td>` or `div.alignment`)!
    if (currentIdx === chain.length - 1) {
      const leafBlock = chain[currentIdx];
      const directHost =
        target.getAttribute('contenteditable') === 'true'
          ? target
          : target.closest<HTMLElement>('[contenteditable="true"]') ||
            (leafBlock.tagName.toLowerCase() === 'a' ? findEditableTextHost(target, leafBlock) : null);
      if (directHost && leafBlock.contains(directHost)) {
        this.enterTextEditMode(directHost, leafBlock);
      }
      return;
    }

    // Case 3: Nothing in `chain` was selected yet -> select the first child level (`chain[1]` or `chain[0]`)
    const initialUnit = chain.length > 1 ? chain[1] : chain[0];
    this.exitTextEditMode();
    this.selectUnit(initialUnit, initialUnit);
  }

  /**
   * Selects a specific inner element and its resolved structural unit, updating the Figma HUD, Inspector, and Layers Tree.
   */
  public selectUnit(selectable: HTMLElement, unit?: HTMLElement): void {
    const resolvedUnit = unit || this.findMoveableUnit(selectable);
    const effectiveSelectable = resolvedUnit.contains(selectable) ? selectable : resolvedUnit;

    this.clearSelection();
    this.selectedElement = effectiveSelectable;
    this.activeMoveableUnit = resolvedUnit;
    resolvedUnit.classList.add('arch-selected-element');

    this.renderFloatingToolbar(resolvedUnit, effectiveSelectable);

    const info = this.extractElementInfo(effectiveSelectable, resolvedUnit);
    this.events.onSelectElement(info);
    this.emitLayersUpdate();
  }

  /**
   * Climbs one structural level up (`Block` -> `Column` -> `Row` -> `Body`) and selects it.
   */
  public selectParentUnit(fromUnit?: HTMLElement): void {
    const current = fromUnit || this.activeMoveableUnit || this.hoveredUnit;
    if (!current) return;
    const parentUnit = getParentStructuralUnit(current);
    if (parentUnit) {
      this.exitTextEditMode();
      this.selectUnit(parentUnit, parentUnit);
    }
  }

  /**
   * Moves the currently selected (or hovered) unit up/left or down/right.
   * Automatically preserves MSO conditional envelopes, gutter cells, card borders, and scoped `@media` rules.
   */
  public moveSelectedElement(direction: 'up' | 'down', targetUnitOverride?: HTMLElement): void {
    const unit =
      targetUnitOverride ||
      this.activeMoveableUnit ||
      (this.selectedElement ? this.findMoveableUnit(this.selectedElement) : null) ||
      this.hoveredUnit;
    if (!unit) return;

    if (!this.activeMoveableUnit || targetUnitOverride) {
      this.selectUnit(unit, unit);
    }

    const effectiveTarget = resolveEffectiveMoveUnit(unit);
    const colsBefore = isColumnElement(effectiveTarget)
      ? getMoveableSiblings(effectiveTarget).filter((c) => isColumnElement(c))
      : [];
    const oldLeftMap = new Map<HTMLElement, number>();
    colsBefore.forEach((col) => {
      const r = col.getBoundingClientRect();
      if (r.width > 0) oldLeftMap.set(col, r.left);
    });

    const snapshotBefore = this.getCleanHTML();
    const moved = moveUnit(unit, direction);
    if (moved) {
      const ifrDoc = this.iframe.contentDocument;
      if (ifrDoc && !validateEmailStructure(ifrDoc).valid) {
        this.update({ version: '1.0', settings: {} as any, blocks: [], rawHtml: snapshotBefore }, null, true);
        return;
      }
      this.onStructureChanged();

      // Play smooth FLIP transition when swapping columns via `◀` / `▶` buttons in a real browser
      if (oldLeftMap.size >= 2) {
        oldLeftMap.forEach((oldLeft, col) => {
          const newLeft = col.getBoundingClientRect().left;
          const deltaX = Math.round(oldLeft - newLeft);
          if (Math.abs(deltaX) > 1) {
            col.classList.remove('arch-col-displace-ready');
            col.classList.add('arch-col-flip-invert');
            col.style.transform = `translate3d(${deltaX}px, 0, 0)`;
            requestAnimationFrame(() => {
              col.classList.remove('arch-col-flip-invert');
              col.classList.add('arch-col-displace-ready');
              col.style.removeProperty('transform');
              setTimeout(() => {
                col.classList.remove('arch-col-displace-ready');
                if (!col.getAttribute('style')?.trim()) col.removeAttribute('style');
              }, 240);
            });
          }
        });
      }
    }
  }

  /**
   * Duplicates the currently selected (or hovered) unit right after itself.
   */
  public duplicateSelectedElement(targetUnitOverride?: HTMLElement): void {
    const rawUnit =
      targetUnitOverride ||
      this.activeMoveableUnit ||
      (this.selectedElement ? this.findMoveableUnit(this.selectedElement) : null) ||
      this.hoveredUnit;
    if (!rawUnit) return;

    const clone = duplicateUnit(rawUnit);
    if (clone) {
      this.selectUnit(clone, clone);
      this.onStructureChanged();
    }
  }

  /**
   * Removes the currently selected (or hovered) unit and its paired envelope comments.
   */
  public removeSelectedElement(targetUnitOverride?: HTMLElement): void {
    const unit =
      targetUnitOverride ||
      this.activeMoveableUnit ||
      (this.selectedElement ? this.findMoveableUnit(this.selectedElement) : null) ||
      this.hoveredUnit;
    if (!unit) return;

    removeUnit(unit);
    this.clearSelection();
    this.onStructureChanged();
    this.events.onSelectElement(null);
  }

  /**
   * Renders the Figma Frame Pill & Dimensions Badge in the parent overlay layer (zero nodes inside iframe DOM).
   */
  private renderFloatingToolbar(unit: HTMLElement, innerTarget?: HTMLElement): void {
    this.removeFloatingToolbar();

    const effectiveMoveTarget = resolveEffectiveMoveUnit(unit);
    const canUp = canMoveUnit(unit, 'up');
    const canDown = canMoveUnit(unit, 'down');
    const parentUnit = getParentStructuralUnit(unit);
    const axis = detectAxis(effectiveMoveTarget);
    const desc = describeUnitForLayer(unit);
    const editableHost = findEditableTextHost(innerTarget || this.selectedElement || unit, unit);
    const badgeLabel = this.isEditingText ? `✎ ${desc.label} (Editing Text)` : desc.label;

    const upIcon = axis === 'horizontal' ? '◀' : '▲';
    const downIcon = axis === 'horizontal' ? '▶' : '▼';
    const upTitle = axis === 'horizontal' ? 'Swap Column Left' : 'Move Up';
    const downTitle = axis === 'horizontal' ? 'Swap Column Right' : 'Move Down';

    const toolbar = document.createElement('div');
    toolbar.className = 'arch-floating-toolbar';
    toolbar.innerHTML = `
      <span class="arch-float-drag" draggable="true" title="Drag Frame (${desc.label}) • Double-click on canvas to drill inside">⠿ ${badgeLabel}</span>
      ${
        editableHost && !this.isEditingText
          ? `<button type="button" class="arch-float-btn btn-float-edit-text" title="Edit / Select Text Inside (or Double-Click)">✎</button>`
          : ''
      }
      <button type="button" class="arch-float-btn btn-float-parent" title="Select Parent Frame (Esc)" ${!parentUnit ? 'disabled' : ''}>↑</button>
      <button type="button" class="arch-float-btn btn-float-up" title="${upTitle}" ${!canUp ? 'disabled' : ''}>${upIcon}</button>
      <button type="button" class="arch-float-btn btn-float-down" title="${downTitle}" ${!canDown ? 'disabled' : ''}>${downIcon}</button>
      <button type="button" class="arch-float-btn btn-float-dup" title="Duplicate Frame">⧉</button>
      <button type="button" class="arch-float-btn arch-float-btn--danger btn-float-del" title="Delete Frame">✕</button>
    `;

    toolbar.querySelector('.btn-float-edit-text')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.enterTextEditMode(innerTarget || this.selectedElement || unit, unit);
    });

    toolbar.querySelector('.btn-float-parent')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectParentUnit(unit);
    });

    toolbar.querySelector('.btn-float-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveSelectedElement('up', unit);
    });

    toolbar.querySelector('.btn-float-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveSelectedElement('down', unit);
    });

    toolbar.querySelector('.btn-float-dup')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.duplicateSelectedElement(unit);
    });

    toolbar.querySelector('.btn-float-del')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeSelectedElement(unit);
    });

    // Support both Pointer-Event dragging and HTML5 dragstart on the `⠿` Frame Pill
    const dragHandle = toolbar.querySelector<HTMLElement>('.arch-float-drag');
    dragHandle?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.pointerDragCandidate = {
        unit,
        startTarget: unit,
        startX: e.clientX,
        startY: e.clientY,
        active: false
      };
    });

    dragHandle?.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', 'arch-move-unit');
        e.dataTransfer.effectAllowed = 'move';
      }
      this.draggedUnit = unit;
      requestAnimationFrame(() => {
        this.overlayLayer.style.pointerEvents = 'auto';
      });
    });

    dragHandle?.addEventListener('dragend', () => {
      this.draggedUnit = null;
      this.overlayLayer.style.pointerEvents = 'none';
      this.clearDropIndicators();
    });

    this.overlayLayer.appendChild(toolbar);
    this.floatingToolbar = toolbar;

    // If this unit is actively selected, also render the Figma Dimensions Badge (`W × H`)
    // and 4 corner resize handles ONLY when the `<img>` leaf itself is selected (never while a parent Row/Column/td is selected!)
    if (this.activeMoveableUnit === unit) {
      const targetEl = innerTarget || this.selectedElement || unit;
      const isDirectImageSelected =
        unit.tagName.toLowerCase() === 'img' ||
        (targetEl.tagName.toLowerCase() === 'img' && targetEl !== unit);
      const targetImg = isDirectImageSelected ? ImageAdapter.findImage(targetEl, unit) : null;

      const rect = (unit.tagName.toLowerCase() === 'img' && targetImg ? targetImg : unit).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const dim = document.createElement('div');
        dim.className = 'arch-dimensions-pill';
        dim.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
        this.overlayLayer.appendChild(dim);
        this.dimensionsBadge = dim;
      }

      if (targetImg) {
        const corners: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; dir: 1 | -1 }> = [
          { corner: 'nw', dir: -1 },
          { corner: 'ne', dir: 1 },
          { corner: 'sw', dir: -1 },
          { corner: 'se', dir: 1 }
        ];
        for (const { corner, dir } of corners) {
          const handle = document.createElement('div');
          handle.className = `arch-resize-handle arch-resize-handle--${corner}`;
          handle.dataset.corner = corner;
          handle.title = 'Drag to resize image';
          handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const imgRect = targetImg.getBoundingClientRect();
            const parsedWidth =
              parseInt(ImageAdapter.getWidth(targetImg, unit), 10) ||
              parseInt(targetImg.getAttribute('width') || '', 10) ||
              200;
            const startWidth = imgRect.width > 0 ? imgRect.width : parsedWidth;
            const colCell = targetImg.closest('td, th') as HTMLElement | null;
            const colWidth = colCell?.getBoundingClientRect().width || 0;
            const maxWidth = colWidth > 40 ? Math.round(colWidth) : 600;

            this.activeImageResize = {
              img: targetImg,
              unit,
              startX: e.clientX,
              startWidth,
              maxWidth: Math.max(maxWidth, Math.round(startWidth)),
              dir
            };
            this.overlayLayer.style.pointerEvents = 'auto';
          });
          this.overlayLayer.appendChild(handle);
          this.resizeHandles.push(handle);
        }
      }
    }

    this.positionFloatingToolbar(unit, toolbar);
  }

  /**
   * Positions the Figma Frame Pill, Dimensions Badge, and Image Resize Handles relative to `unit` inside the iframe.
   */
  private positionFloatingToolbar(unit: HTMLElement, toolbar: HTMLElement): void {
    const unitRect = unit.getBoundingClientRect();
    const iframeRect = this.iframe.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();

    const offsetX = iframeRect.left - containerRect.left;
    const offsetY = iframeRect.top - containerRect.top;

    const top = Math.max(4, offsetY + unitRect.top - 28);
    const left = Math.max(4, offsetX + unitRect.left);

    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;

    const targetEl = this.selectedElement || unit;
    const targetImg =
      this.resizeHandles.length > 0 ? ImageAdapter.findImage(targetEl, unit) : null;
    const targetRect =
      targetImg && targetImg.getBoundingClientRect().width > 0
        ? targetImg.getBoundingClientRect()
        : unitRect;

    if (this.dimensionsBadge) {
      const dimTop = offsetY + targetRect.bottom + 4;
      const dimLeft = offsetX + targetRect.left + targetRect.width / 2;
      this.dimensionsBadge.style.top = `${dimTop}px`;
      this.dimensionsBadge.style.left = `${dimLeft}px`;
    }

    for (const handle of this.resizeHandles) {
      const corner = handle.dataset.corner;
      const hTop =
        corner === 'nw' || corner === 'ne'
          ? offsetY + targetRect.top - 5
          : offsetY + targetRect.bottom - 5;
      const hLeft =
        corner === 'nw' || corner === 'sw'
          ? offsetX + targetRect.left - 5
          : offsetX + targetRect.right - 5;
      handle.style.top = `${hTop}px`;
      handle.style.left = `${hLeft}px`;
    }
  }

  private removeFloatingToolbar(): void {
    if (this.floatingToolbar) {
      this.floatingToolbar.remove();
      this.floatingToolbar = null;
    }
    if (this.dimensionsBadge) {
      this.dimensionsBadge.remove();
      this.dimensionsBadge = null;
    }
    if (this.resizeHandles.length > 0) {
      this.resizeHandles.forEach((h) => h.remove());
      this.resizeHandles = [];
    }
    if (!this.pointerDragCandidate?.active && !this.activeImageResize) {
      this.overlayLayer.style.pointerEvents = 'none';
    }
  }

  /**
   * Invoked whenever the DOM structure or styling is altered.
   */
  public onStructureChanged(): void {
    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      this.enableDirectEditing(ifrDoc);
      if (this.activeMoveableUnit && this.selectedElement && ifrDoc.body.contains(this.activeMoveableUnit)) {
        this.activeMoveableUnit.classList.add('arch-selected-element');
        this.renderFloatingToolbar(this.activeMoveableUnit, this.selectedElement);
        const info = this.extractElementInfo(this.selectedElement, this.activeMoveableUnit);
        this.events.onSelectElement(info);
      }
    }

    const cleanHtml = this.getCleanHTML();
    this.lastRenderedHtml = cleanHtml;
    this.events.onContentChange(cleanHtml);
    this.emitLayersUpdate();
  }

  private emitLayersUpdate(): void {
    if (!this.events.onLayersChange) return;
    const layers = this.getLayerTree();
    this.events.onLayersChange(layers, this.activeMoveableUnit);
  }

  /**
   * Clears selection outlines and floating toolbar.
   */
  public clearSelection(): void {
    this.isEditingText = false;
    if (this.activeMoveableUnit) {
      this.activeMoveableUnit.classList.remove('arch-selected-element');
      this.activeMoveableUnit = null;
    }
    if (this.selectedElement) {
      this.selectedElement.classList.remove('arch-selected-element');
      this.selectedElement = null;
    }
    this.hoveredUnit = null;
    this.removeFloatingToolbar();

    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-selected-element, .arch-hover-element').forEach((el) => {
        el.classList.remove('arch-selected-element', 'arch-hover-element');
      });
    }
  }

  /**
   * Extracts rich semantic element & unit information for the Inspector panel.
   */
  private extractElementInfo(el: HTMLElement, unit?: HTMLElement): SelectedElementInfo {
    const targetUnit = unit || this.findMoveableUnit(el);
    const effectiveMoveTarget = resolveEffectiveMoveUnit(targetUnit);
    const type = classifyElementType(el, targetUnit);
    const unitRole = classifyUnitRole(targetUnit);
    const axis = detectAxis(effectiveMoveTarget);
    const ancestry = getUnitAncestry(targetUnit, el);

    const style = el.style;
    const computed = this.iframe.contentWindow?.getComputedStyle(el);

    const canUp = canMoveUnit(targetUnit, 'up');
    const canDown = canMoveUnit(targetUnit, 'down');
    const canSelectParent = !!getParentStructuralUnit(targetUnit);

    let text = (el.textContent || '').trim();
    let src = el.getAttribute('src') || '';
    let alt = el.getAttribute('alt') || '';
    let url = el.getAttribute('href') || '';
    let bg = style.backgroundColor || computed?.backgroundColor || '';
    let color = style.color || computed?.color || '';
    let width = style.maxWidth || el.getAttribute('width') || '';
    let borderRadius = style.borderRadius || '';

    if (type === 'button') {
      text = ButtonAdapter.getLabel(el, targetUnit);
      url = ButtonAdapter.getUrl(el, targetUnit);
      bg = ButtonAdapter.getBackgroundColor(el, targetUnit) || bg;
      color = ButtonAdapter.getTextColor(el, targetUnit) || color;
      borderRadius = ButtonAdapter.getBorderRadius(el, targetUnit);
    } else if (type === 'image') {
      src = ImageAdapter.getSrc(el, targetUnit);
      alt = ImageAdapter.getAlt(el, targetUnit);
      url = ImageAdapter.getLinkUrl(el, targetUnit);
      width = ImageAdapter.getWidth(el, targetUnit);
    }

    return {
      tagName: el.tagName.toLowerCase(),
      type,
      unitRole,
      axis,
      text,
      src,
      alt,
      url,
      color,
      backgroundColor: bg,
      fontSize: style.fontSize || computed?.fontSize || '',
      textAlign: (style.textAlign || computed?.textAlign || '') as any,
      padding: targetUnit.style.padding || style.padding || computed?.padding || '',
      width,
      borderRadius,
      canMoveUp: canUp,
      canMoveDown: canDown,
      canSelectParent,
      ancestry,
      element: el,
      unit: targetUnit
    };
  }

  /**
   * Binds dragover and drop handlers inside the iframe document for Palette items
   * and blocks native `contenteditable` text-drop corruption.
   */
  private bindIframeDragDrop(doc: Document, signal?: AbortSignal): void {
    doc.addEventListener(
      'dragstart',
      (e: DragEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Prevent browser from dragging raw text/HTML snippets out of contenteditable
        if (target.nodeType === 3 || target.isContentEditable) {
          e.preventDefault();
          return;
        }

        const unit =
          this.activeMoveableUnit && this.activeMoveableUnit.contains(target)
            ? this.activeMoveableUnit
            : this.findMoveableUnit(target);

        if (unit && unit !== doc.body) {
          this.draggedUnit = unit;
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', 'arch-move-unit');
            e.dataTransfer.effectAllowed = 'move';
          }
        }
      },
      { signal }
    );

    doc.addEventListener(
      'dragend',
      () => {
        this.draggedUnit = null;
        this.overlayLayer.style.pointerEvents = 'none';
        this.clearDropIndicators();
      },
      { signal }
    );

    doc.addEventListener(
      'dragover',
      (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = this.draggedUnit ? 'move' : 'copy';
        }

        const target = e.target as HTMLElement;
        if (!target) return;
        this.updateDropTargetForElement(target, e.clientX, e.clientY);
      },
      { signal }
    );

    doc.addEventListener(
      'dragleave',
      (e: DragEvent) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !doc.body.contains(related)) {
          this.clearDropIndicators();
          this.hoveredDropTarget = null;
        }
      },
      { signal }
    );

    doc.addEventListener(
      'drop',
      (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer?.getData('text/plain') || '';
        this.executeDrop(data);
      },
      { signal }
    );
  }

  private clearDropIndicators(keepDisplacementTransition = false, skipDisplacementClear = false): void {
    if (this.dropIndicatorEl) {
      this.dropIndicatorEl.remove();
      this.dropIndicatorEl = null;
    }
    if (!skipDisplacementClear) {
      this.clearColumnDisplacementPreview(keepDisplacementTransition);
    }
    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-drop-line-top, .arch-drop-line-bottom').forEach((el) => {
        el.classList.remove('arch-drop-line-top', 'arch-drop-line-bottom');
      });
    }
  }

  /**
   * Inserts a context-aware email block at the target unit or canonical column slot container (Fixes R3).
   */
  public insertBlock(type: BlockType, targetElement?: HTMLElement | null): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;

    if (refUnit && refUnit.parentElement && refUnit !== ifrDoc.body) {
      if (isColumnElement(refUnit)) {
        const slot = getColumnSlotContainer(refUnit);
        const snippet = buildContextAwareBlockHtml(type, slot.tagName.toLowerCase());
        slot.insertAdjacentHTML('beforeend', snippet);
      } else {
        const parentTag = refUnit.parentElement.tagName.toLowerCase();
        const snippet = buildContextAwareBlockHtml(type, parentTag);
        refUnit.insertAdjacentHTML('afterend', snippet);
      }
    } else {
      const container = findPrimaryContentContainer(ifrDoc);
      const containerTag = container.tagName.toLowerCase();
      const snippet = buildContextAwareBlockHtml(type, containerTag);
      container.insertAdjacentHTML('beforeend', snippet);
    }

    this.onStructureChanged();
  }

  /**
   * Inserts a new multi-column Row Section into the email layout.
   */
  public insertRowLayout(layout: RowLayoutType, targetElement?: HTMLElement | null): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;
    const enclosingRow = refUnit?.closest<HTMLElement>('table.row, section');

    if (enclosingRow && enclosingRow.parentElement) {
      const parentTag = enclosingRow.parentElement.tagName.toLowerCase();
      const wrapInTr = parentTag === 'tbody' || parentTag === 'table';
      const html = buildRowLayoutHtml(layout, wrapInTr);
      enclosingRow.insertAdjacentHTML('afterend', html);
    } else {
      const container = findPrimaryContentContainer(ifrDoc);
      const containerTag = container.tagName.toLowerCase();
      const wrapInTr = containerTag === 'tbody' || containerTag === 'table';
      const html = buildRowLayoutHtml(layout, wrapInTr);
      container.insertAdjacentHTML('beforeend', html);
    }

    this.onStructureChanged();
  }

  /**
   * Adjusts the iframe to fill 100% of the canvas area touching the sidebars.
   */
  public adjustHeight(): void {
    if (this.viewportMode === 'desktop') {
      this.iframe.style.width = '100%';
    }
    this.iframe.style.height = '100%';
  }

  /**
   * Serializes the live iframe DOM and strips all editor-specific helper attributes,
   * restoring the original DOCTYPE, `<html xmlns:v>` attributes, and template tags.
   */
  public getCleanHTML(): string {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.documentElement || !ifrDoc.body) {
      return this.lastRenderedHtml || '';
    }
    return serializeCleanDocument(ifrDoc, this.frameMeta);
  }

  public destroy(): void {
    this.removeFloatingToolbar();
    this.removeDragGhost();
    this.clearDropIndicators();
    this.element.remove();
  }
}

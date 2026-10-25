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

import { BlockType, EmailDocument, LayerNode, PrebuiltSection, RowLayoutType, SelectedElementInfo, ViewportMode } from '../types';
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
  isButtonComponent,
  isEditableTextHost,
  isOuterWrapperTable,
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
  ColumnLayoutAdapter,
  ensureEmptyColumnPlaceholders,
  findPrimaryContentContainer,
  ImageAdapter,
  resolveButtonAnatomy,
  wrapContextAwareHtmlSnippet
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
  onResolveSection?: (id: string) => PrebuiltSection | undefined;
  onUndo?: () => void;
  onRedo?: () => void;
}

export class Canvas {
  private element: HTMLElement;
  private containerElement: HTMLElement;
  private floatingHistory: HTMLElement | null = null;
  private iframe: HTMLIFrameElement;
  private overlayLayer: HTMLElement;
  private floatingToolbar: HTMLElement | null = null;
  private bottomActions: HTMLElement | null = null;
  private textToolbar: HTMLElement | null = null;
  private dimensionsBadge: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
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
  private slotRectCache = new Map<HTMLElement, { rect: DOMRect; scrollX: number; scrollY: number }>();
  private activeElementResize: {
    kind: 'image' | 'button';
    target: HTMLElement;
    unit: HTMLElement;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    maxWidth: number;
    dirX: number;
    dirY: number;
    mode: 'box';
    startPadY?: number;
  } | null = null;
  private columnResizeHandles: HTMLElement[] = [];
  private readOnly: boolean = false;
  private activeColumnResize: {
    handle: HTMLElement;
    row: HTMLElement;
    leftCol: HTMLElement;
    rightCol: HTMLElement;
    startX: number;
    leftStartWidth: number;
    rightStartWidth: number;
    pairTotalWidth: number;
    leftStartPct: number;
    rightStartPct: number;
    pairTotalPct: number;
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

    // Floating bottom-left Undo / Redo controls (BeeFree / Figma layout)
    this.floatingHistory = document.createElement('div');
    this.floatingHistory.className = 'arch-canvas-floating-history';
    this.floatingHistory.innerHTML = `
      <button class="arch-floating-history-btn arch-btn--undo" type="button" title="Undo (Ctrl+Z)" disabled>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 14 4 9l5-5"/>
          <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
        </svg>
      </button>
      <span class="arch-floating-history-divider"></span>
      <button class="arch-floating-history-btn arch-btn--redo" type="button" title="Redo (Ctrl+Y)" disabled>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 14 5-5-5-5"/>
          <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>
        </svg>
      </button>
    `;

    this.floatingHistory.querySelector('.arch-btn--undo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.events.onUndo?.();
    });

    this.floatingHistory.querySelector('.arch-btn--redo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.events.onRedo?.();
    });

    this.containerElement.appendChild(this.iframe);
    this.containerElement.appendChild(this.overlayLayer);
    this.containerElement.appendChild(this.floatingHistory);
    this.element.appendChild(this.containerElement);

    this.bindOuterEvents();
  }

  public updateHistoryState(canUndo: boolean, canRedo: boolean): void {
    if (!this.floatingHistory) return;
    const undoBtn = this.floatingHistory.querySelector<HTMLButtonElement>('.arch-btn--undo');
    const redoBtn = this.floatingHistory.querySelector<HTMLButtonElement>('.arch-btn--redo');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  }

  public setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    if (readOnly) {
      this.clearSelection();
      this.exitTextEditMode();
      this.removeFloatingToolbar();
      if (this.floatingHistory) this.floatingHistory.style.display = 'none';
      const ifrDoc = this.iframe.contentDocument;
      if (ifrDoc) {
        ifrDoc.body.querySelectorAll('[contenteditable]').forEach((el) => {
          el.removeAttribute('contenteditable');
        });
      }
    } else {
      if (this.floatingHistory) this.floatingHistory.style.display = '';
      const ifrDoc = this.iframe.contentDocument;
      if (ifrDoc) {
        this.enableDirectEditing(ifrDoc);
      }
    }
  }

  public isReadOnly(): boolean {
    return this.readOnly;
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
    this.syncHUDPosition();
  }

  /**
   * Re-evaluates and aligns the parent overlay HUD (toolbar, dimensions pill, resize handles)
   * relative to the currently active or hovered unit.
   */
  public syncHUDPosition(): void {
    const target = this.activeMoveableUnit || this.hoveredUnit;
    if (target && (this.floatingToolbar || this.bottomActions || this.columnResizeHandles.length > 0)) {
      this.positionFloatingToolbar(target, this.floatingToolbar || undefined);
    }
  }

  /**
   * Binds click, pointer-drag, and palette HTML5 drop events on the outer canvas container & overlay shield.
   */
  private bindOuterEvents(): void {
    const onScrollOrResize = () => this.syncHUDPosition();
    this.containerElement.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncHUDPosition());
      this.resizeObserver.observe(this.containerElement);
      this.resizeObserver.observe(this.iframe);
    }

    // Global Escape Key Drill-Up:
    // Allows pressing Escape from anywhere (e.g. while inspecting fields or clicking outer canvas)
    // to exit inline text editing or climb to parent container frame (Figma behavior).
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isEditingText) {
          this.exitTextEditMode();
          return;
        }
        if (this.activeMoveableUnit) {
          this.selectParentUnit(this.activeMoveableUnit);
          return;
        }
      }

      // Global Undo/Redo Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        const active = document.activeElement;
        const isEditingInp = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable
        );
        if (!isEditingInp && !this.isEditingText) {
          if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.events.onUndo?.();
            return;
          }
          if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            this.events.onRedo?.();
            return;
          }
        }
      }
    });

    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target === this.element ||
        target === this.containerElement ||
        target === this.overlayLayer
      ) {
        this.exitTextEditMode();
        this.clearSelection();
        this.events.onSelectElement(null);
        this.events.onSelectBlock(null);
        this.emitLayersUpdate();
      }
    });

    // Parent window pointermove/mouseup listeners for 60fps custom Figma Pointer Drag & Image Resize
    // Coalesce mousemove to at most one drag update per animation frame (no redundant work at 120Hz+ mice)
    window.addEventListener('mousemove', (e) => {
      if (this.activeColumnResize) {
        this.handleColumnResizeMove(e.clientX);
        return;
      }
      if (this.activeElementResize) {
        this.handleElementResizeMove(e.clientX, e.clientY);
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
      if (this.activeColumnResize) {
        this.finishColumnResize();
        return;
      }
      if (this.activeElementResize) {
        this.finishElementResize();
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

      // Resolve the effective unit for dragging
      const effectiveCand = resolveEffectiveMoveUnit(cand.unit);
      const candPeers = getMoveableSiblings(effectiveCand);
      const hasHorizontalPeers = candPeers.length >= 2 && detectAxis(effectiveCand) === 'horizontal';

      // Direction-aware Auto-Column Drag Initiator:
      // ONLY escalate to `enclosingCol` if the dragged unit is explicitly a Row (`isRowElement`),
      // OR if the unit has NO horizontal peers in its own container to reorder between!
      if (Math.abs(dx) > Math.abs(dy) * 1.1) {
        if (!hasHorizontalPeers && isRowElement(cand.unit)) {
          const enclosingCol = findEnclosingColumn(cand.startTarget);
          if (enclosingCol && getMoveableSiblings(enclosingCol).length >= 2) {
            cand.unit = enclosingCol;
          } else {
            cand.unit = effectiveCand;
          }
        } else {
          cand.unit = effectiveCand;
        }
      } else {
        // Vertical drag: escalate single-child inner units to their effective moveable unit
        if (!hasHorizontalPeers) {
          const effective = resolveEffectiveMoveUnit(cand.unit);
          if (effective && effective !== cand.unit) {
            cand.unit = effective;
          }
        } else {
          cand.unit = effectiveCand;
        }
      }

      this.selectUnit(cand.unit, cand.unit);
      this.removeFloatingToolbar();

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
   * Resizes the active element (image, button, text) live as the user drags an `.arch-resize-handle`.
   */
  private handleElementResizeMove(clientX: number, clientY: number): void {
    const state = this.activeElementResize;
    if (!state) return;

    const deltaX = (clientX - state.startX) * state.dirX;
    const deltaY = (clientY - state.startY) * state.dirY;

    if (!this.dimensionsBadge) {
      const dim = document.createElement('div');
      dim.className = 'arch-dimensions-pill';
      this.overlayLayer.appendChild(dim);
      this.dimensionsBadge = dim;
    }

    if (state.kind === 'image') {
      const nextWidth = state.dirX !== 0
        ? Math.round(Math.max(24, Math.min(state.maxWidth, state.startWidth + deltaX)))
        : Math.round(state.startWidth);

      const nextHeight = state.dirY !== 0
        ? Math.round(Math.max(20, state.startHeight + deltaY))
        : Math.round(state.startHeight);

      ImageAdapter.setDimensions(state.target, nextWidth, nextHeight, state.unit);
      this.dimensionsBadge.textContent = `${nextWidth} × ${nextHeight}`;
    } else if (state.kind === 'button') {
      const nextWidth = Math.round(Math.max(40, Math.min(state.maxWidth, state.startWidth + deltaX)));
      ButtonAdapter.setWidth(state.target, `${nextWidth}px`, state.unit);
      if (state.dirY !== 0 && state.startPadY !== undefined) {
        const nextPadY = Math.round(Math.max(4, Math.min(48, state.startPadY + deltaY)));
        ButtonAdapter.setPaddingY(state.target, `${nextPadY}px`, state.unit);
      }
      const rect = state.target.getBoundingClientRect();
      this.dimensionsBadge.textContent = `${nextWidth} × ${Math.round(rect.height)}`;
    }

    this.positionFloatingToolbar(state.unit, this.floatingToolbar || undefined);

    const targetRect = state.target.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();
    this.dimensionsBadge.style.left = `${targetRect.left - containerRect.left + targetRect.width / 2}px`;
    this.dimensionsBadge.style.top = `${Math.max(4, targetRect.top - containerRect.top - 24)}px`;
  }

  /**
   * Commits an interactive element resize operation and syncs the Inspector & history.
   */
  private finishElementResize(): void {
    const state = this.activeElementResize;
    if (!state) return;
    this.activeElementResize = null;
    this.suppressNextClick = true;
    this.overlayLayer.style.pointerEvents = 'none';

    if (this.dimensionsBadge) {
      this.dimensionsBadge.remove();
      this.dimensionsBadge = null;
    }

    this.selectUnit(state.target, state.unit);
    this.adjustHeight();
    this.onStructureChanged();
  }

  /**
   * Resizes two adjacent columns live as the user drags a column boundary `.arch-col-resize-handle`.
   */
  private handleColumnResizeMove(clientX: number): void {
    const state = this.activeColumnResize;
    if (!state) return;

    const deltaX = clientX - state.startX;
    const minWidthPx = 35;

    let nextLeftWidth = state.leftStartWidth + deltaX;
    let nextRightWidth = state.rightStartWidth - deltaX;

    if (nextLeftWidth < minWidthPx) {
      nextLeftWidth = minWidthPx;
      nextRightWidth = state.pairTotalWidth - minWidthPx;
    } else if (nextRightWidth < minWidthPx) {
      nextRightWidth = minWidthPx;
      nextLeftWidth = state.pairTotalWidth - minWidthPx;
    }

    const ratio = nextLeftWidth / state.pairTotalWidth;
    const newLeftPct = Math.round(ratio * state.pairTotalPct * 10) / 10;
    const newRightPct = Math.round((state.pairTotalPct - newLeftPct) * 10) / 10;

    ColumnLayoutAdapter.setColumnPairWidths(state.leftCol, state.rightCol, newLeftPct, newRightPct);

    this.positionFloatingToolbar(state.row);

    if (!this.dimensionsBadge) {
      const dim = document.createElement('div');
      dim.className = 'arch-dimensions-pill';
      this.overlayLayer.appendChild(dim);
      this.dimensionsBadge = dim;
    }

    this.dimensionsBadge.textContent = `${Math.round(newLeftPct)}% | ${Math.round(newRightPct)}%`;
    const handleRect = state.handle.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();
    this.dimensionsBadge.style.left = `${handleRect.left - containerRect.left + handleRect.width / 2}px`;
    this.dimensionsBadge.style.top = `${Math.max(4, handleRect.top - containerRect.top - 24)}px`;
  }

  /**
   * Commits an interactive column resize operation and syncs empty column placeholders & history.
   */
  private finishColumnResize(): void {
    const state = this.activeColumnResize;
    if (!state) return;

    state.handle.classList.remove('active');
    this.activeColumnResize = null;
    this.suppressNextClick = true;
    this.overlayLayer.style.pointerEvents = 'none';

    if (this.dimensionsBadge) {
      this.dimensionsBadge.remove();
      this.dimensionsBadge = null;
    }

    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ensureEmptyColumnPlaceholders(ifrDoc);
    }

    this.selectUnit(state.leftCol, state.row);
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

    const isHorizontalDrag = effectiveDragged ? detectAxis(effectiveDragged) === 'horizontal' : false;

    // Oscillation-free untransformed slot hit-testing during horizontal drag:
    // (columns, menu links with display:inline-block, social icon strips, etc.)
    if (
      effectiveDragged &&
      isHorizontalDrag &&
      effectiveDragged.parentElement &&
      (effectiveDragged.parentElement.contains(rawTarget) || rawTarget.contains(effectiveDragged.parentElement))
    ) {
      const peers = getMoveableSiblings(effectiveDragged);
      this.cacheSiblingSlots(peers);
      if (peers.length >= 2 && this.getSlotRect(peers[0]).width > 0) {
        const hitCol = peers.find((col) => {
          const r = this.getSlotRect(col);
          return iframeRelativeX >= r.left && iframeRelativeX <= r.right;
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

    // Same for vertical drag (rows / blocks): hit-test the pointer against each sibling's cached untransformed slot.
    if (effectiveDragged && !isHorizontalDrag && effectiveDragged.parentElement) {
      const peers = getMoveableSiblings(effectiveDragged);
      this.cacheSiblingSlots(peers);
      const parentRect = effectiveDragged.parentElement.getBoundingClientRect();
      if (
        peers.length >= 2 &&
        parentRect.width > 0 &&
        iframeRelativeX >= parentRect.left &&
        iframeRelativeX <= parentRect.right &&
        iframeRelativeY >= parentRect.top &&
        iframeRelativeY <= parentRect.bottom
      ) {
        const hit = peers.find((p) => {
          const r = this.getSlotRect(p);
          return iframeRelativeY >= r.top && iframeRelativeY <= r.bottom;
        });
        if (hit === effectiveDragged) {
          this.clearDropIndicators(true);
          this.hoveredDropTarget = null;
          return;
        }
        if (hit) {
          // Entry threshold on tall neighbors (`height >= 140px`): require crossing at least 15% (up to 24px)
          // past the shared edge before flipping the slot, preventing 1px boundary jumps.
          const r = this.getSlotRect(hit);
          const sIdx = peers.indexOf(effectiveDragged);
          const hIdx = peers.indexOf(hit);
          if (hit !== this.hoveredDropTarget && r.height >= 140 && Math.abs(hIdx - sIdx) === 1) {
            const margin = Math.min(24, r.height * 0.15);
            const entered =
              hIdx > sIdx ? iframeRelativeY >= r.top + margin : iframeRelativeY <= r.bottom - margin;
            if (!entered) {
              return;
            }
          }
          targetUnit = hit;
        } else if (this.hoveredDropTarget && peers.includes(this.hoveredDropTarget)) {
          return; // pointer in a gap between siblings: keep the current slot (no flicker)
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

    const rect = this.getSlotRect(targetUnit);

    const isHorizontal =
      Boolean(targetUnit && effectiveDragged && detectAxis(targetUnit) === 'horizontal' && isHorizontalDrag);
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

    const isDisplacingSiblings = Boolean(
      effectiveDragged &&
        effectiveDragged.parentElement === targetUnit.parentElement &&
        detectAxis(effectiveDragged) === detectAxis(targetUnit)
    );

    if (isDisplacingSiblings && effectiveDragged) {
      this.applySiblingDisplacementPreview(effectiveDragged, targetUnit, this.hoveredDropPosition);
    } else {
      this.clearColumnDisplacementPreview(true);
      if (isBefore) {
        targetUnit.classList.add('arch-drop-line-top');
      } else {
        targetUnit.classList.add('arch-drop-line-bottom');
      }
    }

    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-drop-hover').forEach((el) => el.classList.remove('arch-drop-hover'));
      if (targetUnit.classList.contains('arch-empty-col-placeholder')) {
        targetUnit.classList.add('arch-drop-hover');
      } else {
        const ph = targetUnit.querySelector<HTMLElement>('.arch-empty-col-placeholder');
        if (ph) ph.classList.add('arch-drop-hover');
      }
    }

    this.renderFigmaDropIndicator(targetUnit, rect, isBefore, isHorizontal);
  }

  /**
   * Snapshots the true untransformed `getBoundingClientRect()` of each sibling in `els`
   * before any CSS transition/transform is applied, preventing mid-transition `getBoundingClientRect()` drift.
   */
  private cacheSiblingSlots(els: HTMLElement[]): void {
    const win = this.iframe.contentWindow;
    const scrollX = win?.scrollX || 0;
    const scrollY = win?.scrollY || 0;
    for (const el of els) {
      if (this.slotRectCache.has(el)) continue;
      if (el.dataset.archDisplaceX || el.dataset.archDisplaceY) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        this.slotRectCache.set(el, {
          rect: {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            x: r.left,
            y: r.top,
            toJSON: () => ({})
          } as DOMRect,
          scrollX,
          scrollY
        });
      }
    }
  }

  /**
   * Untransformed layout slot rect of `el`.
   * Uses `slotRectCache` so active 200ms CSS transitions never corrupt hit-testing or displacement distances.
   */
  private getSlotRect(el: HTMLElement): DOMRect {
    const cached = this.slotRectCache.get(el);
    if (cached) {
      const win = this.iframe.contentWindow;
      const dScrollX = (win?.scrollX || 0) - cached.scrollX;
      const dScrollY = (win?.scrollY || 0) - cached.scrollY;
      if (dScrollX === 0 && dScrollY === 0) {
        return cached.rect;
      }
      return {
        left: cached.rect.left - dScrollX,
        right: cached.rect.right - dScrollX,
        top: cached.rect.top - dScrollY,
        bottom: cached.rect.bottom - dScrollY,
        width: cached.rect.width,
        height: cached.rect.height,
        x: cached.rect.left - dScrollX,
        y: cached.rect.top - dScrollY,
        toJSON: () => ({})
      } as DOMRect;
    }

    const r = el.getBoundingClientRect();
    const dx = parseFloat(el.dataset.archDisplaceX || '0') || 0;
    const dy = parseFloat(el.dataset.archDisplaceY || '0') || 0;
    if (!dx && !dy && (r.width > 0 || r.height > 0)) {
      this.cacheSiblingSlots([el]);
      return r;
    }
    if ((!dx && !dy) || (r.width <= 0 && r.height <= 0)) return r;
    return {
      left: r.left - dx,
      right: r.right - dx,
      top: r.top - dy,
      bottom: r.bottom - dy,
      width: r.width,
      height: r.height
    } as DOMRect;
  }

  /**
   * Figma Auto-Layout style live displacement of same-parent siblings while dragging
   * (`transform: translate3d`, GPU-composited, 200ms ease):
   * - Columns move horizontally (axis `x`); Rows / Blocks move vertically (axis `y`).
   * - Uses cached untransformed slot endpoints so items of unequal heights/widths never drift or overshoot.
   */
  private applySiblingDisplacementPreview(
    dragged: HTMLElement,
    target: HTMLElement,
    position: 'before' | 'after'
  ): void {
    const axis: 'x' | 'y' = detectAxis(dragged) === 'horizontal' ? 'x' : 'y';
    const items = getMoveableSiblings(dragged);
    const dragIdx = items.indexOf(dragged);
    const targetIdx = items.indexOf(target);
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

    const key = `${axis}:${dragIdx}:${destIdx}`;
    if (this.displaceKey === key) return;
    this.displaceKey = key;

    // 1. Snapshot all sibling slots BEFORE touching any transform/dataset attributes
    this.cacheSiblingSlots(items);
    const slots = items.map((el) => this.getSlotRect(el));
    const hasGeometry = axis === 'x' ? slots[dragIdx].width > 0 : slots[dragIdx].height > 0;

    let bypassedDelta = 0;
    let draggedDelta = 0;

    if (hasGeometry) {
      const sizeOf = (s: DOMRect) => (axis === 'x' ? s.width : s.height);
      const startOf = (s: DOMRect) => (axis === 'x' ? s.left : s.top);
      const endOf = (s: DOMRect) => (axis === 'x' ? s.right : s.bottom);
      const dragSize = sizeOf(slots[dragIdx]);

      if (destIdx < dragIdx) {
        bypassedDelta = Math.round(dragSize);
        draggedDelta = Math.round(startOf(slots[destIdx]) - startOf(slots[dragIdx]));
      } else {
        bypassedDelta = Math.round(-dragSize);
        draggedDelta = Math.round((endOf(slots[destIdx]) - dragSize) - startOf(slots[dragIdx]));
      }
    } else {
      // Fallback for zero-layout environments (e.g. jsdom without mocked rects)
      const fallbackAdvance = (el: HTMLElement): number => {
        if (axis === 'x') {
          if (el.offsetWidth > 0) return el.offsetWidth;
          const wRaw = el.getAttribute('width') || el.style.width || '';
          const parsed = parseFloat(wRaw);
          if (!isNaN(parsed) && parsed > 0) {
            return wRaw.includes('%') ? Math.round(600 * (parsed / 100)) : Math.round(parsed);
          }
          return Math.round(600 / items.length);
        }
        return el.offsetHeight || 60;
      };
      const dragSize = fallbackAdvance(dragged);
      if (destIdx < dragIdx) {
        bypassedDelta = dragSize;
        draggedDelta = -items.slice(destIdx, dragIdx).reduce((s, c) => s + fallbackAdvance(c), 0);
      } else {
        bypassedDelta = -dragSize;
        draggedDelta = items.slice(dragIdx + 1, destIdx + 1).reduce((s, c) => s + fallbackAdvance(c), 0);
      }
    }

    items.forEach((el, i) => {
      el.classList.add('arch-col-displace-ready');
      let d = 0;
      if (destIdx < dragIdx) {
        if (i >= destIdx && i < dragIdx) d = bypassedDelta;
        else if (i === dragIdx) d = draggedDelta;
      } else if (i > dragIdx && i <= destIdx) {
        d = bypassedDelta;
      } else if (i === dragIdx) {
        d = draggedDelta;
      }

      delete el.dataset.archDisplaceX;
      delete el.dataset.archDisplaceY;
      if (d !== 0) {
        el.style.transform = axis === 'x' ? `translate3d(${d}px, 0, 0)` : `translate3d(0, ${d}px, 0)`;
        el.dataset[axis === 'x' ? 'archDisplaceX' : 'archDisplaceY'] = `${d}`;
        el.dataset.archDisplaced = axis === 'x' ? (d > 0 ? 'right' : 'left') : d > 0 ? 'down' : 'up';
      } else {
        el.style.removeProperty('transform');
        delete el.dataset.archDisplaced;
      }
    });
  }

  /**
   * Clears live displacement transforms.
   * - When `keepTransition = true` (e.g. pointer moved back to home slot), keeps `.arch-col-displace-ready`
   *   so items smoothly glide back to `0px`.
   * - When `keepTransition = false` (e.g. on drop commit), removes transition classes and inline transforms immediately.
   */
  private clearColumnDisplacementPreview(keepTransition = false): void {
    this.displaceKey = '';
    if (!keepTransition) {
      this.slotRectCache.clear();
    }
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
        delete col.dataset.archDisplaceY;
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
    const isColumnSlot = isColumnElement(targetUnit) || targetUnit.classList.contains('arch-empty-col-placeholder');
    const pillText = isColumnSlot
      ? `Drop into ${colLabel || desc.label}`
      : `${isBefore ? 'Before' : 'After'} ${desc.label}${contextPath ? ` in ${contextPath}` : ''}`;

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
  public executeDrop(data: string): void {
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
    if (data.startsWith('arch-row:') || data.startsWith('row:')) {
      const layout = data.replace(/^(arch-)?row:/, '') as RowLayoutType;
      this.insertRowLayout(layout, targetUnit, position);
      return;
    }

    // Case 2b: Dropping a modular Section from the palette
    if (data.startsWith('arch-section:') || data.startsWith('section:')) {
      const sectionId = data.replace(/^(arch-)?section:/, '');
      const section = this.events.onResolveSection?.(sectionId);
      if (section && section.html) {
        this.insertHTML(section.html, targetUnit, position);
        return;
      }
    }

    // Case 3: Dropping a content block from the palette
    if (data && data !== 'arch-move-unit') {
      const blockType = (data.startsWith('arch-block:') ? 'button' : data) as BlockType;
      let targetIdx = -1;
      if (targetUnit && targetUnit.parentElement) {
        const peers = getMoveableSiblings(targetUnit);
        const refIdx = peers.indexOf(targetUnit);
        if (refIdx !== -1) {
          targetIdx = position === 'before' ? refIdx : refIdx + 1;
        }
      }
      this.insertBlock(blockType, targetUnit, position);
      if (this.events.onInsertBlockAt && targetIdx !== -1) {
        this.events.onInsertBlockAt(blockType, targetIdx);
      }
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
      [contenteditable="true"]:not(.arch-editing-text) {
        cursor: default !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        caret-color: transparent !important;
      }
      [contenteditable="true"]:not(.arch-editing-text) *:not(.arch-editing-text):not(.arch-editing-text *) {
        cursor: inherit;
        caret-color: transparent !important;
      }
      .arch-editing-text,
      [contenteditable="true"].arch-editing-text {
        cursor: text !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        caret-color: #000000 !important;
        outline: 2px solid #7747ff !important;
        outline-offset: -2px;
      }
      .arch-editing-text *:not(.arch-selected-element),
      [contenteditable="true"].arch-editing-text *:not(.arch-selected-element) {
        outline: none !important;
        cursor: inherit;
      }
      a.arch-editing-text,
      span.arch-editing-text,
      .arch-editing-text[style*="display: inline-block"],
      .arch-editing-text[style*="display:inline-block"] {
        display: inline-flex !important;
        align-items: center !important;
        line-height: normal !important;
      }
      .arch-editing-text::selection,
      .arch-editing-text *::selection {
        background-color: #7747ff !important;
        color: #ffffff !important;
      }
      .arch-selected-element:not(.arch-has-hovered-child) {
        outline: 2px solid #7747ff !important;
        outline-offset: -2px !important;
      }
      .arch-selected-element.arch-has-hovered-child {
        outline: none !important;
      }
      .arch-hover-element:not(.arch-selected-element) {
        outline: 1.5px solid rgba(119, 71, 255, 0.75) !important;
        outline-offset: -1.5px;
      }
      /* Smart single-outline enforcement: never show borders on parent and child simultaneously */
      .arch-selected-element .arch-selected-element,
      .arch-selected-element .arch-hover-element,
      .arch-hover-element .arch-hover-element,
      .arch-hover-element .arch-selected-element {
        outline: none !important;
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
        box-shadow: 0 8px 20px rgba(119, 71, 255, 0.22) !important;
      }
      .arch-drop-line-top {
        box-shadow: inset 0 3px 0 0 #7747ff !important;
      }
      .arch-drop-line-bottom {
        box-shadow: inset 0 -3px 0 0 #7747ff !important;
      }
      table.row-content {
        height: 100% !important;
      }
      table.row-content > tbody,
      table.row-content > tbody > tr {
        height: 100% !important;
      }
      td.column,
      th.column {
        height: 100% !important;
        vertical-align: top !important;
        box-sizing: border-box !important;
      }
      .arch-empty-col-placeholder {
        container-type: inline-size;
        box-sizing: border-box !important;
        border: 1px dashed #cbd5e1 !important;
        background-color: #f8fafc !important;
        border-radius: 0 !important;
        padding: 20px 10px !important;
        text-align: center !important;
        cursor: pointer !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        min-height: 80px !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        margin: 0 !important;
        overflow: hidden !important;
        transition: border-color 0.15s ease, background-color 0.15s ease !important;
      }
      .arch-empty-col-placeholder span {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        color: #64748b !important;
        line-height: 1.3 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        max-width: 100% !important;
        padding: 0 4px !important;
      }
      .arch-empty-col-placeholder.arch-empty-col-narrow,
      td[width*="25%"] .arch-empty-col-placeholder {
        padding: 20px 6px !important;
        min-height: 80px !important;
        gap: 0 !important;
      }
      .arch-empty-col-placeholder.arch-empty-col-narrow span,
      td[width*="25%"] .arch-empty-col-placeholder span {
        display: none !important;
      }
      @container (max-width: 170px) {
        .arch-empty-col-placeholder span {
          display: none !important;
        }
        .arch-empty-col-placeholder {
          padding: 20px 6px !important;
          min-height: 80px !important;
          gap: 0 !important;
        }
      }
      .arch-empty-col-placeholder:hover,
      .arch-empty-col-placeholder.arch-hover-element,
      .arch-empty-col-placeholder.arch-drop-hover {
        border-color: #7747ff !important;
        background-color: #f5f3ff !important;
      }
      .arch-empty-col-placeholder.arch-drop-hover svg,
      .arch-empty-col-placeholder:hover svg {
        stroke: #7747ff !important;
      }
      .arch-empty-col-placeholder.arch-drop-hover span,
      .arch-empty-col-placeholder:hover span {
        color: #7747ff !important;
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
    if (this.readOnly) {
      doc.body.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
      });
      return;
    }

    ensureEmptyColumnPlaceholders(doc);

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

        // If user is in Text Edit Mode inside the selected element or active editing host, allow normal mouse drag-selection of text!
        if (
          this.isEditingText &&
          ((this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) ||
            (this.selectedElement && this.selectedElement.contains(target)) ||
            Boolean(target.closest('.arch-editing-text')))
        ) {
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
        if (this.activeColumnResize) {
          this.handleColumnResizeMove(iframeRect.left + e.clientX);
          return;
        }
        if (this.activeElementResize) {
          this.handleElementResizeMove(iframeRect.left + e.clientX, iframeRect.top + e.clientY);
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
        if (this.activeColumnResize) {
          this.finishColumnResize();
          return;
        }
        if (this.activeElementResize) {
          this.finishElementResize();
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
        if (!target || target.tagName.toLowerCase() === 'body' || target.tagName.toLowerCase() === 'html' || target === doc.body) {
          this.clearHoverElements(doc);
          return;
        }

        const unit = this.resolveHoverUnit(target);
        if (!unit || unit === doc.body || unit === doc.documentElement) {
          this.clearHoverElements(doc);
          return;
        }

        // SMART HANDLING: Prevent parent and child from both showing borders simultaneously
        // Case A: The unit itself is already selected -> clear hover outline (already has 2px selection outline)
        if (unit.classList.contains('arch-selected-element')) {
          this.clearHoverElements(doc);
          this.hoveredUnit = unit;
          return;
        }

        // Case B: The unit is an ancestor of the currently selected element -> do not hover parent over selected child
        if (this.activeMoveableUnit && unit.contains(this.activeMoveableUnit) && unit !== this.activeMoveableUnit) {
          this.clearHoverElements(doc);
          return;
        }

        // Clear previous hover outlines
        this.clearHoverElements(doc);

        // Case C: The unit is a child inside the currently selected container
        // Temporarily suspend parent container's outline so ONLY the hovered child shows border
        if (this.activeMoveableUnit && this.activeMoveableUnit.contains(unit) && unit !== this.activeMoveableUnit) {
          this.activeMoveableUnit.classList.add('arch-has-hovered-child');
        }

        unit.classList.add('arch-hover-element');
        this.hoveredUnit = unit;
      },
      { signal }
    );

    doc.addEventListener(
      'mouseleave',
      () => {
        this.clearHoverElements(doc);
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
      if (target && (this.floatingToolbar || this.bottomActions)) {
        this.positionFloatingToolbar(target, this.floatingToolbar || undefined);
      }
    };
    doc.addEventListener('scroll', onScroll, { passive: true, signal });
    this.iframe.contentWindow?.addEventListener('scroll', onScroll, { passive: true, signal });

    this.bindIframeDragDrop(doc, signal);
  }

  /**
   * Clears hover outline classes and restores parent container outline states.
   */
  private clearHoverElements(doc?: Document | null): void {
    const d = doc || this.iframe.contentDocument;
    if (!d) return;
    d.querySelectorAll('.arch-hover-element').forEach((el) => el.classList.remove('arch-hover-element'));
    d.querySelectorAll('.arch-has-hovered-child').forEach((el) => el.classList.remove('arch-has-hovered-child'));
    this.hoveredUnit = null;
  }

  /**
   * Resolves the primary unit to highlight on hover:
   * When hovering over any element or block, resolves to its first parent structural unit
   * (e.g. text/image/button leaf -> parent block unit; column padding -> column; row padding -> row).
   */
  private resolveHoverUnit(target: HTMLElement): HTMLElement {
    return this.findMoveableUnit(target);
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
    this.clearHoverElements(ifrDoc);
    if (unit && ifrDoc.body.contains(unit)) {
      if (!unit.classList.contains('arch-selected-element')) {
        if (this.activeMoveableUnit && this.activeMoveableUnit.contains(unit) && unit !== this.activeMoveableUnit) {
          this.activeMoveableUnit.classList.add('arch-has-hovered-child');
        }
        unit.classList.add('arch-hover-element');
      }
      this.hoveredUnit = unit;
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
  public enterTextEditMode(
    target: HTMLElement,
    unit?: HTMLElement,
    clickCoords?: { clientX: number; clientY: number },
    selectWord?: boolean
  ): void {
    const activeUnit = unit || this.activeMoveableUnit || this.findMoveableUnit(target);
    const host = findEditableTextHost(target, activeUnit);
    if (!host) return;

    if (this.activeMoveableUnit !== activeUnit) {
      this.selectUnit(host, activeUnit);
    }

    this.isEditingText = true;
    host.classList.add('arch-editing-text');
    host.classList.add('arch-selected-element');
    if (activeUnit && activeUnit !== host) {
      activeUnit.classList.remove('arch-selected-element');
    }
    if (host.getAttribute('contenteditable') !== 'true') {
      host.setAttribute('contenteditable', 'true');
      host.setAttribute('spellcheck', 'false');
    }

    // Adaptive contrast: if the text or background is very dark and text is light, adapt caret to match text
    try {
      const cs = host.ownerDocument.defaultView?.getComputedStyle(host);
      if (cs) {
        const textColor = cs.color;
        const rgb = textColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const r = parseInt(rgb[0], 10);
          const g = parseInt(rgb[1], 10);
          const b = parseInt(rgb[2], 10);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 200) {
            host.style.setProperty('caret-color', '#ffffff', 'important');
          } else {
            host.style.setProperty('caret-color', '#000000', 'important');
          }
        }
      }
    } catch (_) {}

    host.focus();

    // Explicitly place the blinking text cursor (caret) right where the user clicked,
    // or at the end of the text if entered via toolbar button.
    const doc = host.ownerDocument;
    const win = doc.defaultView || window;
    const sel = win.getSelection();

    if (sel) {
      // If there is already an active non-collapsed text selection inside host, preserve it
      const hasWordSelection =
        !sel.isCollapsed && sel.rangeCount > 0 && host.contains(sel.getRangeAt(0).commonAncestorContainer);

      if (!hasWordSelection) {
        let range: Range | null = null;

        if (clickCoords) {
          if (typeof doc.caretRangeFromPoint === 'function') {
            range = doc.caretRangeFromPoint(clickCoords.clientX, clickCoords.clientY);
          } else if (typeof (doc as any).caretPositionFromPoint === 'function') {
            const pos = (doc as any).caretPositionFromPoint(clickCoords.clientX, clickCoords.clientY);
            if (pos && pos.offsetNode) {
              range = doc.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
          }
        }

        if (range && host.contains(range.startContainer)) {
          if (selectWord && range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
            if (typeof (range as any).expand === 'function') {
              try {
                (range as any).expand('word');
              } catch (_) {}
            }
            if (range.collapsed) {
              const text = range.startContainer.nodeValue || '';
              const offset = range.startOffset;
              let start = offset;
              let end = offset;
              while (start > 0 && /\w/.test(text[start - 1])) {
                start--;
              }
              while (end < text.length && /\w/.test(text[end])) {
                end++;
              }
              if (end > start) {
                range.setStart(range.startContainer, start);
                range.setEnd(range.startContainer, end);
              }
            }
          }
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          try {
            const fallbackRange = doc.createRange();
            fallbackRange.selectNodeContents(host);
            fallbackRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(fallbackRange);
          } catch (_) {}
        }
      }
    }

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
      ifrDoc.querySelectorAll('.arch-editing-text').forEach((el) => {
        el.classList.remove('arch-editing-text');
        el.classList.remove('arch-selected-element');
        (el as HTMLElement).style?.removeProperty('caret-color');
      });
      if (ifrDoc.activeElement instanceof HTMLElement) {
        ifrDoc.activeElement.blur();
      }
      try {
        const sel = ifrDoc.defaultView?.getSelection();
        sel?.removeAllRanges();
      } catch {}
    }
    if (this.activeMoveableUnit) {
      this.activeMoveableUnit.classList.add('arch-selected-element');
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
    if (
      this.isEditingText &&
      ((this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) ||
        (this.selectedElement && this.selectedElement.contains(target)) ||
        Boolean(target.closest('.arch-editing-text')))
    ) {
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

    const tag = target.tagName.toLowerCase();
    const ifrDoc = this.iframe.contentDocument;

    // Deselect if user clicked on the body, html, outer wrapper table, or canvas background
    if (
      tag === 'body' ||
      tag === 'html' ||
      target === ifrDoc?.body ||
      isOuterWrapperTable(target)
    ) {
      this.exitTextEditMode();
      this.clearSelection();
      this.events.onSelectElement(null);
      this.events.onSelectBlock(null);
      this.emitLayersUpdate();
      return;
    }

    const selectable = (target.closest('img, a, h1, h2, h3, h4, h5, h6, p, li, hr, td, div, section') ||
      target) as HTMLElement;

    if (isOuterWrapperTable(selectable)) {
      this.exitTextEditMode();
      this.clearSelection();
      this.events.onSelectElement(null);
      this.events.onSelectBlock(null);
      this.emitLayersUpdate();
      return;
    }

    // Programmatic synthetic test clicks (`detail === 0 && !isTrusted`) or `Cmd/Ctrl + Click` deep-selects the leaf block
    if ((!e.isTrusted && e.detail === 0) || e.metaKey || e.ctrlKey) {
      const deepUnit = this.findMoveableUnit(selectable);
      this.exitTextEditMode();
      this.selectUnit(selectable, deepUnit);
      return;
    }

    const chain = getContainerChain(selectable);
    if (chain.length === 0) {
      this.exitTextEditMode();
      this.clearSelection();
      this.events.onSelectElement(null);
      this.events.onSelectBlock(null);
      this.emitLayersUpdate();
      return;
    }

    // 1. If clicking inside the currently selected container, keep that container selected and focus the clicked item
    if (this.activeMoveableUnit && chain.includes(this.activeMoveableUnit)) {
      this.selectUnit(selectable, this.activeMoveableUnit);
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
          this.selectUnit(selectable, sameRoleUnit);
          return;
        }
      }
    }

    // 3. Otherwise select the element and its top container!
    this.exitTextEditMode();
    this.selectUnit(selectable, chain[0]);
  }

  /**
   * Handles Figma-style Double-Click Drill-Down (`Row Frame` -> `Column Frame` -> `Block Frame (td)` -> `Leaf (p / a / img)` -> `Inline Text Edit`).
   */
  public handleIframeDoubleClick(e: MouseEvent): void {
    if (this.readOnly) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // If currently editing text, let the browser's native text selection (double-click to select word, triple-click to select paragraph) work without interruption!
    if (
      this.isEditingText &&
      ((this.activeMoveableUnit && this.activeMoveableUnit.contains(target)) ||
        (this.selectedElement && this.selectedElement.contains(target)) ||
        Boolean(target.closest('.arch-editing-text')))
    ) {
      return;
    }

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
      const isTargetOnLeaf = Boolean(
        target.getAttribute('contenteditable') === 'true' ||
          target.closest<HTMLElement>('[contenteditable="true"]') ||
          target.closest('p, h1, h2, h3, h4, h5, h6, a, button') === leafBlock ||
          leafBlock.tagName.toLowerCase() === 'a'
      );
      const directHost = isTargetOnLeaf
        ? target.getAttribute('contenteditable') === 'true'
          ? target
          : target.closest<HTMLElement>('[contenteditable="true"]') || findEditableTextHost(target, leafBlock)
        : null;
      if (directHost && leafBlock.contains(directHost)) {
        this.enterTextEditMode(directHost, leafBlock, { clientX: e.clientX, clientY: e.clientY }, true);
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
    // FLIP snapshot of every sibling (rows, blocks and columns) so ▲ ▼ ◀ ▶ moves glide instead of snapping
    const oldPos = new Map<HTMLElement, { left: number; top: number }>();
    getMoveableSiblings(effectiveTarget).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) oldPos.set(el, { left: r.left, top: r.top });
    });

    const snapshotBefore = this.getCleanHTML();
    const moved = moveUnit(unit, direction);
    if (moved) {
      const ifrDoc = this.iframe.contentDocument;
      if (ifrDoc && !validateEmailStructure(ifrDoc).valid) {
        this.update({ version: '1.0', settings: {} as any, blocks: [], rawHtml: snapshotBefore }, null, true);
        return;
      }
      this.selectUnit(effectiveTarget, effectiveTarget);
      this.onStructureChanged();

      // Play smooth FLIP transition (Invert -> reflow -> Play) in a real browser
      if (oldPos.size >= 2) {
        oldPos.forEach((old, el) => {
          const r = el.getBoundingClientRect();
          const dx = Math.round(old.left - r.left);
          const dy = Math.round(old.top - r.top);
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return;
          el.classList.remove('arch-col-displace-ready');
          el.classList.add('arch-col-flip-invert');
          el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          void el.offsetWidth; // commit the inverted start frame
          el.classList.remove('arch-col-flip-invert');
          el.classList.add('arch-col-displace-ready');
          el.style.removeProperty('transform');
          setTimeout(() => {
            el.classList.remove('arch-col-displace-ready');
            if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
          }, 240);
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
   * Renders the RGE Studio selection overlay:
   * 1. Purple circular drag handle (✥) centered on the right border
   * 2. Bottom action bar ([💬] [🗑] [⧉]) attached to the bottom edge
   * 3. Floating rich-text formatting toolbar hovering above editable text elements
   * 4. Image resize corner handles when an image is selected
   */
  private renderFloatingToolbar(unit: HTMLElement, innerTarget?: HTMLElement): void {
    this.removeFloatingToolbar();
    if (this.readOnly) return;

    const editableHost = findEditableTextHost(innerTarget || this.selectedElement || unit, unit);
    const ifrDoc = this.iframe.contentDocument;

    // 1. Bottom Action Bar (Comment, Delete, Duplicate Attached to Bottom Edge)
    const bottomActions = document.createElement('div');
    bottomActions.className = 'arch-rge-bottom-actions';
    bottomActions.innerHTML = `
      <button type="button" class="arch-rge-action-btn btn-rge-comment" title="Add comment">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button type="button" class="arch-rge-action-btn btn-rge-del" title="Delete element">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button type="button" class="arch-rge-action-btn btn-rge-dup" title="Copy / Duplicate element">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    `;

    bottomActions.querySelector('.btn-rge-del')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeSelectedElement(unit);
    });

    bottomActions.querySelector('.btn-rge-dup')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.duplicateSelectedElement(unit);
    });

    bottomActions.querySelector('.btn-rge-comment')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentBtn = document.querySelector<HTMLButtonElement>('#btn-prop-comment');
      commentBtn?.click();
    });

    this.overlayLayer.appendChild(bottomActions);
    this.bottomActions = bottomActions;

    // 3. Floating Rich Text Toolbar (ONLY shown when actively in text edit mode)
    const unitRole = classifyUnitRole(unit);
    const isContainer =
      unitRole === 'row' ||
      unitRole === 'column' ||
      unitRole === 'body' ||
      isRowElement(unit) ||
      isColumnElement(unit) ||
      isOuterWrapperTable(unit);

    const showTextToolbar = this.isEditingText && !isContainer && Boolean(editableHost) && Boolean(ifrDoc);

    if (showTextToolbar && editableHost && ifrDoc) {
      const textToolbar = document.createElement('div');
      textToolbar.className = 'arch-rge-text-toolbar';
      textToolbar.innerHTML = `
        <div class="arch-rge-toolbar-row">
          <button type="button" class="arch-toolbar-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" class="arch-toolbar-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" class="arch-toolbar-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
          <button type="button" class="arch-toolbar-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
          <span class="arch-toolbar-divider"></span>
          <button type="button" class="arch-toolbar-btn arch-toolbar-btn--color" id="btn-tb-text-color" title="Text Color">
            <span style="font-weight: 700; font-size: 11px;">A</span>
            <span class="arch-toolbar-color-indicator" id="tb-color-bar" style="background: #101112;"></span>
          </button>
          <button type="button" class="arch-toolbar-btn arch-toolbar-btn--color" id="btn-tb-hilite-color" title="Highlight Color">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 2 4 4-12 12H6v-4L18 2z"/></svg>
            <span class="arch-toolbar-color-indicator" id="tb-hilite-bar" style="background: #facc15;"></span>
          </button>
          <span class="arch-toolbar-divider"></span>
          <button type="button" class="arch-toolbar-btn" data-cmd="superscript" title="Superscript">X²</button>
          <button type="button" class="arch-toolbar-btn" data-cmd="subscript" title="Subscript">X₂</button>
          <button type="button" class="arch-toolbar-btn" id="btn-tb-special-char" title="Special characters">Ω</button>
          <span class="arch-toolbar-divider"></span>
          <button type="button" class="arch-toolbar-btn" id="btn-tb-align" title="Text Alignment">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
            <span style="font-size: 8px; margin-left: 1px;">▾</span>
          </button>
          <button type="button" class="arch-toolbar-btn" data-cmd="undo" title="Undo">↺</button>
          <button type="button" class="arch-toolbar-btn" id="btn-tb-emoji" title="Insert Emoji">😊</button>
          <button type="button" class="arch-toolbar-btn" id="btn-tb-expand" title="Expand">⛶</button>
        </div>
        <div class="arch-rge-toolbar-row arch-rge-toolbar-row--sub">
          <button type="button" class="arch-toolbar-btn" id="btn-tb-link" title="Insert Link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button type="button" class="arch-toolbar-btn" data-cmd="unlink" title="Remove Link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
          </button>
          <button type="button" class="arch-toolbar-text-btn" id="btn-tb-special-links">
            Special links <span style="font-size: 9px; margin-left: 2px;">▾</span>
          </button>
          <button type="button" class="arch-toolbar-text-btn" id="btn-tb-merge-tags">
            Merge tags <span style="font-size: 9px; margin-left: 2px;">▾</span>
          </button>
        </div>
      `;

      // Bind formatting actions
      textToolbar.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const cmd = btn.getAttribute('data-cmd');
          if (cmd && ifrDoc) {
            ifrDoc.execCommand(cmd, false);
            this.onStructureChanged();
          }
        });
      });

      textToolbar.querySelector('#btn-tb-link')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = prompt('Enter destination URL:', 'https://');
        if (url && ifrDoc) {
          ifrDoc.execCommand('createLink', false, url);
          this.onStructureChanged();
        }
      });

      textToolbar.querySelector('#btn-tb-text-color')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = prompt('Enter hex text color:', '#7747ff');
        if (color && ifrDoc) {
          ifrDoc.execCommand('foreColor', false, color);
          const bar = textToolbar.querySelector<HTMLElement>('#tb-color-bar');
          if (bar) bar.style.background = color;
          this.onStructureChanged();
        }
      });

      textToolbar.querySelector('#btn-tb-hilite-color')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = prompt('Enter highlight color:', '#fef08a');
        if (color && ifrDoc) {
          ifrDoc.execCommand('hiliteColor', false, color);
          const bar = textToolbar.querySelector<HTMLElement>('#tb-hilite-bar');
          if (bar) bar.style.background = color;
          this.onStructureChanged();
        }
      });

      textToolbar.querySelector('#btn-tb-align')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = editableHost.style.textAlign || 'left';
        const next = cur === 'left' ? 'center' : cur === 'center' ? 'right' : 'left';
        editableHost.style.textAlign = next;
        this.onStructureChanged();
      });

      // Prevent clicking buttons in the toolbar from blurring the iframe or dropping the active text selection
      textToolbar.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      this.overlayLayer.appendChild(textToolbar);
      this.textToolbar = textToolbar;
      this.floatingToolbar = textToolbar;
    }

    // 4. Element Resize Handles (Corner & Side Handles for Image and Button; text uses typography controls instead of resize handles)
    if (this.activeMoveableUnit === unit && !isRowElement(unit) && !isColumnElement(unit)) {
      const targetEl = innerTarget || this.selectedElement || unit;

      const isDirectImageSelected =
        unit.tagName.toLowerCase() === 'img' ||
        (targetEl.tagName.toLowerCase() === 'img' && targetEl !== unit);
      const targetImg = isDirectImageSelected ? ImageAdapter.findImage(targetEl, unit) : null;

      const isButton =
        !targetImg &&
        (isButtonComponent(targetEl) ||
          (isButtonComponent(unit) && !unit.classList.contains('image_block')));
      const targetBtn = isButton ? resolveButtonAnatomy(targetEl, unit).anchor : null;

      let resizableTarget: HTMLElement | null = null;
      let resizableKind: 'image' | 'button' | null = null;

      if (targetImg) {
        resizableTarget = targetImg;
        resizableKind = 'image';
      } else if (targetBtn) {
        resizableTarget = targetBtn;
        resizableKind = 'button';
      }

      if (resizableTarget && resizableKind) {
        const handleDefs: Array<{
          side: 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'w' | 's';
          dirX: number;
          dirY: number;
          mode: 'box';
          title: string;
        }> = [
          {
            side: 'nw',
            dirX: -1,
            dirY: -1,
            mode: 'box',
            title: `Drag to resize ${resizableKind}`
          },
          {
            side: 'ne',
            dirX: 1,
            dirY: -1,
            mode: 'box',
            title: `Drag to resize ${resizableKind}`
          },
          {
            side: 'sw',
            dirX: -1,
            dirY: 1,
            mode: 'box',
            title: `Drag to resize ${resizableKind}`
          },
          {
            side: 'se',
            dirX: 1,
            dirY: 1,
            mode: 'box',
            title: `Drag to resize ${resizableKind}`
          },
          {
            side: 'e',
            dirX: 1,
            dirY: 0,
            mode: 'box',
            title: `Drag to resize ${resizableKind} width`
          },
          {
            side: 'w',
            dirX: -1,
            dirY: 0,
            mode: 'box',
            title: `Drag to resize ${resizableKind} width`
          },
          {
            side: 's',
            dirX: 0,
            dirY: 1,
            mode: 'box',
            title: `Drag to resize ${resizableKind} height`
          }
        ];

        for (const def of handleDefs) {
          const handle = document.createElement('div');
          handle.className = `arch-resize-handle arch-resize-handle--${def.side}`;
          handle.dataset.corner = def.side;
          handle.dataset.side = def.side;
          handle.title = def.title;

          handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            const selectedEl =
              this.iframe.contentDocument?.querySelector<HTMLElement>('.arch-selected-element') ||
              this.activeMoveableUnit ||
              unit;
            const targetElRect = selectedEl ? selectedEl.getBoundingClientRect() : resizableTarget!.getBoundingClientRect();
            const colCell = resizableTarget!.closest('td, th') as HTMLElement | null;
            const colWidth = colCell?.getBoundingClientRect().width || 0;
            const maxWidth = colWidth > 40 ? Math.round(colWidth) : 600;

            let parsedWidth = 120;
            let parsedHeight = 80;
            if (resizableKind === 'image') {
              parsedWidth =
                parseInt(ImageAdapter.getWidth(resizableTarget!, unit), 10) ||
                parseInt(resizableTarget!.getAttribute('width') || '', 10) ||
                200;
              parsedHeight =
                parseInt(ImageAdapter.getHeight(resizableTarget!, unit), 10) ||
                parseInt(resizableTarget!.getAttribute('height') || '', 10) ||
                (targetElRect.height > 0 ? Math.round(targetElRect.height) : 150);
            } else if (resizableKind === 'button') {
              parsedWidth =
                parseInt(ButtonAdapter.getWidth(resizableTarget!, unit), 10) ||
                parseInt(resizableTarget!.style.width || '', 10) ||
                140;
            }
            const startWidth = targetElRect.width > 0 ? targetElRect.width : (resizableTarget!.getBoundingClientRect().width > 0 ? resizableTarget!.getBoundingClientRect().width : parsedWidth);

            this.activeElementResize = {
              kind: resizableKind!,
              target: resizableTarget!,
              unit,
              startX: e.clientX,
              startY: e.clientY,
              startWidth,
              startHeight: targetElRect.height > 0 ? targetElRect.height : (resizableKind === 'image' ? parsedHeight : 40),
              maxWidth: Math.max(maxWidth, Math.round(startWidth)),
              dirX: def.dirX,
              dirY: def.dirY,
              mode: def.mode,
              startPadY: resizableKind === 'button' ? ButtonAdapter.getPaddingY(resizableTarget!, unit) : undefined
            };

            this.overlayLayer.style.pointerEvents = 'auto';
          });

          this.overlayLayer.appendChild(handle);
          this.resizeHandles.push(handle);
        }
      }
    }

    // 5. Column Resize Handles (only when row or column itself is selected)
    if (this.viewportMode !== 'mobile' && (isRowElement(unit) || isColumnElement(unit))) {
      const row = isRowElement(unit)
        ? unit
        : (unit.closest('table.row, table.row-content, tr, section') as HTMLElement | null);
      if (row) {
        const cols = ColumnLayoutAdapter.getColumnsInRow(row);
        if (cols.length >= 2) {
          for (let i = 0; i < cols.length - 1; i++) {
            const handle = document.createElement('div');
            handle.className = 'arch-col-resize-handle';
            handle.title = 'Drag to resize columns';
            handle.dataset.colIndex = String(i);

            const grip = document.createElement('div');
            grip.className = 'arch-col-resize-grip';
            handle.appendChild(grip);

            handle.addEventListener('mousedown', (e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();

              const leftCol = cols[i];
              const rightCol = cols[i + 1];
              const leftRect = leftCol.getBoundingClientRect();
              const rightRect = rightCol.getBoundingClientRect();

              const leftWidth = leftRect.width;
              const rightWidth = rightRect.width;
              const pairTotalWidth = leftWidth + rightWidth;

              let p1 = parseFloat(leftCol.getAttribute('width') || leftCol.style.width || '');
              let p2 = parseFloat(rightCol.getAttribute('width') || rightCol.style.width || '');

              if (isNaN(p1) || isNaN(p2) || p1 <= 0 || p2 <= 0) {
                const table = leftCol.closest('table.row-content, table.row') as HTMLElement | null;
                const tableWidth = table?.getBoundingClientRect().width || row.getBoundingClientRect().width;
                p1 = tableWidth > 0 ? (leftWidth / tableWidth) * 100 : 50;
                p2 = tableWidth > 0 ? (rightWidth / tableWidth) * 100 : 50;
              }

              const pairTotalPct = p1 + p2;

              this.activeColumnResize = {
                handle,
                row,
                leftCol,
                rightCol,
                startX: e.clientX,
                leftStartWidth: leftWidth,
                rightStartWidth: rightWidth,
                pairTotalWidth,
                leftStartPct: p1,
                rightStartPct: p2,
                pairTotalPct
              };

              handle.classList.add('active');
              this.overlayLayer.style.pointerEvents = 'auto';
            });

            this.overlayLayer.appendChild(handle);
            this.columnResizeHandles.push(handle);
          }
        }
      }
    }

    this.positionFloatingToolbar(unit);
  }

  /**
   * Positions the RGE Move Handle, Bottom Actions, and Floating Text Toolbar relative to `unit` inside the iframe.
   */
  private positionFloatingToolbar(unit: HTMLElement, toolbar?: HTMLElement): void {
    const unitRect = unit.getBoundingClientRect();
    const iframeRect = this.iframe.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();

    const offsetX = iframeRect.left - containerRect.left;
    const offsetY = iframeRect.top - containerRect.top;

    // 1. Bottom-left action bar (attached directly to the bottom-left corner of selected item)
    if (this.bottomActions) {
      const targetEl =
        this.selectedElement && this.selectedElement !== this.iframe.contentDocument?.body
          ? this.selectedElement
          : unit;
      const targetRect = targetEl.getBoundingClientRect();
      const actionsHeight = 28;
      let actionsTop = offsetY + targetRect.bottom;
      if (actionsTop + actionsHeight > containerRect.height - 4) {
        actionsTop = Math.max(4, offsetY + targetRect.bottom - actionsHeight);
      }
      const actionsLeft = Math.max(4, Math.min(offsetX + targetRect.left, containerRect.width - 95));
      this.bottomActions.style.top = `${actionsTop}px`;
      this.bottomActions.style.left = `${actionsLeft}px`;
    }

    // 3. Floating rich-text toolbar
    const tb = this.textToolbar || toolbar;
    if (tb) {
      const tbWidth = tb.offsetWidth || 340;
      const tbHeight = tb.offsetHeight || 60;
      const fitsAbove = offsetY + unitRect.top >= tbHeight + 8;
      const top = fitsAbove
        ? Math.max(4, offsetY + unitRect.top - tbHeight - 6)
        : Math.min(containerRect.height - tbHeight - 4, offsetY + unitRect.bottom + 32);
      const left = Math.max(4, Math.min(offsetX + unitRect.left, containerRect.width - tbWidth - 4));
      tb.style.top = `${top}px`;
      tb.style.left = `${left}px`;
    }

    // 4. Element resize handles (Image, Button)
    const targetEl = this.selectedElement || unit;
    const isRowOrCol = isRowElement(unit) || isColumnElement(unit);

    const isDirectImageSelected =
      !isRowOrCol &&
      (unit.tagName.toLowerCase() === 'img' ||
        (targetEl.tagName.toLowerCase() === 'img' && targetEl !== unit));
    const targetImg = isDirectImageSelected ? ImageAdapter.findImage(targetEl, unit) : null;

    const isButton =
      !isRowOrCol &&
      !targetImg &&
      (isButtonComponent(targetEl) ||
        (isButtonComponent(unit) && !unit.classList.contains('image_block')));

    let targetNode: HTMLElement | null = null;
    if (this.resizeHandles.length > 0) {
      if (targetImg) {
        targetNode = targetImg;
      } else if (isButton) {
        targetNode = resolveButtonAnatomy(targetEl, unit).anchor;
      }
    }

    const selectedEl =
      this.iframe.contentDocument?.querySelector<HTMLElement>('.arch-selected-element') ||
      this.activeMoveableUnit ||
      unit;
    const targetRect =
      selectedEl && selectedEl.getBoundingClientRect().width > 0
        ? selectedEl.getBoundingClientRect()
        : (targetNode && targetNode.getBoundingClientRect().width > 0
            ? targetNode.getBoundingClientRect()
            : unitRect);

    for (const handle of this.resizeHandles) {
      const side = handle.dataset.side || handle.dataset.corner;
      let hTop = 0;
      let hLeft = 0;

      if (side === 'nw' || side === 'ne') {
        hTop = offsetY + targetRect.top - 5;
      } else if (side === 'sw' || side === 'se') {
        hTop = offsetY + targetRect.bottom - 5;
      } else if (side === 'e' || side === 'w') {
        hTop = offsetY + targetRect.top + targetRect.height / 2 - 9;
      } else if (side === 's') {
        hTop = offsetY + targetRect.bottom - 4;
      }

      if (side === 'nw' || side === 'sw') {
        hLeft = offsetX + targetRect.left - 5;
      } else if (side === 'ne' || side === 'se') {
        hLeft = offsetX + targetRect.right - 5;
      } else if (side === 'e') {
        hLeft = offsetX + targetRect.right - 4;
      } else if (side === 'w') {
        hLeft = offsetX + targetRect.left - 4;
      } else if (side === 's') {
        hLeft = offsetX + targetRect.left + targetRect.width / 2 - 9;
      }

      handle.style.top = `${hTop}px`;
      handle.style.left = `${hLeft}px`;
    }

    // 5. Column resize handles (only when row or column itself is selected)
    if (this.columnResizeHandles.length > 0) {
      const row = (isRowElement(unit) || isColumnElement(unit))
        ? (isRowElement(unit)
            ? unit
            : (unit.closest('table.row, table.row-content, tr, section') as HTMLElement | null))
        : null;
      if (row) {
        const cols = ColumnLayoutAdapter.getColumnsInRow(row);
        for (const handle of this.columnResizeHandles) {
          const idx = parseInt(handle.dataset.colIndex || '-1', 10);
          if (idx >= 0 && idx < cols.length - 1) {
            const leftCol = cols[idx];
            const rightCol = cols[idx + 1];
            const leftRect = leftCol.getBoundingClientRect();
            const rightRect = rightCol.getBoundingClientRect();

            const boundaryX = offsetX + (leftRect.right + rightRect.left) / 2;
            const topY = offsetY + Math.min(leftRect.top, rightRect.top);
            const height = Math.max(leftRect.height, rightRect.height);

            handle.style.left = `${boundaryX}px`;
            handle.style.top = `${topY}px`;
            handle.style.height = `${height}px`;
          }
        }
      }
    }
  }

  private removeFloatingToolbar(): void {
    if (this.bottomActions) {
      this.bottomActions.remove();
      this.bottomActions = null;
    }
    if (this.textToolbar) {
      this.textToolbar.remove();
      this.textToolbar = null;
    }
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
    if (this.columnResizeHandles.length > 0) {
      this.columnResizeHandles.forEach((h) => h.remove());
      this.columnResizeHandles = [];
    }
    if (!this.pointerDragCandidate?.active && !this.activeElementResize && !this.activeColumnResize) {
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
      ifrDoc.querySelectorAll('.arch-selected-element, .arch-hover-element, .arch-editing-text, .arch-has-hovered-child').forEach((el) => {
        el.classList.remove('arch-selected-element', 'arch-hover-element', 'arch-editing-text', 'arch-has-hovered-child');
        (el as HTMLElement).style?.removeProperty('caret-color');
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

    const padCell =
      el.closest<HTMLElement>('td.pad') ||
      targetUnit.querySelector<HTMLElement>(':scope > tbody > tr > td.pad, :scope > tr > td.pad, td.pad');
    const effectivePadEl = padCell || targetUnit;

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
      padding: effectivePadEl.style.padding || targetUnit.style.padding || style.padding || computed?.padding || '',
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
        if (this.readOnly) {
          e.preventDefault();
          return;
        }
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
        if (this.readOnly) {
          e.preventDefault();
          return;
        }
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
        if (this.readOnly) {
          e.preventDefault();
          return;
        }
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
      ifrDoc.querySelectorAll('.arch-drop-line-top, .arch-drop-line-bottom, .arch-drop-hover').forEach((el) => {
        el.classList.remove('arch-drop-line-top', 'arch-drop-line-bottom', 'arch-drop-hover');
      });
    }
  }

  /**
   * Inserts a context-aware email block at the target unit or canonical column slot container (Fixes R3).
   */
  public insertBlock(
    type: BlockType,
    targetElement?: HTMLElement | null,
    position: 'before' | 'after' = 'after'
  ): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;
    let insertedEl: HTMLElement | null = null;

    if (refUnit && refUnit.parentElement && refUnit !== ifrDoc.body) {
      const placeholder =
        refUnit.classList?.contains('arch-empty-col-placeholder') || refUnit.hasAttribute?.('data-arch-placeholder')
          ? refUnit
          : refUnit.closest<HTMLElement>('.arch-empty-col-placeholder, [data-arch-placeholder]');

      if (placeholder && placeholder.parentElement) {
        const slot = placeholder.parentElement;
        const snippet = buildContextAwareBlockHtml(type, slot.tagName.toLowerCase());
        placeholder.insertAdjacentHTML('afterend', snippet);
        insertedEl = placeholder.nextElementSibling as HTMLElement;
        placeholder.remove();
      } else if (isColumnElement(refUnit)) {
        const slot = getColumnSlotContainer(refUnit);
        slot.querySelectorAll('.arch-empty-col-placeholder, [data-arch-placeholder]').forEach((p) => p.remove());
        const snippet = buildContextAwareBlockHtml(type, slot.tagName.toLowerCase());
        const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
        slot.insertAdjacentHTML(insertPosition, snippet);
        insertedEl = position === 'before'
          ? (slot.firstElementChild as HTMLElement)
          : (slot.lastElementChild as HTMLElement);
      } else {
        const parentTag = refUnit.parentElement.tagName.toLowerCase();
        const snippet = buildContextAwareBlockHtml(type, parentTag);
        const insertPosition = position === 'before' ? 'beforebegin' : 'afterend';
        refUnit.insertAdjacentHTML(insertPosition, snippet);
        insertedEl = position === 'before'
          ? (refUnit.previousElementSibling as HTMLElement)
          : (refUnit.nextElementSibling as HTMLElement);
      }
    } else {
      const container = findPrimaryContentContainer(ifrDoc);
      const containerTag = container.tagName.toLowerCase();
      const snippet = buildContextAwareBlockHtml(type, containerTag);
      const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
      container.insertAdjacentHTML(insertPosition, snippet);
      insertedEl = position === 'before'
        ? (container.firstElementChild as HTMLElement)
        : (container.lastElementChild as HTMLElement);
    }

    this.onStructureChanged();

    if (insertedEl) {
      const unit = resolveEffectiveMoveUnit(insertedEl) || insertedEl;
      const targetChild = insertedEl.querySelector<HTMLElement>('a, img, h1, h2, h3, h4, p, hr, table, ul, ol') || insertedEl;
      this.selectUnit(unit, targetChild);
    }
  }

  /**
   * Inserts custom HTML content dynamically into the email template.
   * Automatically normalizes and wraps markup to preserve email table layout stability.
   */
  public insertHTML(
    htmlSnippet: string,
    targetElement?: HTMLElement | null,
    position: 'before' | 'after' = 'after'
  ): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;
    let insertedEl: HTMLElement | null = null;

    if (refUnit && refUnit.parentElement && refUnit !== ifrDoc.body) {
      const placeholder =
        refUnit.classList?.contains('arch-empty-col-placeholder') || refUnit.hasAttribute?.('data-arch-placeholder')
          ? refUnit
          : refUnit.closest<HTMLElement>('.arch-empty-col-placeholder, [data-arch-placeholder]');

      if (placeholder && placeholder.parentElement) {
        const slot = placeholder.parentElement;
        const wrapped = wrapContextAwareHtmlSnippet(htmlSnippet, slot.tagName.toLowerCase());
        placeholder.insertAdjacentHTML('afterend', wrapped);
        insertedEl = placeholder.nextElementSibling as HTMLElement;
        placeholder.remove();
      } else if (isColumnElement(refUnit)) {
        const slot = getColumnSlotContainer(refUnit);
        slot.querySelectorAll('.arch-empty-col-placeholder, [data-arch-placeholder]').forEach((p) => p.remove());
        const wrapped = wrapContextAwareHtmlSnippet(htmlSnippet, slot.tagName.toLowerCase());
        const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
        slot.insertAdjacentHTML(insertPosition, wrapped);
        insertedEl = position === 'before'
          ? (slot.firstElementChild as HTMLElement)
          : (slot.lastElementChild as HTMLElement);
      } else {
        const parentTag = refUnit.parentElement.tagName.toLowerCase();
        const wrapped = wrapContextAwareHtmlSnippet(htmlSnippet, parentTag);
        const insertPosition = position === 'before' ? 'beforebegin' : 'afterend';
        refUnit.insertAdjacentHTML(insertPosition, wrapped);
        insertedEl = position === 'before'
          ? (refUnit.previousElementSibling as HTMLElement)
          : (refUnit.nextElementSibling as HTMLElement);
      }
    } else {
      const container = findPrimaryContentContainer(ifrDoc);
      const containerTag = container.tagName.toLowerCase();
      const wrapped = wrapContextAwareHtmlSnippet(htmlSnippet, containerTag);
      const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
      container.insertAdjacentHTML(insertPosition, wrapped);
      insertedEl = position === 'before'
        ? (container.firstElementChild as HTMLElement)
        : (container.lastElementChild as HTMLElement);
    }

    this.onStructureChanged();

    if (insertedEl) {
      const unit = resolveEffectiveMoveUnit(insertedEl) || insertedEl;
      const targetChild = insertedEl.querySelector<HTMLElement>('a, img, h1, h2, h3, h4, p, hr, table, ul, ol') || insertedEl;
      this.selectUnit(unit, targetChild);
    }
  }

  /**
   * Inserts a new multi-column Row Section into the email layout.
   */
  public insertRowLayout(
    layout: RowLayoutType,
    targetElement?: HTMLElement | null,
    position: 'before' | 'after' = 'after'
  ): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;
    const rawRow =
      refUnit?.closest<HTMLElement>('table.row, section') ||
      (refUnit ? resolveEffectiveMoveUnit(refUnit) : null);
    const effectiveRow =
      rawRow && (isRowElement(rawRow) || rawRow.tagName.toLowerCase() === 'tr')
        ? resolveEffectiveMoveUnit(rawRow)
        : null;

    let insertedRow: HTMLElement | null = null;

    if (effectiveRow && effectiveRow.parentElement && effectiveRow !== ifrDoc.body) {
      const parentTag = effectiveRow.parentElement.tagName.toLowerCase();
      const wrapInTr = parentTag === 'tbody' || parentTag === 'table';
      const html = buildRowLayoutHtml(layout, wrapInTr);
      const insertPosition = position === 'before' ? 'beforebegin' : 'afterend';
      effectiveRow.insertAdjacentHTML(insertPosition, html);
      insertedRow = position === 'before'
        ? (effectiveRow.previousElementSibling as HTMLElement)
        : (effectiveRow.nextElementSibling as HTMLElement);
    } else {
      const existingRows = ifrDoc.body.querySelectorAll<HTMLElement>('table.row, section');
      if (existingRows.length > 0) {
        const targetRow = position === 'before'
          ? resolveEffectiveMoveUnit(existingRows[0])
          : resolveEffectiveMoveUnit(existingRows[existingRows.length - 1]);
        const parentTag = targetRow.parentElement?.tagName.toLowerCase() || 'td';
        const wrapInTr = parentTag === 'tbody' || parentTag === 'table';
        const html = buildRowLayoutHtml(layout, wrapInTr);
        const insertPosition = position === 'before' ? 'beforebegin' : 'afterend';
        targetRow.insertAdjacentHTML(insertPosition, html);
        insertedRow = position === 'before'
          ? (targetRow.previousElementSibling as HTMLElement)
          : (targetRow.nextElementSibling as HTMLElement);
      } else {
        const container = findPrimaryContentContainer(ifrDoc);
        const rowContainer = isColumnElement(container)
          ? (container.closest('table.row')?.parentElement as HTMLElement) || ifrDoc.body
          : container;
        const containerTag = rowContainer.tagName.toLowerCase();
        const wrapInTr = containerTag === 'tbody' || containerTag === 'table';
        const html = buildRowLayoutHtml(layout, wrapInTr);
        const insertPosition = position === 'before' ? 'afterbegin' : 'beforeend';
        rowContainer.insertAdjacentHTML(insertPosition, html);
        insertedRow = position === 'before'
          ? (rowContainer.firstElementChild as HTMLElement)
          : (rowContainer.lastElementChild as HTMLElement);
      }
    }

    this.onStructureChanged();

    if (insertedRow) {
      const unit = resolveEffectiveMoveUnit(insertedRow) || insertedRow;
      this.selectUnit(unit, unit);
    }
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.removeFloatingToolbar();
    this.removeDragGhost();
    this.clearDropIndicators();
    this.element.remove();
  }
}

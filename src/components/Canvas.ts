/**
 * Arch Email Editor - Visual Canvas & Parent Overlay Component
 *
 * Architecture & Email Rendering Fidelity:
 * Uses a same-origin HTMLIFrameElement (`iframe.contentDocument`) with a non-invasive
 * parent-document overlay layer (`overlayLayer`).
 * - 100% email client visual fidelity: table columns, responsive `@media` rules, VML, fonts, and colors.
 * - Safe HTML sanitization + template-tag tokenization (`{% ... %}` / `{{ ... }}`) + DOCTYPE preservation.
 * - Always re-binds iframe event listeners after `ifrDoc.open()/write()/close()` (since `document.open()`
 *   wipes all listeners on the Document object in real browsers).
 * - Shows the Floating Action Toolbar (`⠿ Drag`, `↑ Parent`, `▲/◀`, `▼/▶`, `⧉`, `✕`) immediately on hover
 *   (when no element is locked) and locks it on click selection.
 * - Dual Drag-and-Drop support:
 *   1. Dragging `⠿ Drag` handle or Palette items uses the Parent Overlay Drag-Capture Shield (`elementFromPoint`).
 *   2. Dragging blocks, images, or buttons directly inside the iframe reorders units seamlessly.
 */

import { BlockType, EmailDocument, RowLayoutType, SelectedElementInfo, ViewportMode } from '../types';
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
  classifyElementType,
  classifyUnitRole,
  detectAxis,
  getParentStructuralUnit,
  getUnitAncestry,
  isEditableTextHost,
  resolveUnit
} from '../engine/units';
import {
  canMoveUnit,
  duplicateUnit,
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

    // Non-invasive parent-document overlay layer (zero pollution inside iframe DOM)
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
   * Binds click and drag events on the outer canvas container & parent overlay shield.
   */
  private bindOuterEvents(): void {
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element || e.target === this.containerElement) {
        this.clearSelection();
        this.events.onSelectElement(null);
        this.events.onSelectBlock(null);
      }
    });

    // Parent Overlay Drag-Capture Shield handlers (handles drags from `⠿ Drag` handle and Palette across iframe)
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

    this.updateDropTargetForElement(hitEl, y);
  }

  /**
   * Updates the visual drop indicator line on the compatible target unit inside the iframe.
   */
  private updateDropTargetForElement(rawTarget: HTMLElement, iframeRelativeY: number): void {
    const targetUnit = this.draggedUnit
      ? resolveCompatibleDropTarget(this.draggedUnit, rawTarget)
      : this.findMoveableUnit(rawTarget);

    if (!targetUnit || targetUnit === this.draggedUnit || targetUnit.tagName.toLowerCase() === 'body') {
      return;
    }

    this.clearDropIndicators();
    this.hoveredDropTarget = targetUnit;

    const rect = targetUnit.getBoundingClientRect();
    const isTop = iframeRelativeY < rect.top + rect.height / 2;
    this.hoveredDropPosition = isTop ? 'before' : 'after';

    if (isTop) {
      targetUnit.classList.add('arch-drop-line-top');
    } else {
      targetUnit.classList.add('arch-drop-line-bottom');
    }
  }

  /**
   * Executes a drop operation (either moving `this.draggedUnit` or inserting a block/row from the Palette).
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
      if (targetUnit && source !== targetUnit) {
        const moved = moveUnitToTarget(source, targetUnit, position);
        if (moved) {
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

    // 5. Inject lightweight outline CSS into iframe head (stripped on export)
    this.injectEditorStyles(ifrDoc);

    // 6. Enable single-host direct typing on text leaves & mark blocks draggable
    this.enableDirectEditing(ifrDoc);

    // 7. Always bind delegated iframe events after `ifrDoc.open()/write()/close()`
    this.bindIframeEvents(ifrDoc);

    this.adjustHeight();
  }

  /**
   * Injects lightweight visual outline styles into the iframe (stripped cleanly on export).
   */
  private injectEditorStyles(doc: Document): void {
    if (doc.getElementById('arch-canvas-editor-style')) return;

    const styleEl = doc.createElement('style');
    styleEl.id = 'arch-canvas-editor-style';
    styleEl.textContent = `
      [contenteditable="true"]:focus {
        outline: 2px dashed #2563eb !important;
        outline-offset: 2px;
      }
      .arch-selected-element {
        outline: 2px solid #2563eb !important;
        outline-offset: -2px;
      }
      .arch-hover-element:not(.arch-selected-element) {
        outline: 2px dashed #60a5fa !important;
        outline-offset: -2px;
      }
      .arch-drop-line-top {
        box-shadow: inset 0 4px 0 0 #2563eb !important;
      }
      .arch-drop-line-bottom {
        box-shadow: inset 0 -4px 0 0 #2563eb !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(styleEl);
  }

  /**
   * Marks true text leaf hosts as `contenteditable="true"` (Fixes R14, R17, R18)
   * and marks structural block tables as `draggable="true"`.
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

    // Make structural block wrappers directly draggable on the canvas
    const blockUnits = doc.body.querySelectorAll<HTMLElement>(
      'table.image_block, table.button_block, table.paragraph_block, table.text_block, table.divider_block, table.heading_block, table.social_block, table.spacer_block, table.html_block'
    );
    blockUnits.forEach((unit) => {
      unit.setAttribute('draggable', 'true');
    });
  }

  /**
   * Binds delegated click, hover, input, keydown, scroll, and drag-and-drop listeners on `ifrDoc`.
   */
  private bindIframeEvents(doc: Document): void {
    doc.addEventListener('click', (e) => this.handleIframeClick(e));

    doc.addEventListener('mouseover', (e) => {
      if (this.draggedUnit) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName.toLowerCase() === 'body' || target.tagName.toLowerCase() === 'html') {
        return;
      }
      doc.querySelectorAll('.arch-hover-element').forEach((el) => el.classList.remove('arch-hover-element'));
      const unit = this.findMoveableUnit(target);
      if (unit && unit !== doc.body) {
        unit.classList.add('arch-hover-element');
        this.hoveredUnit = unit;
        // If no element has been clicked/locked yet, show the Floating Toolbar on the hovered unit
        // so the user immediately sees `⠿ Drag`, `▲`, `▼`, `⧉`, `✕` on any imported template!
        if (!this.activeMoveableUnit) {
          this.renderFloatingToolbar(unit, target);
        }
      }
    });

    doc.addEventListener('input', () => {
      const cleanHtml = this.getCleanHTML();
      this.lastRenderedHtml = cleanHtml;
      this.events.onContentChange(cleanHtml);
    });

    doc.addEventListener('keydown', (e: KeyboardEvent) => {
      const active = doc.activeElement as HTMLElement | null;
      if (!active || active.getAttribute('contenteditable') !== 'true') return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const text = active.textContent || '';
        if (text.length === 0) {
          e.preventDefault();
        }
      }
    });

    const onScroll = () => {
      const target = this.activeMoveableUnit || this.hoveredUnit;
      if (target && this.floatingToolbar) {
        this.positionFloatingToolbar(target, this.floatingToolbar);
      }
    };
    doc.addEventListener('scroll', onScroll, { passive: true });
    this.iframe.contentWindow?.addEventListener('scroll', onScroll, { passive: true });

    this.bindIframeDragDrop(doc);
  }

  /**
   * Resolves the safe structural moveable unit for any element in the email.
   */
  public findMoveableUnit(el: HTMLElement): HTMLElement {
    return resolveUnit(el);
  }

  /**
   * Handles element click selection inside the iframe to drive the Inspector and Floating Toolbar.
   */
  private handleIframeClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
    }

    const selectable = (target.closest('img, a, h1, h2, h3, h4, h5, h6, p, li, hr, td, div, section') ||
      target) as HTMLElement;
    const moveableUnit = this.findMoveableUnit(selectable);

    this.selectUnit(selectable, moveableUnit);
  }

  /**
   * Selects a specific inner element and its resolved structural unit, updating the overlay and Inspector.
   */
  public selectUnit(selectable: HTMLElement, unit?: HTMLElement): void {
    const resolvedUnit = unit || this.findMoveableUnit(selectable);

    this.clearSelection();
    this.selectedElement = selectable;
    this.activeMoveableUnit = resolvedUnit;
    resolvedUnit.classList.add('arch-selected-element');
    resolvedUnit.setAttribute('draggable', 'true');

    this.renderFloatingToolbar(resolvedUnit, selectable);

    const info = this.extractElementInfo(selectable, resolvedUnit);
    this.events.onSelectElement(info);
  }

  /**
   * Climbs one structural level up (`Block` -> `Column` -> `Row` -> `Body`) and selects it.
   */
  public selectParentUnit(fromUnit?: HTMLElement): void {
    const current = fromUnit || this.activeMoveableUnit || this.hoveredUnit;
    if (!current) return;
    const parentUnit = getParentStructuralUnit(current);
    if (parentUnit) {
      this.selectUnit(parentUnit, parentUnit);
    }
  }

  /**
   * Moves the currently selected (or hovered) unit up/left or down/right.
   * Automatically preserves MSO conditional envelopes, gutter cells, and scoped `@media` rules.
   */
  public moveSelectedElement(direction: 'up' | 'down', targetUnitOverride?: HTMLElement): void {
    const unit =
      targetUnitOverride ||
      this.activeMoveableUnit ||
      (this.selectedElement ? this.findMoveableUnit(this.selectedElement) : null) ||
      this.hoveredUnit;
    if (!unit) return;

    if (!this.activeMoveableUnit) {
      this.selectUnit(unit, unit);
    }

    const snapshotBefore = this.getCleanHTML();
    const moved = moveUnit(unit, direction);
    if (moved) {
      const ifrDoc = this.iframe.contentDocument;
      if (ifrDoc && !validateEmailStructure(ifrDoc).valid) {
        this.update({ version: '1.0', settings: {} as any, blocks: [], rawHtml: snapshotBefore }, null, true);
        return;
      }
      this.onStructureChanged();
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
   * Renders the Floating Quick-Action Toolbar in the parent overlay layer (zero nodes inside iframe DOM).
   */
  private renderFloatingToolbar(unit: HTMLElement, innerTarget?: HTMLElement): void {
    this.removeFloatingToolbar();

    const effectiveMoveTarget = resolveEffectiveMoveUnit(unit);
    const canUp = canMoveUnit(unit, 'up');
    const canDown = canMoveUnit(unit, 'down');
    const parentUnit = getParentStructuralUnit(unit);
    const axis = detectAxis(effectiveMoveTarget);
    const role = classifyUnitRole(unit);
    const elemType = classifyElementType(innerTarget || this.selectedElement || unit, unit);
    const badgeLabel = role === 'row' ? 'Row' : role === 'column' ? 'Column' : elemType.toUpperCase();

    const upIcon = axis === 'horizontal' ? '◀' : '▲';
    const downIcon = axis === 'horizontal' ? '▶' : '▼';
    const upTitle = axis === 'horizontal' ? 'Move Column Left' : 'Move Up';
    const downTitle = axis === 'horizontal' ? 'Move Column Right' : 'Move Down';

    const toolbar = document.createElement('div');
    toolbar.className = 'arch-floating-toolbar';
    toolbar.innerHTML = `
      <span class="arch-float-drag" draggable="true" title="Drag to move anywhere">⠿ Drag</span>
      <span class="arch-float-badge">${badgeLabel}</span>
      <button type="button" class="arch-float-btn btn-float-parent" title="Select Parent Container (Column / Row)" ${!parentUnit ? 'disabled' : ''}>↑</button>
      <button type="button" class="arch-float-btn btn-float-up" title="${upTitle}" ${!canUp ? 'disabled' : ''}>${upIcon}</button>
      <button type="button" class="arch-float-btn btn-float-down" title="${downTitle}" ${!canDown ? 'disabled' : ''}>${downIcon}</button>
      <button type="button" class="arch-float-btn btn-float-dup" title="Duplicate">⧉</button>
      <button type="button" class="arch-float-btn arch-float-btn--danger btn-float-del" title="Delete">✕</button>
    `;

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

    // Handle drag initiation from the parent overlay `⠿ Drag` handle:
    // Activates `pointer-events: auto` on `overlayLayer` so cross-iframe dragging never drops events!
    const dragHandle = toolbar.querySelector<HTMLElement>('.arch-float-drag');
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
    this.positionFloatingToolbar(unit, toolbar);
  }

  /**
   * Positions the parent-overlay floating toolbar relative to `unit` inside the iframe.
   */
  private positionFloatingToolbar(unit: HTMLElement, toolbar: HTMLElement): void {
    const unitRect = unit.getBoundingClientRect();
    const iframeRect = this.iframe.getBoundingClientRect();
    const containerRect = this.containerElement.getBoundingClientRect();

    const offsetX = iframeRect.left - containerRect.left;
    const offsetY = iframeRect.top - containerRect.top;

    const top = Math.max(4, offsetY + unitRect.top - 32);
    const left = Math.max(4, offsetX + unitRect.left);

    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
  }

  private removeFloatingToolbar(): void {
    if (this.floatingToolbar) {
      this.floatingToolbar.remove();
      this.floatingToolbar = null;
    }
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.style.pointerEvents = 'none';
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
  }

  /**
   * Clears selection outlines and floating toolbar.
   */
  public clearSelection(): void {
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
    const ancestry = getUnitAncestry(targetUnit);

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
   * Binds dragstart, dragover, and drop handlers inside the iframe document so users can also
   * drag images, buttons, or blocks directly on the canvas!
   */
  private bindIframeDragDrop(doc: Document): void {
    doc.addEventListener('dragstart', (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

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
    });

    doc.addEventListener('dragend', () => {
      this.draggedUnit = null;
      this.overlayLayer.style.pointerEvents = 'none';
      this.clearDropIndicators();
    });

    doc.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = this.draggedUnit ? 'move' : 'copy';
      }

      const target = e.target as HTMLElement;
      if (!target) return;
      this.updateDropTargetForElement(target, e.clientY);
    });

    doc.addEventListener('dragleave', (e: DragEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related || !doc.body.contains(related)) {
        this.clearDropIndicators();
        this.hoveredDropTarget = null;
      }
    });

    doc.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData('text/plain') || '';
      this.executeDrop(data);
    });
  }

  private clearDropIndicators(): void {
    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-drop-line-top, .arch-drop-line-bottom').forEach((el) => {
        el.classList.remove('arch-drop-line-top', 'arch-drop-line-bottom');
      });
    }
  }

  /**
   * Inserts a context-aware email block at the target unit or primary content container (Fixes R3).
   */
  public insertBlock(type: BlockType, targetElement?: HTMLElement | null): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const refUnit = targetElement || this.activeMoveableUnit;

    if (refUnit && refUnit.parentElement && refUnit !== ifrDoc.body) {
      const parentTag = refUnit.parentElement.tagName.toLowerCase();
      const snippet = buildContextAwareBlockHtml(type, parentTag);
      refUnit.insertAdjacentHTML('afterend', snippet);
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
    this.element.remove();
  }
}

/**
 * Arch Email Editor - Core Controller & Component Orchestrator
 *
 * Architecture: Component Orchestrator + Core Controller
 *
 * Cleanly breaks responsibilities across focused, modular sub-components:
 * - Toolbar: Top action bar (Undo/Redo, Viewport Switcher, Size Meter, Import HTML, Export JSON/HTML, Clear)
 * - Canvas: Full-width WYSIWYG email canvas (isolated iframe + parent-layer Figma HUD overlay)
 * - RightPanel: Unified 3-tab sidebar:
 *     1. Blocks: Draggable & clickable content blocks (Text, Image, Button, Heading, etc.)
 *     2. Sections: Multi-column auto-layout rows (1 Col, 2 Col 50/50, 3 Col, etc.)
 *     3. Settings: Smart contextual element inspector and global email styling
 * - ImportModal / ExportModal: Lossless template ingestion & export dialogs
 * - HistoryManager: Immutable undo/redo snapshot stack
 *
 * 100% Vanilla TypeScript with zero runtime framework dependencies.
 */

import {
  EmailDocument,
  BlockNode,
  BlockType,
  EditorOptions,
  PrebuiltSection,
  RowLayoutType,
  SelectedElementInfo,
  ToolbarCustomButton,
  ViewportMode
} from './types';
import {
  compileToEmailHtml,
  parseHtmlToDocument,
  normalizeDocument
} from './compiler';
import { getDefaultSections } from './engine/sections';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { RightPanel } from './components/RightPanel';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { HistoryManager } from './engine/history';

export class ArchEmailEditor {
  /** Target container element where the editor is rendered */
  private container: HTMLElement;
  /** Active editor configuration options */
  private options: EditorOptions;
  /** The in-memory document state (reactive AST + lossless email markup) */
  private document: EmailDocument;
  /** Currently selected block ID (or null if document settings are selected) */
  private selectedBlockId: string | null = null;
  /** Currently selected DOM element on canvas */
  private selectedElement: SelectedElementInfo | null = null;
  /** The root editor DOM node */
  private rootElement: HTMLElement | null = null;
  /** Event bus mapping event names to subscriber callbacks */
  private listeners: Map<string, Function[]> = new Map();
  /** Unified Undo/Redo history manager */
  private history: HistoryManager = new HistoryManager(50);

  // Modular UI Components
  private toolbar: Toolbar | null = null;
  private canvas: Canvas | null = null;
  private rightPanel: RightPanel | null = null;
  private importModal: ImportModal | null = null;
  private exportModal: ExportModal | null = null;

  public get inspector(): Inspector | null {
    return this.rightPanel?.getInspector() || null;
  }

  /**
   * Initializes a new email editor instance.
   * Prefer using the static `ArchEmailEditor.create()` factory method.
   */
  constructor(target: HTMLElement | string, options: EditorOptions = {}) {
    if (typeof target === 'string') {
      const el = document.querySelector<HTMLElement>(target);
      if (!el) {
        throw new Error(`Target container not found for selector: ${target}`);
      }
      this.container = el;
    } else {
      this.container = target;
    }

    this.options = options;
    this.document = normalizeDocument(options.initialData);

    if (options.onChange) {
      this.on('change', options.onChange);
    }
    if (options.onSelectBlock) {
      this.on('select', options.onSelectBlock);
    }

    this.mount();
  }

  /**
   * Factory method to create and mount the editor.
   */
  public static create(target: HTMLElement | string, options: EditorOptions = {}): ArchEmailEditor {
    return new ArchEmailEditor(target, options);
  }

  
  /**
   * Sets or replaces the available assets in the media browser panel.
   */
  public setAssets(assets: any[]): void {
    this.rightPanel?.setAssets(assets);
  }

  public setPlaceholders(placeholders: any): void {
    this.options.placeholders = placeholders;
    this.rightPanel?.setPlaceholders(placeholders);
  }

  public getPlaceholders(): any[] {
    return this.rightPanel?.getPlaceholders?.() ?? [];
  }

  /**
   * Returns the currently loaded media assets.
   */
  public getAssets(): any[] {
    return this.rightPanel?.getAssets() || [];
  }

  public setReadOnly(readOnly: boolean): void {
    this.options.readOnly = readOnly;
    if (readOnly) {
      this.rootElement?.classList.add('arch-editor--readonly');
    } else {
      this.rootElement?.classList.remove('arch-editor--readonly');
    }
    this.canvas?.setReadOnly(readOnly);
    this.rightPanel?.setReadOnly(readOnly);
  }

  public isReadOnly(): boolean {
    return Boolean(this.options.readOnly);
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.options.theme = theme;
    if (theme === 'dark') {
      this.rootElement?.classList.add('arch-theme--dark');
    } else {
      this.rootElement?.classList.remove('arch-theme--dark');
    }
  }

  public getTheme(): 'light' | 'dark' {
    return this.options.theme === 'dark' ? 'dark' : 'light';
  }

  /** Returns the current sidebar position. */
  public getSidebarPosition(): 'left' | 'right' {
    return this.options.sidebarPosition === 'left' ? 'left' : 'right';
  }

  /** Returns the sidebar panel instance. */
  public getSidebar(): RightPanel | null {
    return this.rightPanel;
  }

  /** Moves the sidebar to the left or right side of the canvas. */
  public setSidebarPosition(position: 'left' | 'right'): void {
    this.options.sidebarPosition = position;
    this.applySidebarPosition();
  }

  private applySidebarPosition(): void {
    const root = this.rootElement;
    if (!root) return;

    const position = this.getSidebarPosition();
    root.classList.toggle('arch-editor--sidebar-left', position === 'left');
    root.classList.toggle('arch-editor--sidebar-right', position === 'right');

    const body = root.querySelector<HTMLElement>('.arch-editor__body');
    const canvasEl = this.canvas?.getElement();
    const panelEl = this.rightPanel?.getElement();
    if (body && canvasEl && panelEl) {
      // appendChild moves existing nodes, so sidebar state survives the swap.
      if (position === 'left') {
        body.appendChild(panelEl);
        body.appendChild(canvasEl);
      } else {
        body.appendChild(canvasEl);
        body.appendChild(panelEl);
      }
    }

    this.canvas?.setSidebarPosition(position);
    this.toolbar?.setSidebarPosition(position);
  }

  public getOptions(): EditorOptions {
    return this.options;
  }

  /**
   * Returns a deep clone of the current document AST.
   */
  public getJSON(): EmailDocument {
    return JSON.parse(JSON.stringify(this.document));
  }

  /**
   * Replaces current document state and refreshes the canvas & inspector.
   */
  public setJSON(doc: EmailDocument): void {
    this.document = normalizeDocument(doc);
    this.selectedBlockId = null;
    this.selectedElement = null;
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
  }

  /**
   * Compiles current document into production-ready email HTML.
   * Pulls the clean, serialized HTML directly from the live canvas preview.
   */
  public getHTML(): string {
    if (this.canvas) {
      const clean = this.canvas.getCleanHTML();
      if (clean) return clean;
    }
    return this.document.rawHtml || compileToEmailHtml(this.document);
  }

  /**
   * Imports prebuilt HTML email markup, preserves its full layout losslessly,
   * and renders it directly onto the real-preview canvas iframe.
   */
  public importHTML(htmlString: string): void {
    const doc = parseHtmlToDocument(htmlString);
    this.document = doc;
    this.selectedBlockId = null;
    this.selectedElement = null;
    this.canvas?.clearSelection();
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
  }

  /**
   * Sets/replaces the entire email content with the provided HTML markup.
   * Standard WYSIWYG counterpart to `getHTML()`.
   */
  public setHTML(htmlString: string): void {
    this.importHTML(htmlString);
  }

  /**
   * Loads HTML template content into the editor.
   * Alias for `setHTML()` / `importHTML()`.
   */
  public loadHTML(htmlString: string): void {
    this.importHTML(htmlString);
  }

  /**
   * Injects a custom HTML block or snippet dynamically into the email template.
   * Automatically normalizes the markup to preserve email table hierarchy.
   */
  public insertHTML(
    htmlSnippet: string,
    options: { targetElement?: HTMLElement | null; position?: 'before' | 'after' } = {}
  ): void {
    this.canvas?.insertHTML(htmlSnippet, options.targetElement, options.position || 'after');
  }

  /**
   * Sets the template name displayed in the editor toolbar.
   */
  public setTemplateName(name: string): void {
    this.options.templateName = name;
    this.toolbar?.setTemplateName(name);
    this.options.onTemplateNameChange?.(name);
    this.emit('templateNameChange', name);
  }

  /**
   * Gets the current template name.
   */
  public getTemplateName(): string {
    return this.toolbar?.getTemplateName() || this.options.templateName || 'Arch Email Editor';
  }

  /**
   * Dynamically adds a custom action button to the top-right toolbar.
   */
  public addCustomButton(button: ToolbarCustomButton): void {
    this.toolbar?.addCustomButton(button);
  }

  /**
   * Removes a custom action button from the toolbar by id.
   */
  public removeCustomButton(buttonId: string): void {
    this.toolbar?.removeCustomButton(buttonId);
  }

  /**
   * Configures visibility of default toolbar action buttons at runtime.
   */
  public setActions(actions: Partial<import('./types').ToolbarActionsOptions>): void {
    this.toolbar?.setActions(actions);
  }

  /**
   * Returns a copy of the modular sections loaded in the editor's SECTIONS tab.
   */
  public getSections(): PrebuiltSection[] {
    return this.rightPanel?.getSections() || [];
  }

  /**
   * Finds a loaded modular section by its unique ID.
   */
  public getSectionById(id: string): PrebuiltSection | undefined {
    return this.rightPanel?.getSectionById(id);
  }

  /**
   * Replaces the modular sections library and updates the sidebar UI.
   */
  public setSections(sections: PrebuiltSection[]): void {
    this.rightPanel?.setSections(sections);
  }

  /**
   * Dynamically adds or updates a modular section in the editor's library.
   */
  public addSection(section: PrebuiltSection): void {
    this.rightPanel?.addSection(section);
  }

  /**
   * Removes a modular section from the library by ID.
   */
  public removeSection(id: string): void {
    this.rightPanel?.removeSection(id);
  }

  /**
   * Reads an HTML file and imports it into the canvas.
   */
  public async importHTMLFile(file: File): Promise<void> {
    const text = await file.text();
    this.importHTML(text);
  }

  /**
   * Undo the most recent structural or content change.
   */
  public undo(): void {
    const prevHtml = this.history.undo();
    if (prevHtml !== null) {
      this.document.rawHtml = prevHtml;
      this.selectedElement = null;
      this.canvas?.clearSelection();
      this.updateViews(true);
      this.syncToolbarState();
      this.emit('change', this.getJSON());
    }
  }

  /**
   * Redo a previously undone change.
   */
  public redo(): void {
    const nextHtml = this.history.redo();
    if (nextHtml !== null) {
      this.document.rawHtml = nextHtml;
      this.selectedElement = null;
      this.canvas?.clearSelection();
      this.updateViews(true);
      this.syncToolbarState();
      this.emit('change', this.getJSON());
    }
  }

  /**
   * Moves the currently selected canvas element/unit up or down (or left/right for columns).
   */
  public moveSelectedElement(direction: 'up' | 'down'): void {
    this.canvas?.moveSelectedElement(direction);
  }

  /**
   * Duplicates the currently selected canvas element/unit.
   */
  public duplicateSelectedElement(): void {
    this.canvas?.duplicateSelectedElement();
  }

  /**
   * Selects the parent structural container (`Block` -> `Column` -> `Row` -> `Body`).
   */
  public selectParentUnit(): void {
    this.canvas?.selectParentUnit();
  }

  /**
   * Switches the responsive preview and customization mode (`desktop` | `tablet` | `mobile`).
   */
  public setViewportMode(mode: ViewportMode): void {
    this.canvas?.setViewportMode(mode);
    this.rightPanel?.setViewportMode(mode);
    if (this.selectedElement) {
      this.rightPanel?.update(this.document, this.selectedBlockId, this.selectedElement);
    }
  }

  /**
   * Reorders an existing block to a new target index.
   */
  public reorderBlock(sourceId: string, targetIndex: number): void {
    const currentIndex = this.document.blocks.findIndex((b) => b.id === sourceId);
    if (currentIndex === -1) return;

    const [movedBlock] = this.document.blocks.splice(currentIndex, 1);
    const adjustedIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const safeIndex = Math.max(0, Math.min(adjustedIndex, this.document.blocks.length));

    this.document.blocks.splice(safeIndex, 0, movedBlock);
    this.selectedBlockId = movedBlock.id;
    this.selectedElement = null;
    this.document.rawHtml = compileToEmailHtml({ ...this.document, rawHtml: undefined });
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
    this.emit('select', movedBlock);
  }

  /**
   * Inserts a newly created block of the given type at a specific target index.
   */
  public insertBlockAt(type: BlockType, index: number): void {
    const newBlock = this.createBlock(type);
    const safeIndex = Math.max(0, Math.min(index, this.document.blocks.length));
    this.document.blocks.splice(safeIndex, 0, newBlock);
    this.selectedBlockId = newBlock.id;
    this.selectedElement = null;
    this.document.rawHtml = compileToEmailHtml({ ...this.document, rawHtml: undefined });
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
    this.emit('select', newBlock);
  }

  /**
   * Appends a new block of the given type to the email.
   */
  public addBlock(type: BlockType): void {
    const newBlock = this.createBlock(type);
    this.document.blocks.push(newBlock);
    this.selectedBlockId = newBlock.id;
    this.selectedElement = null;

    if (this.canvas) {
      this.canvas.insertBlock(type);
    }

    this.updateViews();
    this.recordHistory();
    this.emit('change', this.getJSON());
    this.emit('select', newBlock);
  }

  /**
   * Inserts a multi-column row layout into the email.
   */
  public addRowLayout(layout: RowLayoutType): void {
    this.canvas?.insertRowLayout(layout);
    this.recordHistory();
    this.emit('change', this.getJSON());
  }

  /**
   * Removes a block by identifier.
   */
  public removeBlock(id: string): void {
    this.document.blocks = this.document.blocks.filter((b) => b.id !== id);
    if (this.selectedBlockId === id) {
      this.selectedBlockId = null;
      this.emit('select', null);
    }
    this.document.rawHtml = compileToEmailHtml({ ...this.document, rawHtml: undefined });
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
  }

  /**
   * Moves a block up or down in the block order.
   */
  public moveBlock(id: string, direction: 'up' | 'down'): void {
    const index = this.document.blocks.findIndex((b) => b.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = this.document.blocks[index - 1];
      this.document.blocks[index - 1] = this.document.blocks[index];
      this.document.blocks[index] = temp;
    } else if (direction === 'down' && index < this.document.blocks.length - 1) {
      const temp = this.document.blocks[index + 1];
      this.document.blocks[index + 1] = this.document.blocks[index];
      this.document.blocks[index] = temp;
    }

    this.document.rawHtml = compileToEmailHtml({ ...this.document, rawHtml: undefined });
    this.updateViews(true);
    this.recordHistory();
    this.emit('change', this.getJSON());
  }

  /**
   * Event subscription bus ('change', 'select').
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(event, list.filter((cb) => cb !== callback));
  }

  private emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => cb(...args));
    }
  }

  /**
   * Mounts all sub-components into the root container.
   */
  private mount(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'arch-editor';
    if (this.options.readOnly) {
      this.rootElement.classList.add('arch-editor--readonly');
    }
    if (this.options.theme === 'dark') {
      this.rootElement.classList.add('arch-theme--dark');
    }
    this.container.innerHTML = '';
    this.container.appendChild(this.rootElement);

    // 1. Initialize Modals
    this.importModal = new ImportModal((html) => this.importHTML(html));
    this.exportModal = new ExportModal();

    // 2. Initialize Toolbar
    this.toolbar = new Toolbar(
      {
        onImportHtml: () => this.importModal?.open(this.rootElement!),
        onExportJson: () =>
          this.exportModal?.open(
            this.rootElement!,
            'Exported Template JSON',
            JSON.stringify(this.getJSON(), null, 2)
          ),
        onExportHtml: () =>
          this.exportModal?.open(this.rootElement!, 'Exported Email HTML', this.getHTML()),
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onViewportChange: (mode) => this.setViewportMode(mode),
        onSidebarPositionChange: (position) => this.setSidebarPosition(position),
        onTemplateNameChange: (name) => {
          this.options.templateName = name;
          this.options.onTemplateNameChange?.(name);
          this.emit('templateNameChange', name);
        },
        onClear: () => {
          this.document.blocks = [];
          this.document.rawHtml = '';
          this.selectedBlockId = null;
          this.selectedElement = null;
          this.updateViews(true);
          this.recordHistory();
          this.emit('change', this.getJSON());
        }
      },
      {
        templateName: this.options.templateName,
        editableTemplateName: this.options.editableTemplateName,
        customButtons: this.options.customButtons,
        sidebarPosition: this.getSidebarPosition(),
        actions: {
          importHtml: this.options.showImportHtml !== undefined ? this.options.showImportHtml : (this.options.actions?.importHtml !== false),
          exportJson: this.options.showExportJson !== undefined ? this.options.showExportJson : (this.options.actions?.exportJson !== false),
          exportHtml: this.options.showExportHtml !== undefined ? this.options.showExportHtml : (this.options.actions?.exportHtml !== false),
          clear: this.options.showClear !== undefined ? this.options.showClear : (this.options.actions?.clear !== false)
        },
        editorInstance: this
      }
    );

    // 3. Initialize Canvas (takes full width on left)
    this.canvas = new Canvas({
      onSelectBlock: (id) => this.selectBlock(id),
      onSelectElement: (info) => this.selectElement(info),
      onContentChange: (cleanHtml) => {
        this.document.rawHtml = cleanHtml;
        this.recordHistory();
        this.emit('change', this.getJSON());
      },
      onAddBlock: (type) => this.addBlock(type),
      onReorderBlock: (sourceId, targetIdx) => this.reorderBlock(sourceId, targetIdx),
      onInsertBlockAt: (type, targetIdx) => {
        if (this.document.blocks && this.document.blocks.length > 0) {
          const newBlock = this.createBlock(type);
          const safeIndex = Math.max(0, Math.min(targetIdx, this.document.blocks.length));
          this.document.blocks.splice(safeIndex, 0, newBlock);
          this.selectedBlockId = newBlock.id;
          this.emit('select', newBlock);
        }
      },
      onMoveBlock: (id, dir) => this.moveBlock(id, dir),
      onRemoveBlock: (id) => this.removeBlock(id),
      onResolveSection: (id) => this.getSectionById(id),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onToggleSidebar: () => this.rightPanel?.toggleCollapsed() ?? false,
      onOpenPlaceholders: () => this.rightPanel?.openPlaceholdersPanel(),
      onOpenAi: () => this.rightPanel?.openAiPanel()
    });

    // 4. Initialize Unified Right Panel (Blocks | Sections | Settings)
    const baseSections = this.options.sections && this.options.sections.length > 0
      ? [...this.options.sections]
      : getDefaultSections();
    const resolvedSections = this.options.customSections && this.options.customSections.length > 0
      ? [...baseSections, ...this.options.customSections]
      : baseSections;

    this.rightPanel = new RightPanel(
      {
        onAddBlock: (type) => this.addBlock(type),
        onAddRowLayout: (layout) => this.addRowLayout(layout),
        onInsertSection: (section) => {
          this.insertHTML(section.html);
        },
        onUploadImage: this.options.onUploadImage,
        assets: (this.options as any).assets,
        onBrowseMedia: this.options.onBrowseMedia,
        onCropImage: this.options.onCropImage,
        onRemoveImage: this.options.onRemoveImage,
        onChange: (isDocumentSetting?: boolean) => {
          if (isDocumentSetting) {
            this.document.rawHtml = compileToEmailHtml({ ...this.document, rawHtml: undefined });
            this.updateViews(true);
            this.recordHistory();
            this.emit('change', this.getJSON());
          } else if (this.canvas) {
            this.canvas.onStructureChanged();
          } else {
            this.emit('change', this.getJSON());
          }
        },
        onRemoveBlock: (id) => this.removeBlock(id),
        onMoveElement: (dir) => this.canvas?.moveSelectedElement(dir),
        onDuplicateElement: () => this.canvas?.duplicateSelectedElement(),
        onRemoveElement: () => this.canvas?.removeSelectedElement(),
        onSelectParent: () => this.canvas?.selectParentUnit(),
        onSelectElementNode: (el) => this.canvas?.selectUnit(el, el),
        onDeselect: () => {
          this.selectedElement = null;
          this.selectedBlockId = null;
          this.canvas?.clearSelection();
          this.rightPanel?.update(this.document, null, null);
        },
        placeholders: this.options.placeholders
      },
      resolvedSections
    );

    if (this.options.readOnly) {
      this.canvas.setReadOnly(true);
      this.rightPanel.setReadOnly(true);
    }

    // 5. Assemble DOM Hierarchy: Canvas (left/main) + Right Panel (right)
    this.rootElement.appendChild(this.toolbar.getElement());

    const bodyEl = document.createElement('div');
    bodyEl.className = 'arch-editor__body';
    bodyEl.appendChild(this.canvas.getElement());
    bodyEl.appendChild(this.rightPanel.getElement());

    this.rootElement.appendChild(bodyEl);
    this.applySidebarPosition();

    // Initial render pass and initial history snapshot
    this.updateViews(true);
    this.history.reset(this.getHTML());
    this.syncToolbarState();
  }

  private recordHistory(): void {
    const html = this.getHTML();
    this.history.push(html);
    this.syncToolbarState();
  }

  private syncToolbarState(): void {
    const html = this.getHTML();
    const bytes = new Blob([html]).size;
    const canUndo = this.history.canUndo();
    const canRedo = this.history.canRedo();
    this.toolbar?.updateState(canUndo, canRedo, bytes);
    this.canvas?.updateHistoryState(canUndo, canRedo);
  }

  /**
   * Refreshes the canvas preview and inspector panel with latest state.
   */
  private updateViews(forceRewrite = false): void {
    this.canvas?.update(this.document, this.selectedBlockId, forceRewrite);
    this.rightPanel?.update(this.document, this.selectedBlockId, this.selectedElement);
  }

  private selectBlock(id: string | null): void {
    this.selectedBlockId = id;
    this.selectedElement = null;
    const block = id ? this.document.blocks.find((b) => b.id === id) || null : null;
    this.emit('select', block);
    this.rightPanel?.update(this.document, id, null);
  }

  private selectElement(info: SelectedElementInfo | null): void {
    this.selectedElement = info;
    this.selectedBlockId = null;
    this.rightPanel?.update(this.document, null, info);
  }

  /**
   * Helper to instantiate a new block with sensible email defaults.
   */
  private createBlock(type: BlockType): BlockNode {
    const id = `block_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    switch (type) {
      case 'heading':
        return {
          id,
          type: 'heading',
          content: { text: 'Heading Title', level: 2 },
          style: { fontSize: '24px', color: '#0f172a', textAlign: 'left', padding: '16px 20px' }
        };
      case 'text':
        return {
          id,
          type: 'text',
          content: { text: 'Write your newsletter paragraph copy here.' },
          style: { fontSize: '16px', color: '#475569', textAlign: 'left', padding: '12px 20px' }
        };
      case 'button':
        return {
          id,
          type: 'button',
          content: { label: 'Click Here', url: 'https://example.com' },
          style: {
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '6px',
            textAlign: 'center',
            padding: '16px 20px'
          }
        };
      case 'image':
        return {
          id,
          type: 'image',
          content: { src: '', alt: 'Image description' },
          style: { textAlign: 'center', padding: '12px 20px' }
        };
      case 'divider':
        return {
          id,
          type: 'divider',
          content: {},
          style: { color: '#e2e8f0', padding: '16px 20px' }
        };
      case 'spacer':
        return {
          id,
          type: 'spacer',
          content: {},
          style: { height: '28px', padding: '0' }
        };
      case 'social':
        return {
          id,
          type: 'social',
          content: {},
          style: { textAlign: 'center', padding: '12px 20px' }
        };
      case 'html':
        return {
          id,
          type: 'html',
          content: {
            html: '<div style="padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b;">Custom HTML snippet</div>'
          },
          style: { padding: '12px 20px' }
        };
      case 'list':
        return {
          id,
          type: 'list',
          content: {},
          style: { fontSize: '15px', color: '#334155', padding: '12px 20px', textAlign: 'left' }
        };
      case 'table':
        return {
          id,
          type: 'table',
          content: {},
          style: { padding: '12px 20px' }
        };
      case 'video':
        return {
          id,
          type: 'video',
          content: {
            url: 'https://youtube.com',
            src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
            label: '▶ Watch Video (3:20)'
          },
          style: { textAlign: 'center', padding: '16px 20px' }
        };
      case 'icons':
        return {
          id,
          type: 'icons',
          content: {},
          style: { textAlign: 'center', padding: '16px 20px' }
        };
      case 'menu':
        return {
          id,
          type: 'menu',
          content: {},
          style: { textAlign: 'center', padding: '12px 20px' }
        };
      case 'gif':
        return {
          id,
          type: 'gif',
          content: {
            src: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
            alt: 'Animated sticker'
          },
          style: { textAlign: 'center', padding: '12px 20px' }
        };
    }
  }

  /**
   * Tears down the editor, detaching all event listeners and clearing DOM nodes.
   */
  public destroy(): void {
    this.toolbar?.destroy();
    this.canvas?.destroy();
    this.rightPanel?.destroy();
    this.importModal?.close();
    this.exportModal?.close();

    this.listeners.clear();
    this.container.innerHTML = '';
    this.rootElement = null;
  }
}

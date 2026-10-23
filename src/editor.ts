/**
 * Arch Email Editor - Core Controller & Component Orchestrator
 *
 * Architecture pattern: Component Orchestrator + Core Controller.
 * 
 * Cleanly breaks responsibilities across focused sub-components:
 * - Toolbar: Top actions (Import HTML, Export JSON/HTML, Clear)
 * - Palette: Left draggable block palette
 * - Canvas: Central real-fidelity email WYSIWYG canvas (isolated iframe)
 * - Inspector: Right property controls
 * - ImportModal: File upload and paste HTML modal
 * - ExportModal: Formatted code viewer and copy-to-clipboard
 *
 * 100% Vanilla TypeScript with zero runtime framework dependencies.
 */

import { EmailDocument, BlockNode, BlockType, EditorOptions, SelectedElementInfo } from './types';
import {
  compileToEmailHtml,
  parseHtmlToDocument,
  normalizeDocument
} from './compiler';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';

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

  // Modular UI Components
  private toolbar: Toolbar | null = null;
  private palette: Palette | null = null;
  private canvas: Canvas | null = null;
  private inspector: Inspector | null = null;
  private importModal: ImportModal | null = null;
  private exportModal: ExportModal | null = null;

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
    this.updateViews();
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
    this.updateViews();
    this.emit('change', this.getJSON());
  }

  /**
   * Reads an HTML file and imports it into the canvas.
   */
  public async importHTMLFile(file: File): Promise<void> {
    const text = await file.text();
    this.importHTML(text);
  }

  /**
   * Reorders an existing block to a new target index.
   */
  public reorderBlock(sourceId: string, targetIndex: number): void {
    const currentIndex = this.document.blocks.findIndex(b => b.id === sourceId);
    if (currentIndex === -1) return;

    const [movedBlock] = this.document.blocks.splice(currentIndex, 1);
    const adjustedIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const safeIndex = Math.max(0, Math.min(adjustedIndex, this.document.blocks.length));

    this.document.blocks.splice(safeIndex, 0, movedBlock);
    this.selectedBlockId = movedBlock.id;
    this.selectedElement = null;
    this.document.rawHtml = compileToEmailHtml(this.document);
    this.updateViews();
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
    this.document.rawHtml = compileToEmailHtml(this.document);
    this.updateViews();
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
    this.emit('change', this.getJSON());
    this.emit('select', newBlock);
  }

  /**
   * Removes a block by identifier.
   */
  public removeBlock(id: string): void {
    this.document.blocks = this.document.blocks.filter(b => b.id !== id);
    if (this.selectedBlockId === id) {
      this.selectedBlockId = null;
      this.emit('select', null);
    }
    this.document.rawHtml = compileToEmailHtml(this.document);
    this.updateViews();
    this.emit('change', this.getJSON());
  }

  /**
   * Moves a block up or down in the block order.
   */
  public moveBlock(id: string, direction: 'up' | 'down'): void {
    const index = this.document.blocks.findIndex(b => b.id === id);
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

    this.document.rawHtml = compileToEmailHtml(this.document);
    this.updateViews();
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
    this.listeners.set(event, list.filter(cb => cb !== callback));
  }

  private emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => cb(...args));
    }
  }

  /**
   * Mounts all sub-components into the root container.
   */
  private mount(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'arch-editor';
    this.container.innerHTML = '';
    this.container.appendChild(this.rootElement);

    // 1. Initialize Modals
    this.importModal = new ImportModal((html) => this.importHTML(html));
    this.exportModal = new ExportModal();

    // 2. Initialize Toolbar
    this.toolbar = new Toolbar({
      onImportHtml: () => this.importModal?.open(this.rootElement!),
      onExportJson: () => this.exportModal?.open(this.rootElement!, 'Exported Template JSON', JSON.stringify(this.getJSON(), null, 2)),
      onExportHtml: () => this.exportModal?.open(this.rootElement!, 'Exported Email HTML', this.getHTML()),
      onClear: () => {
        this.document.blocks = [];
        this.document.rawHtml = '';
        this.selectedBlockId = null;
        this.selectedElement = null;
        this.updateViews();
        this.emit('change', this.getJSON());
      }
    });

    // 3. Initialize Palette
    this.palette = new Palette({
      onAddBlock: (type) => this.addBlock(type)
    });

    // 4. Initialize Canvas
    this.canvas = new Canvas({
      onSelectBlock: (id) => this.selectBlock(id),
      onSelectElement: (info) => this.selectElement(info),
      onContentChange: (cleanHtml) => {
        this.document.rawHtml = cleanHtml;
        this.emit('change', this.getJSON());
      },
      onAddBlock: (type) => this.addBlock(type),
      onReorderBlock: (sourceId, targetIdx) => this.reorderBlock(sourceId, targetIdx),
      onInsertBlockAt: (type, targetIdx) => this.insertBlockAt(type, targetIdx),
      onMoveBlock: (id, dir) => this.moveBlock(id, dir),
      onRemoveBlock: (id) => this.removeBlock(id)
    });

    // 5. Initialize Inspector
    this.inspector = new Inspector({
      onChange: () => {
        if (this.canvas) {
          const cleanHtml = this.canvas.getCleanHTML();
          if (cleanHtml) {
            this.document.rawHtml = cleanHtml;
          }
        }
        this.emit('change', this.getJSON());
      },
      onRemoveBlock: (id) => this.removeBlock(id)
    });

    // 6. Assemble DOM Hierarchy
    this.rootElement.appendChild(this.toolbar.getElement());

    const bodyEl = document.createElement('div');
    bodyEl.className = 'arch-editor__body';
    bodyEl.appendChild(this.palette.getElement());
    bodyEl.appendChild(this.canvas.getElement());
    bodyEl.appendChild(this.inspector.getElement());

    this.rootElement.appendChild(bodyEl);

    // Initial render pass
    this.updateViews();
  }

  /**
   * Refreshes the canvas preview and inspector panel with latest state.
   */
  private updateViews(): void {
    this.canvas?.update(this.document, this.selectedBlockId);
    this.inspector?.update(this.document, this.selectedBlockId, this.selectedElement);
  }

  private selectBlock(id: string | null): void {
    this.selectedBlockId = id;
    this.selectedElement = null;
    const block = id ? this.document.blocks.find(b => b.id === id) || null : null;
    this.emit('select', block);
    this.inspector?.update(this.document, id, null);
  }

  private selectElement(info: SelectedElementInfo | null): void {
    this.selectedElement = info;
    this.selectedBlockId = null;
    this.inspector?.update(this.document, null, info);
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
          style: { backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '6px', textAlign: 'center', padding: '16px 20px' }
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
      case 'html':
        return {
          id,
          type: 'html',
          content: { html: '<div style="padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b;">Custom HTML snippet</div>' },
          style: { padding: '12px 20px' }
        };
    }
  }

  /**
   * Tears down the editor, detaching all event listeners and clearing DOM nodes.
   */
  public destroy(): void {
    this.toolbar?.destroy();
    this.palette?.destroy();
    this.canvas?.destroy();
    this.inspector?.destroy();
    this.importModal?.close();
    this.exportModal?.close();

    this.listeners.clear();
    this.container.innerHTML = '';
    this.rootElement = null;
  }
}

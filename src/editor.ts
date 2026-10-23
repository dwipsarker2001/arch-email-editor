/**
 * Arch Email Editor - Core Vanilla Controller
 *
 * Architecture pattern: Core Controller + Thin Adapter.
 * 
 * This class is 100% Vanilla TypeScript with ZERO external framework dependencies.
 * It manages:
 * 1. Document State: Stores the AST of email blocks with robust normalization.
 * 2. Visual View: Renders canvas, toolbar, palette, and inspector to the DOM.
 * 3. Interactions: Drag-and-drop, block reordering, style updates, and HTML import/export.
 * 4. Lifecycle: Implements imperative `create()` and `destroy()` methods compatible with
 *    direct HTML <script> tags, React useEffect hooks, and Vue onMounted hooks.
 */

import { EmailDocument, BlockNode, BlockType, EditorOptions } from './types';
import {
  compileToEmailHtml,
  parseHtmlToDocument,
  normalizeDocument,
  sanitizeUrl,
  sanitizeImageUrl
} from './compiler';

export class ArchEmailEditor {
  /** Target container element where the editor is rendered */
  private container: HTMLElement;
  /** Active editor configuration options */
  private options: EditorOptions;
  /** The in-memory document state (reactive AST) */
  private document: EmailDocument;
  /** Currently selected block ID (or null if document settings are selected) */
  private selectedBlockId: string | null = null;
  /** The root editor DOM node */
  private rootElement: HTMLElement | null = null;
  /** Event bus mapping event names to subscriber callbacks */
  private listeners: Map<string, Function[]> = new Map();

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
    // Robust normalization: guarantees valid settings and blocks even if empty {} or corrupted
    this.document = normalizeDocument(options.initialData);

    // Register event listeners passed via options
    if (options.onChange) {
      this.on('change', options.onChange);
    }
    if (options.onSelectBlock) {
      this.on('select', options.onSelectBlock);
    }

    // Render the initial DOM structure
    this.render();
  }

  /**
   * Factory method to create and mount the editor.
   * Matches the standard convention used by CKEditor, Monaco Editor, and TinyMCE.
   */
  public static create(target: HTMLElement | string, options: EditorOptions = {}): ArchEmailEditor {
    return new ArchEmailEditor(target, options);
  }

  /**
   * Returns a copy of the editor's options.
   */
  public getOptions(): EditorOptions {
    return this.options;
  }

  /**
   * Returns a deep clone of the current document AST.
   * Useful for saving newsletter drafts in a backend database.
   */
  public getJSON(): EmailDocument {
    return JSON.parse(JSON.stringify(this.document));
  }

  /**
   * Replaces the current document with a new JSON template and re-renders the canvas.
   */
  public setJSON(doc: EmailDocument): void {
    this.document = normalizeDocument(doc);
    this.selectedBlockId = null;
    this.render();
    this.emit('change', this.getJSON());
  }

  /**
   * Compiles the current document into production-ready, client-tested email HTML.
   */
  public getHTML(): string {
    return compileToEmailHtml(this.document);
  }

  /**
   * Imports prebuilt HTML email markup, parses it into editable blocks,
   * and loads it directly onto the canvas.
   */
  public importHTML(htmlString: string): void {
    const doc = parseHtmlToDocument(htmlString);
    this.setJSON(doc);
  }

  /**
   * Reads an HTML file from a file input or drag-and-drop and imports it.
   */
  public async importHTMLFile(file: File): Promise<void> {
    const text = await file.text();
    this.importHTML(text);
  }

  /**
   * Subscribes a listener function to editor lifecycle and state events ('change', 'select').
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribes a listener function.
   */
  public off(event: string, callback: Function): void {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(event, list.filter(cb => cb !== callback));
  }

  /**
   * Emits an event to all subscribed listeners.
   */
  private emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => cb(...args));
    }
  }

  /**
   * Destroys the editor instance, clears event listeners, and removes the editor DOM.
   * Crucial for preventing memory leaks in single-page apps (React / Vue unmounting).
   */
  public destroy(): void {
    this.listeners.clear();
    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.remove();
    }
    this.rootElement = null;
    this.container.innerHTML = '';
  }

  /**
   * Creates a new block node with default styling based on block type.
   */
  private createBlock(type: BlockType): BlockNode {
    const id = `block_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    switch (type) {
      case 'heading':
        return {
          id,
          type: 'heading',
          content: { text: 'New Heading', level: 2 },
          style: { fontSize: '24px', color: '#0f172a', textAlign: 'left', padding: '12px 20px' }
        };
      case 'text':
        return {
          id,
          type: 'text',
          content: { text: 'Enter your email message content here.' },
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
            fontSize: '16px',
            textAlign: 'center',
            padding: '16px 20px'
          }
        };
      case 'image':
        return {
          id,
          type: 'image',
          content: {
            src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
            alt: 'Image'
          },
          style: { textAlign: 'center', padding: '12px 20px' }
        };
      case 'divider':
        return {
          id,
          type: 'divider',
          content: {},
          style: { color: '#e2e8f0', padding: '16px 20px' }
        };
    }
  }

  /**
   * Appends a new block of the given type to the document.
   */
  private addBlock(type: BlockType): void {
    const newBlock = this.createBlock(type);
    this.document.blocks.push(newBlock);
    this.selectedBlockId = newBlock.id;
    this.render();
    this.emit('change', this.getJSON());
    this.emit('select', newBlock);
  }

  /**
   * Deletes a block by ID.
   */
  private removeBlock(id: string): void {
    this.document.blocks = this.document.blocks.filter(b => b.id !== id);
    if (this.selectedBlockId === id) {
      this.selectedBlockId = null;
      this.emit('select', null);
    }
    this.render();
    this.emit('change', this.getJSON());
  }

  /**
   * Moves a block up or down in the newsletter layout.
   */
  private moveBlock(id: string, direction: 'up' | 'down'): void {
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

    this.render();
    this.emit('change', this.getJSON());
  }

  /**
   * Sets the active block for inspector property editing.
   */
  private selectBlock(id: string | null): void {
    this.selectedBlockId = id;
    const block = id ? this.document.blocks.find(b => b.id === id) || null : null;
    this.emit('select', block);
    this.updateInspector();

    // Update active highlight classes on canvas blocks
    const canvasBlocks = this.container.querySelectorAll('.arch-canvas-block');
    canvasBlocks.forEach(el => {
      if (el.getAttribute('data-id') === id) {
        el.classList.add('is-selected');
      } else {
        el.classList.remove('is-selected');
      }
    });
  }

  /**
   * Renders the overall editor frame: header toolbar, block palette, canvas container, and inspector sidebar.
   */
  private render(): void {
    if (!this.rootElement) {
      this.rootElement = document.createElement('div');
      this.rootElement.className = 'arch-editor';
      this.container.innerHTML = '';
      this.container.appendChild(this.rootElement);
    }

    this.rootElement.innerHTML = `
      <div class="arch-editor__toolbar">
        <div class="arch-editor__title">
          <span>📬</span>
          <span>Arch Email Editor</span>
        </div>
        <div class="arch-editor__actions">
          <button class="arch-btn arch-btn--import-html" type="button">📥 Import HTML</button>
          <button class="arch-btn arch-btn--export-json" type="button">Export JSON</button>
          <button class="arch-btn arch-btn--primary arch-btn--export-html" type="button">Export HTML</button>
          <button class="arch-btn arch-btn--danger arch-btn--clear" type="button">Clear</button>
        </div>
      </div>
      <div class="arch-editor__body">
        <div class="arch-editor__palette">
          <div class="arch-editor__section-label">Add Blocks</div>
          <button class="arch-palette-item" type="button" draggable="true" data-block-type="heading">
            <span>🔤</span> Heading
          </button>
          <button class="arch-palette-item" type="button" draggable="true" data-block-type="text">
            <span>📝</span> Text
          </button>
          <button class="arch-palette-item" type="button" draggable="true" data-block-type="button">
            <span>🔘</span> Button
          </button>
          <button class="arch-palette-item" type="button" draggable="true" data-block-type="image">
            <span>🖼️</span> Image
          </button>
          <button class="arch-palette-item" type="button" draggable="true" data-block-type="divider">
            <span>➖</span> Divider
          </button>
        </div>
        <div class="arch-editor__canvas">
          <div class="arch-canvas-container" style="background-color: #ffffff; max-width: ${this.document.settings.contentWidth};">
            <!-- Canvas blocks injected here -->
          </div>
        </div>
        <div class="arch-editor__inspector">
          <!-- Inspector controls injected here -->
        </div>
      </div>
    `;

    this.bindToolbarEvents();
    this.bindPaletteEvents();
    this.renderCanvas();
    this.updateInspector();
  }

  /**
   * Binds click handlers to the top toolbar actions (Import HTML, Export JSON/HTML, Clear).
   */
  private bindToolbarEvents(): void {
    const importBtn = this.rootElement?.querySelector('.arch-btn--import-html');
    importBtn?.addEventListener('click', () => {
      this.showImportModal();
    });

    const jsonBtn = this.rootElement?.querySelector('.arch-btn--export-json');
    jsonBtn?.addEventListener('click', () => {
      this.showModal('Exported Template JSON', JSON.stringify(this.getJSON(), null, 2));
    });

    const htmlBtn = this.rootElement?.querySelector('.arch-btn--export-html');
    htmlBtn?.addEventListener('click', () => {
      this.showModal('Exported Email HTML', this.getHTML());
    });

    const clearBtn = this.rootElement?.querySelector('.arch-btn--clear');
    clearBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all blocks?')) {
        this.document.blocks = [];
        this.selectedBlockId = null;
        this.render();
        this.emit('change', this.getJSON());
      }
    });
  }

  /**
   * Binds both click-to-add and native HTML5 drag-and-drop events for the block palette.
   */
  private bindPaletteEvents(): void {
    const paletteButtons = this.rootElement?.querySelectorAll<HTMLButtonElement>('[data-block-type]');
    paletteButtons?.forEach(btn => {
      const type = btn.getAttribute('data-block-type') as BlockType;

      // Click to add
      btn.addEventListener('click', () => {
        this.addBlock(type);
      });

      // Drag start
      btn.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', type);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });

    // Canvas container drag-and-drop dropzone
    const canvasContainer = this.rootElement?.querySelector<HTMLElement>('.arch-canvas-container');
    const canvasWrapper = this.rootElement?.querySelector<HTMLElement>('.arch-editor__canvas');

    // Deselect active block when clicking on empty canvas area
    canvasWrapper?.addEventListener('click', (e) => {
      if (e.target === canvasWrapper || e.target === canvasContainer) {
        this.selectBlock(null);
      }
    });

    if (canvasContainer) {
      canvasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasContainer.classList.add('drag-over');
      });

      canvasContainer.addEventListener('dragleave', () => {
        canvasContainer.classList.remove('drag-over');
      });

      canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasContainer.classList.remove('drag-over');
        const type = e.dataTransfer?.getData('text/plain') as BlockType;
        if (type) {
          this.addBlock(type);
        }
      });
    }
  }

  /**
   * Renders the newsletter preview blocks inside the centered 600px canvas.
   */
  private renderCanvas(): void {
    const container = this.rootElement?.querySelector<HTMLElement>('.arch-canvas-container');
    if (!container) return;

    if (this.document.blocks.length === 0) {
      container.innerHTML = `
        <div class="arch-canvas-empty">
          <p>This email is empty.</p>
          <p>Drag or click blocks from the left palette to start composing.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.document.blocks.forEach((block, index) => {
      const blockEl = document.createElement('div');
      blockEl.className = `arch-canvas-block ${block.id === this.selectedBlockId ? 'is-selected' : ''}`;
      blockEl.setAttribute('data-id', block.id);
      blockEl.style.padding = block.style.padding || '12px 20px';
      blockEl.style.textAlign = block.style.textAlign || 'left';

      // Block Action Toolbar (Up, Down, Delete)
      const toolbar = document.createElement('div');
      toolbar.className = 'arch-block-toolbar';
      toolbar.innerHTML = `
        ${index > 0 ? `<button class="arch-toolbar-btn btn-up" title="Move Up">▲</button>` : ''}
        ${index < this.document.blocks.length - 1 ? `<button class="arch-toolbar-btn btn-down" title="Move Down">▼</button>` : ''}
        <button class="arch-toolbar-btn btn-delete" title="Delete Block">✕</button>
      `;

      toolbar.querySelector('.btn-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveBlock(block.id, 'up');
      });

      toolbar.querySelector('.btn-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveBlock(block.id, 'down');
      });

      toolbar.querySelector('.btn-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBlock(block.id);
      });

      blockEl.appendChild(toolbar);

      // Block Content Preview
      const contentEl = document.createElement('div');
      this.renderBlockPreview(block, contentEl);
      blockEl.appendChild(contentEl);

      blockEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBlock(block.id);
      });

      container.appendChild(blockEl);
    });
  }

  /**
   * Renders the interactive visual DOM representation of an individual block safely.
   */
  private renderBlockPreview(block: BlockNode, container: HTMLElement): void {
    switch (block.type) {
      case 'heading': {
        const h = document.createElement(block.content.level === 1 ? 'h1' : block.content.level === 3 ? 'h3' : 'h2');
        h.textContent = block.content.text || '';
        h.style.color = block.style.color || '#0f172a';
        h.style.fontSize = block.style.fontSize || '24px';
        h.style.margin = '0';
        container.appendChild(h);
        break;
      }
      case 'text': {
        const p = document.createElement('p');
        p.textContent = block.content.text || '';
        p.style.color = block.style.color || '#475569';
        p.style.fontSize = block.style.fontSize || '16px';
        p.style.lineHeight = '1.6';
        p.style.margin = '0';
        container.appendChild(p);
        break;
      }
      case 'button': {
        const btn = document.createElement('a');
        btn.textContent = block.content.label || 'Click Here';
        btn.href = sanitizeUrl(block.content.url);
        btn.style.display = 'inline-block';
        btn.style.backgroundColor = block.style.backgroundColor || '#2563eb';
        btn.style.color = block.style.color || '#ffffff';
        btn.style.borderRadius = block.style.borderRadius || '4px';
        btn.style.fontSize = block.style.fontSize || '16px';
        btn.style.fontWeight = '600';
        btn.style.padding = '12px 24px';
        btn.style.textDecoration = 'none';
        container.appendChild(btn);
        break;
      }
      case 'image': {
        const img = document.createElement('img');
        const safeSrc = sanitizeImageUrl(block.content.src || '');
        if (safeSrc) {
          img.src = safeSrc;
        }
        img.alt = block.content.alt || '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.style.display = 'inline-block';
        container.appendChild(img);
        break;
      }
      case 'divider': {
        const hr = document.createElement('hr');
        hr.style.border = '0';
        hr.style.borderTop = `1px solid ${block.style.color || '#e2e8f0'}`;
        hr.style.margin = '0';
        container.appendChild(hr);
        break;
      }
    }
  }

  /**
   * Renders the contextual Inspector sidebar safely without raw innerHTML interpolation.
   */
  private updateInspector(): void {
    const inspector = this.rootElement?.querySelector<HTMLElement>('.arch-editor__inspector');
    if (!inspector) return;

    const block = this.selectedBlockId
      ? this.document.blocks.find(b => b.id === this.selectedBlockId)
      : null;

    if (!block) {
      // Document Settings Inspector
      inspector.innerHTML = `
        <div class="arch-editor__section-label">Email Settings</div>
        <div class="arch-form-group">
          <label class="arch-form-label">Background Color</label>
          <input type="color" class="arch-input" id="inp-doc-bg">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Content Width</label>
          <input type="text" class="arch-input" id="inp-doc-width">
        </div>
        <p style="font-size: 12px; color: var(--arch-text-secondary); margin-top: 12px;">
          💡 Click any block on the canvas to inspect and edit its properties.
        </p>
      `;

      const bgInp = inspector.querySelector<HTMLInputElement>('#inp-doc-bg');
      if (bgInp) bgInp.value = this.document.settings.backgroundColor;

      const widthInp = inspector.querySelector<HTMLInputElement>('#inp-doc-width');
      if (widthInp) widthInp.value = this.document.settings.contentWidth;

      bgInp?.addEventListener('input', (e) => {
        this.document.settings.backgroundColor = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      widthInp?.addEventListener('change', (e) => {
        this.document.settings.contentWidth = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      return;
    }

    // Block Inspector
    inspector.innerHTML = `
      <div class="arch-editor__section-label">Block Properties (${block.type.toUpperCase()})</div>
      <div id="inspector-fields"></div>
      <div class="arch-form-group" style="margin-top: 16px;">
        <button class="arch-btn arch-btn--danger" id="btn-inspector-delete" style="width: 100%;">Delete Block</button>
      </div>
    `;

    const fieldsContainer = inspector.querySelector<HTMLElement>('#inspector-fields');
    if (!fieldsContainer) return;

    inspector.querySelector('#btn-inspector-delete')?.addEventListener('click', () => {
      this.removeBlock(block.id);
    });

    if (block.type === 'heading' || block.type === 'text') {
      const isHeading = block.type === 'heading';
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Text Content</label>
          <textarea class="arch-textarea" id="inp-block-text"></textarea>
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Font Size</label>
          <input type="text" class="arch-input" id="inp-font-size">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Text Color</label>
          <input type="color" class="arch-input" id="inp-color">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-align">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      `;

      // Safe value assignments (immune to XSS injection)
      const textInp = fieldsContainer.querySelector<HTMLTextAreaElement>('#inp-block-text')!;
      textInp.value = block.content.text || '';

      const fontInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-font-size')!;
      fontInp.value = block.style.fontSize || (isHeading ? '24px' : '16px');

      const colorInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-color')!;
      colorInp.value = block.style.color || (isHeading ? '#0f172a' : '#475569');

      const alignSel = fieldsContainer.querySelector<HTMLSelectElement>('#inp-align')!;
      alignSel.value = block.style.textAlign || 'left';

      textInp.addEventListener('input', (e) => {
        block.content.text = (e.target as HTMLTextAreaElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fontInp.addEventListener('change', (e) => {
        block.style.fontSize = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      colorInp.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      alignSel.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'button') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Button Label</label>
          <input type="text" class="arch-input" id="inp-btn-label">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Target URL</label>
          <input type="text" class="arch-input" id="inp-btn-url">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Button Background</label>
          <input type="color" class="arch-input" id="inp-btn-bg">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Text Color</label>
          <input type="color" class="arch-input" id="inp-btn-color">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-btn-align">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      `;

      const labelInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-label')!;
      labelInp.value = block.content.label || '';

      const urlInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-url')!;
      urlInp.value = block.content.url || '';

      const bgInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-bg')!;
      bgInp.value = block.style.backgroundColor || '#2563eb';

      const colorInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-color')!;
      colorInp.value = block.style.color || '#ffffff';

      const alignSel = fieldsContainer.querySelector<HTMLSelectElement>('#inp-btn-align')!;
      alignSel.value = block.style.textAlign || 'center';

      labelInp.addEventListener('input', (e) => {
        block.content.label = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      urlInp.addEventListener('input', (e) => {
        block.content.url = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      bgInp.addEventListener('input', (e) => {
        block.style.backgroundColor = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      colorInp.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      alignSel.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'image') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Image URL</label>
          <input type="text" class="arch-input" id="inp-img-src">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alt Description</label>
          <input type="text" class="arch-input" id="inp-img-alt">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-img-align">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      `;

      const srcInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-img-src')!;
      srcInp.value = block.content.src || '';

      const altInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-img-alt')!;
      altInp.value = block.content.alt || '';

      const alignSel = fieldsContainer.querySelector<HTMLSelectElement>('#inp-img-align')!;
      alignSel.value = block.style.textAlign || 'center';

      srcInp.addEventListener('input', (e) => {
        block.content.src = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      altInp.addEventListener('input', (e) => {
        block.content.alt = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      alignSel.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'divider') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Line Color</label>
          <input type="color" class="arch-input" id="inp-div-color">
        </div>
      `;

      const divColorInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-div-color')!;
      divColorInp.value = block.style.color || '#e2e8f0';

      divColorInp.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    }
  }

  /**
   * Displays the HTML Import modal allowing file uploads or pasting raw HTML markup.
   */
  private showImportModal(): void {
    const modal = document.createElement('div');
    modal.className = 'arch-modal-overlay';
    modal.innerHTML = `
      <div class="arch-modal">
        <div class="arch-modal__header">
          <span>📥 Import Prebuilt HTML Email Template</span>
          <button class="arch-btn arch-btn--close" type="button">✕</button>
        </div>
        <div class="arch-modal__body">
          <div class="arch-form-group" style="margin-bottom: 16px;">
            <label class="arch-form-label">Option 1: Upload .html file</label>
            <input type="file" id="arch-import-file" class="arch-input" accept=".html,.htm" />
          </div>
          <div class="arch-form-group">
            <label class="arch-form-label">Option 2: Or Paste HTML Code</label>
            <textarea class="arch-modal__code" id="arch-import-text" placeholder="Paste <table> email markup here..."></textarea>
          </div>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button class="arch-btn arch-btn--close-cancel" type="button">Cancel</button>
          <button class="arch-btn arch-btn--primary arch-btn--do-import" type="button">Load Into Editor</button>
        </div>
      </div>
    `;

    const closeModal = () => modal.remove();
    modal.querySelector('.arch-btn--close')?.addEventListener('click', closeModal);
    modal.querySelector('.arch-btn--close-cancel')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const fileInput = modal.querySelector<HTMLInputElement>('#arch-import-file');
    const textarea = modal.querySelector<HTMLTextAreaElement>('#arch-import-text');

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && textarea) {
        textarea.value = await file.text();
      }
    });

    modal.querySelector('.arch-btn--do-import')?.addEventListener('click', () => {
      const html = textarea?.value?.trim();
      if (html) {
        this.importHTML(html);
        closeModal();
      } else {
        alert('Please select an HTML file or paste HTML markup.');
      }
    });

    this.rootElement?.appendChild(modal);
  }

  /**
   * Displays an export modal safely setting textarea.value without HTML interpolation.
   */
  private showModal(title: string, content: string): void {
    const modal = document.createElement('div');
    modal.className = 'arch-modal-overlay';
    modal.innerHTML = `
      <div class="arch-modal">
        <div class="arch-modal__header">
          <span class="arch-modal__title"></span>
          <button class="arch-btn arch-btn--close" type="button">✕</button>
        </div>
        <div class="arch-modal__body">
          <textarea class="arch-modal__code" readonly></textarea>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button class="arch-btn arch-btn--primary arch-btn--copy" type="button">Copy to Clipboard</button>
        </div>
      </div>
    `;

    modal.querySelector<HTMLElement>('.arch-modal__title')!.textContent = title;
    const textarea = modal.querySelector<HTMLTextAreaElement>('.arch-modal__code')!;
    textarea.value = content; // Safe programmatic assignment

    let copyTimer: any = null;
    const closeModal = () => {
      if (copyTimer) clearTimeout(copyTimer);
      modal.remove();
    };

    modal.querySelector('.arch-btn--close')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const copyBtn = modal.querySelector<HTMLButtonElement>('.arch-btn--copy');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard?.writeText(content);
      copyBtn.textContent = 'Copied!';
      copyTimer = setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    });

    this.rootElement?.appendChild(modal);
  }
}

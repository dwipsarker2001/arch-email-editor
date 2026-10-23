import { EmailDocument, BlockNode, BlockType, EditorOptions } from './types';
import { getDefaultDocument, compileToEmailHtml } from './compiler';

export class ArchEmailEditor {
  private container: HTMLElement;
  private options: EditorOptions;
  private document: EmailDocument;
  private selectedBlockId: string | null = null;
  private rootElement: HTMLElement | null = null;
  private listeners: Map<string, Function[]> = new Map();

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
    this.document = options.initialData
      ? JSON.parse(JSON.stringify(options.initialData))
      : getDefaultDocument();

    if (options.onChange) {
      this.on('change', options.onChange);
    }
    if (options.onSelectBlock) {
      this.on('select', options.onSelectBlock);
    }

    this.render();
  }

  public static create(target: HTMLElement | string, options: EditorOptions = {}): ArchEmailEditor {
    return new ArchEmailEditor(target, options);
  }

  public getOptions(): EditorOptions {
    return this.options;
  }

  public getJSON(): EmailDocument {
    return JSON.parse(JSON.stringify(this.document));
  }

  public setJSON(doc: EmailDocument): void {
    this.document = JSON.parse(JSON.stringify(doc));
    this.selectedBlockId = null;
    this.render();
    this.emit('change', this.getJSON());
  }

  public getHTML(): string {
    return compileToEmailHtml(this.document);
  }

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

  public destroy(): void {
    this.listeners.clear();
    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.remove();
    }
    this.container.innerHTML = '';
  }

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

  private addBlock(type: BlockType): void {
    const newBlock = this.createBlock(type);
    this.document.blocks.push(newBlock);
    this.selectedBlockId = newBlock.id;
    this.render();
    this.emit('change', this.getJSON());
    this.emit('select', newBlock);
  }

  private removeBlock(id: string): void {
    this.document.blocks = this.document.blocks.filter(b => b.id !== id);
    if (this.selectedBlockId === id) {
      this.selectedBlockId = null;
      this.emit('select', null);
    }
    this.render();
    this.emit('change', this.getJSON());
  }

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

  private render(): void {
    // If rootElement already exists, re-render inner parts to preserve container
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

  private bindToolbarEvents(): void {
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

    // Canvas container drag-and-drop
    const canvasContainer = this.rootElement?.querySelector<HTMLElement>('.arch-canvas-container');
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
        btn.href = '#';
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
        img.src = block.content.src || '';
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
          <input type="color" class="arch-input" id="inp-doc-bg" value="${this.document.settings.backgroundColor}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Content Width</label>
          <input type="text" class="arch-input" id="inp-doc-width" value="${this.document.settings.contentWidth}">
        </div>
        <p style="font-size: 12px; color: var(--arch-text-secondary); margin-top: 12px;">
          💡 Click any block on the canvas to inspect and edit its properties.
        </p>
      `;

      inspector.querySelector('#inp-doc-bg')?.addEventListener('input', (e) => {
        this.document.settings.backgroundColor = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      inspector.querySelector('#inp-doc-width')?.addEventListener('change', (e) => {
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

    const fieldsContainer = inspector.querySelector('#inspector-fields');
    if (!fieldsContainer) return;

    inspector.querySelector('#btn-inspector-delete')?.addEventListener('click', () => {
      this.removeBlock(block.id);
    });

    if (block.type === 'heading' || block.type === 'text') {
      const isHeading = block.type === 'heading';
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Text Content</label>
          <textarea class="arch-textarea" id="inp-block-text">${block.content.text || ''}</textarea>
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Font Size</label>
          <input type="text" class="arch-input" id="inp-font-size" value="${block.style.fontSize || (isHeading ? '24px' : '16px')}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Text Color</label>
          <input type="color" class="arch-input" id="inp-color" value="${block.style.color || (isHeading ? '#0f172a' : '#475569')}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-align">
            <option value="left" ${block.style.textAlign === 'left' ? 'selected' : ''}>Left</option>
            <option value="center" ${block.style.textAlign === 'center' ? 'selected' : ''}>Center</option>
            <option value="right" ${block.style.textAlign === 'right' ? 'selected' : ''}>Right</option>
          </select>
        </div>
      `;

      fieldsContainer.querySelector('#inp-block-text')?.addEventListener('input', (e) => {
        block.content.text = (e.target as HTMLTextAreaElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-font-size')?.addEventListener('change', (e) => {
        block.style.fontSize = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-color')?.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-align')?.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'button') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Button Label</label>
          <input type="text" class="arch-input" id="inp-btn-label" value="${block.content.label || ''}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Target URL</label>
          <input type="text" class="arch-input" id="inp-btn-url" value="${block.content.url || ''}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Button Background</label>
          <input type="color" class="arch-input" id="inp-btn-bg" value="${block.style.backgroundColor || '#2563eb'}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Text Color</label>
          <input type="color" class="arch-input" id="inp-btn-color" value="${block.style.color || '#ffffff'}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-btn-align">
            <option value="left" ${block.style.textAlign === 'left' ? 'selected' : ''}>Left</option>
            <option value="center" ${block.style.textAlign === 'center' ? 'selected' : ''}>Center</option>
            <option value="right" ${block.style.textAlign === 'right' ? 'selected' : ''}>Right</option>
          </select>
        </div>
      `;

      fieldsContainer.querySelector('#inp-btn-label')?.addEventListener('input', (e) => {
        block.content.label = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-btn-url')?.addEventListener('input', (e) => {
        block.content.url = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-btn-bg')?.addEventListener('input', (e) => {
        block.style.backgroundColor = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-btn-color')?.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-btn-align')?.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'image') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Image URL</label>
          <input type="text" class="arch-input" id="inp-img-src" value="${block.content.src || ''}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alt Description</label>
          <input type="text" class="arch-input" id="inp-img-alt" value="${block.content.alt || ''}">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alignment</label>
          <select class="arch-select" id="inp-img-align">
            <option value="left" ${block.style.textAlign === 'left' ? 'selected' : ''}>Left</option>
            <option value="center" ${block.style.textAlign === 'center' ? 'selected' : ''}>Center</option>
            <option value="right" ${block.style.textAlign === 'right' ? 'selected' : ''}>Right</option>
          </select>
        </div>
      `;

      fieldsContainer.querySelector('#inp-img-src')?.addEventListener('input', (e) => {
        block.content.src = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-img-alt')?.addEventListener('input', (e) => {
        block.content.alt = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });

      fieldsContainer.querySelector('#inp-img-align')?.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    } else if (block.type === 'divider') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Line Color</label>
          <input type="color" class="arch-input" id="inp-div-color" value="${block.style.color || '#e2e8f0'}">
        </div>
      `;

      fieldsContainer.querySelector('#inp-div-color')?.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.renderCanvas();
        this.emit('change', this.getJSON());
      });
    }
  }

  private showModal(title: string, content: string): void {
    const modal = document.createElement('div');
    modal.className = 'arch-modal-overlay';
    modal.innerHTML = `
      <div class="arch-modal">
        <div class="arch-modal__header">
          <span>${title}</span>
          <button class="arch-btn arch-btn--close" type="button">✕</button>
        </div>
        <div class="arch-modal__body">
          <textarea class="arch-modal__code" readonly>${content}</textarea>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button class="arch-btn arch-btn--primary arch-btn--copy" type="button">Copy to Clipboard</button>
        </div>
      </div>
    `;

    modal.querySelector('.arch-btn--close')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const copyBtn = modal.querySelector<HTMLButtonElement>('.arch-btn--copy');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard?.writeText(content);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    });

    this.rootElement?.appendChild(modal);
  }
}

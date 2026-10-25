/**
 * Arch Email Editor - Header Toolbar Component
 *
 * Renders the top application action bar with branding, responsive viewport switcher,
 * Undo/Redo controls, Gmail 102KB size indicator, and primary operations:
 * - Undo / Redo
 * - Desktop / Tablet (768px) / Mobile (375px) Viewport Preview
 * - Gmail Clipping Size Meter (KB / 102KB)
 * - Import HTML (for prebuilt template loading)
 * - Export JSON (for database storage)
 * - Export HTML (for email sending)
 * - Clear (to reset template)
 */

import { ToolbarCustomButton, ViewportMode } from '../types';

export interface ToolbarEvents {
  onImportHtml: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onClear: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onViewportChange?: (mode: ViewportMode) => void;
  onTemplateNameChange?: (name: string) => void;
}

export interface ToolbarOptions {
  templateName?: string;
  editableTemplateName?: boolean;
  customButtons?: ToolbarCustomButton[];
  editorInstance?: any;
}

export class Toolbar {
  private element: HTMLElement;
  private events: ToolbarEvents;
  private currentViewport: ViewportMode = 'desktop';
  private templateName: string = 'Arch Email Editor';
  private editableTemplateName: boolean = true;
  private customButtons: ToolbarCustomButton[] = [];
  private editorInstance?: any;

  constructor(events: ToolbarEvents, options: ToolbarOptions = {}) {
    this.events = events;
    this.templateName = options.templateName || 'Arch Email Editor';
    this.editableTemplateName = options.editableTemplateName !== false;
    this.customButtons = options.customButtons ? [...options.customButtons] : [];
    this.editorInstance = options.editorInstance;

    this.element = document.createElement('div');
    this.element.className = 'arch-editor__toolbar';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setTemplateName(name: string): void {
    this.templateName = name;
    const nameSpan = this.element.querySelector<HTMLElement>('.arch-template-name');
    if (nameSpan) {
      nameSpan.textContent = name;
    }
  }

  public getTemplateName(): string {
    return this.templateName;
  }

  public addCustomButton(button: ToolbarCustomButton): void {
    const existingIdx = this.customButtons.findIndex((b) => b.id === button.id);
    if (existingIdx !== -1) {
      this.customButtons[existingIdx] = button;
    } else {
      this.customButtons.push(button);
    }
    this.renderCustomButtons();
  }

  public removeCustomButton(buttonId: string): void {
    this.customButtons = this.customButtons.filter((b) => b.id !== buttonId);
    this.renderCustomButtons();
  }

  public updateState(canUndo: boolean, canRedo: boolean, htmlBytes?: number): void {
    const undoBtn = this.element.querySelector<HTMLButtonElement>('.arch-btn--undo');
    const redoBtn = this.element.querySelector<HTMLButtonElement>('.arch-btn--redo');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;

    if (typeof htmlBytes === 'number') {
      const badge = this.element.querySelector<HTMLElement>('.arch-size-badge');
      if (badge) {
        const kb = (htmlBytes / 1024).toFixed(1);
        badge.textContent = `${kb} KB`;
        badge.title =
          htmlBytes > 102 * 1024
            ? `Warning: Email exceeds Gmail's 102 KB clipping limit (${kb} KB)`
            : `Email HTML size: ${kb} KB (Gmail safe limit: 102 KB)`;
        badge.classList.toggle('is-warning', htmlBytes > 80 * 1024 && htmlBytes <= 102 * 1024);
        badge.classList.toggle('is-danger', htmlBytes > 102 * 1024);
      }
    }
  }

  private renderCustomButtons(): void {
    const container = this.element.querySelector<HTMLElement>('.arch-custom-buttons');
    if (!container) return;
    container.innerHTML = '';

    for (const btnDef of this.customButtons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `arch-custom-btn-${btnDef.id}`;
      btn.className = `arch-btn arch-btn--custom ${btnDef.className || ''}`.trim();
      if (btnDef.title) btn.title = btnDef.title;
      btn.innerHTML = `${btnDef.icon ? `<span class="arch-btn-icon">${btnDef.icon}</span> ` : ''}<span>${btnDef.label}</span>`;
      btn.addEventListener('click', (e) => {
        btnDef.onClick(this.editorInstance, e);
      });
      container.appendChild(btn);
    }
  }

  private bindTemplateNameEditing(): void {
    if (!this.editableTemplateName) return;
    const nameSpan = this.element.querySelector<HTMLElement>('.arch-template-name');
    const renameBtn = this.element.querySelector<HTMLElement>('.arch-btn-rename-icon');
    if (!nameSpan) return;

    const startEditing = () => {
      const current = this.templateName;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'arch-template-name-input';
      input.value = current;

      nameSpan.replaceWith(input);
      if (renameBtn) renameBtn.style.display = 'none';
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const val = input.value.trim() || current;
        this.templateName = val;
        nameSpan.textContent = val;
        input.replaceWith(nameSpan);
        if (renameBtn) renameBtn.style.display = '';
        if (val !== current) {
          this.events.onTemplateNameChange?.(val);
        }
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        } else if (e.key === 'Escape') {
          input.value = current;
          input.blur();
        }
      });
    };

    nameSpan.addEventListener('click', startEditing);
    renameBtn?.addEventListener('click', startEditing);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-editor__title">
        <span>📬</span>
        <span class="arch-template-name" title="Click to rename template">${this.templateName}</span>
        ${this.editableTemplateName ? '<button class="arch-btn-rename-icon" type="button" title="Rename template">✎</button>' : ''}
        <span class="arch-size-badge" title="Email HTML size (Gmail limit: 102 KB)">0.0 KB</span>
      </div>
      <div class="arch-toolbar-center">
        <div class="arch-btn-group">
          <button class="arch-btn arch-btn--icon arch-btn--undo" type="button" title="Undo (Ctrl+Z)" disabled>↶</button>
          <button class="arch-btn arch-btn--icon arch-btn--redo" type="button" title="Redo (Ctrl+Y)" disabled>↷</button>
        </div>
        <div class="arch-btn-group arch-viewport-switcher">
          <button class="arch-btn arch-btn--viewport is-active" type="button" data-viewport="desktop" title="Desktop View (100%)">🖥️ Desktop</button>
          <button class="arch-btn arch-btn--viewport" type="button" data-viewport="tablet" title="Tablet View (768px)">📱 Tablet</button>
          <button class="arch-btn arch-btn--viewport" type="button" data-viewport="mobile" title="Mobile View (375px)">📱 Mobile</button>
        </div>
      </div>
      <div class="arch-editor__actions">
        <div class="arch-custom-buttons"></div>
        <button class="arch-btn arch-btn--import-html" type="button" title="Load a prebuilt HTML newsletter">
          📥 Import HTML
        </button>
        <button class="arch-btn arch-btn--export-json" type="button" title="Export template as JSON schema">
          Export JSON
        </button>
        <button class="arch-btn arch-btn--primary arch-btn--export-html" type="button" title="Export client-safe HTML">
          Export HTML
        </button>
        <button class="arch-btn arch-btn--danger arch-btn--clear" type="button" title="Clear all blocks">
          Clear
        </button>
      </div>
    `;

    this.renderCustomButtons();
    this.bindTemplateNameEditing();

    this.element.querySelector('.arch-btn--undo')?.addEventListener('click', () => {
      this.events.onUndo?.();
    });

    this.element.querySelector('.arch-btn--redo')?.addEventListener('click', () => {
      this.events.onRedo?.();
    });

    this.element.querySelectorAll<HTMLButtonElement>('[data-viewport]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-viewport') as ViewportMode;
        this.currentViewport = mode;
        this.element.querySelectorAll('[data-viewport]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.events.onViewportChange?.(mode);
      });
    });

    this.element.querySelector('.arch-btn--import-html')?.addEventListener('click', () => {
      this.events.onImportHtml();
    });

    this.element.querySelector('.arch-btn--export-json')?.addEventListener('click', () => {
      this.events.onExportJson();
    });

    this.element.querySelector('.arch-btn--export-html')?.addEventListener('click', () => {
      this.events.onExportHtml();
    });

    this.element.querySelector('.arch-btn--clear')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all blocks?')) {
        this.events.onClear();
      }
    });
  }

  public getViewport(): ViewportMode {
    return this.currentViewport;
  }

  public destroy(): void {
    this.element.remove();
  }
}

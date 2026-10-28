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

import { ToolbarCustomButton, ToolbarActionsOptions, ViewportMode } from '../types';
import { icons } from 'lucide';

/**
 * Resolves an icon representation into an HTML string.
 * Supports:
 * - Lucide icon names: e.g. 'chevron-left', 'chevronLeft', 'ChevronLeft', 'save', 'eye', etc.
 * - Raw SVG strings: '<svg>...</svg>'
 * - Plain emoji/text: '💾', '✉️', etc.
 */
function resolveButtonIcon(icon?: string, size = 14): string {
  if (!icon) return '';
  const trimmed = icon.trim();
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<span') || trimmed.startsWith('<i')) {
    return trimmed;
  }

  // Convert kebab-case, snake_case, or lowercase into PascalCase (e.g. 'chevron-left' -> 'ChevronLeft')
  const pascalName = trimmed
    .replace(/[-_ ]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());

  const iconNode = (icons as any)[pascalName] || (icons as any)[trimmed];
  if (Array.isArray(iconNode)) {
    const inner = iconNode
      .map(([tag, attrs]) => {
        const attrStr = Object.entries(attrs || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return `<${tag} ${attrStr}></${tag}>`;
      })
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="arch-btn-icon-svg">${inner}</svg>`;
  }

  return trimmed;
}

export interface ToolbarEvents {
  onImportHtml: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onClear: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onViewportChange?: (mode: ViewportMode) => void;
  onTemplateNameChange?: (name: string) => void;
  onSidebarPositionChange?: (position: 'left' | 'right') => void;
}

export interface ToolbarOptions {
  templateName?: string;
  editableTemplateName?: boolean;
  customButtons?: ToolbarCustomButton[];
  actions?: ToolbarActionsOptions;
  editorInstance?: any;
  sidebarPosition?: 'left' | 'right';
}

export class Toolbar {
  private element: HTMLElement;
  private events: ToolbarEvents;
  private currentViewport: ViewportMode = 'desktop';
  private templateName: string = 'Arch Email Editor';
  private editableTemplateName: boolean = true;
  private customButtons: ToolbarCustomButton[] = [];
  private actions: ToolbarActionsOptions = {};
  private editorInstance?: any;
  private sidebarPosition: 'left' | 'right' = 'right';

  constructor(events: ToolbarEvents, options: ToolbarOptions = {}) {
    this.events = events;
    this.templateName = options.templateName || 'Arch Email Editor';
    this.editableTemplateName = options.editableTemplateName !== false;
    this.customButtons = options.customButtons ? [...options.customButtons] : [];
    this.actions = {
      importHtml: options.actions?.importHtml !== false,
      exportJson: options.actions?.exportJson !== false,
      exportHtml: options.actions?.exportHtml !== false,
      clear: options.actions?.clear !== false,
    };
    this.editorInstance = options.editorInstance;
    this.sidebarPosition = options.sidebarPosition === 'left' ? 'left' : 'right';

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

  public setActions(actions: Partial<ToolbarActionsOptions>): void {
    this.actions = { ...this.actions, ...actions };
    this.render();
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
      const iconHtml = resolveButtonIcon(btnDef.icon);
      const labelHtml = btnDef.label ? `<span>${btnDef.label}</span>` : '';
      btn.innerHTML = `${iconHtml ? `<span class="arch-btn-icon">${iconHtml}</span> ` : ''}${labelHtml}`.trim();
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
        <span class="arch-editor__logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </span>
        <span class="arch-template-name" title="Click to rename template">${this.templateName}</span>
        ${this.editableTemplateName ? `
          <button class="arch-btn-rename-icon" type="button" title="Rename template">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
          </button>
        ` : ''}
        <span class="arch-size-badge" title="Email HTML size (Gmail limit: 102 KB)">0.0 KB</span>
      </div>
      <div class="arch-toolbar-center">
        <div class="arch-btn-group arch-viewport-switcher">
          <button class="arch-btn arch-btn--viewport is-active" type="button" data-viewport="desktop" title="Desktop View (100%)">
            <svg class="arch-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="14" x="2" y="3" rx="2"/>
              <line x1="8" x2="16" y1="21" y2="21"/>
              <line x1="12" x2="12" y1="17" y2="21"/>
            </svg>
            <span>Desktop</span>
          </button>
          <button class="arch-btn arch-btn--viewport" type="button" data-viewport="tablet" title="Tablet View (768px)">
            <svg class="arch-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="20" x="4" y="2" rx="2"/>
              <line x1="12" x2="12.01" y1="18" y2="18"/>
            </svg>
            <span>Tablet</span>
          </button>
          <button class="arch-btn arch-btn--viewport" type="button" data-viewport="mobile" title="Mobile View (375px)">
            <svg class="arch-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="20" x="5" y="2" rx="2"/>
              <line x1="12" x2="12.01" y1="18" y2="18"/>
            </svg>
            <span>Mobile</span>
          </button>
        </div>
        <div class="arch-btn-group arch-sidebar-switcher" role="group" aria-label="Sidebar position">
          <button class="arch-btn arch-btn--icon arch-btn--sidebar-left" type="button" data-sidebar-position="left" title="Sidebar on left" aria-label="Sidebar on left" aria-pressed="false">
            <svg class="arch-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          </button>
          <button class="arch-btn arch-btn--icon arch-btn--sidebar-right" type="button" data-sidebar-position="right" title="Sidebar on right" aria-label="Sidebar on right" aria-pressed="false">
            <svg class="arch-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M15 3v18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="arch-editor__actions">
        ${this.actions.importHtml ? `
        <button class="arch-btn arch-btn--import-html" type="button" title="Load a prebuilt HTML newsletter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Import HTML</span>
        </button>` : ''}
        ${this.actions.exportJson ? `
        <button class="arch-btn arch-btn--export-json" type="button" title="Export template as JSON schema">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Export JSON</span>
        </button>` : ''}
        ${this.actions.exportHtml ? `
        <button class="arch-btn arch-btn--primary arch-btn--export-html" type="button" title="Export client-safe HTML">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>Export HTML</span>
        </button>` : ''}
        ${this.actions.clear ? `
        <button class="arch-btn arch-btn--danger arch-btn--clear" type="button" title="Clear all blocks">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          <span>Clear</span>
        </button>` : ''}
        <div class="arch-custom-buttons"></div>
      </div>
    `;

    this.renderCustomButtons();
    this.bindTemplateNameEditing();
    this.setSidebarPosition(this.sidebarPosition);

    this.element.querySelectorAll<HTMLButtonElement>('[data-viewport]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-viewport') as ViewportMode;
        this.currentViewport = mode;
        this.element.querySelectorAll('[data-viewport]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.events.onViewportChange?.(mode);
      });
    });

    this.element.querySelectorAll<HTMLButtonElement>('[data-sidebar-position]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.events.onSidebarPositionChange?.(btn.getAttribute('data-sidebar-position') as 'left' | 'right');
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

  /** Syncs the sidebar switcher buttons with the active position. */
  public setSidebarPosition(position: 'left' | 'right'): void {
    this.sidebarPosition = position;
    this.element.querySelectorAll<HTMLButtonElement>('[data-sidebar-position]').forEach((btn) => {
      const active = btn.getAttribute('data-sidebar-position') === position;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  public destroy(): void {
    this.element.remove();
  }
}

/**
 * Arch Email Editor - Contextual Smart Inspector Component
 *
 * Uses Smart Component Adapters (`ButtonAdapter`, `ImageAdapter`, `TextAdapter`,
 * `DividerAdapter`, `SpacerAdapter`, `SocialAdapter`, `ColumnLayoutAdapter`) to
 * customize any email element without breaking compound HTML or MSO VML.
 */

import { EmailDocument, BlockNode, RowLayoutType, SelectedElementInfo, ViewportMode } from '../types';
import {
  ButtonAdapter,
  ColumnLayoutAdapter,
  DividerAdapter,
  ImageAdapter,
  SocialAdapter,
  SpacerAdapter,
  TextAdapter
} from '../engine/adapters';
import { setUnitVisibility } from '../engine/cssScope';

export interface InspectorEvents {
  onChange: (isDocumentSetting?: boolean) => void;
  onRemoveBlock?: (id: string) => void;
  onMoveElement?: (direction: 'up' | 'down') => void;
  onDuplicateElement?: () => void;
  onRemoveElement?: () => void;
  onSelectParent?: () => void;
  onSelectElementNode?: (el: HTMLElement) => void;
  onDeselect?: () => void;
}

/**
 * Converts rgb(...) or named colors to valid 6-char hex for <input type="color">.
 */
function toHexColor(colorStr?: string, fallback = '#000000'): string {
  if (!colorStr) return fallback;
  const trimmed = colorStr.trim().toLowerCase();
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 7) return trimmed;
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
  }
  const match = trimmed.match(/\d+/g);
  if (match && match.length >= 3) {
    const r = Math.min(255, parseInt(match[0], 10));
    const g = Math.min(255, parseInt(match[1], 10));
    const b = Math.min(255, parseInt(match[2], 10));
    const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    return `#${hex}`;
  }
  return fallback;
}

export class Inspector {
  private element: HTMLElement;
  private events: InspectorEvents;
  private viewportMode: ViewportMode = 'desktop';
  /** UI-only state: per-side padding inputs stay expanded across inspector re-renders. */
  private padMoreExpanded = false;
  private padMoreUnit: HTMLElement | null = null;
  /** UI-only state: accordion open/close state for document settings. */
  private docAccordionOpen: Record<string, boolean> = {
    'design-settings': true,
    'typography-settings': true,
    metadata: true
  };

  constructor(events: InspectorEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__inspector';
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setViewportMode(mode: ViewportMode): void {
    this.viewportMode = mode;
  }

  /**
   * Updates the inspector panel based on current selection:
   * Prioritizes live DOM element selection > block AST selection > document settings.
   */
  public update(
    doc: EmailDocument,
    selectedBlockId: string | null,
    selectedElement?: SelectedElementInfo | null
  ): void {
    if (selectedElement) {
      this.renderElementSettings(selectedElement);
      return;
    }

    const block = selectedBlockId
      ? doc.blocks.find((b) => b.id === selectedBlockId) || null
      : null;

    if (block) {
      this.renderBlockSettings(block);
    } else {
      this.renderDocumentSettings(doc);
    }
  }

  /**
   * Renders controls for a live clicked DOM element inside the email template.
   */
  private renderElementSettings(info: SelectedElementInfo): void {
    const activeNode = info.unit || info.element;
    const isDirectAnchor = activeNode.tagName.toLowerCase() === 'a';
    const titleMap: Record<string, string> = {
      text: 'PARAGRAPH',
      heading: 'TITLE',
      image: 'IMAGE',
      button: 'BUTTON',
      divider: 'DIVIDER',
      spacer: 'SPACER',
      social: 'SOCIAL',
      table: 'TABLE',
      list: 'LIST',
      video: 'VIDEO',
      icons: 'ICONS',
      menu: 'MENU',
      html: 'HTML',
      row: 'ROW',
      column: 'COLUMN'
    };
    const typeTitle = isDirectAnchor ? 'BUTTON' : (titleMap[info.type] || info.type.toUpperCase());

    const targetUnit = info.unit || info.element;
    const computedPad = parseInt(targetUnit.style.padding || info.element.style.padding || '20', 10) || 20;
    const padTop = parseInt(targetUnit.style.paddingTop || '20', 10) || 20;
    const padRight = parseInt(targetUnit.style.paddingRight || '20', 10) || 20;
    const padBottom = parseInt(targetUnit.style.paddingBottom || '20', 10) || 20;
    const padLeft = parseInt(targetUnit.style.paddingLeft || '20', 10) || 20;
    const padMoreExpanded = this.padMoreExpanded && this.padMoreUnit === targetUnit;

    this.element.innerHTML = `
      <div class="arch-prop-header">
        <div class="arch-prop-title">${typeTitle} PROPERTIES</div>
        <div class="arch-prop-actions">
          <button type="button" class="arch-icon-btn" id="btn-prop-comment" title="Add Comment">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-delete" title="Delete Element">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-duplicate" title="Duplicate Unit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-close" title="Close Properties">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div id="inspector-element-fields"></div>

      <div class="arch-accordion-header" id="hdr-block-options">
        <span>BLOCK OPTIONS</span>
        <span class="arch-accordion-arrow">▲</span>
      </div>
      <div class="arch-accordion-body" id="body-block-options" style="padding: 0; gap: 0;">
        <div class="arch-rge-row">
          <span class="arch-rge-label">Padding</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: #6b7280;">More options</span>
            <label class="arch-toggle-switch">
              <input type="checkbox" id="chk-pad-more" ${padMoreExpanded ? 'checked' : ''} />
              <span class="arch-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="arch-rge-row" id="row-pad-single" style="${padMoreExpanded ? 'display: none;' : ''}">
          <span class="arch-rge-label">All sides</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${this.renderStepper('stp-pad-all', computedPad, 0, 100, 5)}
            <div class="arch-padding-preview">
              <div class="arch-padding-preview__inner">
                <div class="arch-padding-preview__line"></div>
                <div class="arch-padding-preview__line arch-padding-preview__line--short"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="row-pad-multi" style="display: ${padMoreExpanded ? 'block' : 'none'};">
          <div class="arch-rge-row">
            <span class="arch-rge-label">Top</span>
            ${this.renderStepper('stp-pad-top', padTop, 0, 100, 5)}
          </div>
          <div class="arch-rge-row">
            <span class="arch-rge-label">Right</span>
            ${this.renderStepper('stp-pad-right', padRight, 0, 100, 5)}
          </div>
          <div class="arch-rge-row">
            <span class="arch-rge-label">Bottom</span>
            ${this.renderStepper('stp-pad-bottom', padBottom, 0, 100, 5)}
          </div>
          <div class="arch-rge-row">
            <span class="arch-rge-label">Left</span>
            ${this.renderStepper('stp-pad-left', padLeft, 0, 100, 5)}
          </div>
        </div>

        <div class="arch-rge-row">
          <span class="arch-rge-label">Hide on desktop</span>
          <label class="arch-toggle-switch">
            <input type="checkbox" id="chk-vis-desktop" ${targetUnit.classList.contains('arch-hide-desktop') ? 'checked' : ''} />
            <span class="arch-toggle-slider"></span>
          </label>
        </div>

        <div class="arch-rge-row">
          <span class="arch-rge-label">Hide on mobile</span>
          <label class="arch-toggle-switch">
            <input type="checkbox" id="chk-vis-mobile" ${targetUnit.classList.contains('mobile_hide') ? 'checked' : ''} />
            <span class="arch-toggle-slider"></span>
          </label>
        </div>
      </div>
    `;

    // Bind Header Action clicks
    this.element.querySelector('#btn-prop-close')?.addEventListener('click', () => {
      this.events.onDeselect?.();
      const blocksTab = document.querySelector<HTMLButtonElement>('[data-tab="blocks"]');
      blocksTab?.click();
    });

    const handleDelete = () => {
      if (this.events.onRemoveElement) {
        this.events.onRemoveElement();
      } else {
        targetUnit.remove();
        this.events.onChange();
      }
      const blocksTab = document.querySelector<HTMLButtonElement>('[data-tab="blocks"]');
      blocksTab?.click();
    };

    this.element.querySelector('#btn-prop-delete')?.addEventListener('click', handleDelete);

    const handleDuplicate = () => {
      this.events.onDuplicateElement?.();
    };
    this.element.querySelector('#btn-prop-duplicate')?.addEventListener('click', handleDuplicate);

    // Padding Stepper bindings
    const padMoreChk = this.element.querySelector<HTMLInputElement>('#chk-pad-more');
    const rowPadSingle = this.element.querySelector<HTMLElement>('#row-pad-single');
    const rowPadMulti = this.element.querySelector<HTMLElement>('#row-pad-multi');
    padMoreChk?.addEventListener('change', () => {
      const isMulti = padMoreChk.checked;
      this.padMoreExpanded = isMulti;
      this.padMoreUnit = targetUnit;
      if (rowPadSingle) rowPadSingle.style.display = isMulti ? 'none' : 'flex';
      if (rowPadMulti) rowPadMulti.style.display = isMulti ? 'block' : 'none';
    });

    this.bindStepper(this.element, 'stp-pad-all', (val) => {
      targetUnit.style.padding = `${val}px`;
      this.events.onChange();
    });
    this.bindStepper(this.element, 'stp-pad-top', (val) => {
      targetUnit.style.paddingTop = `${val}px`;
      this.events.onChange();
    });
    this.bindStepper(this.element, 'stp-pad-right', (val) => {
      targetUnit.style.paddingRight = `${val}px`;
      this.events.onChange();
    });
    this.bindStepper(this.element, 'stp-pad-bottom', (val) => {
      targetUnit.style.paddingBottom = `${val}px`;
      this.events.onChange();
    });
    this.bindStepper(this.element, 'stp-pad-left', (val) => {
      targetUnit.style.paddingLeft = `${val}px`;
      this.events.onChange();
    });

    // Accordion toggle
    const accHdr = this.element.querySelector<HTMLElement>('#hdr-block-options');
    const accBody = this.element.querySelector<HTMLElement>('#body-block-options');
    accHdr?.addEventListener('click', () => {
      if (!accBody) return;
      const isHidden = accBody.style.display === 'none';
      accBody.style.display = isHidden ? 'block' : 'none';
      const arrow = accHdr.querySelector('.arch-accordion-arrow');
      if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
    });

    this.element.querySelector<HTMLInputElement>('#chk-vis-desktop')?.addEventListener('change', (e) => {
      setUnitVisibility(targetUnit, 'desktop', (e.target as HTMLInputElement).checked);
      this.events.onChange();
    });
    this.element.querySelector<HTMLInputElement>('#chk-vis-mobile')?.addEventListener('change', (e) => {
      setUnitVisibility(targetUnit, 'mobile', (e.target as HTMLInputElement).checked);
      this.events.onChange();
    });

    const fieldsContainer = this.element.querySelector<HTMLElement>('#inspector-element-fields');
    if (!fieldsContainer) return;

    switch (info.type) {
      case 'heading':
        this.renderHeadingElementControls(fieldsContainer, info);
        break;
      case 'text':
        this.renderTextElementControls(fieldsContainer, info);
        break;
      case 'button':
        this.renderButtonElementControls(fieldsContainer, info);
        break;
      case 'image':
        this.renderImageElementControls(fieldsContainer, info);
        break;
      case 'divider':
        this.renderDividerElementControls(fieldsContainer, info);
        break;
      case 'spacer':
        this.renderSpacerElementControls(fieldsContainer, info);
        break;
      case 'social':
        this.renderSocialElementControls(fieldsContainer, info);
        break;
      case 'list':
        this.renderListElementControls(fieldsContainer, info);
        break;
      case 'table':
        this.renderTableElementControls(fieldsContainer, info);
        break;
      case 'video':
        this.renderVideoElementControls(fieldsContainer, info);
        break;
      case 'icons':
        this.renderIconsElementControls(fieldsContainer, info);
        break;
      case 'menu':
        this.renderMenuElementControls(fieldsContainer, info);
        break;
      case 'html':
        this.renderHtmlElementControls(fieldsContainer, info);
        break;
      case 'sticker':
        this.renderStickerGifElementControls(fieldsContainer, info, false);
        break;
      case 'gif':
        this.renderStickerGifElementControls(fieldsContainer, info, true);
        break;
      default:
        this.renderSectionElementControls(fieldsContainer, info);
        break;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Shared RGE Visual Component Helpers                                       */
  /* -------------------------------------------------------------------------- */

  private renderStepper(id: string, value: number, min = 0, max = 500, step = 1): string {
    return `
      <div class="arch-stepper" data-stepper-id="${id}">
        <button type="button" class="arch-stepper-btn" data-step="-${step}">−</button>
        <input type="text" class="arch-stepper-val" id="${id}" value="${value}" data-min="${min}" data-max="${max}" data-step="${step}" />
        <button type="button" class="arch-stepper-btn" data-step="${step}">+</button>
      </div>
    `;
  }

  private bindStepper(container: HTMLElement, id: string, onChange: (val: number) => void): void {
    const root = container.querySelector<HTMLElement>(`[data-stepper-id="${id}"]`);
    if (!root) return;
    const inp = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!inp) return;

    const min = parseInt(inp.getAttribute('data-min') || '0', 10);
    const max = parseInt(inp.getAttribute('data-max') || '500', 10);

    const updateVal = (newVal: number) => {
      const clamped = Math.max(min, Math.min(max, newVal));
      inp.value = String(clamped);
      onChange(clamped);
    };

    root.querySelectorAll<HTMLButtonElement>('.arch-stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-step') || '1', 10);
        const current = parseInt(inp.value, 10) || 0;
        updateVal(current + delta);
      });
    });

    inp.addEventListener('change', () => {
      const parsed = parseInt(inp.value, 10);
      updateVal(isNaN(parsed) ? 0 : parsed);
    });
  }

  private renderColorPicker(swatchId: string, hexId: string, value: string): string {
    const hex = toHexColor(value, '#ffffff');
    return `
      <div class="arch-color-picker-control">
        <input type="color" class="arch-color-swatch" id="${swatchId}" value="${hex}" />
        <input type="text" class="arch-color-hex" id="${hexId}" value="${value || hex}" />
      </div>
    `;
  }

  private bindColorPicker(container: HTMLElement, swatchId: string, hexId: string, onChange: (color: string) => void): void {
    const swatch = container.querySelector<HTMLInputElement>(`#${swatchId}`);
    const hex = container.querySelector<HTMLInputElement>(`#${hexId}`);
    if (!swatch || !hex) return;

    swatch.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      hex.value = val;
      onChange(val);
    });

    hex.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      swatch.value = toHexColor(val, '#ffffff');
      onChange(val);
    });
  }

  private renderAlignment(groupClass: string, current: string, hasJustify = false): string {
    const opts = hasJustify ? ['left', 'center', 'right', 'justify'] : ['left', 'center', 'right'];
    return `
      <div class="arch-segmented-group ${groupClass}">
        ${opts
          .map((align) => {
            const isActive = current === align ? 'is-active' : '';
            const svgIcon =
              align === 'left'
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>`
                : align === 'center'
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`
                : align === 'right'
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
            return `<button type="button" class="arch-segmented-icon-btn ${isActive}" data-align="${align}" title="Align ${align}">${svgIcon}</button>`;
          })
          .join('')}
      </div>
    `;
  }

  private bindAlignment(container: HTMLElement, groupClass: string, onChange: (val: string) => void): void {
    const group = container.querySelector<HTMLElement>(`.${groupClass}`);
    if (!group) return;
    const btns = group.querySelectorAll<HTMLButtonElement>('[data-align]');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-align') || 'left';
        btns.forEach((b) => b.classList.toggle('is-active', b === btn));
        onChange(val);
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Block Control Renderers                                                    */
  /* -------------------------------------------------------------------------- */

  private renderHeadingElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const activeNode = info.element;
    const unitNode = info.unit || activeNode;
    const headingEl = (activeNode.tagName.match(/^H[1-6]$/i) ? activeNode : unitNode.querySelector('h1, h2, h3, h4, h5, h6') || activeNode) as HTMLElement;
    const tag = (headingEl.tagName || 'H1').toUpperCase();
    const currentTag = /^H[1-4]$/.test(tag) ? tag : 'H1';
    const currentFont = headingEl.style.fontFamily || 'Global font';
    const currentWeight = headingEl.style.fontWeight || 'bold';
    const currentSize = parseInt(headingEl.style.fontSize || '32', 10) || 32;
    const currentColor = toHexColor(headingEl.style.color || info.color, '#111827');
    const currentAlign = headingEl.style.textAlign || info.textAlign || 'left';
    const currentLineHeight = headingEl.style.lineHeight || '1.2';
    const currentSpacing = parseInt(headingEl.style.letterSpacing || '0', 10) || 0;
    const currentDirection = headingEl.style.direction || 'ltr';

    container.innerHTML = `
      <div class="arch-rge-row">
        <label class="arch-rge-label">Title</label>
        <select class="arch-rge-select" id="sel-head-tag">
          <option value="H1" ${currentTag === 'H1' ? 'selected' : ''}>H1</option>
          <option value="H2" ${currentTag === 'H2' ? 'selected' : ''}>H2</option>
          <option value="H3" ${currentTag === 'H3' ? 'selected' : ''}>H3</option>
          <option value="H4" ${currentTag === 'H4' ? 'selected' : ''}>H4</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font family</label>
        <select class="arch-rge-select" id="sel-head-font">
          <option value="Global font" ${currentFont === 'Global font' ? 'selected' : ''}>Global font</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
          <option value="Tahoma, sans-serif">Tahoma</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font weight</label>
        <select class="arch-rge-select" id="sel-head-weight">
          <option value="bold" ${currentWeight === 'bold' || currentWeight === '700' ? 'selected' : ''}>Bold</option>
          <option value="600" ${currentWeight === '600' ? 'selected' : ''}>Semi Bold</option>
          <option value="normal" ${currentWeight === 'normal' || currentWeight === '400' ? 'selected' : ''}>Regular</option>
          <option value="300" ${currentWeight === '300' ? 'selected' : ''}>Light</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font size</label>
        ${this.renderStepper('stp-head-size', currentSize, 12, 96, 2)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Color</label>
        ${this.renderColorPicker('swatch-head-color', 'txt-head-color', currentColor)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Link color</label>
        ${this.renderColorPicker('swatch-head-link-color', 'txt-head-link-color', '#7747ff')}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Align</label>
        ${this.renderAlignment('grp-head-align', currentAlign, true)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Line height</label>
        <select class="arch-rge-select" id="sel-head-lh">
          <option value="1.1" ${currentLineHeight === '1.1' ? 'selected' : ''}>≡ 1.1</option>
          <option value="1.2" ${currentLineHeight === '1.2' ? 'selected' : ''}>≡ 1.2</option>
          <option value="1.3" ${currentLineHeight === '1.3' ? 'selected' : ''}>≡ 1.3</option>
          <option value="1.4" ${currentLineHeight === '1.4' ? 'selected' : ''}>≡ 1.4</option>
          <option value="1.5" ${currentLineHeight === '1.5' ? 'selected' : ''}>≡ 1.5</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Letter spacing</label>
        ${this.renderStepper('stp-head-spacing', currentSpacing, -5, 20, 1)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Text direction</label>
        <div class="arch-segmented-group grp-head-dir">
          <button type="button" class="arch-segmented-icon-btn ${currentDirection === 'ltr' ? 'is-active' : ''}" data-dir="ltr" title="Left to Right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>
          </button>
          <button type="button" class="arch-segmented-icon-btn ${currentDirection === 'rtl' ? 'is-active' : ''}" data-dir="rtl" title="Right to Left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12H4m7-7-7 7 7 7"/></svg>
          </button>
        </div>
      </div>
    `;

    const tagSel = container.querySelector<HTMLSelectElement>('#sel-head-tag')!;
    tagSel.addEventListener('change', () => {
      const newTag = tagSel.value.toLowerCase();
      const newHeading = document.createElement(newTag);
      newHeading.innerHTML = headingEl.innerHTML;
      newHeading.style.cssText = headingEl.style.cssText;
      headingEl.replaceWith(newHeading);
      this.events.onChange();
    });

    const fontSel = container.querySelector<HTMLSelectElement>('#sel-head-font')!;
    fontSel.addEventListener('change', () => {
      const val = fontSel.value;
      headingEl.style.fontFamily = val === 'Global font' ? '' : val;
      this.events.onChange();
    });

    const weightSel = container.querySelector<HTMLSelectElement>('#sel-head-weight')!;
    weightSel.addEventListener('change', () => {
      headingEl.style.fontWeight = weightSel.value;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-head-size', (val) => {
      headingEl.style.fontSize = `${val}px`;
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-head-color', 'txt-head-color', (val) => {
      headingEl.style.color = val;
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-head-link-color', 'txt-head-link-color', (val) => {
      headingEl.querySelectorAll('a').forEach((a) => (a.style.color = val));
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-head-align', (val) => {
      headingEl.style.textAlign = val;
      this.events.onChange();
    });

    const lhSel = container.querySelector<HTMLSelectElement>('#sel-head-lh')!;
    lhSel.addEventListener('change', () => {
      headingEl.style.lineHeight = lhSel.value;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-head-spacing', (val) => {
      headingEl.style.letterSpacing = `${val}px`;
      this.events.onChange();
    });

    const dirBtns = container.querySelectorAll<HTMLButtonElement>('.grp-head-dir [data-dir]');
    dirBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-dir') || 'ltr';
        dirBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        headingEl.style.direction = dir;
        this.events.onChange();
      });
    });
  }

  private renderTextElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const activeNode = info.element;
    const currentFont = activeNode.style.fontFamily || 'Global font';
    const currentWeight = activeNode.style.fontWeight || 'normal';
    const currentSize = parseInt(activeNode.style.fontSize || info.fontSize || '16', 10) || 16;
    const currentColor = toHexColor(activeNode.style.color || info.color, '#101112');
    const currentAlign = activeNode.style.textAlign || info.textAlign || 'left';
    const currentLineHeight = activeNode.style.lineHeight || '1.2';
    const currentSpacing = parseInt(activeNode.style.letterSpacing || '0', 10) || 0;
    const currentParaSpacing = parseInt(activeNode.style.marginBottom || '16', 10) || 16;
    const currentDirection = activeNode.style.direction || 'ltr';

    container.innerHTML = `
      <textarea id="inp-text-copy" style="display: none;"></textarea>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font family</label>
        <select class="arch-rge-select" id="sel-text-font">
          <option value="Global font" ${currentFont === 'Global font' ? 'selected' : ''}>Global font</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
          <option value="'Lucida Sans Unicode', sans-serif">Lucida Sans</option>
          <option value="Tahoma, sans-serif">Tahoma</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font weight</label>
        <select class="arch-rge-select" id="sel-text-weight">
          <option value="normal" ${currentWeight === 'normal' || currentWeight === '400' ? 'selected' : ''}>Regular</option>
          <option value="600" ${currentWeight === '600' ? 'selected' : ''}>Semi Bold</option>
          <option value="bold" ${currentWeight === 'bold' || currentWeight === '700' ? 'selected' : ''}>Bold</option>
          <option value="300" ${currentWeight === '300' ? 'selected' : ''}>Light</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font size</label>
        ${this.renderStepper('stp-text-size', currentSize, 8, 72, 1)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Text color</label>
        ${this.renderColorPicker('swatch-text-color', 'txt-text-color', currentColor)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Link color</label>
        ${this.renderColorPicker('swatch-text-link-color', 'txt-text-link-color', '#7747ff')}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Align</label>
        ${this.renderAlignment('grp-text-align', currentAlign, true)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Paragraph spacing</label>
        ${this.renderStepper('stp-text-para-spacing', currentParaSpacing, 0, 60, 2)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Line height</label>
        <select class="arch-rge-select" id="sel-text-lh">
          <option value="1.1" ${currentLineHeight === '1.1' ? 'selected' : ''}>≡ 1.1</option>
          <option value="1.2" ${currentLineHeight === '1.2' ? 'selected' : ''}>≡ 1.2</option>
          <option value="1.3" ${currentLineHeight === '1.3' ? 'selected' : ''}>≡ 1.3</option>
          <option value="1.4" ${currentLineHeight === '1.4' ? 'selected' : ''}>≡ 1.4</option>
          <option value="1.5" ${currentLineHeight === '1.5' ? 'selected' : ''}>≡ 1.5</option>
          <option value="2.0" ${currentLineHeight === '2.0' ? 'selected' : ''}>≡ 2.0</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Letter spacing</label>
        ${this.renderStepper('stp-text-spacing', currentSpacing, -5, 20, 1)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Text direction</label>
        <div class="arch-segmented-group grp-text-dir">
          <button type="button" class="arch-segmented-icon-btn ${currentDirection === 'ltr' ? 'is-active' : ''}" data-dir="ltr" title="Left to Right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>
          </button>
          <button type="button" class="arch-segmented-icon-btn ${currentDirection === 'rtl' ? 'is-active' : ''}" data-dir="rtl" title="Right to Left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12H4m7-7-7 7 7 7"/></svg>
          </button>
        </div>
      </div>

      <div id="inspector-inner-links"></div>
    `;

    const copyInp = container.querySelector<HTMLTextAreaElement>('#inp-text-copy')!;
    copyInp.value = info.element.textContent || '';
    copyInp.addEventListener('input', (e) => {
      TextAdapter.setText(info.element, (e.target as HTMLTextAreaElement).value, info.unit);
      this.events.onChange();
    });

    const fontSel = container.querySelector<HTMLSelectElement>('#sel-text-font')!;
    fontSel.addEventListener('change', () => {
      const val = fontSel.value;
      activeNode.style.fontFamily = val === 'Global font' ? '' : val;
      this.events.onChange();
    });

    const weightSel = container.querySelector<HTMLSelectElement>('#sel-text-weight')!;
    weightSel.addEventListener('change', () => {
      activeNode.style.fontWeight = weightSel.value;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-text-size', (val) => {
      TextAdapter.setFontSize(info.element, `${val}px`, this.viewportMode, info.unit);
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-text-color', 'txt-text-color', (val) => {
      TextAdapter.setColor(info.element, val, info.unit);
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-text-link-color', 'txt-text-link-color', (val) => {
      activeNode.querySelectorAll('a').forEach((a) => (a.style.color = val));
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-text-align', (val) => {
      TextAdapter.setAlignment(info.element, val as any, this.viewportMode, info.unit);
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-text-para-spacing', (val) => {
      activeNode.style.marginBottom = `${val}px`;
      this.events.onChange();
    });

    const lhSel = container.querySelector<HTMLSelectElement>('#sel-text-lh')!;
    lhSel.addEventListener('change', () => {
      activeNode.style.lineHeight = lhSel.value;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-text-spacing', (val) => {
      activeNode.style.letterSpacing = `${val}px`;
      this.events.onChange();
    });

    const dirBtns = container.querySelectorAll<HTMLButtonElement>('.grp-text-dir [data-dir]');
    dirBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-dir') || 'ltr';
        dirBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        activeNode.style.direction = dir;
        this.events.onChange();
      });
    });

    const linksHolder = container.querySelector<HTMLElement>('#inspector-inner-links');
    if (linksHolder) {
      this.renderInnerLinksCard(linksHolder, info);
    }
  }

  /**
   * When a parent container (`<td>`, `<h1>`, `<p>`, `table`) is selected and contains `<a href="...">` tags,
   * renders a quick-select & inline editor card for every `<a>` inside that container.
   */
  private renderInnerLinksCard(holder: HTMLElement, info: SelectedElementInfo): void {
    const scope = info.unit || info.element;
    const anchors = Array.from(scope.querySelectorAll<HTMLAnchorElement>('a')).filter(
      (a) => (a.style?.display || '').toLowerCase() !== 'none'
    );
    if (anchors.length === 0) return;

    holder.innerHTML = `
      <div class="arch-form-group" style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:10px;">
        <label class="arch-form-label">Inner Links (&lt;a&gt;) (${anchors.length})</label>
        <div class="arch-inner-links-list" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    `;

    const listEl = holder.querySelector<HTMLElement>('.arch-inner-links-list')!;
    anchors.forEach((aEl, idx) => {
      const card = document.createElement('div');
      card.className = 'arch-item-card';
      const labelVal = ButtonAdapter.getLabel(aEl, aEl);
      const hrefVal = aEl.getAttribute('href') || '';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;">
          <span>Link #${idx + 1} (&lt;a&gt;)</span>
          <button type="button" class="arch-btn btn-select-inner-a" style="padding:2px 8px;font-size:11px;">Select &lt;a&gt;</button>
        </div>
        <input type="text" class="arch-input inp-inner-a-label" placeholder="Link text" />
        <input type="text" class="arch-input inp-inner-a-href" placeholder="https://..." />
      `;

      const lblInput = card.querySelector<HTMLInputElement>('.inp-inner-a-label')!;
      lblInput.value = labelVal;
      lblInput.addEventListener('input', (e) => {
        ButtonAdapter.setLabel(aEl, (e.target as HTMLInputElement).value, aEl);
        this.events.onChange();
      });

      const hrefInput = card.querySelector<HTMLInputElement>('.inp-inner-a-href')!;
      hrefInput.value = hrefVal;
      hrefInput.addEventListener('input', (e) => {
        aEl.setAttribute('href', (e.target as HTMLInputElement).value);
        this.events.onChange();
      });

      card.querySelector('.btn-select-inner-a')?.addEventListener('click', () => {
        this.events.onSelectElementNode?.(aEl);
      });

      listEl.appendChild(card);
    });
  }

  private renderButtonElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const activeNode = info.unit || info.element;
    const buttonLabel = ButtonAdapter.getLabel(info.element, info.unit);
    const buttonUrl = ButtonAdapter.getUrl(info.element, info.unit);
    const bgColor = toHexColor(ButtonAdapter.getBackgroundColor(info.element, info.unit) || info.backgroundColor, '#7747ff');
    const textColor = toHexColor(ButtonAdapter.getTextColor(info.element, info.unit) || info.color, '#ffffff');
    const fontSize = parseInt(activeNode.style.fontSize || info.fontSize || '16', 10) || 16;
    const borderRadius = parseInt(ButtonAdapter.getBorderRadius(info.element, info.unit) || '4', 10) || 4;
    const align = ButtonAdapter.getAlignment(info.element, info.unit) || 'center';

    container.innerHTML = `
      <div class="arch-sub-heading">ACTION</div>
      <div class="arch-rge-row">
        <label class="arch-rge-label">Action type</label>
        <select class="arch-rge-select" id="sel-btn-action-type">
          <option value="web">Open web page</option>
          <option value="email">Send email</option>
          <option value="tel">Call phone</option>
          <option value="sms">Send SMS</option>
        </select>
      </div>

      <div style="padding: 10px 18px 14px 18px; border-bottom: 1px solid #f2f3f5;">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-btn-url" value="${buttonUrl}" placeholder="https://..." />
        </div>
        <div class="arch-action-links">
          <span class="arch-action-link">Special links</span>
          <span class="arch-action-link">Link file</span>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Button text</label>
        <input type="text" class="arch-input" id="inp-btn-label" value="${buttonLabel}" style="width: 145px; height: 32px;" />
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font family</label>
        <select class="arch-rge-select" id="sel-btn-font">
          <option value="Global font">Global font</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font weight</label>
        <select class="arch-rge-select" id="sel-btn-weight">
          <option value="normal" selected>Regular</option>
          <option value="600">Semi Bold</option>
          <option value="bold">Bold</option>
          <option value="300">Light</option>
        </select>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Font size</label>
        ${this.renderStepper('stp-btn-size', fontSize, 10, 48, 1)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Background color</label>
        ${this.renderColorPicker('inp-btn-bg', 'txt-btn-bg', bgColor)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Text color</label>
        ${this.renderColorPicker('inp-btn-color', 'txt-btn-color', textColor)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Align</label>
        ${this.renderAlignment('grp-btn-align', align, false)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Border radius</label>
        ${this.renderStepper('stp-btn-radius', borderRadius, 0, 50, 1)}
      </div>
    `;

    const labelInp = container.querySelector<HTMLInputElement>('#inp-btn-label')!;
    labelInp.addEventListener('input', (e) => {
      ButtonAdapter.setLabel(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const urlInp = container.querySelector<HTMLInputElement>('#inp-btn-url')!;
    urlInp.addEventListener('input', (e) => {
      ButtonAdapter.setUrl(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    this.bindColorPicker(container, 'inp-btn-bg', 'txt-btn-bg', (val) => {
      ButtonAdapter.setBackgroundColor(info.element, val, info.unit);
      this.events.onChange();
    });

    this.bindColorPicker(container, 'inp-btn-color', 'txt-btn-color', (val) => {
      ButtonAdapter.setTextColor(info.element, val, info.unit);
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-btn-size', (val) => {
      TextAdapter.setFontSize(info.element, `${val}px`, this.viewportMode, info.unit);
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-btn-radius', (val) => {
      ButtonAdapter.setBorderRadius(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-btn-align', (val) => {
      ButtonAdapter.setAlignment(info.element, val as any, info.unit);
      this.events.onChange();
    });
  }

  private renderImageElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const src = ImageAdapter.getSrc(info.element, info.unit);
    const alt = ImageAdapter.getAlt(info.element, info.unit);
    const linkUrl = ImageAdapter.getLinkUrl(info.element, info.unit);
    const width = ImageAdapter.getWidth(info.element, info.unit);
    const numWidth = parseInt(width, 10) || 300;
    const align = ImageAdapter.getAlignment(info.element, info.unit) || 'center';
    const filename = src.split('/').pop()?.split('?')[0] || 'image.png';

    container.innerHTML = `
      <div style="display: flex; gap: 8px; padding: 14px 18px; border-bottom: 1px solid #f2f3f5;">
        <button type="button" class="arch-btn arch-btn--primary" id="btn-img-replace" style="flex: 1; height: 34px; font-size: 12px; font-weight: 600;">Replace</button>
        <button type="button" class="arch-btn" id="btn-img-effects" style="flex: 1; height: 34px; font-size: 12px; font-weight: 600;">Apply effects</button>
      </div>

      <div style="padding: 12px 18px; border-bottom: 1px solid #f2f3f5;">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-img-src" value="${src}" placeholder="https://..." />
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Image name: <strong>${filename}</strong>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Width</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="text" class="arch-input" id="inp-img-width" value="${width}" style="width: 60px; text-align: center; height: 32px;" />
          ${this.renderStepper('stp-img-width', numWidth, 24, 600, 10)}
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Presets</label>
        <div class="arch-btn-group" style="display: flex; gap: 4px;">
          <button type="button" class="arch-btn arch-btn--sm" data-width-preset="25%" style="padding: 3px 8px; font-size: 11px;">25%</button>
          <button type="button" class="arch-btn arch-btn--sm" data-width-preset="50%" style="padding: 3px 8px; font-size: 11px;">50%</button>
          <button type="button" class="arch-btn arch-btn--sm" data-width-preset="75%" style="padding: 3px 8px; font-size: 11px;">75%</button>
          <button type="button" class="arch-btn arch-btn--sm" data-width-preset="100%" style="padding: 3px 8px; font-size: 11px;">100%</button>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Align</label>
        <div style="display: flex; align-items: center; gap: 6px;">
          <select class="arch-rge-select" id="inp-img-align" style="width: 80px;">
            <option value="left" ${align === 'left' ? 'selected' : ''}>Left</option>
            <option value="center" ${align === 'center' ? 'selected' : ''}>Center</option>
            <option value="right" ${align === 'right' ? 'selected' : ''}>Right</option>
          </select>
          ${this.renderAlignment('grp-img-align', align, false)}
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Alt text</label>
        <input type="text" class="arch-input" id="inp-img-alt" value="${alt}" placeholder="Describe image" style="width: 145px; height: 32px;" />
      </div>

      <div class="arch-sub-heading">ACTION</div>
      <div class="arch-rge-row">
        <label class="arch-rge-label">Image link</label>
        <select class="arch-rge-select" id="sel-img-link-type">
          <option value="web">Open web page</option>
          <option value="email">Send email</option>
        </select>
      </div>
      <div style="padding: 0 18px 14px 18px; border-bottom: 1px solid #f2f3f5;">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-img-link" value="${linkUrl}" placeholder="https://..." />
        </div>
      </div>
    `;

    const srcInp = container.querySelector<HTMLInputElement>('#inp-img-src')!;
    srcInp.addEventListener('input', (e) => {
      ImageAdapter.setSrc(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const altInp = container.querySelector<HTMLInputElement>('#inp-img-alt')!;
    altInp.addEventListener('input', (e) => {
      ImageAdapter.setAlt(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const linkInp = container.querySelector<HTMLInputElement>('#inp-img-link')!;
    linkInp.addEventListener('input', (e) => {
      ImageAdapter.setLinkUrl(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const widthInp = container.querySelector<HTMLInputElement>('#inp-img-width')!;
    widthInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        const valInp = container.querySelector<HTMLInputElement>('#stp-img-width');
        if (valInp) valInp.value = String(num);
      }
      ImageAdapter.setWidth(info.element, val, info.unit);
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-img-width', (val) => {
      widthInp.value = `${val}px`;
      ImageAdapter.setWidth(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });

    container.querySelectorAll<HTMLButtonElement>('[data-width-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-width-preset');
        if (preset) {
          widthInp.value = preset;
          ImageAdapter.setWidth(info.element, preset, info.unit);
          this.events.onChange();
        }
      });
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-img-align')!;
    alignSel.addEventListener('change', () => {
      const val = alignSel.value;
      container.querySelectorAll('.grp-img-align button').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-align') === val);
      });
      ImageAdapter.setAlignment(info.element, val as any, info.unit);
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-img-align', (val) => {
      alignSel.value = val;
      ImageAdapter.setAlignment(info.element, val as any, info.unit);
      this.events.onChange();
    });
  }

  private renderDividerElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const color = toHexColor(DividerAdapter.getColor(info.element, info.unit), '#cbd5e1');
    const thickness = parseInt(DividerAdapter.getThickness(info.element, info.unit) || '1', 10) || 1;

    container.innerHTML = `
      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Transparent</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-div-transparent" />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Line style</label>
        <select class="arch-select" id="sel-div-style" style="width: 140px;">
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Thickness</label>
        ${this.renderStepper('stp-div-thickness', thickness, 1, 20, 1)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Divider color</label>
        ${this.renderColorPicker('swatch-div-color', 'txt-div-color', color)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Align</label>
        ${this.renderAlignment('grp-div-align', 'center', false)}
      </div>
    `;

    const transChk = container.querySelector<HTMLInputElement>('#chk-div-transparent')!;
    transChk.addEventListener('change', () => {
      DividerAdapter.setColor(info.element, transChk.checked ? 'transparent' : color, info.unit);
      this.events.onChange();
    });

    const styleSel = container.querySelector<HTMLSelectElement>('#sel-div-style')!;
    styleSel.addEventListener('change', () => {
      info.element.style.borderTopStyle = styleSel.value;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-div-thickness', (val) => {
      DividerAdapter.setThickness(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-div-color', 'txt-div-color', (val) => {
      DividerAdapter.setColor(info.element, val, info.unit);
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-div-align', (val) => {
      info.element.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderSpacerElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const height = parseInt(SpacerAdapter.getHeight(info.element, info.unit) || '28', 10) || 28;

    container.innerHTML = `
      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Spacer height</label>
        ${this.renderStepper('stp-spacer-height', height, 5, 200, 5)}
      </div>

      <div class="arch-form-group" style="margin-top: 10px;">
        <input type="range" class="arch-range" id="rng-spacer-height" min="5" max="200" step="1" value="${height}" style="width: 100%;" />
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Dynamic height on mobile</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-spacer-dyn" />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>
    `;

    const rngInp = container.querySelector<HTMLInputElement>('#rng-spacer-height')!;
    this.bindStepper(container, 'stp-spacer-height', (val) => {
      rngInp.value = String(val);
      SpacerAdapter.setHeight(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });

    rngInp.addEventListener('input', () => {
      const val = parseInt(rngInp.value, 10);
      const valInp = container.querySelector<HTMLInputElement>('#stp-spacer-height');
      if (valInp) valInp.value = String(val);
      SpacerAdapter.setHeight(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });
  }

  private renderSocialElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const unit = info.unit || info.element;
    const items = SocialAdapter.getItems(unit);

    container.innerHTML = `
      <div class="arch-sub-heading">SOCIAL ICONS (${items.length})</div>
      <div id="social-items-list" style="display: flex; flex-direction: column; gap: 8px;"></div>

      <button type="button" class="arch-btn" id="btn-add-social" style="margin-top: 8px; width: 100%; font-size: 12px; font-weight: 600;">
        + Add new icon
      </button>

      <div class="arch-form-row--split" style="margin-top: 12px;">
        <label class="arch-form-label-sub">Icon size</label>
        ${this.renderStepper('stp-soc-size', 32, 16, 64, 4)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Icon spacing</label>
        ${this.renderStepper('stp-soc-space', 8, 2, 32, 2)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Align</label>
        ${this.renderAlignment('grp-soc-align', 'center', false)}
      </div>
    `;

    const listEl = container.querySelector<HTMLElement>('#social-items-list')!;
    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'arch-item-card';
      card.innerHTML = `
        <div class="arch-item-card-header">
          <span>${idx + 1}. ${item.alt || 'Icon'}</span>
          <button type="button" class="arch-btn arch-btn--danger btn-del-social" style="padding: 2px 6px; font-size: 10px;">✕</button>
        </div>
        <input type="text" class="arch-input inp-social-href" placeholder="https://..." value="${item.href}" />
      `;
      card.querySelector<HTMLInputElement>('.inp-social-href')?.addEventListener('input', (e) => {
        item.anchor.setAttribute('href', (e.target as HTMLInputElement).value);
        this.events.onChange();
      });
      card.querySelector('.btn-del-social')?.addEventListener('click', () => {
        item.anchor.remove();
        this.events.onChange();
        this.renderSocialElementControls(container, info);
      });
      listEl.appendChild(card);
    });

    container.querySelector('#btn-add-social')?.addEventListener('click', () => {
      SocialAdapter.addIcon(unit);
      this.events.onChange();
      this.renderSocialElementControls(container, info);
    });

    this.bindStepper(container, 'stp-soc-size', (val) => {
      unit.querySelectorAll('img').forEach((img) => {
        img.style.width = `${val}px`;
        img.setAttribute('width', String(val));
      });
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-soc-align', (val) => {
      unit.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderListElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;
    const listEl = (target.querySelector('ul, ol') || (target.tagName.match(/^(UL|OL)$/i) ? target : null)) as HTMLElement;
    const isOrdered = listEl ? listEl.tagName.toLowerCase() === 'ol' : false;
    const currentSize = parseInt(target.style.fontSize || '14', 10) || 14;
    const currentColor = toHexColor(target.style.color || '#374151', '#374151');

    container.innerHTML = `
      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">List type</label>
        <div class="arch-segmented-group grp-list-type">
          <button type="button" class="arch-segmented-btn ${!isOrdered ? 'is-active' : ''}" data-type="ul">• Bullet</button>
          <button type="button" class="arch-segmented-btn ${isOrdered ? 'is-active' : ''}" data-type="ol">1. Number</button>
        </div>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Font family</label>
        <select class="arch-select" id="sel-list-font" style="width: 140px;">
          <option value="Global font">Global font</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Font size</label>
        ${this.renderStepper('stp-list-size', currentSize, 10, 48, 1)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Text color</label>
        ${this.renderColorPicker('swatch-list-color', 'txt-list-color', currentColor)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Line height</label>
        <select class="arch-select" id="sel-list-lh" style="width: 140px;">
          <option value="1.2">≡ 1.2</option>
          <option value="1.5" selected>≡ 1.5</option>
          <option value="1.8">≡ 1.8</option>
        </select>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>('.grp-list-type button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newTag = btn.getAttribute('data-type') || 'ul';
        container.querySelectorAll('.grp-list-type button').forEach((b) => b.classList.toggle('is-active', b === btn));
        if (listEl && listEl.tagName.toLowerCase() !== newTag) {
          const newList = document.createElement(newTag);
          newList.innerHTML = listEl.innerHTML;
          listEl.replaceWith(newList);
          this.events.onChange();
        }
      });
    });

    this.bindStepper(container, 'stp-list-size', (val) => {
      target.style.fontSize = `${val}px`;
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-list-color', 'txt-list-color', (val) => {
      target.style.color = val;
      this.events.onChange();
    });
  }

  private renderTableElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;
    const tableEl = (target.tagName.toLowerCase() === 'table' ? target : target.querySelector('table') || target) as HTMLTableElement;
    const rows = tableEl.rows?.length || 3;
    const cols = tableEl.rows?.[0]?.cells?.length || 3;

    container.innerHTML = `
      <div class="arch-sub-heading">TABLE DIMENSIONS</div>
      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Rows</label>
        ${this.renderStepper('stp-tbl-rows', rows, 1, 20, 1)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Columns</label>
        ${this.renderStepper('stp-tbl-cols', cols, 1, 10, 1)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Header background</label>
        ${this.renderColorPicker('swatch-tbl-hdr-bg', 'txt-tbl-hdr-bg', '#f3f4f6')}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Cell padding</label>
        ${this.renderStepper('stp-tbl-pad', 8, 2, 32, 2)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Border color</label>
        ${this.renderColorPicker('swatch-tbl-border', 'txt-tbl-border', '#e5e7eb')}
      </div>
    `;

    this.bindColorPicker(container, 'swatch-tbl-hdr-bg', 'txt-tbl-hdr-bg', (val) => {
      tableEl.querySelectorAll('th').forEach((th) => {
        th.style.backgroundColor = val;
      });
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-tbl-pad', (val) => {
      tableEl.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.padding = `${val}px`;
      });
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-tbl-border', 'txt-tbl-border', (val) => {
      tableEl.style.borderColor = val;
      tableEl.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.borderColor = val;
      });
      this.events.onChange();
    });
  }

  private renderVideoElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;
    const aEl = target.querySelector<HTMLAnchorElement>('a') || (target.tagName.toLowerCase() === 'a' ? (target as HTMLAnchorElement) : null);
    const videoUrl = aEl?.getAttribute('href') || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    container.innerHTML = `
      <div class="arch-sub-heading">VIDEO URL</div>
      <div class="arch-form-group">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-video-url" value="${videoUrl}" placeholder="https://www.youtube.com/..." />
        </div>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Auto width</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-video-auto-width" checked />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Play icon style</label>
        <select class="arch-select" id="sel-video-play-icon" style="width: 140px;">
          <option value="round-dark">Round Dark</option>
          <option value="round-light">Round Light</option>
          <option value="square-dark">Square Dark</option>
          <option value="square-light">Square Light</option>
        </select>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Align</label>
        ${this.renderAlignment('grp-video-align', 'center', false)}
      </div>
    `;

    const urlInp = container.querySelector<HTMLInputElement>('#inp-video-url')!;
    urlInp.addEventListener('input', () => {
      if (aEl) aEl.setAttribute('href', urlInp.value);
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-video-align', (val) => {
      target.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderIconsElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;

    container.innerHTML = `
      <div class="arch-sub-heading">ICONS LIST</div>
      <div id="icons-items-list" style="display: flex; flex-direction: column; gap: 8px;">
        <div class="arch-item-card">
          <div class="arch-item-card-header">
            <span>⭐ Star Icon</span>
          </div>
          <input type="text" class="arch-input inp-icon-label" value="Feature" placeholder="Text" />
          <input type="text" class="arch-input inp-icon-url" value="https://" placeholder="https://..." />
        </div>
      </div>

      <button type="button" class="arch-btn" id="btn-add-icon-item" style="margin-top: 8px; width: 100%; font-size: 12px; font-weight: 600;">
        + Add new icon
      </button>

      <div class="arch-form-row--split" style="margin-top: 12px;">
        <label class="arch-form-label-sub">Icon size</label>
        ${this.renderStepper('stp-ico-size', 24, 16, 64, 4)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Icon spacing</label>
        ${this.renderStepper('stp-ico-spacing', 10, 4, 30, 2)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Align</label>
        ${this.renderAlignment('grp-ico-align', 'center', false)}
      </div>
    `;

    this.bindStepper(container, 'stp-ico-size', (val) => {
      target.querySelectorAll('svg, img').forEach((icon) => {
        (icon as HTMLElement).style.width = `${val}px`;
        (icon as HTMLElement).style.height = `${val}px`;
      });
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-ico-align', (val) => {
      target.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderMenuElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;
    const links = Array.from(target.querySelectorAll<HTMLAnchorElement>('a'));

    container.innerHTML = `
      <div class="arch-sub-heading">MENU ITEMS (${links.length || 3})</div>
      <div id="menu-items-list" style="display: flex; flex-direction: column; gap: 8px;">
        ${(links.length > 0 ? links : [{ textContent: 'Home', href: '#' }, { textContent: 'About', href: '#' }, { textContent: 'Contact', href: '#' }])
          .map(
            (item, idx) => `
            <div class="arch-item-card">
              <div class="arch-item-card-header">
                <span>Item #${idx + 1}</span>
                <button type="button" class="arch-btn arch-btn--danger btn-del-menu" style="padding: 2px 6px; font-size: 10px;">✕</button>
              </div>
              <input type="text" class="arch-input inp-menu-text" value="${item.textContent || ''}" placeholder="Label" />
              <input type="text" class="arch-input inp-menu-href" value="${(item as any).href || '#'}" placeholder="https://..." />
            </div>
          `
          )
          .join('')}
      </div>

      <button type="button" class="arch-btn" id="btn-add-menu-item" style="margin-top: 8px; width: 100%; font-size: 12px; font-weight: 600;">
        + Add new item
      </button>

      <div class="arch-form-row--split" style="margin-top: 12px;">
        <label class="arch-form-label-sub">Layout</label>
        <div class="arch-segmented-group grp-menu-layout">
          <button type="button" class="arch-segmented-btn is-active" data-layout="row">Horizontal</button>
          <button type="button" class="arch-segmented-btn" data-layout="column">Vertical</button>
        </div>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Font size</label>
        ${this.renderStepper('stp-menu-size', 13, 10, 24, 1)}
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Text color</label>
        ${this.renderColorPicker('swatch-menu-color', 'txt-menu-color', '#4b5563')}
      </div>
    `;

    this.bindStepper(container, 'stp-menu-size', (val) => {
      target.querySelectorAll('a').forEach((a) => {
        a.style.fontSize = `${val}px`;
      });
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-menu-color', 'txt-menu-color', (val) => {
      target.querySelectorAll('a').forEach((a) => {
        a.style.color = val;
      });
      this.events.onChange();
    });
  }

  private renderHtmlElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const target = info.unit || info.element;
    const htmlCode = target.innerHTML || '<!-- Custom HTML -->';

    container.innerHTML = `
      <div class="arch-sub-heading">HTML CODE</div>
      <div class="arch-form-group">
        <textarea class="arch-code-editor" id="inp-html-code" rows="8">${htmlCode}</textarea>
      </div>
      <div style="font-size: 11px; color: #6b7280; line-height: 1.4; background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
        💡 Raw HTML elements render directly inside the email table structure.
      </div>
    `;

    const codeInp = container.querySelector<HTMLTextAreaElement>('#inp-html-code')!;
    codeInp.addEventListener('input', () => {
      target.innerHTML = codeInp.value;
      this.events.onChange();
    });
  }

  private renderStickerGifElementControls(container: HTMLElement, info: SelectedElementInfo, isGif: boolean): void {
    const target = info.unit || info.element;
    const img = target.querySelector<HTMLImageElement>('img') || (target.tagName.toLowerCase() === 'img' ? (target as HTMLImageElement) : null);
    const src = img?.src || '';
    const alt = img?.alt || '';

    container.innerHTML = `
      <div class="arch-sub-heading">${isGif ? 'GIF' : 'STICKER'} URL</div>
      <div class="arch-form-group">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-sg-src" value="${src}" placeholder="https://..." />
        </div>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Auto width</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-sg-auto-width" checked />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div class="arch-form-row--split">
        <label class="arch-form-label-sub">Align</label>
        ${this.renderAlignment('grp-sg-align', 'center', false)}
      </div>

      <div class="arch-form-group">
        <label class="arch-form-label">Alt text</label>
        <input type="text" class="arch-input" id="inp-sg-alt" value="${alt}" placeholder="Description" />
      </div>
    `;

    const srcInp = container.querySelector<HTMLInputElement>('#inp-sg-src')!;
    srcInp.addEventListener('input', () => {
      if (img) img.src = srcInp.value;
      this.events.onChange();
    });

    this.bindAlignment(container, 'grp-sg-align', (val) => {
      target.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderSectionElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const targetEl = info.unit || info.element;
    const contentTable = targetEl.querySelector<HTMLElement>('.row-content') || targetEl;
    const rowBg = toHexColor(targetEl.style.backgroundColor, '#ffffff');
    const contentBg = toHexColor(contentTable.style.backgroundColor || info.backgroundColor, '#ffffff');

    container.innerHTML = `
      <div class="arch-accordion">
        <!-- Accordion 1: Backgrounds -->
        <div class="arch-accordion-header" data-toggle="row-bg">
          <span>BACKGROUNDS</span>
          <span class="arch-accordion-arrow">▲</span>
        </div>
        <div class="arch-accordion-body" id="sec-row-bg">
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Row background</label>
            ${this.renderColorPicker('swatch-row-bg', 'txt-row-bg', rowBg)}
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Content background</label>
            ${this.renderColorPicker('swatch-row-cnt-bg', 'txt-row-cnt-bg', contentBg)}
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Row background image</label>
            <label class="arch-toggle-switch">
              <input type="checkbox" id="chk-row-bg-img" />
              <span class="arch-toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Accordion 2: Borders -->
        <div class="arch-accordion-header" data-toggle="row-borders">
          <span>BORDERS</span>
          <span class="arch-accordion-arrow">▲</span>
        </div>
        <div class="arch-accordion-body" id="sec-row-borders">
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Content area border</label>
            <label class="arch-toggle-switch">
              <input type="checkbox" id="chk-row-border" />
              <span class="arch-toggle-slider"></span>
            </label>
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Border style</label>
            <select class="arch-select" id="sel-row-border-style" style="width: 140px;">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Border width</label>
            ${this.renderStepper('stp-row-border-w', 0, 0, 20, 1)}
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Rounded corners</label>
            ${this.renderStepper('stp-row-radius', 0, 0, 50, 1)}
          </div>
        </div>

        <!-- Accordion 3: Layout -->
        <div class="arch-accordion-header" data-toggle="row-layout">
          <span>LAYOUT</span>
          <span class="arch-accordion-arrow">▲</span>
        </div>
        <div class="arch-accordion-body" id="sec-row-layout">
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Content Area Padding</label>
            ${this.renderStepper('stp-row-pad', 10, 0, 60, 5)}
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Vertical align</label>
            <div class="arch-segmented-group grp-row-valign">
              <button type="button" class="arch-segmented-btn is-active" data-valign="top">Top</button>
              <button type="button" class="arch-segmented-btn" data-valign="middle">Center</button>
              <button type="button" class="arch-segmented-btn" data-valign="bottom">Bottom</button>
            </div>
          </div>
          <div class="arch-form-row--split">
            <label class="arch-form-label-sub">Stack on mobile</label>
            <div class="arch-segmented-group grp-row-stack">
              <button type="button" class="arch-segmented-btn is-active" data-stack="on">ON</button>
              <button type="button" class="arch-segmented-btn" data-stack="off">OFF</button>
            </div>
          </div>
          <div class="arch-form-group" style="margin-top: 8px;">
            <label class="arch-form-label">Column Layout Preset</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="1-col">1 Col (100%)</button>
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="2-col-50-50">2 Col (50/50)</button>
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="2-col-33-67">2 Col (33/67)</button>
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="2-col-67-33">2 Col (67/33)</button>
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="3-col">3 Col (Equal)</button>
              <button type="button" class="arch-btn arch-btn--sm" data-col-preset="4-col">4 Col (Equal)</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindColorPicker(container, 'swatch-row-bg', 'txt-row-bg', (val) => {
      targetEl.style.backgroundColor = val;
      this.events.onChange();
    });

    this.bindColorPicker(container, 'swatch-row-cnt-bg', 'txt-row-cnt-bg', (val) => {
      contentTable.style.backgroundColor = val;
      if (contentTable.tagName.toLowerCase() === 'td' || contentTable.tagName.toLowerCase() === 'table') {
        contentTable.setAttribute('bgcolor', val);
      }
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-row-pad', (val) => {
      contentTable.style.padding = `${val}px`;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-row-border-w', (val) => {
      contentTable.style.borderWidth = `${val}px`;
      this.events.onChange();
    });

    this.bindStepper(container, 'stp-row-radius', (val) => {
      contentTable.style.borderRadius = `${val}px`;
      this.events.onChange();
    });

    container.querySelectorAll<HTMLButtonElement>('[data-col-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-col-preset') as RowLayoutType;
        ColumnLayoutAdapter.applyRowPreset(targetEl, preset);
        this.events.onChange();
      });
    });

    // Toggle accordions inside Row Properties
    container.querySelectorAll<HTMLElement>('.arch-accordion-header[data-toggle]').forEach((header) => {
      header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-toggle');
        const body = container.querySelector<HTMLElement>(`#sec-${targetId}`);
        const arrow = header.querySelector<HTMLElement>('.arch-accordion-arrow');
        if (body) {
          const isHidden = body.classList.toggle('is-hidden');
          if (arrow) arrow.textContent = isHidden ? '▼' : '▲';
        }
      });
    });
  }

  /**
   * Renders global newsletter settings.
   */
  private renderDocumentSettings(doc: EmailDocument): void {
    const contentAlign = doc.settings.contentAlign || 'center';
    const contentBg = toHexColor(doc.settings.contentBackgroundColor, '#ffffff');
    const docBg = toHexColor(doc.settings.backgroundColor, '#f4f4f7');
    const textColor = toHexColor(doc.settings.textColor, '#334155');
    const preheader = doc.settings.preheader || '';
    const widthNum = parseInt(doc.settings.contentWidth, 10) || 600;
    const defaultFont = doc.settings.fontFamily || 'Arial, sans-serif';

    const isDesignOpen = this.docAccordionOpen['design-settings'] !== false;
    const isTypoOpen = this.docAccordionOpen['typography-settings'] !== false;
    const isMetaOpen = this.docAccordionOpen['metadata'] !== false;

    this.element.innerHTML = `
      <div class="arch-prop-header">
        <div class="arch-prop-title">DOCUMENT SETTINGS</div>
        <div class="arch-prop-actions">
          <span style="font-size: 10px; padding: 2px 8px; background: #ede9fe; color: #7747ff; border-radius: 12px; font-weight: 700; letter-spacing: 0.04em;">
            GLOBAL
          </span>
        </div>
      </div>

      <div class="arch-accordion">
        <!-- Accordion 1: General Canvas Styles -->
        <div class="arch-accordion-header" data-toggle="design-settings">
          <span>EMAIL CANVAS</span>
          <span class="arch-accordion-arrow">${isDesignOpen ? '▲' : '▼'}</span>
        </div>
        <div class="arch-accordion-body ${isDesignOpen ? '' : 'is-hidden'}" id="sec-design-settings" style="padding: 0; gap: 0;">
          <!-- Content Area Width (Stepper + Slider) -->
          <div class="arch-rge-row" style="flex-direction: column; align-items: stretch; gap: 8px; min-height: auto; padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <label class="arch-rge-label">Content area width</label>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${this.renderStepper('stp-doc-width', widthNum, 320, 1200, 10)}
                <span class="arch-slider-badge" id="val-doc-width" style="display: none;">${doc.settings.contentWidth}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
              <span style="font-size: 11px; color: #9ca3af; font-weight: 500;">480px</span>
              <input type="range" class="arch-range" id="inp-doc-width-range" min="480" max="900" step="10" value="${Math.min(900, Math.max(480, widthNum))}" style="flex: 1; cursor: pointer;" />
              <span style="font-size: 11px; color: #9ca3af; font-weight: 500;">900px</span>
            </div>
            <input type="text" class="arch-input" id="inp-doc-width" value="${doc.settings.contentWidth}" style="display: none;" />
          </div>

          <!-- Content Area Alignment -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Content alignment</label>
            <div class="arch-segmented-group" id="grp-doc-align">
              <button type="button" class="arch-segmented-icon-btn ${contentAlign === 'left' ? 'is-active' : ''}" data-align="left" title="Align Left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
              </button>
              <button type="button" class="arch-segmented-icon-btn ${contentAlign === 'center' ? 'is-active' : ''}" data-align="center" title="Align Center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
              </button>
            </div>
            <select class="arch-select" id="inp-doc-align" style="display: none;">
              <option value="left" ${contentAlign === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${contentAlign === 'center' ? 'selected' : ''}>Center</option>
            </select>
          </div>

          <!-- Background Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Background color</label>
            ${this.renderColorPicker('inp-doc-bg', 'txt-doc-bg', docBg)}
          </div>

          <!-- Content Area Background Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Content area background</label>
            ${this.renderColorPicker('inp-doc-content-bg', 'txt-doc-content-bg', contentBg)}
          </div>

          <!-- Background Image Switch -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Background image</label>
            <label class="arch-toggle-switch">
              <input type="checkbox" id="chk-doc-bg-img" />
              <span class="arch-toggle-slider"></span>
            </label>
          </div>
          <div class="arch-rge-row" id="row-doc-bg-url" style="display: none;">
            <label class="arch-rge-label">Image URL</label>
            <div class="arch-url-group" style="width: 160px;">
              <input type="text" class="arch-input" id="inp-doc-bg-url" placeholder="https://..." style="height: 100%; border: none; font-size: 12px; width: 100%;" />
            </div>
          </div>
        </div>

        <!-- Accordion 2: Typography Settings -->
        <div class="arch-accordion-header" data-toggle="typography-settings">
          <span>DEFAULT TYPOGRAPHY</span>
          <span class="arch-accordion-arrow">${isTypoOpen ? '▲' : '▼'}</span>
        </div>
        <div class="arch-accordion-body ${isTypoOpen ? '' : 'is-hidden'}" id="sec-typography-settings" style="padding: 0; gap: 0;">
          <!-- Default Font Family -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Font family</label>
            <select class="arch-rge-select" id="inp-doc-font">
              <option value="Arial, sans-serif" ${defaultFont.includes('Arial') ? 'selected' : ''}>Arial</option>
              <option value="Helvetica, Arial, sans-serif" ${defaultFont.includes('Helvetica') ? 'selected' : ''}>Helvetica</option>
              <option value="Georgia, serif" ${defaultFont.includes('Georgia') ? 'selected' : ''}>Georgia</option>
              <option value="'Lucida Sans Unicode', sans-serif" ${defaultFont.includes('Lucida Sans') ? 'selected' : ''}>Lucida Sans</option>
              <option value="Tahoma, sans-serif" ${defaultFont.includes('Tahoma') ? 'selected' : ''}>Tahoma</option>
              <option value="'Times New Roman', Times, serif" ${defaultFont.includes('Times New Roman') ? 'selected' : ''}>Times New Roman</option>
              <option value="'Trebuchet MS', sans-serif" ${defaultFont.includes('Trebuchet MS') ? 'selected' : ''}>Trebuchet MS</option>
              <option value="Verdana, sans-serif" ${defaultFont.includes('Verdana') ? 'selected' : ''}>Verdana</option>
              <option value="system-ui, -apple-system, sans-serif" ${defaultFont.includes('system-ui') ? 'selected' : ''}>System Sans</option>
            </select>
          </div>

          <!-- Font Weight -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Font weight</label>
            <select class="arch-rge-select" id="sel-doc-weight">
              <option value="normal" selected>Regular</option>
              <option value="600">Semi Bold</option>
              <option value="bold">Bold</option>
            </select>
          </div>

          <!-- Default Text Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Text color</label>
            ${this.renderColorPicker('inp-doc-text-color', 'txt-doc-text-color', textColor)}
          </div>

          <!-- Link Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Link color</label>
            ${this.renderColorPicker('inp-doc-link-color', 'txt-doc-link-color', '#7747ff')}
          </div>

          <!-- Line Height -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Line height</label>
            <select class="arch-rge-select" id="sel-doc-lh">
              <option value="1.1">≡ 1.1</option>
              <option value="1.2">≡ 1.2</option>
              <option value="1.3">≡ 1.3</option>
              <option value="1.4">≡ 1.4</option>
              <option value="1.5" selected>≡ 1.5</option>
              <option value="2.0">≡ 2.0</option>
            </select>
          </div>

          <!-- Letter Spacing -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Letter spacing</label>
            ${this.renderStepper('stp-doc-spacing', 0, -2, 10, 1)}
          </div>
        </div>

        <!-- Accordion 3: METADATA -->
        <div class="arch-accordion-header" data-toggle="metadata">
          <span>EMAIL METADATA</span>
          <span class="arch-accordion-arrow">${isMetaOpen ? '▲' : '▼'}</span>
        </div>
        <div class="arch-accordion-body ${isMetaOpen ? '' : 'is-hidden'}" id="sec-metadata" style="padding: 0; gap: 0;">
          <div class="arch-rge-row" style="flex-direction: column; align-items: stretch; gap: 8px; min-height: auto; padding: 14px 18px;">
            <label class="arch-rge-label" style="font-weight: 500;">Preheader (Preview Text)</label>
            <input type="text" class="arch-input" id="inp-doc-preheader" placeholder="Inbox summary snippet..." value="${preheader}" style="width: 100%; box-sizing: border-box;" />
            <span style="font-size: 11px; color: #9ca3af; line-height: 1.3;">
              Summary text shown next to the subject line in subscribers' inbox previews.
            </span>
          </div>
          <div class="arch-rge-row">
            <label class="arch-rge-label">Language</label>
            <select class="arch-rge-select" id="sel-doc-lang">
              <option value="en">English (en)</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
              <option value="it">Italian (it)</option>
              <option value="pt">Portuguese (pt)</option>
            </select>
          </div>
        </div>
      </div>
    `;

    // 1. Content Area Width (Stepper + Range Slider + Hidden Input Sync)
    const rangeInp = this.element.querySelector<HTMLInputElement>('#inp-doc-width-range');
    const badge = this.element.querySelector<HTMLElement>('#val-doc-width');
    const widthInp = this.element.querySelector<HTMLInputElement>('#inp-doc-width');
    const stpInp = this.element.querySelector<HTMLInputElement>('#stp-doc-width');

    const setWidth = (num: number) => {
      const clamped = Math.max(320, Math.min(1200, num));
      const strVal = `${clamped}px`;
      if (widthInp) widthInp.value = strVal;
      if (badge) badge.textContent = strVal;
      if (rangeInp) rangeInp.value = String(Math.min(900, Math.max(480, clamped)));
      if (stpInp) stpInp.value = String(clamped);
      doc.settings.contentWidth = strVal;
      this.events.onChange(true);
    };

    this.bindStepper(this.element, 'stp-doc-width', (val) => {
      setWidth(val);
    });

    rangeInp?.addEventListener('input', (e) => {
      const num = parseInt((e.target as HTMLInputElement).value, 10);
      setWidth(num);
    });

    widthInp?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        setWidth(parsed);
      }
    });

    // 2. Alignment Toggle Group Sync (Icon Buttons + Select + Doc Settings)
    const alignSel = this.element.querySelector<HTMLSelectElement>('#inp-doc-align');
    const alignBtns = this.element.querySelectorAll<HTMLButtonElement>('#grp-doc-align [data-align]');

    alignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-align') as 'left' | 'center';
        alignBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        if (alignSel) alignSel.value = val;
        doc.settings.contentAlign = val;
        this.events.onChange(true);
      });
    });

    alignSel?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as 'left' | 'center';
      alignBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-align') === val));
      doc.settings.contentAlign = val;
      this.events.onChange(true);
    });

    // 3. Background Color Sync
    this.bindColorPicker(this.element, 'inp-doc-bg', 'txt-doc-bg', (val) => {
      doc.settings.backgroundColor = val;
      this.events.onChange(true);
    });

    // 4. Content Area Background Color Sync
    this.bindColorPicker(this.element, 'inp-doc-content-bg', 'txt-doc-content-bg', (val) => {
      doc.settings.contentBackgroundColor = val;
      this.events.onChange(true);
    });

    // 5. Background Image Toggle Switch
    const bgImgChk = this.element.querySelector<HTMLInputElement>('#chk-doc-bg-img');
    const bgImgRow = this.element.querySelector<HTMLElement>('#row-doc-bg-url');
    bgImgChk?.addEventListener('change', () => {
      if (bgImgRow) {
        bgImgRow.style.display = bgImgChk.checked ? 'flex' : 'none';
      }
    });

    // 6. Default Font Family
    const fontSel = this.element.querySelector<HTMLSelectElement>('#inp-doc-font');
    fontSel?.addEventListener('change', (e) => {
      doc.settings.fontFamily = (e.target as HTMLSelectElement).value;
      this.events.onChange(true);
    });

    // 7. Text Color Sync
    this.bindColorPicker(this.element, 'inp-doc-text-color', 'txt-doc-text-color', (val) => {
      doc.settings.textColor = val;
      this.events.onChange(true);
    });

    // 8. Link Color Sync
    this.bindColorPicker(this.element, 'inp-doc-link-color', 'txt-doc-link-color', () => {
      this.events.onChange(true);
    });

    // 9. Preheader Input
    const preheaderInp = this.element.querySelector<HTMLInputElement>('#inp-doc-preheader');
    preheaderInp?.addEventListener('input', (e) => {
      doc.settings.preheader = (e.target as HTMLInputElement).value;
      this.events.onChange(true);
    });

    // 10. Accordion Collapsible Toggles with persistent open/close memory
    this.element.querySelectorAll<HTMLElement>('.arch-accordion-header[data-toggle]').forEach((header) => {
      header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-toggle');
        if (!targetId) return;
        const body = this.element.querySelector<HTMLElement>(`#sec-${targetId}`);
        const arrow = header.querySelector<HTMLElement>('.arch-accordion-arrow');
        if (body) {
          const isHidden = body.classList.toggle('is-hidden');
          this.docAccordionOpen[targetId] = !isHidden;
          if (arrow) arrow.textContent = isHidden ? '▼' : '▲';
        }
      });
    });
  }

  /**
   * Renders contextual settings for a selected AST block (backward compatibility).
   */
  private renderBlockSettings(block: BlockNode): void {
    this.element.innerHTML = `
      <div class="arch-editor__section-label">Block Properties (${block.type.toUpperCase()})</div>
      <div id="inspector-fields"></div>
      <div class="arch-form-group" style="margin-top: 18px;">
        <button class="arch-btn arch-btn--danger" id="btn-inspector-delete" type="button" style="width: 100%;">
          Delete Block
        </button>
      </div>
    `;

    this.element.querySelector('#btn-inspector-delete')?.addEventListener('click', () => {
      if (this.events.onRemoveBlock) {
        this.events.onRemoveBlock(block.id);
      }
    });

    const fieldsContainer = this.element.querySelector<HTMLElement>('#inspector-fields');
    if (!fieldsContainer) return;

    if (block.type === 'heading' || block.type === 'text') {
      const isHeading = block.type === 'heading';
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Text Content</label>
          <textarea class="arch-textarea" id="inp-block-text"></textarea>
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Font Size</label>
          <input type="text" class="arch-input" id="inp-font-size" placeholder="${isHeading ? '24px' : '16px'}">
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

      const textInp = fieldsContainer.querySelector<HTMLTextAreaElement>('#inp-block-text')!;
      textInp.value = block.content.text || '';
      textInp.addEventListener('input', (e) => {
        block.content.text = (e.target as HTMLTextAreaElement).value;
        this.events.onChange();
      });

      const sizeInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-font-size')!;
      sizeInp.value = block.style.fontSize || (isHeading ? '24px' : '16px');
      sizeInp.addEventListener('change', (e) => {
        block.style.fontSize = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const colorInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-color')!;
      colorInp.value = toHexColor(block.style.color, isHeading ? '#0f172a' : '#475569');
      colorInp.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const alignSel = fieldsContainer.querySelector<HTMLSelectElement>('#inp-align')!;
      alignSel.value = block.style.textAlign || 'left';
      alignSel.addEventListener('change', (e) => {
        block.style.textAlign = (e.target as HTMLSelectElement).value as any;
        this.events.onChange();
      });
    } else if (block.type === 'button') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Button Label</label>
          <input type="text" class="arch-input" id="inp-btn-label">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Target URL</label>
          <input type="text" class="arch-input" id="inp-btn-url" placeholder="https://...">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Button Color</label>
          <input type="color" class="arch-input" id="inp-btn-bg">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Text Color</label>
          <input type="color" class="arch-input" id="inp-btn-color">
        </div>
      `;

      const labelInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-label')!;
      labelInp.value = block.content.label || 'Click Here';
      labelInp.addEventListener('input', (e) => {
        block.content.label = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const urlInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-url')!;
      urlInp.value = block.content.url || '';
      urlInp.addEventListener('change', (e) => {
        block.content.url = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const bgInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-bg')!;
      bgInp.value = toHexColor(block.style.backgroundColor, '#2563eb');
      bgInp.addEventListener('input', (e) => {
        block.style.backgroundColor = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const colorInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-btn-color')!;
      colorInp.value = toHexColor(block.style.color, '#ffffff');
      colorInp.addEventListener('input', (e) => {
        block.style.color = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });
    } else if (block.type === 'image') {
      fieldsContainer.innerHTML = `
        <div class="arch-form-group">
          <label class="arch-form-label">Image URL</label>
          <input type="text" class="arch-input" id="inp-img-src" placeholder="https://...">
        </div>
        <div class="arch-form-group">
          <label class="arch-form-label">Alt Text</label>
          <input type="text" class="arch-input" id="inp-img-alt" placeholder="Description of image">
        </div>
      `;

      const srcInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-img-src')!;
      srcInp.value = block.content.src || '';
      srcInp.addEventListener('change', (e) => {
        block.content.src = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });

      const altInp = fieldsContainer.querySelector<HTMLInputElement>('#inp-img-alt')!;
      altInp.value = block.content.alt || '';
      altInp.addEventListener('input', (e) => {
        block.content.alt = (e.target as HTMLInputElement).value;
        this.events.onChange();
      });
    }
  }

  public destroy(): void {
    this.element.remove();
  }
}

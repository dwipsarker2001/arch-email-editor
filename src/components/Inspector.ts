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
    const typeTitle = isDirectAnchor ? 'LINK / BUTTON (A)' : info.type.toUpperCase();
    const isHorizontal = info.axis === 'horizontal';
    const upLabel = isHorizontal ? '◀ Left' : '▲ Up';
    const downLabel = isHorizontal ? '▶ Right' : '▼ Down';

    const breadcrumbHtml =
      info.ancestry && info.ancestry.length > 0
        ? `<div class="arch-breadcrumb">
            ${info.ancestry
              .map(
                (item, idx) =>
                  `<button type="button" class="arch-breadcrumb__item ${
                    idx === info.ancestry!.length - 1 ? 'is-current' : ''
                  }" data-ancestry-idx="${idx}">${item.label}</button>`
              )
              .join('<span class="arch-breadcrumb__sep">›</span>')}
          </div>`
        : '';

    const modeBadge =
      this.viewportMode === 'mobile'
        ? `<div class="arch-mode-banner">📱 Editing Mobile (≤620px) Overrides</div>`
        : '';

    this.element.innerHTML = `
      <div class="arch-prop-header">
        <div class="arch-prop-title">${typeTitle} PROPERTIES</div>
        <div class="arch-prop-actions">
          <button type="button" class="arch-icon-btn" id="btn-prop-comment" title="Add Comment">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-delete" title="Delete Element">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-duplicate" title="Duplicate Unit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-prop-close" title="Close Properties">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div class="arch-ai-bar">
        <button type="button" class="arch-ai-btn" id="btn-write-ai">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
          Write with AI
        </button>
      </div>

      <div style="padding: 10px 14px 0 14px;">
        ${breadcrumbHtml}
        ${modeBadge}
      </div>

      <div class="arch-form-group" style="padding: 10px 14px 6px 14px;">
        <label class="arch-form-label">Structure & Placement</label>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="arch-btn arch-btn--sm" id="btn-select-parent" type="button" style="flex: 1;" title="Select enclosing Column or Row" ${!info.canSelectParent ? 'disabled' : ''}>
            ↑ Parent
          </button>
          <button class="arch-btn arch-btn--sm" id="btn-move-up" type="button" style="flex: 1;" ${!info.canMoveUp ? 'disabled' : ''}>
            ${upLabel}
          </button>
          <button class="arch-btn arch-btn--sm" id="btn-move-down" type="button" style="flex: 1;" ${!info.canMoveDown ? 'disabled' : ''}>
            ${downLabel}
          </button>
          <button class="arch-btn arch-btn--sm" id="btn-duplicate-element" type="button" title="Duplicate Unit">
            ⧉ Copy
          </button>
        </div>
      </div>

      <div id="inspector-element-fields"></div>

      <div class="arch-accordion-header" style="margin-top: 10px;">
        <span>BLOCK OPTIONS</span>
        <span class="arch-accordion-arrow">▲</span>
      </div>
      <div class="arch-accordion-body" style="padding: 12px 14px;">
        <div class="arch-form-group">
          <label class="arch-form-label">Responsive Visibility</label>
          <div style="display: flex; gap: 16px; font-size: 12px; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" id="chk-vis-desktop" ${!(info.unit || info.element).classList.contains('arch-hide-desktop') ? 'checked' : ''} />
              Desktop
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" id="chk-vis-mobile" ${!(info.unit || info.element).classList.contains('mobile_hide') ? 'checked' : ''} />
              Mobile
            </label>
          </div>
        </div>
        <div class="arch-form-group" style="margin-top: 10px;">
          <button class="arch-btn arch-btn--danger" id="btn-delete-element" type="button" style="width: 100%;">
            Delete ${info.unitRole === 'row' ? 'Row' : info.unitRole === 'column' ? 'Column' : 'Element'}
          </button>
        </div>
      </div>
    `;

    // Bind Header Action clicks
    this.element.querySelector('#btn-prop-close')?.addEventListener('click', () => {
      if (this.events.onDeselect) {
        this.events.onDeselect();
      }
    });

    const targetUnit = info.unit || info.element;
    const handleDelete = () => {
      if (this.events.onRemoveElement) {
        this.events.onRemoveElement();
      } else {
        targetUnit.remove();
        this.events.onChange();
      }
      this.element.innerHTML = `
        <div class="arch-prop-header">
          <div class="arch-prop-title">Element Deleted</div>
        </div>
        <p style="font-size: 13px; color: var(--arch-text-secondary); padding: 14px;">
          Element was removed from the email template.
        </p>
      `;
    };

    this.element.querySelector('#btn-prop-delete')?.addEventListener('click', handleDelete);
    this.element.querySelector('#btn-delete-element')?.addEventListener('click', handleDelete);

    const handleDuplicate = () => {
      this.events.onDuplicateElement?.();
    };
    this.element.querySelector('#btn-prop-duplicate')?.addEventListener('click', handleDuplicate);
    this.element.querySelector('#btn-duplicate-element')?.addEventListener('click', handleDuplicate);

    // Bind Breadcrumb clicks
    if (info.ancestry) {
      this.element.querySelectorAll<HTMLButtonElement>('[data-ancestry-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-ancestry-idx') || '0', 10);
          const item = info.ancestry![idx];
          if (item && this.events.onSelectElementNode) {
            this.events.onSelectElementNode(item.element);
          }
        });
      });
    }

    this.element.querySelector('#btn-select-parent')?.addEventListener('click', () => {
      this.events.onSelectParent?.();
    });

    this.element.querySelector('#btn-move-up')?.addEventListener('click', () => {
      this.events.onMoveElement?.('up');
    });

    this.element.querySelector('#btn-move-down')?.addEventListener('click', () => {
      this.events.onMoveElement?.('down');
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
      case 'image':
        this.renderImageElementControls(fieldsContainer, info);
        break;
      case 'button':
        this.renderButtonElementControls(fieldsContainer, info);
        break;
      case 'heading':
      case 'text':
        this.renderTextElementControls(fieldsContainer, info);
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
      default:
        this.renderSectionElementControls(fieldsContainer, info);
        break;
    }
  }

  private renderImageElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Image URL</label>
        <input type="text" class="arch-input" id="inp-img-src" placeholder="https://..." />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Alt Text (Accessibility)</label>
        <input type="text" class="arch-input" id="inp-img-alt" placeholder="Description of image" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Click-Through Link URL</label>
        <input type="text" class="arch-input" id="inp-img-link" placeholder="https://..." />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Width (px or %)</label>
        <div class="arch-img-resize-row">
          <input type="range" class="arch-range" id="inp-img-width-range" min="24" max="600" step="1" />
          <input type="text" class="arch-input arch-img-width-input" id="inp-img-width" placeholder="180px or 100%" />
        </div>
        <div class="arch-btn-group" style="margin-top: 6px;">
          <button type="button" class="arch-btn" data-width-preset="25%">25%</button>
          <button type="button" class="arch-btn" data-width-preset="50%">50%</button>
          <button type="button" class="arch-btn" data-width-preset="75%">75%</button>
          <button type="button" class="arch-btn" data-width-preset="100%">100%</button>
        </div>
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

    const srcInp = container.querySelector<HTMLInputElement>('#inp-img-src')!;
    srcInp.value = ImageAdapter.getSrc(info.element, info.unit);
    srcInp.addEventListener('input', (e) => {
      ImageAdapter.setSrc(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const altInp = container.querySelector<HTMLInputElement>('#inp-img-alt')!;
    altInp.value = ImageAdapter.getAlt(info.element, info.unit);
    altInp.addEventListener('input', (e) => {
      ImageAdapter.setAlt(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const linkInp = container.querySelector<HTMLInputElement>('#inp-img-link')!;
    linkInp.value = ImageAdapter.getLinkUrl(info.element, info.unit);
    linkInp.addEventListener('input', (e) => {
      ImageAdapter.setLinkUrl(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const widthInp = container.querySelector<HTMLInputElement>('#inp-img-width')!;
    const widthRange = container.querySelector<HTMLInputElement>('#inp-img-width-range')!;
    const initialWidth = ImageAdapter.getWidth(info.element, info.unit);
    widthInp.value = initialWidth;
    const numericInitial = parseInt(initialWidth, 10);
    widthRange.value = String(!isNaN(numericInitial) && !initialWidth.includes('%') ? numericInitial : 300);

    const applyWidth = (val: string) => {
      widthInp.value = val;
      const num = parseInt(val, 10);
      if (!isNaN(num) && !val.includes('%')) {
        widthRange.value = String(Math.min(600, Math.max(24, num)));
      }
      ImageAdapter.setWidth(info.element, val, info.unit);
      this.events.onChange();
    };

    widthInp.addEventListener('input', (e) => {
      applyWidth((e.target as HTMLInputElement).value);
    });

    widthRange.addEventListener('input', (e) => {
      applyWidth(`${(e.target as HTMLInputElement).value}px`);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-width-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.widthPreset;
        if (preset) applyWidth(preset);
      });
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-img-align')!;
    alignSel.value = ImageAdapter.getAlignment(info.element, info.unit);
    alignSel.addEventListener('change', (e) => {
      ImageAdapter.setAlignment(info.element, (e.target as HTMLSelectElement).value as any, info.unit);
      this.events.onChange();
    });
  }

  private renderButtonElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const activeNode = info.unit || info.element;
    const isLinkTag = activeNode.tagName.toLowerCase() === 'a';
    const labelTitle = isLinkTag ? 'Link / Button Label (<a>)' : 'Button Label';

    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">${labelTitle}</label>
        <input type="text" class="arch-input" id="inp-btn-label" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Target Link URL (href)</label>
        <input type="text" class="arch-input" id="inp-btn-url" placeholder="https://..." />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Text Color</label>
        <input type="color" class="arch-input" id="inp-btn-color" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Background Color</label>
        <input type="color" class="arch-input" id="inp-btn-bg" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Font Size</label>
        <input type="text" class="arch-input" id="inp-btn-size" placeholder="16px" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Text Decoration</label>
        <select class="arch-select" id="inp-btn-deco">
          <option value="none">None</option>
          <option value="underline">Underline</option>
        </select>
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Border Radius</label>
        <input type="text" class="arch-input" id="inp-btn-radius" placeholder="6px" />
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

    const labelInp = container.querySelector<HTMLInputElement>('#inp-btn-label')!;
    labelInp.value = ButtonAdapter.getLabel(info.element, info.unit);
    labelInp.addEventListener('input', (e) => {
      ButtonAdapter.setLabel(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const urlInp = container.querySelector<HTMLInputElement>('#inp-btn-url')!;
    urlInp.value = ButtonAdapter.getUrl(info.element, info.unit);
    urlInp.addEventListener('input', (e) => {
      ButtonAdapter.setUrl(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const bgInp = container.querySelector<HTMLInputElement>('#inp-btn-bg')!;
    bgInp.value = toHexColor(ButtonAdapter.getBackgroundColor(info.element, info.unit) || info.backgroundColor, '#2563eb');
    bgInp.addEventListener('input', (e) => {
      ButtonAdapter.setBackgroundColor(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const colorInp = container.querySelector<HTMLInputElement>('#inp-btn-color')!;
    colorInp.value = toHexColor(ButtonAdapter.getTextColor(info.element, info.unit) || info.color, '#ffffff');
    colorInp.addEventListener('input', (e) => {
      ButtonAdapter.setTextColor(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const sizeInp = container.querySelector<HTMLInputElement>('#inp-btn-size')!;
    sizeInp.value = activeNode.style.fontSize || info.fontSize || '';
    sizeInp.addEventListener('input', (e) => {
      TextAdapter.setFontSize(info.element, (e.target as HTMLInputElement).value, this.viewportMode, info.unit);
      this.events.onChange();
    });

    const decoSel = container.querySelector<HTMLSelectElement>('#inp-btn-deco')!;
    const currentDeco = (activeNode.style.textDecoration || info.element.style.textDecoration || '').toLowerCase();
    decoSel.value = currentDeco.includes('underline') ? 'underline' : 'none';
    decoSel.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      activeNode.style.textDecoration = val;
      if (info.element !== activeNode) {
        info.element.style.textDecoration = val;
      }
      this.events.onChange();
    });

    const radiusInp = container.querySelector<HTMLInputElement>('#inp-btn-radius')!;
    radiusInp.value = ButtonAdapter.getBorderRadius(info.element, info.unit);
    radiusInp.addEventListener('input', (e) => {
      ButtonAdapter.setBorderRadius(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-btn-align')!;
    alignSel.value = ButtonAdapter.getAlignment(info.element, info.unit);
    alignSel.addEventListener('change', (e) => {
      ButtonAdapter.setAlignment(info.element, (e.target as HTMLSelectElement).value as any, info.unit);
      this.events.onChange();
    });
  }

  private renderTextElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const hasRich = TextAdapter.hasRichFormatting(info.element, info.unit);
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Text Content ${hasRich ? '<span style="font-weight:400;font-size:11px;color:#2563eb;">(Edit directly on canvas to keep bold/italic/links)</span>' : ''}</label>
        <textarea class="arch-textarea" id="inp-text-copy" rows="4"></textarea>
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Font Size</label>
        <input type="text" class="arch-input" id="inp-text-size" placeholder="16px" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Text Color</label>
        <input type="color" class="arch-input" id="inp-text-color" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Text Alignment</label>
        <select class="arch-select" id="inp-text-align">
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div id="inspector-inner-links"></div>
    `;

    const copyInp = container.querySelector<HTMLTextAreaElement>('#inp-text-copy')!;
    copyInp.value = info.element.textContent || '';
    copyInp.addEventListener('input', (e) => {
      TextAdapter.setText(info.element, (e.target as HTMLTextAreaElement).value, info.unit);
      this.events.onChange();
    });

    const sizeInp = container.querySelector<HTMLInputElement>('#inp-text-size')!;
    sizeInp.value = info.fontSize || '';
    sizeInp.addEventListener('input', (e) => {
      TextAdapter.setFontSize(info.element, (e.target as HTMLInputElement).value, this.viewportMode, info.unit);
      this.events.onChange();
    });

    const colorInp = container.querySelector<HTMLInputElement>('#inp-text-color')!;
    colorInp.value = toHexColor(info.color, '#0f172a');
    colorInp.addEventListener('input', (e) => {
      TextAdapter.setColor(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-text-align')!;
    alignSel.value = info.textAlign || 'left';
    alignSel.addEventListener('change', (e) => {
      TextAdapter.setAlignment(info.element, (e.target as HTMLSelectElement).value as any, this.viewportMode, info.unit);
      this.events.onChange();
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
      <div class="arch-form-group" style="margin-top:10px;border-top:1px solid var(--arch-border);padding-top:10px;">
        <label class="arch-form-label">Inner Links (&lt;a&gt;) (${anchors.length})</label>
        <div class="arch-inner-links-list" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    `;

    const listEl = holder.querySelector<HTMLElement>('.arch-inner-links-list')!;
    anchors.forEach((aEl, idx) => {
      const card = document.createElement('div');
      card.style.cssText =
        'border:1px solid var(--arch-border);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:5px;background:rgba(13,153,255,0.03);';
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

  private renderDividerElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Divider Line Color</label>
        <input type="color" class="arch-input" id="inp-div-color" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Line Thickness (px)</label>
        <input type="text" class="arch-input" id="inp-div-thickness" placeholder="1px" />
      </div>
    `;

    const colorInp = container.querySelector<HTMLInputElement>('#inp-div-color')!;
    colorInp.value = toHexColor(DividerAdapter.getColor(info.element, info.unit), '#cbd5e1');
    colorInp.addEventListener('input', (e) => {
      DividerAdapter.setColor(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const thickInp = container.querySelector<HTMLInputElement>('#inp-div-thickness')!;
    thickInp.value = DividerAdapter.getThickness(info.element, info.unit);
    thickInp.addEventListener('input', (e) => {
      DividerAdapter.setThickness(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });
  }

  private renderSpacerElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Spacer Height (px)</label>
        <input type="text" class="arch-input" id="inp-spacer-height" placeholder="28px" />
      </div>
    `;

    const heightInp = container.querySelector<HTMLInputElement>('#inp-spacer-height')!;
    heightInp.value = SpacerAdapter.getHeight(info.element, info.unit);
    heightInp.addEventListener('input', (e) => {
      SpacerAdapter.setHeight(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });
  }

  private renderSocialElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const unit = info.unit || info.element;
    const items = SocialAdapter.getItems(unit);

    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Social Icon Links (${items.length})</label>
        <div id="social-items-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        <button type="button" class="arch-btn" id="btn-add-social" style="margin-top:6px;">+ Add Social Icon</button>
      </div>
    `;

    const listEl = container.querySelector<HTMLElement>('#social-items-list')!;
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'border:1px solid var(--arch-border);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:4px;';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;">
          <span>${idx + 1}. ${item.alt || 'Icon'}</span>
          <button type="button" class="arch-btn arch-btn--danger btn-del-social" style="padding:2px 6px;font-size:10px;">✕</button>
        </div>
        <input type="text" class="arch-input inp-social-href" placeholder="https://..." value="${item.href}" />
      `;
      row.querySelector<HTMLInputElement>('.inp-social-href')?.addEventListener('input', (e) => {
        item.anchor.setAttribute('href', (e.target as HTMLInputElement).value);
        this.events.onChange();
      });
      row.querySelector('.btn-del-social')?.addEventListener('click', () => {
        item.anchor.remove();
        this.events.onChange();
        this.renderSocialElementControls(container, info);
      });
      listEl.appendChild(row);
    });

    container.querySelector('#btn-add-social')?.addEventListener('click', () => {
      SocialAdapter.addIcon(unit);
      this.events.onChange();
      this.renderSocialElementControls(container, info);
    });
  }

  private renderSectionElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const targetEl = info.unit || info.element;
    // If targetEl is a `table.row`, background often lives on inner `.row-content` table as well
    const contentTable = targetEl.querySelector<HTMLElement>('.row-content') || targetEl;

    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Background Color</label>
        <input type="color" class="arch-input" id="inp-sec-bg" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Padding</label>
        <input type="text" class="arch-input" id="inp-sec-padding" placeholder="16px 20px" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Row Column Layout</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <button type="button" class="arch-btn" data-col-preset="1-col">1 Col (100%)</button>
          <button type="button" class="arch-btn" data-col-preset="2-col-50-50">2 Col (50/50)</button>
          <button type="button" class="arch-btn" data-col-preset="2-col-33-67">2 Col (33/67)</button>
          <button type="button" class="arch-btn" data-col-preset="2-col-67-33">2 Col (67/33)</button>
          <button type="button" class="arch-btn" data-col-preset="3-col">3 Col (33/33/33)</button>
          <button type="button" class="arch-btn" data-col-preset="4-col">4 Col (25/25/25/25)</button>
        </div>
      </div>
    `;

    const bgInp = container.querySelector<HTMLInputElement>('#inp-sec-bg')!;
    bgInp.value = toHexColor(contentTable.style.backgroundColor || info.backgroundColor, '#ffffff');
    bgInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      contentTable.style.backgroundColor = val;
      if (
        contentTable.tagName.toLowerCase() === 'td' ||
        contentTable.tagName.toLowerCase() === 'table'
      ) {
        contentTable.setAttribute('bgcolor', val);
      }
      info.element.style.backgroundColor = val;
      if (info.element.tagName.toLowerCase() === 'td') {
        info.element.setAttribute('bgcolor', val);
      }
      this.events.onChange();
    });

    const padInp = container.querySelector<HTMLInputElement>('#inp-sec-padding')!;
    padInp.value = info.element.style.padding || targetEl.style.padding || '';
    padInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.style.padding = val;
      this.events.onChange();
    });

    container.querySelectorAll<HTMLButtonElement>('[data-col-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-col-preset') as RowLayoutType;
        ColumnLayoutAdapter.applyRowPreset(targetEl, preset);
        this.events.onChange();
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
    const preheader = doc.settings.preheader || '';
    const widthNum = parseInt(doc.settings.contentWidth, 10) || 600;

    this.element.innerHTML = `
      <div class="arch-accordion">
        <div class="arch-accordion-header" data-toggle="design-settings">
          <span>DESIGN SETTINGS</span>
          <span class="arch-accordion-arrow">▲</span>
        </div>
        <div class="arch-accordion-body" id="sec-design-settings">
          <!-- Content Area Width Slider -->
          <div class="arch-form-row">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
              <label class="arch-form-label" style="margin: 0;">Content area width</label>
              <span class="arch-slider-badge" id="val-doc-width">${doc.settings.contentWidth}</span>
            </div>
            <input type="range" class="arch-range" id="inp-doc-width-range" min="480" max="900" step="10" value="${widthNum}" />
            <input type="text" class="arch-input" id="inp-doc-width" value="${doc.settings.contentWidth}" style="display: none;" />
          </div>

          <!-- Content Area Alignment -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Content area alignment</label>
            <div class="arch-segmented-group" id="grp-doc-align">
              <button type="button" class="arch-segmented-btn ${contentAlign === 'left' ? 'is-active' : ''}" data-align="left">LEFT</button>
              <button type="button" class="arch-segmented-btn ${contentAlign === 'center' ? 'is-active' : ''}" data-align="center">CENTER</button>
            </div>
            <select class="arch-select" id="inp-doc-align" style="display: none;">
              <option value="left" ${contentAlign === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${contentAlign === 'center' ? 'selected' : ''}>Center</option>
            </select>
          </div>

          <!-- Background Color -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Background color</label>
            <div class="arch-color-picker-control">
              <input type="color" class="arch-color-swatch" id="inp-doc-bg" value="${docBg}">
              <input type="text" class="arch-color-hex" id="txt-doc-bg" value="${docBg}">
            </div>
          </div>

          <!-- Content Area Background Color -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Content area background color</label>
            <div class="arch-color-picker-control">
              <input type="color" class="arch-color-swatch" id="inp-doc-content-bg" value="${contentBg}">
              <input type="text" class="arch-color-hex" id="txt-doc-content-bg" value="${contentBg}">
            </div>
          </div>

          <!-- Background Image Switch -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Background image</label>
            <label class="arch-toggle-switch">
              <input type="checkbox" id="chk-doc-bg-img">
              <span class="arch-toggle-slider"></span>
            </label>
          </div>

          <!-- Default Font -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Default font</label>
            <select class="arch-select" id="inp-doc-font" style="max-width: 160px;">
              <option value="Arial, sans-serif">Arial</option>
              <option value="Helvetica, Arial, sans-serif">Helvetica</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="system-ui, -apple-system, sans-serif">System Sans</option>
            </select>
          </div>

          <!-- Link Color -->
          <div class="arch-form-row arch-form-row--split">
            <label class="arch-form-label" style="margin: 0;">Link color</label>
            <div class="arch-color-picker-control">
              <input type="color" class="arch-color-swatch" id="inp-doc-link-color" value="#7747ff">
              <input type="text" class="arch-color-hex" id="txt-doc-link-color" value="#7747ff">
            </div>
          </div>
        </div>

        <!-- Accordion 2: METADATA -->
        <div class="arch-accordion-header" data-toggle="metadata">
          <span>METADATA</span>
          <span class="arch-accordion-arrow">▲</span>
        </div>
        <div class="arch-accordion-body" id="sec-metadata">
          <div class="arch-form-row">
            <label class="arch-form-label" style="margin-bottom: 6px;">Preheader (Preview Text)</label>
            <input type="text" class="arch-input" id="inp-doc-preheader" placeholder="Inbox summary snippet..." value="${preheader}" />
          </div>
          <div class="arch-form-row arch-form-row--split" style="margin-top: 10px;">
            <label class="arch-form-label" style="margin: 0;">Language</label>
            <select class="arch-select" id="sel-doc-lang" style="max-width: 160px;">
              <option value="en">English (en)</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
            </select>
          </div>
        </div>
      </div>
    `;

    // 1. Content Area Width Slider + Text Input Sync
    const rangeInp = this.element.querySelector<HTMLInputElement>('#inp-doc-width-range')!;
    const badge = this.element.querySelector<HTMLElement>('#val-doc-width')!;
    const widthInp = this.element.querySelector<HTMLInputElement>('#inp-doc-width')!;

    rangeInp.addEventListener('input', (e) => {
      const val = `${(e.target as HTMLInputElement).value}px`;
      badge.textContent = val;
      widthInp.value = val;
      doc.settings.contentWidth = val;
      this.events.onChange(true);
    });

    widthInp.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        rangeInp.value = String(parsed);
      }
      badge.textContent = val;
      doc.settings.contentWidth = val;
      this.events.onChange(true);
    });

    // 2. Alignment Toggle Group Sync
    const alignSel = this.element.querySelector<HTMLSelectElement>('#inp-doc-align')!;
    const alignBtns = this.element.querySelectorAll<HTMLButtonElement>('.arch-segmented-btn[data-align]');

    alignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-align') as 'left' | 'center';
        alignBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        alignSel.value = val;
        doc.settings.contentAlign = val;
        this.events.onChange(true);
      });
    });

    alignSel.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as 'left' | 'center';
      alignBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-align') === val));
      doc.settings.contentAlign = val;
      this.events.onChange(true);
    });

    // 3. Background Color Sync (Swatch + Hex Input)
    const bgInp = this.element.querySelector<HTMLInputElement>('#inp-doc-bg')!;
    const bgTxt = this.element.querySelector<HTMLInputElement>('#txt-doc-bg')!;

    bgInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      bgTxt.value = val;
      doc.settings.backgroundColor = val;
      this.events.onChange(true);
    });

    bgTxt.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      bgInp.value = toHexColor(val, '#f4f4f7');
      doc.settings.backgroundColor = val;
      this.events.onChange(true);
    });

    // 4. Content Area Background Color Sync (Swatch + Hex Input)
    const contentBgInp = this.element.querySelector<HTMLInputElement>('#inp-doc-content-bg')!;
    const contentBgTxt = this.element.querySelector<HTMLInputElement>('#txt-doc-content-bg')!;

    contentBgInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      contentBgTxt.value = val;
      doc.settings.contentBackgroundColor = val;
      this.events.onChange(true);
    });

    contentBgTxt.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      contentBgInp.value = toHexColor(val, '#ffffff');
      doc.settings.contentBackgroundColor = val;
      this.events.onChange(true);
    });

    // 5. Default Font Family
    const fontSel = this.element.querySelector<HTMLSelectElement>('#inp-doc-font')!;
    fontSel.value = doc.settings.fontFamily;
    fontSel.addEventListener('change', (e) => {
      doc.settings.fontFamily = (e.target as HTMLSelectElement).value;
      this.events.onChange(true);
    });

    // 6. Preheader Input
    const preheaderInp = this.element.querySelector<HTMLInputElement>('#inp-doc-preheader')!;
    preheaderInp.value = preheader;
    preheaderInp.addEventListener('input', (e) => {
      doc.settings.preheader = (e.target as HTMLInputElement).value;
      this.events.onChange(true);
    });

    // 7. Accordion Collapsible Toggles
    this.element.querySelectorAll<HTMLElement>('.arch-accordion-header[data-toggle]').forEach((header) => {
      header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-toggle');
        const body = this.element.querySelector<HTMLElement>(`#sec-${targetId}`);
        const arrow = header.querySelector<HTMLElement>('.arch-accordion-arrow');
        if (body) {
          const isHidden = body.classList.toggle('is-hidden');
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

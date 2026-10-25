/**
 * Row Inspector Submodule
 * Row & Column structure settings: backgrounds (row & content), background image,
 * content area padding, content area borders, column layout presets, vertical alignment, and mobile stacking.
 * Styled with uniform .arch-rge-row, .arch-rge-label, visual column presets, and reactive state matching Text Properties.
 */

import { SelectedElementInfo, RowLayoutType } from '../../types';
import { ColumnLayoutAdapter } from '../../engine/adapters';
import {
  toHexColor,
  renderStepper,
  bindStepper,
  renderColorPicker,
  bindColorPicker
} from './InspectorControls';

export interface RowInspectorEvents {
  onChange: () => void;
  openAssetsPanel?: (onSelect: (url: string) => void) => void;
}

export class RowInspector {
  private events: RowInspectorEvents;

  constructor(events: RowInspectorEvents) {
    this.events = events;
  }

  /**
   * Helper to detect active layout preset from column count & widths
   */
  private detectPreset(targetEl: HTMLElement): RowLayoutType {
    const cols = ColumnLayoutAdapter.getColumnsInRow(targetEl);
    if (cols.length === 1) return '1-col';
    if (cols.length === 3) return '3-col';
    if (cols.length === 4) return '4-col';
    if (cols.length === 2) {
      const w0 = parseFloat(cols[0].style.width || cols[0].getAttribute('width') || '50');
      if (w0 < 40) return '2-col-33-67';
      if (w0 > 60) return '2-col-67-33';
      return '2-col-50-50';
    }
    return '1-col';
  }

  public renderSectionElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    const targetEl = info.unit || info.element;
    const contentTable = targetEl.querySelector<HTMLElement>('.row-content') || targetEl;
    const rowBg = toHexColor(targetEl.style.backgroundColor, '#ffffff');
    const contentBg = toHexColor(contentTable.style.backgroundColor || info.backgroundColor, '#ffffff');

    // Background Image
    const bgImg = targetEl.style.backgroundImage || contentTable.style.backgroundImage || '';
    const hasBgImg = !!bgImg && bgImg !== 'none';
    const bgUrlMatch = bgImg.match(/url\(['"]?(.*?)['"]?\)/);
    const bgImgUrl = bgUrlMatch ? bgUrlMatch[1] : (targetEl.getAttribute('background') || '');

    // Content area padding
    const contentPad = parseInt(contentTable.style.padding || '10', 10) || 10;

    // Border
    const hasBorder = !!contentTable.style.borderWidth && contentTable.style.borderWidth !== '0px';
    const borderStyle = contentTable.style.borderStyle || 'solid';
    const borderWidth = parseInt(contentTable.style.borderWidth, 10) || 1;
    const borderColor = toHexColor(contentTable.style.borderColor, '#e5e7eb');
    const borderRadius = parseInt(contentTable.style.borderRadius, 10) || 0;

    // Vertical Align
    const cols = ColumnLayoutAdapter.getColumnsInRow(targetEl);
    const firstCol = cols[0] || contentTable.querySelector<HTMLElement>('td.column');
    const vAlign = (firstCol?.style.verticalAlign || firstCol?.getAttribute('valign') || 'top').toLowerCase();

    // Stack on mobile
    const isStacked = !targetEl.classList.contains('mobile_no_stack');

    // Active preset
    const activePreset = this.detectPreset(targetEl);

    container.innerHTML = `
      <div class="arch-rge-row">
        <label class="arch-rge-label">Row background</label>
        ${renderColorPicker('swatch-row-bg', 'txt-row-bg', rowBg)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Content background</label>
        ${renderColorPicker('swatch-row-cnt-bg', 'txt-row-cnt-bg', contentBg)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Background image</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-row-bg-img" ${hasBgImg ? 'checked' : ''} />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div class="arch-rge-row" id="row-bg-img-url-box" style="display: ${hasBgImg ? 'flex' : 'none'};">
        <label class="arch-rge-label">Image URL</label>
        <div style="display: flex; gap: 6px; align-items: center; width: 175px;">
          <input type="text" class="arch-input" id="txt-row-bg-url" value="${bgImgUrl}" placeholder="https://..." style="flex: 1; font-size: 12px; padding: 5px 8px; height: 32px;" />
          <button type="button" class="arch-btn arch-btn--sm" id="btn-row-bg-browse" style="padding: 0 8px; font-size: 11px; height: 32px; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Browse</span>
          </button>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Content area padding</label>
        ${renderStepper('stp-row-pad', contentPad, 0, 100, 5)}
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Content area border</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-row-border" ${hasBorder ? 'checked' : ''} />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div id="row-border-controls" style="display: ${hasBorder ? 'block' : 'none'};">
        <div class="arch-rge-row">
          <label class="arch-rge-label">Border style</label>
          <select class="arch-rge-select" id="sel-row-border-style">
            <option value="solid" ${borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
            <option value="dashed" ${borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
            <option value="dotted" ${borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
          </select>
        </div>

        <div class="arch-rge-row">
          <label class="arch-rge-label">Border width</label>
          ${renderStepper('stp-row-border-w', borderWidth, 1, 20, 1)}
        </div>

        <div class="arch-rge-row">
          <label class="arch-rge-label">Border color</label>
          ${renderColorPicker('swatch-row-border-col', 'txt-row-border-col', borderColor)}
        </div>

        <div class="arch-rge-row">
          <label class="arch-rge-label">Rounded corners</label>
          ${renderStepper('stp-row-radius', borderRadius, 0, 50, 1)}
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Vertical align</label>
        <div class="arch-segmented-group grp-row-valign">
          <button type="button" class="arch-segmented-btn ${vAlign === 'top' ? 'is-active' : ''}" data-valign="top">Top</button>
          <button type="button" class="arch-segmented-btn ${vAlign === 'middle' ? 'is-active' : ''}" data-valign="middle">Middle</button>
          <button type="button" class="arch-segmented-btn ${vAlign === 'bottom' ? 'is-active' : ''}" data-valign="bottom">Bottom</button>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Stack on mobile</label>
        <label class="arch-toggle-switch">
          <input type="checkbox" id="chk-row-stack" ${isStacked ? 'checked' : ''} />
          <span class="arch-toggle-slider"></span>
        </label>
      </div>

      <div class="arch-rge-row" style="flex-direction: column; align-items: stretch; gap: 8px; min-height: auto; padding: 13px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label class="arch-rge-label" style="font-weight: 600;">Column layout</label>
          <span style="font-size: 11px; color: #94a3b8;">${cols.length} column${cols.length > 1 ? 's' : ''}</span>
        </div>
        <div class="arch-col-preset-grid">
          <button type="button" class="arch-col-preset-btn ${activePreset === '1-col' ? 'is-active' : ''}" data-col-preset="1-col" title="1 Column (100%)">
            <span class="arch-col-preset-preview"><span style="width: 100%;"></span></span>
            <span class="arch-col-preset-title">1 Col</span>
          </button>
          <button type="button" class="arch-col-preset-btn ${activePreset === '2-col-50-50' ? 'is-active' : ''}" data-col-preset="2-col-50-50" title="2 Columns (50% / 50%)">
            <span class="arch-col-preset-preview"><span style="width: 50%;"></span><span style="width: 50%;"></span></span>
            <span class="arch-col-preset-title">50 / 50</span>
          </button>
          <button type="button" class="arch-col-preset-btn ${activePreset === '2-col-33-67' ? 'is-active' : ''}" data-col-preset="2-col-33-67" title="2 Columns (33% / 67%)">
            <span class="arch-col-preset-preview"><span style="width: 33%;"></span><span style="width: 67%;"></span></span>
            <span class="arch-col-preset-title">33 / 67</span>
          </button>
          <button type="button" class="arch-col-preset-btn ${activePreset === '2-col-67-33' ? 'is-active' : ''}" data-col-preset="2-col-67-33" title="2 Columns (67% / 33%)">
            <span class="arch-col-preset-preview"><span style="width: 67%;"></span><span style="width: 33%;"></span></span>
            <span class="arch-col-preset-title">67 / 33</span>
          </button>
          <button type="button" class="arch-col-preset-btn ${activePreset === '3-col' ? 'is-active' : ''}" data-col-preset="3-col" title="3 Columns (Equal)">
            <span class="arch-col-preset-preview"><span style="width: 33.3%;"></span><span style="width: 33.3%;"></span><span style="width: 33.3%;"></span></span>
            <span class="arch-col-preset-title">3 Col</span>
          </button>
          <button type="button" class="arch-col-preset-btn ${activePreset === '4-col' ? 'is-active' : ''}" data-col-preset="4-col" title="4 Columns (Equal)">
            <span class="arch-col-preset-preview"><span style="width: 25%;"></span><span style="width: 25%;"></span><span style="width: 25%;"></span><span style="width: 25%;"></span></span>
            <span class="arch-col-preset-title">4 Col</span>
          </button>
        </div>
      </div>
    `;

    // Row Background Color
    bindColorPicker(container, 'swatch-row-bg', 'txt-row-bg', (val, isCommit) => {
      targetEl.style.backgroundColor = val;
      if (targetEl.tagName.toLowerCase() === 'table' || targetEl.tagName.toLowerCase() === 'td') {
        targetEl.setAttribute('bgcolor', val);
      }
      if (isCommit !== false) this.events.onChange();
    });

    // Content Background Color
    bindColorPicker(container, 'swatch-row-cnt-bg', 'txt-row-cnt-bg', (val, isCommit) => {
      contentTable.style.backgroundColor = val;
      if (contentTable.tagName.toLowerCase() === 'table' || contentTable.tagName.toLowerCase() === 'td') {
        contentTable.setAttribute('bgcolor', val);
      }
      if (isCommit !== false) this.events.onChange();
    });

    // Background Image Toggle & URL
    const chkBgImg = container.querySelector<HTMLInputElement>('#chk-row-bg-img');
    const bgUrlBox = container.querySelector<HTMLElement>('#row-bg-img-url-box');
    const txtBgUrl = container.querySelector<HTMLInputElement>('#txt-row-bg-url');
    const btnBrowse = container.querySelector<HTMLButtonElement>('#btn-row-bg-browse');

    const updateBgImage = (url: string) => {
      if (url.trim()) {
        targetEl.style.backgroundImage = `url('${url.trim()}')`;
        targetEl.style.backgroundRepeat = 'no-repeat';
        targetEl.style.backgroundPosition = 'center top';
        targetEl.style.backgroundSize = 'cover';
        targetEl.setAttribute('background', url.trim());
      } else {
        targetEl.style.backgroundImage = 'none';
        targetEl.removeAttribute('background');
      }
      this.events.onChange();
    };

    chkBgImg?.addEventListener('change', () => {
      if (bgUrlBox) bgUrlBox.style.display = chkBgImg.checked ? 'flex' : 'none';
      if (!chkBgImg.checked) {
        updateBgImage('');
      } else if (txtBgUrl && txtBgUrl.value) {
        updateBgImage(txtBgUrl.value);
      }
    });

    txtBgUrl?.addEventListener('input', () => {
      if (chkBgImg?.checked) {
        updateBgImage(txtBgUrl.value);
      }
    });

    btnBrowse?.addEventListener('click', () => {
      this.events.openAssetsPanel?.((selectedUrl) => {
        if (txtBgUrl) txtBgUrl.value = selectedUrl;
        if (chkBgImg) chkBgImg.checked = true;
        if (bgUrlBox) bgUrlBox.style.display = 'flex';
        updateBgImage(selectedUrl);
      });
    });

    // Content Area Padding
    bindStepper(container, 'stp-row-pad', (val) => {
      contentTable.style.padding = `${val}px`;
      this.events.onChange();
    });

    // Border Switch & Controls
    const chkBorder = container.querySelector<HTMLInputElement>('#chk-row-border');
    const borderControls = container.querySelector<HTMLElement>('#row-border-controls');
    const selBorderStyle = container.querySelector<HTMLSelectElement>('#sel-row-border-style');

    const applyBorder = (shouldCommit = true) => {
      if (chkBorder?.checked) {
        const style = selBorderStyle?.value || 'solid';
        const wInp = container.querySelector<HTMLInputElement>('#stp-row-border-w');
        const w = parseInt(wInp?.value || '1', 10) || 1;
        const colInp = container.querySelector<HTMLInputElement>('#txt-row-border-col');
        const col = colInp?.value || '#e5e7eb';
        contentTable.style.border = `${w}px ${style} ${col}`;
      } else {
        contentTable.style.border = 'none';
      }
      if (shouldCommit) {
        this.events.onChange();
      }
    };

    chkBorder?.addEventListener('change', () => {
      if (borderControls) borderControls.style.display = chkBorder.checked ? 'block' : 'none';
      applyBorder(true);
    });

    selBorderStyle?.addEventListener('change', () => {
      if (chkBorder?.checked) applyBorder(true);
    });

    bindStepper(container, 'stp-row-border-w', () => {
      if (chkBorder?.checked) applyBorder(true);
    });

    bindColorPicker(container, 'swatch-row-border-col', 'txt-row-border-col', (_val, isCommit) => {
      if (chkBorder?.checked) applyBorder(isCommit !== false);
    });

    bindStepper(container, 'stp-row-radius', (val) => {
      contentTable.style.borderRadius = `${val}px`;
      this.events.onChange();
    });

    // Vertical Align
    const vAlignBtns = container.querySelectorAll<HTMLButtonElement>('.grp-row-valign button');
    vAlignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-valign') || 'top';
        vAlignBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        const currentCols = ColumnLayoutAdapter.getColumnsInRow(targetEl);
        currentCols.forEach((col) => {
          col.style.verticalAlign = val;
          col.setAttribute('valign', val);
        });
        this.events.onChange();
      });
    });

    // Stack on Mobile Toggle
    const chkStack = container.querySelector<HTMLInputElement>('#chk-row-stack');
    chkStack?.addEventListener('change', () => {
      if (chkStack.checked) {
        targetEl.classList.remove('mobile_no_stack');
        targetEl.classList.add('mobile_stack');
      } else {
        targetEl.classList.remove('mobile_stack');
        targetEl.classList.add('mobile_no_stack');
      }
      this.events.onChange();
    });

    // Column Layout Presets
    container.querySelectorAll<HTMLButtonElement>('[data-col-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-col-preset') as RowLayoutType;
        container.querySelectorAll('[data-col-preset]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        ColumnLayoutAdapter.applyRowPreset(targetEl, preset);
        this.events.onChange();
      });
    });
  }
}

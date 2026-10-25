/**
 * Document Inspector Submodule
 * Global email settings: canvas width, alignment, background color,
 * content area background, typography defaults, and preheader metadata.
 */

import { EmailDocument } from '../../types';
import {
  toHexColor,
  renderStepper,
  bindStepper,
  renderColorPicker,
  bindColorPicker
} from './InspectorControls';

export interface DocumentInspectorEvents {
  onChange: (isDocumentSetting?: boolean) => void;
}

export class DocumentInspector {
  private element: HTMLElement;
  private events: DocumentInspectorEvents;
  private docAccordionOpen: Record<string, boolean> = {
    'design-settings': true,
    'typography-settings': false,
    'metadata': false
  };

  constructor(element: HTMLElement, events: DocumentInspectorEvents) {
    this.element = element;
    this.events = events;
  }

  public renderDocumentSettings(doc: EmailDocument): void {
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
                ${renderStepper('stp-doc-width', widthNum, 320, 1200, 10)}
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
            ${renderColorPicker('inp-doc-bg', 'txt-doc-bg', docBg)}
          </div>

          <!-- Content Area Background Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Content area background</label>
            ${renderColorPicker('inp-doc-content-bg', 'txt-doc-content-bg', contentBg)}
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
            ${renderColorPicker('inp-doc-text-color', 'txt-doc-text-color', textColor)}
          </div>

          <!-- Link Color -->
          <div class="arch-rge-row">
            <label class="arch-rge-label">Link color</label>
            ${renderColorPicker('inp-doc-link-color', 'txt-doc-link-color', '#7747ff')}
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
            ${renderStepper('stp-doc-spacing', 0, -2, 10, 1)}
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

    bindStepper(this.element, 'stp-doc-width', (val) => {
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
    bindColorPicker(this.element, 'inp-doc-bg', 'txt-doc-bg', (val) => {
      doc.settings.backgroundColor = val;
      this.events.onChange(true);
    });

    // 4. Content Area Background Color Sync
    bindColorPicker(this.element, 'inp-doc-content-bg', 'txt-doc-content-bg', (val) => {
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
    bindColorPicker(this.element, 'inp-doc-text-color', 'txt-doc-text-color', (val) => {
      doc.settings.textColor = val;
      this.events.onChange(true);
    });

    // 8. Link Color Sync
    bindColorPicker(this.element, 'inp-doc-link-color', 'txt-doc-link-color', () => {
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
}

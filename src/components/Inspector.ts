/**
 * Arch Email Editor - Contextual Inspector Component
 *
 * Renders the right sidebar property controls:
 * 1. Element Inspector (active when an email element is clicked in the canvas):
 *    - Image: Image URL, Alt text, alignment, width.
 *    - Button / Link: Button Label, Link URL, Button Color, Text Color, Border Radius.
 *    - Heading / Text: Text Content, Font Size, Text Color, Alignment.
 *    - Section / Table: Background Color, Padding.
 *    - Delete Element button: deletes the element from the email template.
 * 2. Block Inspector (for AST block compatibility).
 * 3. Document Settings (when nothing is selected):
 *    - Background Color, Content Width, Base Font Family.
 *
 * All inputs update the live DOM node synchronously with zero latency.
 */

import { EmailDocument, BlockNode, SelectedElementInfo } from '../types';

export interface InspectorEvents {
  onChange: () => void;
  onRemoveBlock?: (id: string) => void;
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

  constructor(events: InspectorEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__inspector';
  }

  public getElement(): HTMLElement {
    return this.element;
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
      ? doc.blocks.find(b => b.id === selectedBlockId) || null
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
    const typeTitle = info.type.toUpperCase();
    this.element.innerHTML = `
      <div class="arch-editor__section-label">Element Properties (${typeTitle})</div>
      <div id="inspector-element-fields"></div>
      <div class="arch-form-group" style="margin-top: 18px;">
        <button class="arch-btn arch-btn--danger" id="btn-delete-element" type="button" style="width: 100%;">
          Delete Element
        </button>
      </div>
    `;

    const deleteBtn = this.element.querySelector('#btn-delete-element');
    deleteBtn?.addEventListener('click', () => {
      info.element.remove();
      this.events.onChange();
      this.element.innerHTML = `
        <div class="arch-editor__section-label">Element Deleted</div>
        <p style="font-size: 13px; color: var(--arch-text-secondary); margin-top: 8px;">
          Element was removed from the email template.
        </p>
      `;
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
        <label class="arch-form-label">Max Width</label>
        <input type="text" class="arch-input" id="inp-img-width" placeholder="100% or 600px" />
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
    srcInp.value = info.element.getAttribute('src') || '';
    srcInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.setAttribute('src', val);
      this.events.onChange();
    });

    const altInp = container.querySelector<HTMLInputElement>('#inp-img-alt')!;
    altInp.value = info.element.getAttribute('alt') || '';
    altInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.setAttribute('alt', val);
      this.events.onChange();
    });

    const widthInp = container.querySelector<HTMLInputElement>('#inp-img-width')!;
    widthInp.value = info.element.style.maxWidth || info.element.getAttribute('width') || '';
    widthInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.style.maxWidth = val;
      if (val.endsWith('px')) {
        info.element.setAttribute('width', val.replace('px', ''));
      }
      this.events.onChange();
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-img-align')!;
    alignSel.value = info.textAlign || 'center';
    alignSel.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (info.element.parentElement) {
        info.element.parentElement.style.textAlign = val;
      }
      info.element.style.textAlign = val;
      this.events.onChange();
    });
  }

  private renderButtonElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Button Label</label>
        <input type="text" class="arch-input" id="inp-btn-label" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Target Link URL</label>
        <input type="text" class="arch-input" id="inp-btn-url" placeholder="https://..." />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Button Background Color</label>
        <input type="color" class="arch-input" id="inp-btn-bg" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Button Text Color</label>
        <input type="color" class="arch-input" id="inp-btn-color" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Border Radius</label>
        <input type="text" class="arch-input" id="inp-btn-radius" placeholder="6px" />
      </div>
    `;

    const labelInp = container.querySelector<HTMLInputElement>('#inp-btn-label')!;
    labelInp.value = info.element.textContent?.trim() || '';
    labelInp.addEventListener('input', (e) => {
      info.element.textContent = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const urlInp = container.querySelector<HTMLInputElement>('#inp-btn-url')!;
    urlInp.value = info.element.getAttribute('href') || '';
    urlInp.addEventListener('input', (e) => {
      info.element.setAttribute('href', (e.target as HTMLInputElement).value);
      this.events.onChange();
    });

    const bgInp = container.querySelector<HTMLInputElement>('#inp-btn-bg')!;
    bgInp.value = toHexColor(info.backgroundColor, '#2563eb');
    bgInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.style.backgroundColor = val;
      const parentTd = info.element.closest('td');
      if (parentTd) {
        parentTd.setAttribute('bgcolor', val);
        parentTd.style.backgroundColor = val;
      }
      this.events.onChange();
    });

    const colorInp = container.querySelector<HTMLInputElement>('#inp-btn-color')!;
    colorInp.value = toHexColor(info.color, '#ffffff');
    colorInp.addEventListener('input', (e) => {
      info.element.style.color = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const radiusInp = container.querySelector<HTMLInputElement>('#inp-btn-radius')!;
    radiusInp.value = info.element.style.borderRadius || '6px';
    radiusInp.addEventListener('input', (e) => {
      info.element.style.borderRadius = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });
  }

  private renderTextElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Text Content</label>
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
    `;

    const copyInp = container.querySelector<HTMLTextAreaElement>('#inp-text-copy')!;
    copyInp.value = info.element.textContent || '';
    copyInp.addEventListener('input', (e) => {
      info.element.textContent = (e.target as HTMLTextAreaElement).value;
      this.events.onChange();
    });

    const sizeInp = container.querySelector<HTMLInputElement>('#inp-text-size')!;
    sizeInp.value = info.fontSize || '';
    sizeInp.addEventListener('input', (e) => {
      info.element.style.fontSize = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const colorInp = container.querySelector<HTMLInputElement>('#inp-text-color')!;
    colorInp.value = toHexColor(info.color, '#0f172a');
    colorInp.addEventListener('input', (e) => {
      info.element.style.color = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-text-align')!;
    alignSel.value = info.textAlign || 'left';
    alignSel.addEventListener('change', (e) => {
      info.element.style.textAlign = (e.target as HTMLSelectElement).value;
      this.events.onChange();
    });
  }

  private renderSectionElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    container.innerHTML = `
      <div class="arch-form-group">
        <label class="arch-form-label">Section Background Color</label>
        <input type="color" class="arch-input" id="inp-sec-bg" />
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Padding</label>
        <input type="text" class="arch-input" id="inp-sec-padding" placeholder="16px 20px" />
      </div>
    `;

    const bgInp = container.querySelector<HTMLInputElement>('#inp-sec-bg')!;
    bgInp.value = toHexColor(info.backgroundColor, '#ffffff');
    bgInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      info.element.style.backgroundColor = val;
      if (info.element.tagName.toLowerCase() === 'td') {
        info.element.setAttribute('bgcolor', val);
      }
      this.events.onChange();
    });

    const padInp = container.querySelector<HTMLInputElement>('#inp-sec-padding')!;
    padInp.value = info.element.style.padding || '';
    padInp.addEventListener('input', (e) => {
      info.element.style.padding = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });
  }

  /**
   * Renders global newsletter settings.
   */
  private renderDocumentSettings(doc: EmailDocument): void {
    this.element.innerHTML = `
      <div class="arch-editor__section-label">Email Settings</div>
      <div class="arch-form-group">
        <label class="arch-form-label">Background Color</label>
        <input type="color" class="arch-input" id="inp-doc-bg">
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Content Width</label>
        <input type="text" class="arch-input" id="inp-doc-width" placeholder="600px">
      </div>
      <div class="arch-form-group">
        <label class="arch-form-label">Font Family</label>
        <select class="arch-select" id="inp-doc-font">
          <option value="Arial, sans-serif">Arial</option>
          <option value="Helvetica, Arial, sans-serif">Helvetica</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', Times, serif">Times New Roman</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="system-ui, -apple-system, sans-serif">System Sans</option>
        </select>
      </div>
      <p style="font-size: 12px; color: var(--arch-text-secondary); margin-top: 14px; line-height: 1.5;">
        💡 Click any element on the canvas to inspect and customize its individual properties.
      </p>
    `;

    const bgInp = this.element.querySelector<HTMLInputElement>('#inp-doc-bg')!;
    bgInp.value = toHexColor(doc.settings.backgroundColor, '#f4f4f7');
    bgInp.addEventListener('input', (e) => {
      doc.settings.backgroundColor = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const widthInp = this.element.querySelector<HTMLInputElement>('#inp-doc-width')!;
    widthInp.value = doc.settings.contentWidth;
    widthInp.addEventListener('change', (e) => {
      doc.settings.contentWidth = (e.target as HTMLInputElement).value;
      this.events.onChange();
    });

    const fontSel = this.element.querySelector<HTMLSelectElement>('#inp-doc-font')!;
    fontSel.value = doc.settings.fontFamily;
    fontSel.addEventListener('change', (e) => {
      doc.settings.fontFamily = (e.target as HTMLSelectElement).value;
      this.events.onChange();
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

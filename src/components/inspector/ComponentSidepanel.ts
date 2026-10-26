/**
 * Arch Email Editor - Component Sidepanel Submodule
 * Sliding drawer panel displaying proportionally scaled component preview inside an isolated iframe and name input.
 */

import { isOuterWrapperTable, isRowElement } from '../../engine/units';

export interface ComponentSidepanelOptions {
  container: HTMLElement;
}

export interface OpenComponentPanelParams {
  unit: HTMLElement;
  element?: HTMLElement;
  type?: string;
  defaultName?: string;
}

/**
 * Resolves the target element representing the selected component.
 * Targets only the selected component/element (or row if a row was selected),
 * never climbing to the full email template or outer wrapper table.
 */
function resolveComponentTarget(unit: HTMLElement, element?: HTMLElement): HTMLElement {
  const target = unit || element;
  if (!target || !target.tagName) return unit;

  const tag = target.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html' || isOuterWrapperTable(target)) {
    return element || unit;
  }

  return target;
}

/**
 * Extracts clean, email-safe HTML from a DOM element, stripping editor HUD classes.
 */
function extractCleanHtml(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;

  // Remove editor-internal helper classes and attributes
  const removeClasses = [
    'arch-selected-element',
    'arch-hover-element',
    'arch-editing-text',
    'arch-dragging-source',
    'arch-col-displace-ready',
    'arch-col-flip-invert',
    'arch-has-hovered-child'
  ];

  clone.classList.remove(...removeClasses);
  clone.querySelectorAll('*').forEach((node) => {
    node.classList.remove(...removeClasses);
    node.removeAttribute('contenteditable');
    node.removeAttribute('data-arch-id');
  });

  return clone.outerHTML;
}

/**
 * Wraps extracted HTML into compliant table structures for isolated iframe rendering.
 */
function wrapForPreview(cleanHtml: string, targetComponent: HTMLElement): { html: string; isFullRow: boolean } {
  const tag = targetComponent.tagName ? targetComponent.tagName.toLowerCase() : '';
  const isRow = isRowElement(targetComponent) || (tag === 'table' && targetComponent.classList.contains('row'));

  if (tag === 'tr') {
    return {
      html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 0 auto;"><tbody>${cleanHtml}</tbody></table>`,
      isFullRow: true
    };
  }
  if (tag === 'td' || tag === 'th') {
    return {
      html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 0 auto;"><tbody><tr>${cleanHtml}</tr></tbody></table>`,
      isFullRow: false
    };
  }
  if (!isRow && tag !== 'table') {
    return {
      html: `<div style="padding: 16px; display: flex; justify-content: center; align-items: center; width: 100%;">${cleanHtml}</div>`,
      isFullRow: false
    };
  }

  return { html: cleanHtml, isFullRow: isRow };
}

export class ComponentSidepanel {
  private container: HTMLElement;

  constructor(options: ComponentSidepanelOptions) {
    this.container = options.container;
  }

  public openComponentPanel(params: OpenComponentPanelParams): void {
    const existing = this.container.querySelector('.arch-component-sidepanel');
    if (existing) existing.remove();

    this.container.style.overflow = 'hidden';

    // 1. Resolve exact selected component (not full template) and extract clean HTML
    const targetComponent = resolveComponentTarget(params.unit, params.element);
    const cleanHtml = extractCleanHtml(targetComponent);
    const { html: previewHtml, isFullRow } = wrapForPreview(cleanHtml, targetComponent);

    // 2. Generate initial default name based on component type
    const typeLabel = (params.type || 'Component').charAt(0).toUpperCase() + (params.type || 'Component').slice(1);
    const initialName = params.defaultName || `${typeLabel} Component`;

    const panel = document.createElement('div');
    panel.className = 'arch-component-sidepanel';
    panel.innerHTML = `
      <div class="arch-prop-header arch-component-header">
        <div class="arch-prop-title">Component</div>
        <div class="arch-prop-actions">
          <button type="button" class="arch-icon-btn" id="btn-component-close" title="Close Component Panel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div class="arch-component-body">
        <div class="arch-component-preview-label">Preview</div>
        <div class="arch-component-preview-wrap">
          <iframe
            class="arch-component-preview-iframe"
            id="arch-component-preview-iframe"
            tabindex="-1"
            title="Component Preview"
          ></iframe>
        </div>
      </div>

      <div class="arch-component-footer">
        <label class="arch-component-name-label" for="inp-component-name">Component Name</label>
        <div class="arch-component-input-wrap">
          <input
            type="text"
            class="arch-component-name-input"
            id="inp-component-name"
            placeholder="Enter component name..."
            value="${initialName}"
          />
        </div>
      </div>
    `;

    this.container.appendChild(panel);

    // 3. Render clean preview HTML inside the isolated iframe with dynamic proportional scaling
    const iframe = panel.querySelector<HTMLIFrameElement>('#arch-component-preview-iframe');
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                * { box-sizing: border-box; }
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  height: 100%;
                  background: #f1f5f9;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden;
                }
                #preview-viewport {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden;
                  padding: 10px;
                  box-sizing: border-box;
                }
                #preview-scaler {
                  width: 600px;
                  max-width: 600px;
                  transform-origin: center center;
                  margin: 0 auto;
                  pointer-events: none;
                  user-select: none;
                  background: #ffffff;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                  border-radius: 4px;
                  overflow: hidden;
                  transition: transform 0.15s ease-out;
                }
                img {
                  max-width: 100% !important;
                  height: auto !important;
                }
                .arch-selected-element, .arch-hover-element {
                  outline: none !important;
                }
              </style>
            </head>
            <body>
              <div id="preview-viewport">
                <div id="preview-scaler" data-full-row="${isFullRow ? 'true' : 'false'}">
                  ${previewHtml}
                </div>
              </div>
              <script>
                function updateScale() {
                  var viewport = document.getElementById('preview-viewport');
                  var scaler = document.getElementById('preview-scaler');
                  if (!viewport || !scaler) return;

                  var availW = viewport.clientWidth - 16;
                  var availH = viewport.clientHeight - 16;
                  if (availW <= 0 || availH <= 0) return;

                  var isFullRow = scaler.getAttribute('data-full-row') === 'true';
                  var naturalW = 600;

                  if (!isFullRow) {
                    var firstEl = scaler.firstElementChild;
                    if (firstEl) {
                      var elW = firstEl.offsetWidth || firstEl.scrollWidth;
                      if (elW > 0 && elW < 520) {
                        naturalW = Math.max(elW + 20, 200);
                        scaler.style.width = naturalW + 'px';
                      }
                    }
                  } else {
                    scaler.style.width = '600px';
                  }

                  var naturalH = scaler.scrollHeight || scaler.offsetHeight || 120;
                  var scaleW = availW / naturalW;
                  var scaleH = availH / Math.max(naturalH, 1);
                  var scale = Math.min(scaleW, scaleH);

                  scale = Math.min(1.0, Math.max(0.15, scale));
                  scaler.style.transform = 'scale(' + scale + ')';
                }

                window.addEventListener('resize', updateScale);
                setTimeout(updateScale, 20);
                setTimeout(updateScale, 100);
                setTimeout(updateScale, 300);
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
    }

    const closeBtn = panel.querySelector<HTMLButtonElement>('#btn-component-close');
    const nameInput = panel.querySelector<HTMLInputElement>('#inp-component-name');

    const closePanel = () => {
      panel.classList.remove('is-open');
      this.container.style.overflow = '';
      setTimeout(() => {
        panel.remove();
      }, 260);
    };

    closeBtn?.addEventListener('click', closePanel);

    requestAnimationFrame(() => {
      this.container.scrollTop = 0;
      this.container.style.overflow = 'hidden';
      panel.classList.add('is-open');

      // Trigger scale calculation when transition kicks in
      setTimeout(() => {
        try {
          const win = iframe?.contentWindow as any;
          if (win && win.updateScale) {
            win.updateScale();
          }
        } catch (e) {}
      }, 100);

      // Focus name input after slide animation begins
      setTimeout(() => {
        nameInput?.focus();
        nameInput?.select();
      }, 150);
    });
  }
}

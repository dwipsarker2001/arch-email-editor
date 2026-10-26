/**
 * Arch Email Editor - Component Sidepanel Submodule
 * Sliding drawer panel displaying a full-width rectangular component preview inside an isolated iframe and name input.
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
 * Wraps extracted HTML into a compliant full-width row table structure
 * so it renders as a realistic rectangular block spanning edge-to-edge.
 */
function wrapForPreview(cleanHtml: string, targetComponent: HTMLElement): string {
  const tag = targetComponent.tagName ? targetComponent.tagName.toLowerCase() : '';
  const isRow = isRowElement(targetComponent) || (tag === 'table' && targetComponent.classList.contains('row'));

  if (tag === 'tr') {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" class="row" style="width: 100%; border-collapse: collapse; margin: 0 auto;"><tbody>${cleanHtml}</tbody></table>`;
  }
  if (tag === 'td' || tag === 'th') {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" class="row" style="width: 100%; border-collapse: collapse; margin: 0 auto;"><tbody><tr>${cleanHtml}</tr></tbody></table>`;
  }
  if (!isRow && tag !== 'table') {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" class="row" style="width: 100%; border-collapse: collapse; margin: 0 auto; background: #ffffff;"><tr><td align="center" style="padding: 24px 20px;">${cleanHtml}</td></tr></table>`;
  }

  return cleanHtml;
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

    // 1. Resolve exact selected component and wrap as a full-width rectangular block
    const targetComponent = resolveComponentTarget(params.unit, params.element);
    const cleanHtml = extractCleanHtml(targetComponent);
    const previewHtml = wrapForPreview(cleanHtml, targetComponent);

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

    // 3. Render clean preview HTML inside the isolated iframe with edge-to-edge full-width rectangular scaling
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
                  background: #ffffff;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  overflow-x: hidden;
                  overflow-y: auto;
                }
                #preview-viewport {
                  width: 100%;
                  overflow: hidden;
                  background: #ffffff;
                }
                #preview-scaler {
                  width: 600px;
                  min-width: 600px;
                  transform-origin: top left;
                  pointer-events: none;
                  user-select: none;
                  background: #ffffff;
                  transition: transform 0.15s ease-out;
                }
                table {
                  width: 100% !important;
                  margin: 0 !important;
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
                <div id="preview-scaler">
                  ${previewHtml}
                </div>
              </div>
              <script>
                function updateScale() {
                  var viewport = document.getElementById('preview-viewport');
                  var scaler = document.getElementById('preview-scaler');
                  if (!viewport || !scaler) return;

                  var availW = viewport.clientWidth;
                  if (availW <= 0) return;

                  // Full-width edge-to-edge rectangular scale matching container width
                  var scale = availW / 600;
                  scaler.style.transform = 'scale(' + scale + ')';

                  // Adapt height to the scaled content height
                  var naturalH = scaler.scrollHeight || scaler.offsetHeight || 100;
                  var scaledH = Math.ceil(naturalH * scale);
                  viewport.style.height = scaledH + 'px';
                  document.body.style.height = scaledH + 'px';

                  try {
                    if (window.frameElement) {
                      window.frameElement.style.height = Math.max(scaledH, 120) + 'px';
                    }
                  } catch (e) {}
                }

                window.addEventListener('resize', updateScale);
                setTimeout(updateScale, 20);
                setTimeout(updateScale, 100);
                setTimeout(updateScale, 250);
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

/**
 * Arch Email Editor - Component Sidepanel Submodule
 * Sliding drawer panel displaying component preview and name input.
 */

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
 * Resolves the enclosing Section / Row for the selected unit,
 * ensuring the full row layout and background styling are captured.
 */
function resolveEnclosingSection(unit: HTMLElement): HTMLElement {
  const row = unit.closest('table.row, [data-arch-row], .row') as HTMLElement | null;
  if (row) return row;
  const table = unit.closest('table') as HTMLElement | null;
  if (table && table.offsetWidth > 300) return table;
  return unit;
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

export class ComponentSidepanel {
  private container: HTMLElement;

  constructor(options: ComponentSidepanelOptions) {
    this.container = options.container;
  }

  public openComponentPanel(params: OpenComponentPanelParams): void {
    const existing = this.container.querySelector('.arch-component-sidepanel');
    if (existing) existing.remove();

    this.container.style.overflow = 'hidden';

    // 1. Resolve enclosing Section/Row and clean HTML
    const targetSection = resolveEnclosingSection(params.unit);
    const cleanHtml = extractCleanHtml(targetSection);

    // 2. Generate initial default name
    const typeLabel = (params.type || 'Section').charAt(0).toUpperCase() + (params.type || 'Section').slice(1);
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
          <div class="arch-component-preview-stage" id="arch-component-preview-stage">
            ${cleanHtml}
          </div>
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

      // Focus name input after slide animation begins
      setTimeout(() => {
        nameInput?.focus();
        nameInput?.select();
      }, 150);
    });
  }
}

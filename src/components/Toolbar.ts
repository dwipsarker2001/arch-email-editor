/**
 * Arch Email Editor - Header Toolbar Component
 *
 * Renders the top application action bar with branding and primary operations:
 * - Import HTML (for prebuilt template loading)
 * - Export JSON (for database storage)
 * - Export HTML (for email sending)
 * - Clear (to reset template)
 */

export interface ToolbarEvents {
  onImportHtml: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onClear: () => void;
}

export class Toolbar {
  private element: HTMLElement;
  private events: ToolbarEvents;

  constructor(events: ToolbarEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__toolbar';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-editor__title">
        <span>📬</span>
        <span>Arch Email Editor</span>
      </div>
      <div class="arch-editor__actions">
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

  public destroy(): void {
    this.element.remove();
  }
}

/**
 * Arch Email Editor - Import Modal Component
 *
 * Provides a clean modal dialog to import prebuilt HTML email templates.
 * Supports:
 * 1. Uploading a local `.html` / `.htm` file using native FileReader.
 * 2. Pasting arbitrary raw HTML email markup into a textarea.
 */

export class ImportModal {
  private overlay: HTMLElement | null = null;
  private onImportCallback: (html: string) => void;

  constructor(onImport: (html: string) => void) {
    this.onImportCallback = onImport;
  }

  /**
   * Opens the import dialog inside the given parent container.
   */
  public open(parent: HTMLElement): void {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'arch-modal-overlay';
    overlay.innerHTML = `
      <div class="arch-modal">
        <div class="arch-modal__header">
          <span>📥 Import Prebuilt HTML Email Template</span>
          <button class="arch-btn arch-btn--close" type="button" title="Close">✕</button>
        </div>
        <div class="arch-modal__body">
          <div class="arch-form-group" style="margin-bottom: 16px;">
            <label class="arch-form-label">Option 1: Upload .html file</label>
            <input type="file" id="arch-import-file" class="arch-input" accept=".html,.htm" />
            <small style="color: var(--arch-text-secondary); font-size: 11px; margin-top: 4px;">
              Select any prebuilt newsletter HTML file from your computer.
            </small>
          </div>
          <div class="arch-form-group">
            <label class="arch-form-label">Option 2: Or Paste HTML Code</label>
            <textarea class="arch-modal__code" id="arch-import-text" placeholder="Paste full <table> or <div> email markup here..."></textarea>
          </div>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button class="arch-btn arch-btn--close-cancel" type="button">Cancel</button>
          <button class="arch-btn arch-btn--primary arch-btn--do-import" type="button">Load Into Editor</button>
        </div>
      </div>
    `;

    const close = () => this.close();
    overlay.querySelector('.arch-btn--close')?.addEventListener('click', close);
    overlay.querySelector('.arch-btn--close-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const fileInput = overlay.querySelector<HTMLInputElement>('#arch-import-file');
    const textarea = overlay.querySelector<HTMLTextAreaElement>('#arch-import-text');

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && textarea) {
        textarea.value = await file.text();
      }
    });

    overlay.querySelector('.arch-btn--do-import')?.addEventListener('click', () => {
      const html = textarea?.value?.trim();
      if (html) {
        this.onImportCallback(html);
        close();
      } else {
        alert('Please select an HTML file or paste HTML email markup.');
      }
    });

    parent.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Closes and removes the modal from the DOM.
   */
  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

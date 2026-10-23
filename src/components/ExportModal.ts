/**
 * Arch Email Editor - Export Modal Component
 *
 * Displays formatted HTML or JSON code with a one-click copy to clipboard.
 * Safely assigns code to `textarea.value` to avoid XSS injection risks.
 */

export class ExportModal {
  private overlay: HTMLElement | null = null;
  private copyTimer: any = null;

  /**
   * Opens the export dialog displaying the generated content.
   */
  public open(parent: HTMLElement, title: string, content: string): void {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'arch-modal-overlay';
    overlay.innerHTML = `
      <div class="arch-modal">
        <div class="arch-modal__header">
          <span class="arch-modal__title"></span>
          <button class="arch-btn arch-btn--close" type="button" title="Close">✕</button>
        </div>
        <div class="arch-modal__body">
          <textarea class="arch-modal__code" readonly spellcheck="false"></textarea>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button class="arch-btn arch-btn--primary arch-btn--copy" type="button">Copy to Clipboard</button>
        </div>
      </div>
    `;

    overlay.querySelector<HTMLElement>('.arch-modal__title')!.textContent = title;
    const textarea = overlay.querySelector<HTMLTextAreaElement>('.arch-modal__code')!;
    textarea.value = content; // Safe DOM assignment

    const close = () => this.close();
    overlay.querySelector('.arch-btn--close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const copyBtn = overlay.querySelector<HTMLButtonElement>('.arch-btn--copy');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard?.writeText(content);
      copyBtn.textContent = 'Copied!';
      this.copyTimer = setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    });

    parent.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Closes and cleans up the modal and any active timers.
   */
  public close(): void {
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

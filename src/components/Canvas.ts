/**
 * Arch Email Editor - Visual Canvas Component
 *
 * Architecture & Email Rendering Fidelity:
 * Real email templates carry DOCTYPEs, table resets, inline styles, and CSS media queries.
 * Rendering directly inside host page DOM causes:
 * 1. Host CSS leaks into email tables (breaking column widths and padding).
 * 2. Email client CSS leaks into host application.
 * 3. Flattening of nested multi-column tables into 1D blocks.
 *
 * Solution (Ponytail principle - native browser platform feature):
 * Uses a same-origin HTMLIFrameElement (`iframe.contentDocument`).
 * - 100% email client visual fidelity: table columns, responsive rules, fonts, and colors.
 * - In-place editing: text elements are given `contenteditable="true"` for direct typing.
 * - Real-time element selection: clicking buttons, images, text, or sections sends info to Inspector.
 * - Native Drag-and-Drop: dragging blocks from the palette into the email inserts clean table rows.
 * - Clean export: serializes the live DOM, stripping editor helper attributes.
 */

import { EmailDocument, BlockType, SelectedElementInfo } from '../types';
import { compileToEmailHtml } from '../compiler';

export interface CanvasEvents {
  onSelectBlock: (id: string | null) => void;
  onSelectElement: (info: SelectedElementInfo | null) => void;
  onContentChange: (html: string) => void;
  onAddBlock?: (type: BlockType) => void;
  onReorderBlock?: (sourceId: string, targetIndex: number) => void;
  onMoveBlock?: (id: string, direction: 'up' | 'down') => void;
  onRemoveBlock?: (id: string) => void;
  onInsertBlockAt?: (type: BlockType, targetIndex: number) => void;
}

export class Canvas {
  private element: HTMLElement;
  private containerElement: HTMLElement;
  private iframe: HTMLIFrameElement;
  private events: CanvasEvents;
  private selectedElement: HTMLElement | null = null;
  private lastRenderedHtml: string = '';
  private hoveredDropTarget: HTMLElement | null = null;

  constructor(events: CanvasEvents) {
    this.events = events;

    // Root canvas wrapper
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__canvas';

    // Canvas container maintaining standard email client max-width (e.g. 600px - 680px)
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'arch-canvas-container';

    // Same-origin isolated email preview iframe
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'arch-canvas-iframe';
    this.iframe.setAttribute('title', 'Email Canvas Preview');

    this.containerElement.appendChild(this.iframe);
    this.element.appendChild(this.containerElement);

    this.bindOuterEvents();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getIFrame(): HTMLIFrameElement {
    return this.iframe;
  }

  /**
   * Binds click and drag events on the outer canvas container.
   */
  private bindOuterEvents(): void {
    // Deselect when clicking outside the email iframe in the canvas backdrop
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element || e.target === this.containerElement) {
        this.clearSelection();
        this.events.onSelectElement(null);
        this.events.onSelectBlock(null);
      }
    });

    // Support dropping blocks directly onto the canvas container backdrop
    this.containerElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.containerElement.classList.add('drag-over');
    });

    this.containerElement.addEventListener('dragleave', () => {
      this.containerElement.classList.remove('drag-over');
    });

    this.containerElement.addEventListener('drop', (e) => {
      e.preventDefault();
      this.containerElement.classList.remove('drag-over');
      const data = e.dataTransfer?.getData('text/plain') || '';
      if (data && !data.startsWith('arch-block:')) {
        this.insertBlock(data as BlockType);
      }
    });
  }

  /**
   * Renders or updates the email template inside the isolated canvas iframe.
   */
  public update(doc: EmailDocument, _selectedBlockId: string | null): void {
    // Check for empty template state
    const hasBlocks = doc.blocks && doc.blocks.length > 0;
    const hasRawHtml = typeof doc.rawHtml === 'string' && doc.rawHtml.trim().length > 0;

    if (!hasBlocks && !hasRawHtml) {
      this.containerElement.innerHTML = `
        <div class="arch-canvas-empty">
          <p style="font-weight: 600; font-size: 16px; margin: 0 0 6px 0;">This email is empty</p>
          <p style="margin: 0; color: var(--arch-text-secondary); font-size: 13px;">
            Drag or click blocks from the left palette or import a prebuilt HTML newsletter.
          </p>
        </div>
      `;
      return;
    }

    // Ensure iframe is mounted in containerElement
    if (!this.containerElement.contains(this.iframe)) {
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.iframe);
    }

    // Obtain the exact HTML string to render
    const htmlToRender = (doc.rawHtml && doc.rawHtml.trim())
      ? doc.rawHtml
      : compileToEmailHtml(doc);

    // Skip redundant DOM rewrites if HTML content hasn't changed
    if (this.lastRenderedHtml === htmlToRender && this.iframe.contentDocument?.body) {
      return;
    }
    this.lastRenderedHtml = htmlToRender;

    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc) return;

    // Write full email markup directly into the iframe (preserving <head>, <style>, tables)
    ifrDoc.open();
    ifrDoc.write(htmlToRender);
    ifrDoc.close();

    // Inject editor visual feedback styles (selection, hover, focus outlines)
    this.injectEditorStyles(ifrDoc);

    // Enable direct typing on headings, paragraphs, and buttons
    this.enableDirectEditing(ifrDoc);

    // Bind drag-and-drop insertion from palette into iframe
    this.bindIframeDragDrop(ifrDoc);

    // Listen for element clicks inside the email to drive the Inspector
    ifrDoc.addEventListener('click', (e) => this.handleIframeClick(e));

    // Automatically adjust iframe height to eliminate internal vertical scrollbars
    this.adjustHeight();
  }

  /**
   * Injects non-destructive editor outline styles into the iframe.
   */
  private injectEditorStyles(doc: Document): void {
    if (doc.getElementById('arch-canvas-editor-style')) return;

    const styleEl = doc.createElement('style');
    styleEl.id = 'arch-canvas-editor-style';
    styleEl.textContent = `
      [contenteditable="true"]:focus {
        outline: 2px dashed #2563eb !important;
        outline-offset: 2px;
      }
      .arch-selected-element {
        outline: 2px solid #2563eb !important;
        outline-offset: 2px;
      }
      .arch-drop-target {
        outline: 2px dashed #10b981 !important;
        background-color: rgba(16, 185, 129, 0.05) !important;
      }
      img.arch-selected-element {
        outline: 2px solid #2563eb !important;
        outline-offset: 1px;
      }
    `;
    doc.head?.appendChild(styleEl);
  }

  /**
   * Makes copy elements inside the iframe directly editable in-place.
   */
  private enableDirectEditing(doc: Document): void {
    const textNodes = doc.body?.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, td, th, li, span') || [];
    textNodes.forEach((el) => {
      // Only attach contenteditable to elements without child block containers
      const hasChildBlock = el.querySelector('h1, h2, h3, h4, h5, h6, p, table, ul, ol');
      if (!hasChildBlock) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      }
    });

    // Notify listeners when text is typed directly into the email canvas
    doc.addEventListener('input', () => {
      const cleanHtml = this.getCleanHTML();
      this.lastRenderedHtml = cleanHtml;
      this.events.onContentChange(cleanHtml);
    });
  }

  /**
   * Handles element click selection inside the iframe to feed the Inspector.
   */
  private handleIframeClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Prevent navigation if clicking on email links / buttons
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
    }

    // Identify primary selectable element
    const selectable = (target.closest('img, a, h1, h2, h3, h4, h5, h6, p, hr, td') || target) as HTMLElement;

    this.clearSelection();
    this.selectedElement = selectable;
    selectable.classList.add('arch-selected-element');

    const info = this.extractElementInfo(selectable);
    this.events.onSelectElement(info);
  }

  /**
   * Clears selection outlines across the canvas iframe.
   */
  public clearSelection(): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('arch-selected-element');
      this.selectedElement = null;
    }
    const ifrDoc = this.iframe.contentDocument;
    if (ifrDoc) {
      ifrDoc.querySelectorAll('.arch-selected-element').forEach(el => el.classList.remove('arch-selected-element'));
    }
  }

  /**
   * Extracts attributes and styling information for the Inspector panel.
   */
  private extractElementInfo(el: HTMLElement): SelectedElementInfo {
    const tag = el.tagName.toLowerCase();
    let type: SelectedElementInfo['type'] = 'other';

    if (tag.startsWith('h')) type = 'heading';
    else if (tag === 'p' || tag === 'span') type = 'text';
    else if (tag === 'a') type = 'button';
    else if (tag === 'img') type = 'image';
    else if (tag === 'td' || tag === 'tr' || tag === 'table' || tag === 'div') type = 'section';

    const style = el.style;
    const computed = this.iframe.contentWindow?.getComputedStyle(el);

    return {
      tagName: tag,
      type,
      text: el.textContent?.trim() || '',
      src: el.getAttribute('src') || '',
      alt: el.getAttribute('alt') || '',
      url: el.getAttribute('href') || '',
      color: style.color || computed?.color || '',
      backgroundColor: style.backgroundColor || computed?.backgroundColor || '',
      fontSize: style.fontSize || computed?.fontSize || '',
      textAlign: (style.textAlign || computed?.textAlign || '') as any,
      padding: style.padding || computed?.padding || '',
      element: el
    };
  }

  /**
   * Binds dragover and drop handlers on the iframe document for block palette dropping.
   */
  private bindIframeDragDrop(doc: Document): void {
    doc.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }

      const target = (e.target as HTMLElement)?.closest('tr, table, div, p, h1, h2, h3');
      if (target && target !== this.hoveredDropTarget) {
        this.hoveredDropTarget?.classList.remove('arch-drop-target');
        this.hoveredDropTarget = target as HTMLElement;
        this.hoveredDropTarget.classList.add('arch-drop-target');
      }
    });

    doc.addEventListener('dragleave', () => {
      this.hoveredDropTarget?.classList.remove('arch-drop-target');
      this.hoveredDropTarget = null;
    });

    doc.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      this.hoveredDropTarget?.classList.remove('arch-drop-target');

      const data = e.dataTransfer?.getData('text/plain') || '';
      if (!data) return;

      const blockType = (data.startsWith('arch-block:') ? 'button' : data) as BlockType;
      this.insertBlock(blockType, this.hoveredDropTarget);
      this.hoveredDropTarget = null;
    });
  }

  /**
   * Inserts a bulletproof email table row corresponding to the dropped block type.
   */
  public insertBlock(type: BlockType, targetElement?: HTMLElement | null): void {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.body) return;

    const snippet = this.getBlockHtmlSnippet(type);

    if (targetElement && targetElement.parentElement) {
      targetElement.insertAdjacentHTML('afterend', snippet);
    } else {
      // Append to the innermost content table or body
      const table = ifrDoc.body.querySelector('table');
      if (table) {
        const tbody = table.querySelector('tbody') || table;
        tbody.insertAdjacentHTML('beforeend', snippet);
      } else {
        ifrDoc.body.insertAdjacentHTML('beforeend', snippet);
      }
    }

    this.enableDirectEditing(ifrDoc);
    const cleanHtml = this.getCleanHTML();
    this.lastRenderedHtml = cleanHtml;
    this.events.onContentChange(cleanHtml);
    this.adjustHeight();
  }

  /**
   * Returns bulletproof email HTML table markup for standard blocks.
   */
  private getBlockHtmlSnippet(type: BlockType): string {
    switch (type) {
      case 'heading':
        return `<tr><td style="padding: 16px 20px; text-align: left;"><h2 style="margin: 0; font-family: Arial, sans-serif; font-size: 22px; color: #0f172a; font-weight: bold;">New Heading</h2></td></tr>`;
      case 'text':
        return `<tr><td style="padding: 12px 20px; text-align: left; font-family: Arial, sans-serif; font-size: 16px; color: #475569; line-height: 1.6;"><p style="margin: 0;">Add your newsletter copy here. Click to edit directly in the email.</p></td></tr>`;
      case 'button':
        return `<tr><td align="center" style="padding: 16px 20px;"><table border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" bgcolor="#2563eb" style="border-radius: 6px;"><a href="https://example.com" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 6px; padding: 12px 24px; border: 1px solid #2563eb; display: inline-block; font-weight: 600;">Click Here</a></td></tr></table></td></tr>`;
      case 'image':
        return `<tr><td align="center" style="padding: 16px 20px;"><img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80" alt="Banner visual" width="560" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 6px; border: 0;" /></td></tr>`;
      case 'divider':
        return `<tr><td style="padding: 16px 20px;"><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0;" /></td></tr>`;
      case 'html':
        return `<tr><td style="padding: 16px 20px;"><div style="padding: 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-size: 13px;">Custom HTML Section</div></td></tr>`;
    }
  }

  /**
   * Adjusts the iframe to fill 100% of the canvas area touching the sidebars.
   */
  public adjustHeight(): void {
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
  }

  /**
   * Serializes the live iframe DOM and strips all editor-specific helper attributes,
   * returning clean, production-ready, email-client-safe HTML.
   */
  public getCleanHTML(): string {
    const ifrDoc = this.iframe.contentDocument;
    if (!ifrDoc || !ifrDoc.documentElement) {
      return this.lastRenderedHtml || '';
    }

    // Clone root node to avoid disrupting the active visual editor state
    const clone = ifrDoc.documentElement.cloneNode(true) as HTMLElement;

    // Remove internal editor style tag
    const helperStyle = clone.querySelector('#arch-canvas-editor-style');
    if (helperStyle) helperStyle.remove();

    // Remove editor classes
    clone.querySelectorAll('.arch-selected-element, .arch-drop-target').forEach((el) => {
      el.classList.remove('arch-selected-element', 'arch-drop-target');
      if (el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
    });

    // Remove contenteditable and spellcheck helper attributes
    clone.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });

    const doctype = '<!DOCTYPE html>\n';
    return doctype + clone.outerHTML;
  }

  public destroy(): void {
    this.element.remove();
  }
}

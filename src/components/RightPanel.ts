/**
 * Arch Email Editor - Right Panel Component (Really Good Emails / Beefree Studio Architecture)
 *
 * Implements the RGE 3-tab Right Panel with 100% visual and functional fidelity:
 * 1. Content: Draggable content blocks (when nothing selected) or Contextual Element Properties
 *    (when an element is selected), with a Close (✕) button to deselect and return to blocks.
 * 2. Rows: Category selector, empty multi-column row layouts, and prebuilt modular sections.
 * 3. Settings: Global email document settings (Content width, alignment, colors, fonts, preheader).
 */

import { BlockType, RowLayoutType, ViewportMode, EmailDocument, SelectedElementInfo, PrebuiltSection, AiOptions } from '../types';
import type { EditorToolCallbacks } from '../ai/editorTools';
import { Inspector, InspectorEvents } from './Inspector';
import { PlaceholdersSidepanel } from './inspector/PlaceholdersSidepanel';
import { getDefaultSections } from '../engine/sections';
import { AiAssistant } from './AiAssistant';

export type RightPanelTab = 'content' | 'rows' | 'settings' | 'blocks' | 'sections';

export interface RightPanelEvents extends InspectorEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout: (layout: RowLayoutType) => void;
  aiOptions: AiOptions;
  createAiEditorToolCallbacks: () => EditorToolCallbacks;
  onInsertSection?: (section: PrebuiltSection) => void;
  onDeselect?: () => void;
  placeholders?: any;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

export class RightPanel {
  private element: HTMLElement;
  private events: RightPanelEvents;
  private activeTab: RightPanelTab = 'blocks';

  private tabButtons: Map<string, HTMLButtonElement> = new Map();
  private tabPanels: Map<string, HTMLElement> = new Map();

  // Element inspector displays in the Content tab when an element is selected
  private elementInspector: Inspector;
  // Template strings sidepanel (slides over the Content tab)
  private placeholdersPanel: PlaceholdersSidepanel | null = null;
  // AI sidepanel (slides over the Content tab)
  private aiPanel: HTMLElement | null = null;
  private aiAssistant: AiAssistant | null = null;
  // Document inspector displays in the Settings tab for global design settings
  private documentInspector: Inspector;

  // Prebuilt & custom modular sections catalog
  private sections: PrebuiltSection[] = [];
  private selectedCategory: string = 'all';
  private searchQuery: string = '';

  constructor(events: RightPanelEvents, initialSections: PrebuiltSection[] = []) {
    this.events = events;
    this.sections = initialSections && initialSections.length > 0
      ? [...initialSections]
      : getDefaultSections();

    this.element = document.createElement('div');
    this.element.className = 'arch-editor__right-panel';

    this.elementInspector = new Inspector({
      onChange: events.onChange,
      onUploadImage: events.onUploadImage,
      assets: events.assets,
      onBrowseMedia: events.onBrowseMedia,
      onCropImage: events.onCropImage,
      onRemoveImage: events.onRemoveImage,
      onRemoveBlock: events.onRemoveBlock,
      onMoveElement: events.onMoveElement,
      onDuplicateElement: events.onDuplicateElement,
      onRemoveElement: events.onRemoveElement,
      onSelectParent: events.onSelectParent,
      onSelectElementNode: events.onSelectElementNode,
      onDeselect: () => {
        if (events.onDeselect) {
          events.onDeselect();
        }
      }
    });

    this.documentInspector = new Inspector({
      onChange: events.onChange,
      onRemoveBlock: events.onRemoveBlock,
      onMoveElement: events.onMoveElement,
      onDuplicateElement: events.onDuplicateElement,
      onRemoveElement: events.onRemoveElement,
      onSelectParent: events.onSelectParent,
      onSelectElementNode: events.onSelectElementNode,
      onDeselect: () => {
        if (events.onDeselect) {
          events.onDeselect();
        }
      }
    });

    this.render();

    const contentPanel = this.element.querySelector<HTMLElement>('#arch-panel-blocks');
    if (contentPanel) {
      contentPanel.style.position = 'relative';
      this.placeholdersPanel = new PlaceholdersSidepanel({
        container: contentPanel,
        onSelect: (code) => {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(code).catch(() => {});
          }
        },
        placeholders: events.placeholders
      });
    }
  }

  private readOnly: boolean = false;

  public setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    this.aiAssistant?.setReadOnly(readOnly);
    if (readOnly) {
      this.element.classList.add('arch-right-panel--readonly');
      this.element.querySelectorAll<HTMLElement>('.arch-block-card').forEach((card) => {
        card.setAttribute('draggable', 'false');
      });
    } else {
      this.element.classList.remove('arch-right-panel--readonly');
      this.element.querySelectorAll<HTMLElement>('.arch-block-card').forEach((card) => {
        card.setAttribute('draggable', 'true');
      });
    }
  }

  public isReadOnly(): boolean {
    return this.readOnly;
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  /** Toggles the right sidebar and returns whether it is now collapsed. */
  public toggleCollapsed(): boolean {
    return this.element.classList.toggle('is-collapsed');
  }

  
  public setAssets(assets: any[]): void {
    this.elementInspector.setAssets(assets);
  }

  public setPlaceholders(placeholders: any): void {
    this.placeholdersPanel?.setPlaceholders(placeholders);
  }

  public getPlaceholders(): any[] {
    return this.placeholdersPanel?.getPlaceholders?.() ?? [];
  }

  /** Opens (or toggles) the template-strings sidepanel in the right sidebar. */
  public openPlaceholdersPanel(): void {
    this.element.classList.remove('is-collapsed');
    this.closeAiPanel();
    if (this.activeTab !== 'blocks') {
      this.setActiveTab('blocks');
    }
    if (this.placeholdersPanel?.isOpen()) {
      this.placeholdersPanel.close();
    } else {
      this.placeholdersPanel?.open();
    }
  }

  /** Opens (or toggles) the AI sidepanel in the right sidebar. */
  public openAiPanel(): void {
    this.element.classList.remove('is-collapsed');
    if (this.activeTab !== 'blocks') {
      this.setActiveTab('blocks');
    }
    if (this.aiPanel) {
      this.closeAiPanel();
      return;
    }

    this.placeholdersPanel?.close();
    const contentPanel = this.element.querySelector<HTMLElement>('#arch-panel-blocks');
    if (!contentPanel) return;

    const panel = document.createElement('div');
    panel.className = 'arch-assets-sidepanel arch-ai-sidepanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI Assistant');
    panel.innerHTML = `
      <div class="arch-prop-header arch-assets-header">
        <div class="arch-prop-title">AI Assistant</div>
        <div class="arch-prop-actions arch-assets-header-actions">
          <button type="button" class="arch-icon-btn" id="btn-ai-close" title="Close" aria-label="Close AI Assistant">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="arch-assets-body"></div>
    `;

    contentPanel.appendChild(panel);
    this.aiPanel = panel;
    this.aiAssistant = new AiAssistant(
      panel.querySelector<HTMLElement>('.arch-assets-body')!,
      this.events.aiOptions,
      this.events.createAiEditorToolCallbacks,
      this.readOnly,
    );
    panel.querySelector('#btn-ai-close')?.addEventListener('click', () => this.closeAiPanel());
    panel.classList.add('is-open');
  }

  /** Closes the AI sidepanel. */
  public closeAiPanel(): void {
    this.aiAssistant?.dispose();
    this.aiAssistant = null;
    this.aiPanel?.remove();
    this.aiPanel = null;
  }

  public getAssets(): any[] {
    return this.elementInspector.getAssets();
  }

  public getInspector(): Inspector {
    return this.elementInspector;
  }

  public getActiveTab(): RightPanelTab {
    return this.activeTab;
  }

  public setActiveTab(tab: RightPanelTab): void {
    // Normalize aliases: 'content' -> 'blocks', 'rows' -> 'sections'
    const normalizedTab = tab === 'content' ? 'blocks' : tab === 'rows' ? 'sections' : tab;
    if (this.activeTab === normalizedTab) return;

    if (this.activeTab === "blocks" && normalizedTab !== "blocks") {
      this.placeholdersPanel?.close();
      this.closeAiPanel();
    }

    this.activeTab = normalizedTab;

    this.tabButtons.forEach((btn, t) => {
      btn.classList.toggle('is-active', t === normalizedTab);
    });

    this.tabPanels.forEach((panel, t) => {
      panel.classList.toggle('is-hidden', t !== normalizedTab);
    });
  }

  public setViewportMode(mode: ViewportMode): void {
    this.elementInspector.setViewportMode(mode);
    this.documentInspector.setViewportMode(mode);
  }

  public update(
    doc: EmailDocument,
    selectedBlockId: string | null,
    selectedElement?: SelectedElementInfo | null
  ): void {
    // 1. Keep Document Settings synchronized in the Settings tab
    this.documentInspector.update(doc, null, null);

    const blocksView = this.element.querySelector<HTMLElement>('#arch-content-blocks-view');
    const inspectorView = this.element.querySelector<HTMLElement>('#arch-content-inspector-view');

    // 2. Contextual Content Tab behavior matching RGE Studio:
    if (selectedElement || selectedBlockId) {
      // Element selected: show Element Properties inside the CONTENT tab!
      this.elementInspector.update(doc, selectedBlockId, selectedElement);
      if (blocksView) blocksView.style.display = 'none';
      if (inspectorView) inspectorView.style.display = 'block';

      // Switch to Content tab (matching Really Good Emails)
      this.setActiveTab('blocks');
    } else {
      // Nothing selected: show Content Block Tiles inside the CONTENT tab!
      if (blocksView) blocksView.style.display = 'block';
      if (inspectorView) inspectorView.style.display = 'none';
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-right-tabs">
        <button type="button" class="arch-right-tab is-active" data-tab="blocks" data-tab-name="content" title="Content Blocks">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1"/>
            <rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/>
            <rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
          Content
        </button>
        <button type="button" class="arch-right-tab" data-tab="sections" data-tab-name="sections" title="Prebuilt Modular Sections">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
          </svg>
          Sections
        </button>
        <button type="button" class="arch-right-tab" data-tab="settings" title="Global Email Settings">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="12" height="12" rx="2"/>
            <line x1="5" y1="6" x2="11" y2="6"/>
            <line x1="5" y1="10" x2="9" y2="10"/>
          </svg>
          Settings
        </button>
      </div>

      <div class="arch-right-tab-content">
        <!-- Tab 1: Content (Blocks Grid when unselected, Element Properties when selected) -->
        <div class="arch-tab-panel arch-tab-panel--blocks arch-tab-panel--content arch-editor__palette" id="arch-panel-blocks">
          <div id="arch-content-inspector-view" style="display: none; width: 100%;"></div>

          <div id="arch-content-blocks-view" style="width: 100%;">
            <div class="arch-editor__section-label">Content</div>
            <div class="arch-assets-grid">
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="heading" title="Title Heading">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                <span>Title</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="text" title="Paragraph Copy">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/></svg>
                <span>Paragraph</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="list" title="Bullet List">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
                <span>List</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="image" title="Image Banner">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Image</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="button" title="Call to Action Button">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M12 11l3 3-1.5 1-1.5-4z" fill="currentColor"/></svg>
                <span>Button</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="table" title="Data Table">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                <span>Table</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="divider" title="Divider Line">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><rect x="8" y="5" width="8" height="3" rx="1"/><rect x="8" y="16" width="8" height="3" rx="1"/></svg>
                <span>Divider</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="spacer" title="Vertical Spacer">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 8 12 5 15 8"/><polyline points="9 16 12 19 15 16"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="4" y1="3" x2="20" y2="3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                <span>Spacer</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="social" title="Social Links">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <span>Social</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="html" title="Custom HTML">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>
                <span>HTML</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="video" title="Video Thumbnail">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2.5"/><polygon points="10 9 16 12 10 15 10 9" fill="currentColor"/></svg>
                <span>Video</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="icons" title="Icons Group">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>Icons</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="menu" title="Navigation Menu">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                <span>Menu</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="gif" data-block-variant="sticker" title="Sticker Graphic">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 18a6 6 0 0 1-6-6"/><path d="M12 21a9 9 0 0 0 9-9h-6a3 3 0 0 0-3 3v6z" fill="#71717a"/></svg>
                <span>Sticker</span>
              </button>
              <button class="arch-palette-item" type="button" draggable="true" data-block-type="gif" title="Animated GIF">
                <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12a2 2 0 0 1 2-2h1v4H9a2 2 0 0 1-2-2z"/><line x1="13" y1="10" x2="13" y2="14"/><path d="M16 10h3"/><path d="M16 12h2"/><path d="M16 14h1"/></svg>
                <span>GIF</span>
              </button>
            </div>

            <!-- Empty Row Layouts in Blocks/Content per user preference -->
            <div class="arch-editor__section-label" style="margin-top: 18px;">Empty Rows</div>
            <div class="arch-rows-list">
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="1-col" title="1 Column (100%)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 100%;"></div>
                </div>
              </button>
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="2-col-33-67" title="2 Columns (33% / 67%)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 30%;"></div>
                  <div class="arch-col-bar" style="width: 70%;"></div>
                </div>
              </button>
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="2-col-50-50" title="2 Columns (50% / 50%)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 50%;"></div>
                  <div class="arch-col-bar" style="width: 50%;"></div>
                </div>
              </button>
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="2-col-67-33" title="2 Columns (67% / 33%)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 70%;"></div>
                  <div class="arch-col-bar" style="width: 30%;"></div>
                </div>
              </button>
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="3-col" title="3 Columns (33% / 33% / 33%)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 33.33%;"></div>
                  <div class="arch-col-bar" style="width: 33.33%;"></div>
                  <div class="arch-col-bar" style="width: 33.33%;"></div>
                </div>
              </button>
              <button class="arch-row-card" type="button" draggable="true" data-row-layout="4-col" title="4 Columns (25% each)">
                <div class="arch-row-silhouette">
                  <div class="arch-col-bar" style="width: 25%;"></div>
                  <div class="arch-col-bar" style="width: 25%;"></div>
                  <div class="arch-col-bar" style="width: 25%;"></div>
                  <div class="arch-col-bar" style="width: 25%;"></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 2: Modular Sections & Row Layouts -->
        <div class="arch-tab-panel arch-tab-panel--sections is-hidden" id="arch-panel-sections">
          <div class="arch-sections-header-controls">
            <div class="arch-sections-search-wrap">
              <svg class="arch-sections-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="arch-sections-search-input" id="arch-sections-search-input" placeholder="Search sections..." />
            </div>
            <div class="arch-form-group" style="margin-bottom: 0;">
              <select class="arch-select" id="sel-section-category">
                <option value="all">All Categories</option>
              </select>
            </div>
          </div>

          <div class="arch-sections-catalog" id="arch-sections-catalog"></div>
        </div>

        <!-- Tab 3: Settings (Global Document Design Settings) -->
        <div class="arch-tab-panel arch-tab-panel--settings arch-editor__inspector is-hidden" id="arch-panel-settings">
        </div>
      </div>
    `;

    // Cache tab buttons and panels
    const tabs = ['blocks', 'sections', 'settings'];
    tabs.forEach((tab) => {
      const btn = this.element.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (btn) this.tabButtons.set(tab, btn);

      const panel = this.element.querySelector<HTMLElement>(`#arch-panel-${tab}`);
      if (panel) this.tabPanels.set(tab, panel);
    });

    // Mount Element Inspector into Content Tab's inspector view
    const contentInspectorView = this.element.querySelector<HTMLElement>('#arch-content-inspector-view');
    if (contentInspectorView) {
      contentInspectorView.appendChild(this.elementInspector.getElement());
    }

    // Mount Document Inspector into Settings Tab
    const settingsPanel = this.tabPanels.get('settings');
    if (settingsPanel) {
      settingsPanel.appendChild(this.documentInspector.getElement());
    }

    // Bind tab switching
    this.tabButtons.forEach((btn, tab) => {
      btn.addEventListener('click', () => {
        this.setActiveTab(tab as RightPanelTab);
      });
    });

    // Bind Content Block click & dragstart
    this.element.querySelectorAll<HTMLButtonElement>('[data-block-type]').forEach((btn) => {
      const type = btn.getAttribute('data-block-type') as BlockType;

      btn.addEventListener('click', () => {
        this.events.onAddBlock(type);
      });

      btn.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', type);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });

    // Bind Empty Row Layouts in Content Tab
    const contentBlocksView = this.element.querySelector<HTMLElement>('#arch-content-blocks-view');
    contentBlocksView?.querySelectorAll<HTMLButtonElement>('[data-row-layout]').forEach((btn) => {
      const layout = btn.getAttribute('data-row-layout') as RowLayoutType;

      btn.addEventListener('click', () => {
        this.events.onAddRowLayout(layout);
      });

      btn.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', `row:${layout}`);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });

    // Bind Sections filter and search controls
    const categorySelect = this.element.querySelector<HTMLSelectElement>('#sel-section-category');
    categorySelect?.addEventListener('change', () => {
      this.selectedCategory = categorySelect.value;
      this.renderSectionsCatalog();
    });

    const searchInput = this.element.querySelector<HTMLInputElement>('#arch-sections-search-input');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.renderSectionsCatalog();
    });

    // Render the initial sections catalog
    this.renderSectionsCatalog();
  }

  /**
   * Renders the modular prebuilt sections catalog into Tab 2 based on category & search filter.
   */
  private renderSectionsCatalog(): void {
    const catalogEl = this.element.querySelector<HTMLElement>('#arch-sections-catalog');
    if (!catalogEl) return;

    // Update Category Dropdown options if category list changed
    const categorySelect = this.element.querySelector<HTMLSelectElement>('#sel-section-category');
    if (categorySelect) {
      const categoryCounts = new Map<string, number>();
      this.sections.forEach((s) => {
        const cat = s.category || 'General';
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      });
      const sortedCategories = Array.from(categoryCounts.keys()).sort();

      const options = [
        `<option value="all"${this.selectedCategory === 'all' ? ' selected' : ''}>All Categories (${this.sections.length})</option>`,
        ...sortedCategories.map(
          (cat) =>
            `<option value="${escapeHtml(cat)}"${this.selectedCategory === cat ? ' selected' : ''}>${escapeHtml(cat)} (${categoryCounts.get(cat)})</option>`
        )
      ];
      categorySelect.innerHTML = options.join('');
    }

    const query = this.searchQuery.trim().toLowerCase();
    const isCategoryAll = this.selectedCategory === 'all';

    const filtered = this.sections.filter((s) => {
      const matchesCategory = isCategoryAll || (s.category || 'General') === this.selectedCategory;
      const matchesQuery =
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)) ||
        (s.category && s.category.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });

    if (filtered.length === 0) {
      catalogEl.innerHTML = `
        <div class="arch-sections-empty-state">
          <div style="font-weight: 600; font-size: 13px; color: var(--arch-text-primary); margin-bottom: 4px;">No sections found</div>
          <div style="font-size: 12px; color: var(--arch-text-secondary); line-height: 1.5;">Try searching with different terms or selecting another category.</div>
        </div>
      `;
    } else {
      catalogEl.innerHTML = `
        <div class="arch-sections-grid">
          ${filtered
            .map(
              (s) => `
            <div class="arch-section-card" data-section-id="${escapeHtml(s.id)}" draggable="true" title="${escapeHtml(s.description || s.name)}">
              <div class="arch-section-preview">
                ${s.thumbnail ? s.thumbnail : `<div class="arch-section-preview-placeholder">${escapeHtml(s.name)}</div>`}
              </div>
              <div class="arch-section-footer-row">
                <div class="arch-section-title-wrap">
                  <div class="arch-section-name">${escapeHtml(s.name)}</div>
                  <span class="arch-section-badge">${escapeHtml(s.category || 'General')}</span>
                </div>
                <button type="button" class="arch-section-add-btn" title="Insert into email" data-insert-id="${escapeHtml(s.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    // Bind Section click & dragstart
    catalogEl.querySelectorAll<HTMLElement>('.arch-section-card').forEach((card) => {
      const sectionId = card.getAttribute('data-section-id');
      const section = this.sections.find((s) => s.id === sectionId);
      if (!section) return;

      card.addEventListener('click', () => {
        this.events.onInsertSection?.(section);
      });

      card.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', `section:${section.id}`);
          e.dataTransfer.setData('text/html', section.html);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });
  }

  /**
   * Returns a copy of the currently loaded modular sections.
   */
  public getSections(): PrebuiltSection[] {
    return [...this.sections];
  }

  /**
   * Finds a loaded section by its unique ID.
   */
  public getSectionById(id: string): PrebuiltSection | undefined {
    return this.sections.find((s) => s.id === id);
  }

  /**
   * Replaces the modular sections library and updates the sidebar UI.
   */
  public setSections(sections: PrebuiltSection[]): void {
    this.sections = [...sections];
    this.renderSectionsCatalog();
  }

  /**
   * Dynamically adds or updates a modular section in the library.
   */
  public addSection(section: PrebuiltSection): void {
    const existingIndex = this.sections.findIndex((s) => s.id === section.id);
    if (existingIndex !== -1) {
      this.sections[existingIndex] = section;
    } else {
      this.sections.push(section);
    }
    this.renderSectionsCatalog();
  }

  /**
   * Removes a modular section from the library by ID.
   */
  public removeSection(id: string): void {
    this.sections = this.sections.filter((s) => s.id !== id);
    this.renderSectionsCatalog();
  }

  public destroy(): void {
    this.closeAiPanel();
    this.elementInspector.destroy();
    this.documentInspector.destroy();
    this.element.remove();
  }
}

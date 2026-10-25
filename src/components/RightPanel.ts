/**
 * Arch Email Editor - Right Panel Component (Really Good Emails / Beefree Studio Architecture)
 *
 * Implements the RGE 3-tab Right Panel with 100% visual and functional fidelity:
 * 1. Content: Draggable content blocks (when nothing selected) or Contextual Element Properties
 *    (when an element is selected), with a Close (✕) button to deselect and return to blocks.
 * 2. Rows: Category selector, empty multi-column row layouts, and prebuilt modular sections.
 * 3. Settings: Global email document settings (Content width, alignment, colors, fonts, preheader).
 */

import { BlockType, RowLayoutType, ViewportMode, EmailDocument, SelectedElementInfo } from '../types';
import { Inspector, InspectorEvents } from './Inspector';

export type RightPanelTab = 'content' | 'rows' | 'settings' | 'blocks' | 'sections';

export interface RightPanelEvents extends InspectorEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout: (layout: RowLayoutType) => void;
  onDeselect?: () => void;
}

export class RightPanel {
  private element: HTMLElement;
  private events: RightPanelEvents;
  private activeTab: RightPanelTab = 'blocks';

  private tabButtons: Map<string, HTMLButtonElement> = new Map();
  private tabPanels: Map<string, HTMLElement> = new Map();

  // Element inspector displays in the Content tab when an element is selected
  private elementInspector: Inspector;
  // Document inspector displays in the Settings tab for global design settings
  private documentInspector: Inspector;

  constructor(events: RightPanelEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__right-panel';

    this.elementInspector = new Inspector({
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
  }

  public getElement(): HTMLElement {
    return this.element;
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
        <button type="button" class="arch-right-panel-toggle" id="arch-btn-collapse-panel" title="Collapse / Expand Panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <button type="button" class="arch-right-tab is-active" data-tab="blocks" data-tab-name="content" title="Content Blocks">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1"/>
            <rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/>
            <rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
          CONTENT
        </button>
        <button type="button" class="arch-right-tab" data-tab="sections" data-tab-name="rows" title="Rows & Column Layouts">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="2" width="14" height="4" rx="1"/>
            <rect x="1" y="10" width="14" height="4" rx="1"/>
          </svg>
          ROWS
        </button>
        <button type="button" class="arch-right-tab" data-tab="settings" title="Global Email Settings">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="12" height="12" rx="2"/>
            <line x1="5" y1="6" x2="11" y2="6"/>
            <line x1="5" y1="10" x2="9" y2="10"/>
          </svg>
          SETTINGS
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

        <!-- Tab 2: Rows & Sections -->
        <div class="arch-tab-panel arch-tab-panel--sections is-hidden" id="arch-panel-sections">
          <div class="arch-form-group">
            <select class="arch-select" id="sel-section-category">
              <option value="empty">Empty Rows</option>
              <option value="all">All Categories</option>
              <option value="headers">Headers</option>
              <option value="footers">Footers</option>
              <option value="hero">Hero Sections</option>
              <option value="cta">Call to Action</option>
            </select>
          </div>

          <div class="arch-rows-list" id="arch-rows-tab-list">
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

          <div class="arch-sections-placeholder" style="margin-top: 16px;">
            <div class="arch-sections-placeholder-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
              </svg>
            </div>
            <div style="font-weight: 600; font-size: 13px; color: var(--arch-text-primary); margin-top: 10px;">
              Prebuilt Sections Library
            </div>
            <div style="font-size: 12px; color: var(--arch-text-secondary); text-align: center; margin-top: 4px; line-height: 1.5; max-width: 240px;">
              Prebuilt modular section templates will appear here when category is selected.
            </div>
          </div>
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

    // Bind collapse toggle button
    const collapseBtn = this.element.querySelector<HTMLButtonElement>('#arch-btn-collapse-panel');
    collapseBtn?.addEventListener('click', () => {
      this.element.classList.toggle('is-collapsed');
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

    // Bind Section / Row layout click & dragstart
    this.element.querySelectorAll<HTMLButtonElement>('[data-row-layout]').forEach((btn) => {
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
  }

  public destroy(): void {
    this.elementInspector.destroy();
    this.documentInspector.destroy();
    this.element.remove();
  }
}

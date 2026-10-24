/**
 * Arch Email Editor - Right Panel Component (Really Good Emails / Beefree Studio Architecture)
 *
 * Implements the RGE 3-tab Right Panel with 100% visual and functional fidelity:
 * 1. Blocks: 15 Content Blocks (Title, Paragraph, List, Image, Button, Table, Divider, Spacer,
 *    Social, HTML, Video, Icons, Menu, Sticker, GIF) AND Empty Multi-Column Row Layouts.
 * 2. Sections: Reserved for Prebuilt modular sections (Headers, Footers, Hero, etc.).
 * 3. Settings: Design Settings & Metadata accordion (when nothing is selected) or Contextual
 *    Element Properties (when an element is selected).
 */

import { BlockType, RowLayoutType, ViewportMode, EmailDocument, SelectedElementInfo } from '../types';
import { Inspector, InspectorEvents } from './Inspector';

export type RightPanelTab = 'blocks' | 'sections' | 'settings';

export interface RightPanelEvents extends InspectorEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout: (layout: RowLayoutType) => void;
  onDeselect?: () => void;
}

export class RightPanel {
  private element: HTMLElement;
  private events: RightPanelEvents;
  private activeTab: RightPanelTab = 'blocks';

  private tabButtons: Map<RightPanelTab, HTMLButtonElement> = new Map();
  private tabPanels: Map<RightPanelTab, HTMLElement> = new Map();

  private inspector: Inspector;

  constructor(events: RightPanelEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__right-panel';

    this.inspector = new Inspector({
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
    return this.inspector;
  }

  public getActiveTab(): RightPanelTab {
    return this.activeTab;
  }

  public setActiveTab(tab: RightPanelTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    this.tabButtons.forEach((btn, t) => {
      btn.classList.toggle('is-active', t === tab);
    });

    this.tabPanels.forEach((panel, t) => {
      panel.classList.toggle('is-hidden', t !== tab);
    });
  }

  public setViewportMode(mode: ViewportMode): void {
    this.inspector.setViewportMode(mode);
  }

  public update(
    doc: EmailDocument,
    selectedBlockId: string | null,
    selectedElement?: SelectedElementInfo | null
  ): void {
    this.inspector.update(doc, selectedBlockId, selectedElement);

    // When an element on canvas is selected, automatically switch to Settings/Properties view
    if (selectedElement || selectedBlockId) {
      this.setActiveTab('settings');
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-right-tabs">
        <button type="button" class="arch-right-panel-toggle" id="arch-btn-collapse-panel" title="Collapse / Expand Panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <button type="button" class="arch-right-tab is-active" data-tab="blocks" title="Content Blocks & Rows">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1"/>
            <rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/>
            <rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
          Blocks
        </button>
        <button type="button" class="arch-right-tab" data-tab="sections" title="Prebuilt Sections">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="2" width="14" height="4" rx="1"/>
            <rect x="1" y="10" width="14" height="4" rx="1"/>
          </svg>
          Sections
        </button>
        <button type="button" class="arch-right-tab" data-tab="settings" title="Settings & Properties">
          <svg class="arch-tab-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="12" height="12" rx="2"/>
            <line x1="5" y1="6" x2="11" y2="6"/>
            <line x1="5" y1="10" x2="9" y2="10"/>
          </svg>
          Settings
        </button>
      </div>

      <div class="arch-right-tab-content">
        <!-- Tab 1: Blocks (Content Blocks + Multi-Column Row Layouts) -->
        <div class="arch-tab-panel arch-tab-panel--blocks arch-editor__palette" id="arch-panel-blocks">
          <div class="arch-editor__section-label">Content</div>
          <div class="arch-assets-grid">
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="heading" title="Title Heading">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
              <span>TITLE</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="text" title="Paragraph Copy">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/></svg>
              <span>PARAGRAPH</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="list" title="Bullet List">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
              <span>LIST</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="image" title="Image Banner">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>IMAGE</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="button" title="Call to Action Button">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M12 11l3 3-1.5 1-1.5-4z" fill="currentColor"/></svg>
              <span>BUTTON</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="table" title="Data Table">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
              <span>TABLE</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="divider" title="Divider Line">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><rect x="8" y="5" width="8" height="3" rx="1"/><rect x="8" y="16" width="8" height="3" rx="1"/></svg>
              <span>DIVIDER</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="spacer" title="Vertical Spacer">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 8 12 5 15 8"/><polyline points="9 16 12 19 15 16"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="4" y1="3" x2="20" y2="3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
              <span>SPACER</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="social" title="Social Links">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>SOCIAL</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="html" title="Custom HTML">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>
              <span>HTML</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="video" title="Video Thumbnail">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2.5"/><polygon points="10 9 16 12 10 15 10 9" fill="currentColor"/></svg>
              <span>VIDEO</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="icons" title="Icons Group">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>ICONS</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="menu" title="Navigation Menu">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              <span>MENU</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="gif" data-block-variant="sticker" title="Sticker Graphic">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 18a6 6 0 0 1-6-6"/><path d="M12 21a9 9 0 0 0 9-9h-6a3 3 0 0 0-3 3v6z" fill="#71717a"/></svg>
              <span>STICKER</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="gif" title="Animated GIF">
              <svg class="arch-block-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12a2 2 0 0 1 2-2h1v4H9a2 2 0 0 1-2-2z"/><line x1="13" y1="10" x2="13" y2="14"/><path d="M16 10h3"/><path d="M16 12h2"/><path d="M16 14h1"/></svg>
              <span>GIF</span>
            </button>
          </div>

          <!-- Empty Row Layouts (in Blocks tab per user instruction) -->
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

        <!-- Tab 2: Sections (Prebuilt Modular Sections) -->
        <div class="arch-tab-panel arch-tab-panel--sections is-hidden" id="arch-panel-sections">
          <div class="arch-form-group">
            <select class="arch-select" id="sel-section-category">
              <option value="all">Empty / All Categories</option>
              <option value="headers">Headers</option>
              <option value="footers">Footers</option>
              <option value="hero">Hero Sections</option>
              <option value="cta">Call to Action</option>
            </select>
          </div>
          <div class="arch-sections-placeholder">
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
              Prebuilt section templates (headers, footers, heroes, and testimonials) will appear here.
            </div>
          </div>
        </div>

        <!-- Tab 3: Settings (Smart Inspector & Global Design Settings) -->
        <div class="arch-tab-panel arch-tab-panel--settings arch-editor__inspector is-hidden" id="arch-panel-settings">
        </div>
      </div>
    `;

    // Cache tab buttons and panels
    const tabs = ['blocks', 'sections', 'settings'] as RightPanelTab[];
    tabs.forEach((tab) => {
      const btn = this.element.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (btn) this.tabButtons.set(tab, btn);

      const panel = this.element.querySelector<HTMLElement>(`#arch-panel-${tab}`);
      if (panel) this.tabPanels.set(tab, panel);
    });

    // Mount Inspector into Settings tab panel
    const settingsPanel = this.tabPanels.get('settings');
    if (settingsPanel) {
      settingsPanel.appendChild(this.inspector.getElement());
    }

    // Bind tab switching
    this.tabButtons.forEach((btn, tab) => {
      btn.addEventListener('click', () => {
        this.setActiveTab(tab);
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
    this.inspector.destroy();
    this.element.remove();
  }
}


/**
 * Arch Email Editor - Right Panel Component
 *
 * Implements the unified 3-tab Right Panel:
 * 1. Blocks: Content blocks (Heading, Text, Button, Image, Divider, Spacer, Social, HTML).
 * 2. Sections: Multi-column row layout sections (1 Col, 2 Col 50/50, 2 Col 33/67, 2 Col 67/33, 3 Col).
 * 3. Settings: Contextual element properties (when selected) or global email settings.
 */

import { BlockType, RowLayoutType, ViewportMode, EmailDocument, SelectedElementInfo } from '../types';
import { Inspector, InspectorEvents } from './Inspector';

export type RightPanelTab = 'blocks' | 'sections' | 'settings';

export interface RightPanelEvents extends InspectorEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout: (layout: RowLayoutType) => void;
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
      onSelectElementNode: events.onSelectElementNode
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

    // If user clicked or selected an element on canvas, automatically switch to Settings tab
    if (selectedElement || selectedBlockId) {
      this.setActiveTab('settings');
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-right-tabs">
        <button type="button" class="arch-right-tab is-active" data-tab="blocks" title="Add Content Blocks">
          Blocks
        </button>
        <button type="button" class="arch-right-tab" data-tab="sections" title="Add Layout Sections">
          Sections
        </button>
        <button type="button" class="arch-right-tab" data-tab="settings" title="Element & Email Settings">
          Settings
        </button>
      </div>

      <div class="arch-right-tab-content">
        <!-- Tab 1: Content Blocks -->
        <div class="arch-tab-panel arch-tab-panel--blocks arch-editor__palette" id="arch-panel-blocks">
          <div class="arch-editor__section-label">Content Blocks</div>
          <div class="arch-assets-grid">
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="heading">
              <span class="arch-palette-icon">𝗛</span>
              <span>Heading</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="text">
              <span class="arch-palette-icon">¶</span>
              <span>Text</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="button">
              <span class="arch-palette-icon">🔘</span>
              <span>Button</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="image">
              <span class="arch-palette-icon">🖼</span>
              <span>Image</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="divider">
              <span class="arch-palette-icon">―</span>
              <span>Divider</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="spacer">
              <span class="arch-palette-icon">↕</span>
              <span>Spacer</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="social">
              <span class="arch-palette-icon">🌐</span>
              <span>Social</span>
            </button>
            <button class="arch-palette-item" type="button" draggable="true" data-block-type="html">
              <span class="arch-palette-icon">&lt;/&gt;</span>
              <span>HTML</span>
            </button>
          </div>
        </div>

        <!-- Tab 2: Sections / Multi-Column Layouts -->
        <div class="arch-tab-panel arch-tab-panel--sections is-hidden" id="arch-panel-sections">
          <div class="arch-editor__section-label">Multi-Column Layouts</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="1-col">
              <span class="arch-palette-icon" style="font-size: 16px;">▭</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <span style="font-weight: 600;">1 Column</span>
                <span style="font-size: 11px; color: var(--arch-text-secondary);">100% full-width row</span>
              </div>
            </button>
            <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="2-col-50-50">
              <span class="arch-palette-icon" style="font-size: 16px;">▥</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <span style="font-weight: 600;">2 Columns</span>
                <span style="font-size: 11px; color: var(--arch-text-secondary);">50% / 50% split</span>
              </div>
            </button>
            <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="2-col-33-67">
              <span class="arch-palette-icon" style="font-size: 16px;">◧</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <span style="font-weight: 600;">2 Columns (1/3 + 2/3)</span>
                <span style="font-size: 11px; color: var(--arch-text-secondary);">33% left / 67% right</span>
              </div>
            </button>
            <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="2-col-67-33">
              <span class="arch-palette-icon" style="font-size: 16px;">◨</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <span style="font-weight: 600;">2 Columns (2/3 + 1/3)</span>
                <span style="font-size: 11px; color: var(--arch-text-secondary);">67% left / 33% right</span>
              </div>
            </button>
            <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="3-col">
              <span class="arch-palette-icon" style="font-size: 16px;">▤</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <span style="font-weight: 600;">3 Columns</span>
                <span style="font-size: 11px; color: var(--arch-text-secondary);">33% / 33% / 33% equal split</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Tab 3: Settings (Smart Inspector) -->
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

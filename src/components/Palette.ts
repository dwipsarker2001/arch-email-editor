/**
 * Arch Email Editor - Figma-Style Left Sidebar ("Layers" Tree & "Assets" Palette)
 *
 * Provides two integrated tabs in the left sidebar:
 * 1. Layers Tree (`Layers`): Live hierarchical Figma tree (`Row › Column › Block`)
 *    with hover-highlight sync, click-to-select + scroll-into-view, and quick reorder (`▲`/`▼`) & delete (`✕`).
 * 2. Assets Palette (`Assets`): Draggable & clickable Content Blocks and Multi-Column Row Layouts.
 */

import { BlockType, LayerNode, RowLayoutType } from '../types';
import { canMoveUnit } from '../engine/glue';

export interface PaletteEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout?: (layout: RowLayoutType) => void;
  onSelectLayer?: (el: HTMLElement) => void;
  onHoverLayer?: (el: HTMLElement | null) => void;
  onMoveLayer?: (el: HTMLElement, direction: 'up' | 'down') => void;
  onRemoveLayer?: (el: HTMLElement) => void;
}

export class Palette {
  private element: HTMLElement;
  private events: PaletteEvents;
  private layersContainer: HTMLElement | null = null;
  private assetsContainer: HTMLElement | null = null;
  private collapsedElements: WeakSet<HTMLElement> = new WeakSet();
  private lastLayers: LayerNode[] = [];
  private selectedElement: HTMLElement | null = null;

  constructor(events: PaletteEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__palette';
    this.renderShell();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private renderShell(): void {
    this.element.innerHTML = `
      <div class="arch-sidebar-tabs">
        <button type="button" class="arch-sidebar-tab active" data-tab="layers" title="Figma Layers Tree">
          <span>◇</span> Layers
        </button>
        <button type="button" class="arch-sidebar-tab" data-tab="assets" title="Add Content Blocks & Row Layouts">
          <span>＋</span> Assets
        </button>
      </div>

      <div class="arch-layers-panel" id="arch-layers-panel"></div>

      <div class="arch-assets-panel arch-sidebar-panel--hidden" id="arch-assets-panel">
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

        <div class="arch-editor__section-label" style="margin-top: 14px;">Auto-Layout Rows</div>
        <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="1-col">
          <span>▭</span> 1 Column (100%)
        </button>
        <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="2-col-50-50">
          <span>▥</span> 2 Columns (50 / 50)
        </button>
        <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="2-col-33-67">
          <span>◧</span> 2 Columns (33 / 67)
        </button>
        <button class="arch-palette-item arch-palette-item--row" type="button" draggable="true" data-row-layout="3-col">
          <span>▤</span> 3 Columns (33 / 33 / 33)
        </button>
      </div>
    `;

    this.layersContainer = this.element.querySelector('#arch-layers-panel');
    this.assetsContainer = this.element.querySelector('#arch-assets-panel');

    // Bind tab switching
    const tabs = this.element.querySelectorAll<HTMLButtonElement>('.arch-sidebar-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-tab') as 'layers' | 'assets';
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        this.layersContainer?.classList.toggle('arch-sidebar-panel--hidden', mode !== 'layers');
        this.assetsContainer?.classList.toggle('arch-sidebar-panel--hidden', mode !== 'assets');
      });
    });

    // Bind content block buttons
    const blockButtons = this.element.querySelectorAll<HTMLButtonElement>('[data-block-type]');
    blockButtons.forEach((btn) => {
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

    // Bind row layout buttons
    const rowButtons = this.element.querySelectorAll<HTMLButtonElement>('[data-row-layout]');
    rowButtons.forEach((btn) => {
      const layout = btn.getAttribute('data-row-layout') as RowLayoutType;

      btn.addEventListener('click', () => {
        this.events.onAddRowLayout?.(layout);
      });

      btn.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', `arch-row:${layout}`);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });
  }

  /**
   * Updates the Figma Layers Tree with the latest DOM hierarchy and active selection.
   */
  public updateLayers(layers: LayerNode[], selectedUnit: HTMLElement | null): void {
    this.lastLayers = layers;
    this.selectedElement = selectedUnit;
    this.renderLayerTree();
  }

  private getLayerIcon(node: LayerNode): string {
    if (node.role === 'row') return '▤';
    if (node.role === 'column') return '▥';
    switch (node.type) {
      case 'heading':
        return '𝗛';
      case 'text':
        return '¶';
      case 'button':
        return '🔘';
      case 'image':
        return '🖼';
      case 'divider':
        return '―';
      case 'spacer':
        return '↕';
      case 'social':
        return '🌐';
      default:
        return '◇';
    }
  }

  private renderLayerTree(): void {
    if (!this.layersContainer) return;
    this.layersContainer.innerHTML = '';

    if (this.lastLayers.length === 0) {
      this.layersContainer.innerHTML = `
        <div class="arch-layers-empty">No layers on canvas</div>
      `;
      return;
    }

    const header = document.createElement('div');
    header.className = 'arch-layers-header';
    header.innerHTML = `
      <span>FRAMES &amp; AUTO-LAYOUT</span>
      <span class="arch-layers-count">${this.lastLayers.length}</span>
    `;
    this.layersContainer.appendChild(header);

    const treeRoot = document.createElement('div');
    treeRoot.className = 'arch-layer-tree';

    const renderNode = (node: LayerNode, depth: number) => {
      const isSelected =
        this.selectedElement === node.element ||
        (this.selectedElement && node.children.length === 0 && node.element.contains(this.selectedElement));
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = this.collapsedElements.has(node.element);

      const row = document.createElement('div');
      row.className = `arch-layer-row arch-layer-row--${node.role}${isSelected ? ' selected' : ''}`;
      row.style.paddingLeft = `${8 + depth * 14}px`;

      const canUp = canMoveUnit(node.element, 'up');
      const canDown = canMoveUnit(node.element, 'down');

      row.innerHTML = `
        <span class="arch-layer-toggle ${hasChildren ? '' : 'arch-layer-toggle--empty'}">${
          hasChildren ? (isCollapsed ? '▸' : '▾') : ''
        }</span>
        <span class="arch-layer-icon">${this.getLayerIcon(node)}</span>
        <span class="arch-layer-title">
          <span class="arch-layer-name">${this.escapeHtml(node.label)}</span>
          ${node.sublabel ? `<span class="arch-layer-sub">${this.escapeHtml(node.sublabel)}</span>` : ''}
        </span>
        <span class="arch-layer-actions">
          <button type="button" class="arch-layer-btn btn-layer-up" title="Move Up / Left" ${!canUp ? 'disabled' : ''}>▲</button>
          <button type="button" class="arch-layer-btn btn-layer-down" title="Move Down / Right" ${!canDown ? 'disabled' : ''}>▼</button>
          <button type="button" class="arch-layer-btn arch-layer-btn--del btn-layer-del" title="Delete Layer">✕</button>
        </span>
      `;

      // Toggle expand/collapse
      const toggle = row.querySelector('.arch-layer-toggle');
      toggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!hasChildren) return;
        if (this.collapsedElements.has(node.element)) {
          this.collapsedElements.delete(node.element);
        } else {
          this.collapsedElements.add(node.element);
        }
        this.renderLayerTree();
      });

      // Hover highlights unit on canvas
      row.addEventListener('mouseenter', () => {
        this.events.onHoverLayer?.(node.element);
      });
      row.addEventListener('mouseleave', () => {
        this.events.onHoverLayer?.(null);
      });

      // Click selects unit on canvas and scrolls it into view
      row.addEventListener('click', () => {
        this.events.onSelectLayer?.(node.element);
      });

      // Quick reorder & delete buttons inside the Layers Tree
      row.querySelector('.btn-layer-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.onMoveLayer?.(node.element, 'up');
      });
      row.querySelector('.btn-layer-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.onMoveLayer?.(node.element, 'down');
      });
      row.querySelector('.btn-layer-del')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.onRemoveLayer?.(node.element);
      });

      treeRoot.appendChild(row);

      if (hasChildren && !isCollapsed) {
        for (const child of node.children) {
          renderNode(child, depth + 1);
        }
      }
    };

    for (const rootNode of this.lastLayers) {
      renderNode(rootNode, 0);
    }

    this.layersContainer.appendChild(treeRoot);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public destroy(): void {
    this.element.remove();
  }
}

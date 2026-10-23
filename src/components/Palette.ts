/**
 * Arch Email Editor - Block & Row Layout Palette Component
 *
 * Renders the left sidebar with draggable and clickable primitives:
 * 1. Content Blocks: Heading, Text, Button, Image, Divider, Spacer, Social, Custom HTML.
 * 2. Multi-Column Row Layouts: 1 Col, 2 Col (50/50), 2 Col (33/67), 3 Col (33/33/33).
 */

import { BlockType, RowLayoutType } from '../types';

export interface PaletteEvents {
  onAddBlock: (type: BlockType) => void;
  onAddRowLayout?: (layout: RowLayoutType) => void;
}

export class Palette {
  private element: HTMLElement;
  private events: PaletteEvents;

  constructor(events: PaletteEvents) {
    this.events = events;
    this.element = document.createElement('div');
    this.element.className = 'arch-editor__palette';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="arch-editor__section-label">Add Content Blocks</div>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="heading">
        <span>🔤</span> Heading
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="text">
        <span>📝</span> Text
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="button">
        <span>🔘</span> Button
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="image">
        <span>🖼️</span> Image
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="divider">
        <span>➖</span> Divider
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="spacer">
        <span>↕️</span> Spacer
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="social">
        <span>🌐</span> Social Links
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="html">
        <span>💻</span> Custom HTML
      </button>

      <div class="arch-editor__section-label" style="margin-top: 12px;">Add Row Layouts</div>
      <button class="arch-palette-item" type="button" draggable="true" data-row-layout="1-col">
        <span>▭</span> 1 Column (100%)
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-row-layout="2-col-50-50">
        <span>▥</span> 2 Columns (50 / 50)
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-row-layout="2-col-33-67">
        <span>◧</span> 2 Columns (33 / 67)
      </button>
      <button class="arch-palette-item" type="button" draggable="true" data-row-layout="3-col">
        <span>▤</span> 3 Columns (33 / 33 / 33)
      </button>
    `;

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

  public destroy(): void {
    this.element.remove();
  }
}

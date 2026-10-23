/**
 * Arch Email Editor - Block Palette Component
 *
 * Renders the left sidebar of draggable and clickable block primitives:
 * Heading, Text, Button, Image, Divider, and Custom HTML.
 */

import { BlockType } from '../types';

export interface PaletteEvents {
  onAddBlock: (type: BlockType) => void;
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
      <div class="arch-editor__section-label">Add Blocks</div>
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
      <button class="arch-palette-item" type="button" draggable="true" data-block-type="html">
        <span>💻</span> Custom HTML
      </button>
    `;

    const buttons = this.element.querySelectorAll<HTMLButtonElement>('[data-block-type]');
    buttons.forEach((btn) => {
      const type = btn.getAttribute('data-block-type') as BlockType;

      // Click to append at end
      btn.addEventListener('click', () => {
        this.events.onAddBlock(type);
      });

      // Native HTML5 drag initiation
      btn.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', type);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
    });
  }

  public destroy(): void {
    this.element.remove();
  }
}

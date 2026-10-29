import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchEmailEditor } from '../src/editor';

describe('AI sidepanel', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    container.remove();
  });

  it('opens an empty AI sidepanel from the spark button and closes it again', () => {
    editor = ArchEmailEditor.create(container);
    const spark = container.querySelector<HTMLButtonElement>('.arch-btn--ai')!;

    spark.click();

    const panel = container.querySelector<HTMLElement>('.arch-ai-sidepanel');
    expect(panel?.classList.contains('is-open')).toBe(true);
    expect(panel?.querySelector('.arch-prop-title')?.textContent).toBe('AI Assistant');
    expect(panel?.querySelector('.arch-assets-body')?.textContent?.trim()).toBe('');

    panel?.querySelector<HTMLButtonElement>('#btn-ai-close')?.click();
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();

    spark.click();
    expect(container.querySelector('.arch-ai-sidepanel')).not.toBeNull();
    spark.click();
    expect(container.querySelector('.arch-ai-sidepanel')).toBeNull();
  });
});

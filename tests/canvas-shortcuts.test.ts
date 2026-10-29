import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchEmailEditor } from '../src/editor';

describe('Canvas keyboard and wheel shortcuts', () => {
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

  const zoomTitle = () =>
    container.querySelector<HTMLButtonElement>('.arch-btn--zoom-in')?.title;

  it('zooms with Ctrl + mouse wheel over the parent canvas', () => {
    editor = ArchEmailEditor.create(container);
    const canvas = container.querySelector<HTMLElement>('.arch-canvas-container')!;

    canvas.dispatchEvent(
      new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true })
    );

    expect(zoomTitle()).toBe('Zoom In (110%)');
  });

  it('zooms with Ctrl + mouse wheel over the email iframe', () => {
    editor = ArchEmailEditor.create(container);
    const doc = container.querySelector('iframe')!.contentDocument!;
    const IframeWheelEvent = doc.defaultView!.WheelEvent;

    doc.body.dispatchEvent(
      new IframeWheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true })
    );

    expect(zoomTitle()).toBe('Zoom In (110%)');
  });

  it('does not zoom on a plain mouse wheel', () => {
    editor = ArchEmailEditor.create(container);
    const canvas = container.querySelector<HTMLElement>('.arch-canvas-container')!;

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));

    expect(zoomTitle()).toBe('Zoom In');
  });

  it('undoes and redoes with Ctrl+Z / Ctrl+Y while the canvas iframe has focus', () => {
    editor = ArchEmailEditor.create(container);
    editor.insertHTML('<p>New change for undo</p>');

    const doc = container.querySelector('iframe')!.contentDocument!;
    const IframeKeyboardEvent = doc.defaultView!.KeyboardEvent;
    doc.dispatchEvent(new IframeKeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(editor.getHTML()).not.toContain('New change for undo');

    doc.dispatchEvent(new IframeKeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(editor.getHTML()).toContain('New change for undo');
  });
});

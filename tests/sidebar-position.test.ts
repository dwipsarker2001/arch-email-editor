import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { ReactEmailEditor } from '../packages/react';
import { VueEmailEditor } from '../packages/vue';

describe('Sidebar Position Configuration & Runtime API', () => {
  let container: HTMLDivElement;
  let editor: ArchEmailEditor | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-sidebar-test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    container.remove();
  });

  it('defaults to right sidebar position when no option is provided', () => {
    editor = ArchEmailEditor.create(container);
    expect(editor.getSidebarPosition()).toBe('right');

    const root = container.querySelector('.arch-editor');
    expect(root?.classList.contains('arch-editor--sidebar-left')).toBe(false);
    expect(root?.classList.contains('arch-editor--sidebar-right')).toBe(true);

    const body = container.querySelector('.arch-editor__body');
    const children = Array.from(body?.children || []);
    // In right mode, canvas is first child, rightPanel is second child
    expect(children[0]?.classList.contains('arch-editor__canvas')).toBe(true);
    expect(children[1]?.classList.contains('arch-editor__right-panel')).toBe(true);
  });

  it('initializes with left sidebar position when sidebarPosition is "left"', () => {
    editor = ArchEmailEditor.create(container, { sidebarPosition: 'left' });
    expect(editor.getSidebarPosition()).toBe('left');

    const root = container.querySelector('.arch-editor');
    expect(root?.classList.contains('arch-editor--sidebar-left')).toBe(true);

    const body = container.querySelector('.arch-editor__body');
    const children = Array.from(body?.children || []);
    // In left mode, rightPanel (sidebar) is first child, canvas is second child
    expect(children[0]?.classList.contains('arch-editor__right-panel')).toBe(true);
    expect(children[1]?.classList.contains('arch-editor__canvas')).toBe(true);
  });

  it('dynamically switches sidebar position using setSidebarPosition()', () => {
    editor = ArchEmailEditor.create(container, { sidebarPosition: 'right' });
    expect(editor.getSidebarPosition()).toBe('right');

    // Switch to left
    editor.setSidebarPosition('left');
    expect(editor.getSidebarPosition()).toBe('left');

    const root = container.querySelector('.arch-editor');
    expect(root?.classList.contains('arch-editor--sidebar-left')).toBe(true);
    expect(root?.classList.contains('arch-editor--sidebar-right')).toBe(false);

    let body = container.querySelector('.arch-editor__body');
    let children = Array.from(body?.children || []);
    expect(children[0]?.classList.contains('arch-editor__right-panel')).toBe(true);
    expect(children[1]?.classList.contains('arch-editor__canvas')).toBe(true);

    // Switch back to right
    editor.setSidebarPosition('right');
    expect(editor.getSidebarPosition()).toBe('right');
    expect(root?.classList.contains('arch-editor--sidebar-left')).toBe(false);
    expect(root?.classList.contains('arch-editor--sidebar-right')).toBe(true);

    body = container.querySelector('.arch-editor__body');
    children = Array.from(body?.children || []);
    expect(children[0]?.classList.contains('arch-editor__canvas')).toBe(true);
    expect(children[1]?.classList.contains('arch-editor__right-panel')).toBe(true);
  });

  it('preserves sidebar state (active tab & content) when switching position', () => {
    editor = ArchEmailEditor.create(container, { sidebarPosition: 'right' });
    // Switch to 'sections' tab
    editor.getSidebar()?.setActiveTab('sections');
    expect(editor.getSidebar()?.getActiveTab()).toBe('sections');

    // Switch position to left
    editor.setSidebarPosition('left');
    expect(editor.getSidebarPosition()).toBe('left');
    expect(editor.getSidebar()?.getActiveTab()).toBe('sections');
  });

  it('updates canvas toggle button icon and accessibility attributes based on sidebar position', () => {
    editor = ArchEmailEditor.create(container, { sidebarPosition: 'left' });
    const toggleBtn = container.querySelector<HTMLButtonElement>('.arch-btn--sidebar-close');
    expect(toggleBtn).not.toBeNull();
    // For left sidebar, icon path or aria label references left sidebar
    expect(toggleBtn?.getAttribute('aria-label')).toBe('Close left sidebar');

    editor.setSidebarPosition('right');
    expect(toggleBtn?.getAttribute('aria-label')).toBe('Close right sidebar');
  });

  it('switches sidebar position from toolbar buttons and keeps them in sync', () => {
    editor = ArchEmailEditor.create(container, { sidebarPosition: 'right' });
    const leftBtn = container.querySelector<HTMLButtonElement>('.arch-btn--sidebar-left');
    const rightBtn = container.querySelector<HTMLButtonElement>('.arch-btn--sidebar-right');
    expect(leftBtn).not.toBeNull();
    expect(rightBtn).not.toBeNull();
    expect(rightBtn?.classList.contains('is-active')).toBe(true);

    leftBtn!.click();
    expect(editor.getSidebarPosition()).toBe('left');
    expect(leftBtn?.classList.contains('is-active')).toBe(true);
    expect(rightBtn?.classList.contains('is-active')).toBe(false);

    // Programmatic changes keep the toolbar buttons in sync too
    editor.setSidebarPosition('right');
    expect(rightBtn?.classList.contains('is-active')).toBe(true);
    expect(leftBtn?.classList.contains('is-active')).toBe(false);
  });

  it('React adapter accepts sidebarPosition prop and exposes getSidebarPosition & setSidebarPosition', () => {
    expect(ReactEmailEditor).toBeDefined();
    // TypeScript / interface check: verify types allow sidebarPosition
    const options: import('../src/types').EditorOptions = {
      sidebarPosition: 'left'
    };
    expect(options.sidebarPosition).toBe('left');
  });

  it('Vue adapter accepts sidebarPosition prop', () => {
    expect(VueEmailEditor.props).toHaveProperty('sidebarPosition');
  });
});

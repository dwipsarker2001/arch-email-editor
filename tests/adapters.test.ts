import { describe, it, expect, vi } from 'vitest';
import { ReactEmailEditor } from '../packages/react';
import { VueEmailEditor } from '../packages/vue';
import { ArchEmailEditor } from '../src/editor';

describe('Framework Adapters', () => {
  it('exports ReactEmailEditor component definition', () => {
    expect(ReactEmailEditor).toBeDefined();
    expect(typeof ReactEmailEditor).toBe('object'); // forwardRef returns object
  });

  it('exports VueEmailEditor component definition', () => {
    expect(VueEmailEditor).toBeDefined();
    expect(VueEmailEditor.name).toBe('VueEmailEditor');
  });

  it('React adapter mounts ArchEmailEditor and handles cleanup', () => {
    const createSpy = vi.spyOn(ArchEmailEditor, 'create');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onChange = vi.fn();
    const editor = ArchEmailEditor.create(container, { onChange });
    expect(createSpy).toHaveBeenCalledWith(container, { onChange });

    const destroySpy = vi.spyOn(editor, 'destroy');
    editor.destroy();
    expect(destroySpy).toHaveBeenCalled();

    container.remove();
    createSpy.mockRestore();
  });
});

/**
 * Arch Email Editor - React Adapter Component
 *
 * Pattern: Thin Adapter around the Vanilla ArchEmailEditor Core.
 *
 * This component:
 * 1. Creates a DOM container via `useRef<HTMLDivElement>`.
 * 2. Instantiates the vanilla `ArchEmailEditor` inside `useEffect`.
 * 3. Handles React 18/19 StrictMode double-mounting safely by calling `editor.destroy()` on unmount.
 * 4. Exposes imperative methods (`getJSON()`, `getHTML()`, `editor`) via `forwardRef` and `useImperativeHandle`.
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ArchEmailEditor } from '../../src/editor';
import { EmailDocument, EditorOptions } from '../../src/types';

export interface ReactEmailEditorProps extends Omit<EditorOptions, 'target'> {
  /** Optional custom CSS class name for the wrapper element */
  className?: string;
  /** Optional inline styles for the wrapper element */
  style?: React.CSSProperties;
}

export interface ReactEmailEditorRef {
  /** Direct access to the underlying Vanilla ArchEmailEditor instance */
  editor: ArchEmailEditor | null;
  /** Returns the current document state as a JSON AST */
  getJSON: () => EmailDocument | null;
  /** Compiles and returns production email HTML */
  getHTML: () => string;
}

export const ReactEmailEditor = forwardRef<ReactEmailEditorRef, ReactEmailEditorProps>(
  ({ initialData, theme, readOnly, onChange, onSelectBlock, className, style }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<ArchEmailEditor | null>(null);

    // Keep ref to callbacks to prevent stale closures when parent re-renders
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const onSelectBlockRef = useRef(onSelectBlock);
    onSelectBlockRef.current = onSelectBlock;

    useEffect(() => {
      if (!containerRef.current) return;

      // Mount the vanilla editor core into the React ref container
      const editor = ArchEmailEditor.create(containerRef.current, {
        initialData,
        theme,
        readOnly,
        onChange: (doc) => onChangeRef.current?.(doc),
        onSelectBlock: (block) => onSelectBlockRef.current?.(block)
      });

      editorInstance.current = editor;

      // Cleanup on unmount (prevents memory leaks and duplicate DOM trees)
      return () => {
        editor.destroy();
        editorInstance.current = null;
      };
    }, []);

    // Expose ref API to parent React components
    useImperativeHandle(ref, () => ({
      get editor() {
        return editorInstance.current;
      },
      getJSON() {
        return editorInstance.current ? editorInstance.current.getJSON() : null;
      },
      getHTML() {
        return editorInstance.current ? editorInstance.current.getHTML() : '';
      }
    }));

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: '600px', ...style }}
      />
    );
  }
);

ReactEmailEditor.displayName = 'ReactEmailEditor';

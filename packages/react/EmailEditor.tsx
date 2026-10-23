import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ArchEmailEditor } from '../../src/editor';
import { EmailDocument, EditorOptions } from '../../src/types';

export interface ReactEmailEditorProps extends Omit<EditorOptions, 'target'> {
  className?: string;
  style?: React.CSSProperties;
}

export interface ReactEmailEditorRef {
  editor: ArchEmailEditor | null;
  getJSON: () => EmailDocument | null;
  getHTML: () => string;
}

export const ReactEmailEditor = forwardRef<ReactEmailEditorRef, ReactEmailEditorProps>(
  ({ initialData, theme, readOnly, onChange, onSelectBlock, className, style }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<ArchEmailEditor | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      const editor = ArchEmailEditor.create(containerRef.current, {
        initialData,
        theme,
        readOnly,
        onChange,
        onSelectBlock
      });

      editorInstance.current = editor;

      return () => {
        editor.destroy();
        editorInstance.current = null;
      };
    }, []);

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

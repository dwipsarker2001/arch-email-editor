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
import { EmailDocument, EditorOptions, PrebuiltSection, ToolbarCustomButton } from '../../src/types';

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
  /** Sets and replaces current email content with new HTML */
  setHTML: (htmlString: string) => void;
  /** Loads HTML content into the editor */
  loadHTML: (htmlString: string) => void;
  /** Inserts custom HTML content dynamically */
  insertHTML: (htmlSnippet: string, options?: { targetElement?: HTMLElement | null; position?: 'before' | 'after' }) => void;
  /** Sets the template name in the toolbar */
  setTemplateName: (name: string) => void;
  /** Gets the current template name */
  getTemplateName: () => string;
  /** Adds a custom button to the top-right toolbar */
  addCustomButton: (button: ToolbarCustomButton) => void;
  /** Removes a custom button by id */
  removeCustomButton: (buttonId: string) => void;
  /** Gets the current loaded modular sections */
  getSections: () => PrebuiltSection[];
  /** Gets a modular section by its unique ID */
  getSectionById: (id: string) => PrebuiltSection | undefined;
  /** Replaces modular sections library */
  setSections: (sections: PrebuiltSection[]) => void;
  /** Adds a custom modular section */
  addSection: (section: PrebuiltSection) => void;
  /** Removes a modular section by id */
  removeSection: (id: string) => void;
}

export const ReactEmailEditor = forwardRef<ReactEmailEditorRef, ReactEmailEditorProps>(
  (
    {
      initialData,
      theme,
      readOnly,
      templateName,
      editableTemplateName,
      onTemplateNameChange,
      customButtons,
      sections,
      customSections,
      onChange,
      onSelectBlock,
      className,
      style
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<ArchEmailEditor | null>(null);

    // Keep ref to callbacks to prevent stale closures when parent re-renders
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const onSelectBlockRef = useRef(onSelectBlock);
    onSelectBlockRef.current = onSelectBlock;

    const onTemplateNameChangeRef = useRef(onTemplateNameChange);
    onTemplateNameChangeRef.current = onTemplateNameChange;

    useEffect(() => {
      if (!containerRef.current) return;

      // Mount the vanilla editor core into the React ref container
      const editor = ArchEmailEditor.create(containerRef.current, {
        initialData,
        theme,
        readOnly,
        templateName,
        editableTemplateName,
        customButtons,
        sections,
        customSections,
        onTemplateNameChange: (name) => onTemplateNameChangeRef.current?.(name),
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
      },
      setHTML(htmlString: string) {
        editorInstance.current?.setHTML(htmlString);
      },
      loadHTML(htmlString: string) {
        editorInstance.current?.loadHTML(htmlString);
      },
      insertHTML(htmlSnippet: string, options?: { targetElement?: HTMLElement | null; position?: 'before' | 'after' }) {
        editorInstance.current?.insertHTML(htmlSnippet, options);
      },
      setTemplateName(name: string) {
        editorInstance.current?.setTemplateName(name);
      },
      getTemplateName() {
        return editorInstance.current ? editorInstance.current.getTemplateName() : '';
      },
      addCustomButton(button: ToolbarCustomButton) {
        editorInstance.current?.addCustomButton(button);
      },
      removeCustomButton(buttonId: string) {
        editorInstance.current?.removeCustomButton(buttonId);
      },
      getSections() {
        return editorInstance.current ? editorInstance.current.getSections() : [];
      },
      getSectionById(id: string) {
        return editorInstance.current?.getSectionById(id);
      },
      setSections(newSections: PrebuiltSection[]) {
        editorInstance.current?.setSections(newSections);
      },
      addSection(newSection: PrebuiltSection) {
        editorInstance.current?.addSection(newSection);
      },
      removeSection(id: string) {
        editorInstance.current?.removeSection(id);
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

/**
 * Arch Email Editor - Types and Schema Definitions
 * 
 * Core architectural principle: Framework-agnostic document state.
 * The editor manipulates this JSON AST, which is subsequently compiled
 * into client-safe table HTML via `compileToEmailHtml()`.
 */

/**
 * Supported email block types.
 */
export type BlockType = 'heading' | 'text' | 'button' | 'image' | 'divider';

/**
 * Visual styling attributes for a block.
 * These map to inline CSS in the compiled email table rows.
 */
export interface BlockStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  borderRadius?: string;
  width?: string;
  height?: string;
}

/**
 * Content payload specific to each block type.
 */
export interface BlockContent {
  /** Heading or paragraph copy */
  text?: string;
  /** Heading level: 1 (h1), 2 (h2), or 3 (h3) */
  level?: 1 | 2 | 3;
  /** Button title / call to action text */
  label?: string;
  /** Button target hyperlink URL */
  url?: string;
  /** Image source URL */
  src?: string;
  /** Image alternative text for accessibility and screen readers */
  alt?: string;
}

/**
 * An individual email block in the document AST.
 */
export interface BlockNode {
  /** Unique block identifier */
  id: string;
  /** Block variant */
  type: BlockType;
  /** Block textual or media content */
  content: BlockContent;
  /** Block CSS presentation rules */
  style: BlockStyle;
}

/**
 * Global newsletter email settings.
 */
export interface DocumentSettings {
  /** Max content width, standard for emails is 600px */
  contentWidth: string;
  /** Outer canvas / email client background color */
  backgroundColor: string;
  /** Base typography font stack */
  fontFamily: string;
  /** Base copy color */
  textColor: string;
}

/**
 * The complete serializable Email Document.
 * Can be exported to JSON to persist in databases, or compiled to email HTML.
 */
export interface EmailDocument {
  version: '1.0';
  settings: DocumentSettings;
  blocks: BlockNode[];
}

/**
 * Configuration options passed to `ArchEmailEditor.create(target, options)`.
 */
export interface EditorOptions {
  /** DOM element or selector string to mount the editor into */
  target?: HTMLElement | string;
  /** Initial template document (defaults to starter newsletter) */
  initialData?: EmailDocument;
  /** UI theme */
  theme?: 'light' | 'dark';
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback fired whenever blocks, content, or settings change */
  onChange?: (doc: EmailDocument) => void;
  /** Callback fired when a block is selected or deselected */
  onSelectBlock?: (block: BlockNode | null) => void;
}

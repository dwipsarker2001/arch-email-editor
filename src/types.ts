/**
 * Arch Email Editor - Types and Schema Definitions
 * 
 * Core architectural principle: Framework-agnostic document state.
 * Supports both structured block ASTs and full prebuilt HTML email templates
 * (preserving media queries, nested tables, MSO VML, and head styles without breaking).
 */

/**
 * Supported email block types.
 */
export type BlockType =
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'divider'
  | 'spacer'
  | 'social'
  | 'html'
  | 'list'
  | 'table'
  | 'video'
  | 'icons'
  | 'menu'
  | 'gif';

/**
 * Supported multi-column row layout presets.
 */
export type RowLayoutType =
  | '1-col'
  | '2-col-50-50'
  | '2-col-33-67'
  | '2-col-67-33'
  | '3-col'
  | '4-col';

/**
 * Responsive preview & style customization viewport mode.
 */
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

/**
 * Five-level structural taxonomy role for any node in an email layout.
 */
export type UnitRole = 'body' | 'row' | 'column' | 'block' | 'leaf';

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
  /** Raw or prebuilt HTML snippet for custom sections */
  html?: string;
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
  /** Content area alignment: 'left' | 'center' */
  contentAlign?: 'left' | 'center';
  /** Outer canvas / email client background color */
  backgroundColor: string;
  /** Content area background color */
  contentBackgroundColor?: string;
  /** Base typography font stack */
  fontFamily: string;
  /** Base copy color */
  textColor: string;
  /** Preheader text for email inboxes */
  preheader?: string;
}

/**
 * The complete serializable Email Document.
 * Can be exported to JSON to persist in databases, or compiled to email HTML.
 * When `rawHtml` is present, it preserves 100% of the imported prebuilt template.
 */
export interface EmailDocument {
  version: '1.0';
  settings: DocumentSettings;
  blocks: BlockNode[];
  /** Preserved full HTML document (keeps <head>, <style>, media queries, and nested tables intact) */
  rawHtml?: string;
}

/**
 * Breadcrumb item representing an ancestor in the 5-level structural taxonomy.
 */
export interface BreadcrumbItem {
  label: string;
  role: UnitRole;
  element: HTMLElement;
}

/**
 * Node in the Figma-style hierarchical Layers Tree in the left sidebar.
 */
export interface LayerNode {
  id: string;
  label: string;
  sublabel?: string;
  role: UnitRole;
  type: SelectedElementInfo['type'];
  element: HTMLElement;
  children: LayerNode[];
}

/**
 * Information about a currently selected DOM node and its resolved structural unit on the canvas.
 */
export interface SelectedElementInfo {
  tagName: string;
  type:
    | 'heading'
    | 'text'
    | 'button'
    | 'image'
    | 'divider'
    | 'spacer'
    | 'social'
    | 'list'
    | 'table'
    | 'video'
    | 'icons'
    | 'menu'
    | 'html'
    | 'sticker'
    | 'gif'
    | 'column'
    | 'row'
    | 'section'
    | 'other';
  unitRole?: UnitRole;
  axis?: 'vertical' | 'horizontal';
  text?: string;
  src?: string;
  alt?: string;
  url?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  textAlign?: string;
  padding?: string;
  width?: string;
  height?: string;
  borderRadius?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canSelectParent?: boolean;
  ancestry?: BreadcrumbItem[];
  /** The inner clicked DOM element (e.g. <img>, <a>, <p>) */
  element: HTMLElement;
  /** The resolved moveable structural unit (e.g. table.button_block, table.row, td.column) */
  unit?: HTMLElement;
}

/**
 * Custom action button definition added to the top-right toolbar.
 */
export interface ToolbarCustomButton {
  /** Unique identifier for the custom action button */
  id: string;
  /** Button text label */
  label: string;
  /** Optional icon (emoji, HTML/SVG snippet, or text icon) */
  icon?: string;
  /** Optional hover tooltip title */
  title?: string;
  /** Optional CSS classes (e.g. 'arch-btn--primary') */
  className?: string;
  /** Click callback with editor instance and native MouseEvent */
  onClick: (editor: any, event: MouseEvent) => void;
}

/**
 * A prebuilt or custom modular email section that can be dragged or clicked
 * to insert directly into an email template.
 */
export interface PrebuiltSection {
  /** Unique section identifier */
  id: string;
  /** Section display title */
  name: string;
  /** Section category (e.g. 'Header', 'Hero', 'Features', 'Call to Action', 'Footer', 'General') */
  category: string;
  /** Optional visual thumbnail: SVG string, image URL, or silhouette */
  thumbnail?: string;
  /** Optional description for search and tooltips */
  description?: string;
  /** Cross-client email-safe HTML markup */
  html: string;
}

/**
 * A single template placeholder string shown in the Template Strings sidepanel.
 * Hosts may pass either this flat shape or a nested `{ categories }` shape.
 */
export interface PlaceholderItem {
  /** The template string to copy/insert (e.g. "{{-FM_NAME-}}"). Aliases: `code`. */
  value?: string;
  code?: string;
  /** Friendly display name (e.g. "Firm Name"). Falls back to description, then value. */
  label?: string;
  /** Meaning / description of the placeholder. */
  description?: string;
  /** Grouping category (e.g. "Firm Details"). Aliases: `category_name`. */
  category?: string;
  category_name?: string;
}

export interface PlaceholderCategory {
  category_name?: string;
  category?: string;
  placeholders: PlaceholderItem[];
}

export type PlaceholdersOption = PlaceholderItem[] | { categories: PlaceholderCategory[] };

/**
 * Configuration options passed to `ArchEmailEditor.create(target, options)`.
 */
/**
 * Configuration options to toggle default action buttons in the top-right toolbar.
 */
export interface ToolbarActionsOptions {
  /** Whether to show the "Import HTML" button (default: true) */
  importHtml?: boolean;
  /** Whether to show the "Export JSON" button (default: true) */
  exportJson?: boolean;
  /** Whether to show the "Export HTML" button (default: true) */
  exportHtml?: boolean;
  /** Whether to show the "Clear" button (default: true) */
  clear?: boolean;
}

export interface EditorOptions {
  /** DOM element or selector string to mount the editor into */
  target?: HTMLElement | string;
  /** Initial template document (defaults to starter newsletter) */
  initialData?: EmailDocument;
  /** UI theme */
  theme?: 'light' | 'dark';
  /** Position of the sidebar panel: 'left' or 'right' (default: 'right') */
  sidebarPosition?: 'left' | 'right';
  /** Read-only mode */
  readOnly?: boolean;
  /** Template name / title displayed in the editor toolbar (default: "Arch Email Editor") */
  templateName?: string;
  /** Whether the user can click the template name in the toolbar to edit it inline (default: true) */
  editableTemplateName?: boolean;
  /** Callback fired when the template name is changed */
  onTemplateNameChange?: (name: string) => void;
  /** Custom action buttons added to the top-right toolbar actions bar (e.g. Save, Send) */
  customButtons?: ToolbarCustomButton[];
  /** Options to toggle visibility of default action buttons in the top-right toolbar */
  actions?: ToolbarActionsOptions;
  /** Shortcut to show/hide "Import HTML" button (default: true) */
  showImportHtml?: boolean;
  /** Shortcut to show/hide "Export HTML" button (default: true) */
  showExportHtml?: boolean;
  /** Shortcut to show/hide "Export JSON" button (default: true) */
  showExportJson?: boolean;
  /** Shortcut to show/hide "Clear" button (default: true) */
  showClear?: boolean;
  /** Prebuilt modular sections library (overrides built-in sections if provided) */
  sections?: PrebuiltSection[];
  /** Custom modular sections array to append to the sections library */
  customSections?: PrebuiltSection[];
  /** Template placeholder strings shown in the Template Strings sidepanel.
   *  Accepts a flat array or a nested `{ categories }` object. Hosts fetch these from their own API. */
  placeholders?: PlaceholdersOption;
  /** Callback fired whenever blocks, content, or settings change */
  onChange?: (doc: EmailDocument) => void;
  /** Callback fired when an element or block is selected */
  onSelectBlock?: (block: BlockNode | null) => void;
  /** Callback fired when user selects a file via Image Replace > Upload */
  onUploadImage?: (file: File, callback: (url: string) => void) => void;
  /** Callback fired when user clicks Image Replace > Browse media */
  onBrowseMedia?: (callback: (url: string) => void) => void;
  /** Callback fired when user clicks Image Crop button */
  onCropImage?: (element: HTMLElement) => void;
  /** Callback fired when user clicks Image Remove button */
  onRemoveImage?: (element: HTMLElement) => void;
}

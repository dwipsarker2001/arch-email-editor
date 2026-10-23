export type BlockType = 'heading' | 'text' | 'button' | 'image' | 'divider';

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

export interface BlockContent {
  text?: string;
  level?: 1 | 2 | 3;
  label?: string;
  url?: string;
  src?: string;
  alt?: string;
}

export interface BlockNode {
  id: string;
  type: BlockType;
  content: BlockContent;
  style: BlockStyle;
}

export interface DocumentSettings {
  contentWidth: string; // e.g. "600px"
  backgroundColor: string; // outer email background e.g. "#f4f4f7"
  fontFamily: string; // e.g. "Arial, sans-serif"
  textColor: string; // e.g. "#333333"
}

export interface EmailDocument {
  version: '1.0';
  settings: DocumentSettings;
  blocks: BlockNode[];
}

export interface EditorOptions {
  target?: HTMLElement | string;
  initialData?: EmailDocument;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  onChange?: (doc: EmailDocument) => void;
  onSelectBlock?: (block: BlockNode | null) => void;
}

# Design Spec: Framework-Agnostic Drag-and-Drop Email Editor

**Date**: 2026-10-23  
**Status**: Pending Review  
**Target Package**: `@arch/email-editor` (Core), `@arch/email-editor-react`, `@arch/email-editor-vue`

---

## 1. Goal & Vision
Create an embeddable, framework-agnostic Drag-and-Drop Email Editor (similar to CKEditor / Unlayer) that can be embedded into:
1. **Plain HTML** via a single `<script>` tag (`dist/arch-email-editor.umd.js`) and `<link>` stylesheet.
2. **React applications** via `@arch/email-editor-react`.
3. **Vue 3 applications** via `@arch/email-editor-vue`.
4. Any other JS framework (Angular, Svelte) via the ESM/Vanilla TypeScript API.

The editor allows users to visually compose newsletter layouts (sections, columns, text, headings, buttons, images, dividers, spacers), modify block styles via an interactive property inspector sidebar, and export both a reusable JSON template and bulletproof, email-client-tested HTML (rendered with table layouts and Outlook MSO support).

---

## 2. Monorepo & Package Architecture

```
arch-newsletter/
├── packages/
│   ├── core/                        # 100% Vanilla TypeScript Engine (Zero framework dependencies)
│   │   ├── src/
│   │   │   ├── model/               # Document schema, types, AST definitions, default template
│   │   │   ├── state/               # Reactive Store, Selection state, Undo/Redo stack
│   │   │   ├── dnd/                 # Drag-and-Drop manager (palette drag, reorder, drop zones)
│   │   │   ├── view/                # DOM canvas view, block renderers, toolbar
│   │   │   ├── inspector/           # Contextual sidebar property controls
│   │   │   ├── compiler/            # JSON -> MJML -> Bulletproof Email HTML generator
│   │   │   └── index.ts             # Public API & ArchEmailEditor class
│   │   ├── package.json             # Builds UMD (dist/arch-email-editor.umd.js) + ESM + CSS
│   │   └── vite.config.ts
│   │
│   ├── react/                       # Thin React Wrapper (<EmailEditor />)
│   │   ├── src/
│   │   │   ├── EmailEditor.tsx      # Mounts core via useRef/useEffect
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── vue/                         # Thin Vue 3 Wrapper (<EmailEditor />)
│       ├── src/
│       │   ├── EmailEditor.vue      # Mounts core via onMounted/onBeforeUnmount
│       │   └── index.ts
│       └── package.json
│
└── examples/
    ├── vanilla/index.html           # Tests single <script> tag UMD usage in browser
    ├── react-demo/                  # Tests React integration
    └── vue-demo/                    # Tests Vue integration
```

### Build & Distribution Targets
- **Core UMD**: `dist/arch-email-editor.umd.js` exposing `window.ArchEmailEditor`.
- **Core ESM**: `dist/index.mjs` with full TypeScript typings.
- **Core CSS**: `dist/style.css` using namespaced BEM classes (`arch-editor__*`) to prevent CSS collisions.
- **React Adapter**: Thin wrapper component with typed props (`initialData`, `onChange`, `onSelect`, `theme`).
- **Vue Adapter**: Thin Vue 3 component with `v-model` / event bindings.

---

## 3. Data Model (JSON Document AST)

The editor state is represented as a structured AST tree:

```typescript
export type ElementType = 'heading' | 'text' | 'button' | 'image' | 'divider' | 'spacer';

export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  borderRadius?: string;
  height?: string;
  width?: string;
}

export interface ElementNode {
  id: string;
  type: ElementType;
  content: {
    text?: string;
    level?: 1 | 2 | 3;
    label?: string;
    url?: string;
    src?: string;
    alt?: string;
  };
  style: ElementStyle;
}

export interface ColumnNode {
  id: string;
  width: string; // e.g. "100%", "50%", "33.33%"
  elements: ElementNode[];
  style?: {
    backgroundColor?: string;
    padding?: string;
  };
}

export interface SectionNode {
  id: string;
  columns: ColumnNode[];
  style: {
    backgroundColor?: string;
    padding?: string;
  };
}

export interface EmailDocument {
  version: '1.0';
  settings: {
    contentWidth: string; // default "600px"
    backgroundColor: string; // default "#f4f4f7"
    fontFamily: string; // default "Arial, sans-serif"
    textColor: string; // default "#333333"
  };
  sections: SectionNode[];
}
```

---

## 4. Email HTML Compilation Pipeline

Email clients (Outlook Desktop 2007-2021, Gmail mobile, Yahoo Mail) lack standard Flexbox, CSS Grid, and external stylesheets. The compiler solves this:

1. **Step 1: AST -> MJML**:
   - Maps `EmailDocument` to `<mjml><mj-body>`
   - Maps `SectionNode` to `<mj-section>`
   - Maps `ColumnNode` to `<mj-column>`
   - Maps `ElementNode` to `<mj-text>`, `<mj-button>`, `<mj-image>`, `<mj-divider>`, `<mj-spacer>`
2. **Step 2: MJML -> Client-Tested Email HTML**:
   - Uses `mjml-browser` to compile the MJML string into full, table-based responsive HTML.
   - Includes Outlook MSO conditionals (`<!--[if mso]>`), inline CSS attributes, and fallback tables.
3. **Step 3 (Fallback)**:
   - Built-in lightweight table renderer if running in restricted environments without WebAssembly/eval.

---

## 5. UI Layout & Drag-and-Drop Interaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: [Undo] [Redo] | [Preview] [Export JSON] [Export HTML] [Clear]       │
├──────────────┬──────────────────────────────────────────────┬───────────────┤
│ Palette      │ Canvas Area (600px email preview)            │ Inspector     │
│ ──────────   │ ──────────────────────────────────────────   │ ─────────     │
│ [1 Column]   │ ┌──────────────────────────────────────────┐ │ Selected Block│
│ [2 Columns]  │ │ Section 1 (2 Columns)                    │ │ Type: Button  │
│ [3 Columns]  │ │ ┌───────────────┐ ┌────────────────────┐ │ │ Text: Click Me│
│ ──────────   │ │ │ [Image]       │ │ [Heading]          │ │ │ URL: https:// │
│ [Heading]    │ │ │               │ │ [Text]             │ │ │ Color: #fff   │
│ [Text]       │ │ │               │ │ [Button]           │ │ │ Bg: #2563eb   │
│ [Button]     │ │ └───────────────┘ └────────────────────┘ │ │ Padding: 12px │
│ [Image]      │ └──────────────────────────────────────────┘ │ Radius: 4px   │
│ [Divider]    │  + Drag blocks here to add...                │               │
│ [Spacer]     │                                              │ [Delete Block]│
└──────────────┴──────────────────────────────────────────────┴───────────────┘
```

- **Palette**: Left sidebar with draggable block templates (Sections, Headings, Text, Buttons, Images, Dividers, Spacers).
- **Canvas**: Centered responsive 600px container displaying live interactive rendered blocks.
- **Drop Zones**: Visual highlight lines when hovering between or inside sections/columns.
- **Inspector**: Right sidebar showing context-sensitive property inputs (URL, text, colors, padding) for whichever element or section is currently selected.

---

## 6. Public API & Lifecycle

```typescript
export interface EditorOptions {
  target: HTMLElement | string;
  initialData?: EmailDocument;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  onChange?: (doc: EmailDocument) => void;
  onSelect?: (element: ElementNode | SectionNode | null) => void;
}

export class ArchEmailEditor {
  static create(options: EditorOptions): ArchEmailEditor;
  
  // Document Operations
  getJSON(): EmailDocument;
  setJSON(data: EmailDocument): void;
  getHTML(): Promise<string>;
  getMJML(): string;
  
  // History
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  
  // Lifecycle
  destroy(): void;
  on(event: 'change' | 'select' | 'ready', callback: Function): void;
  off(event: string, callback: Function): void;
}
```

---

## 7. Verification & Testing Plan
- **Unit Tests**:
  - Store: test adding/removing/moving blocks, updating styles, undo/redo state preservation.
  - Compiler: test AST -> MJML -> HTML conversion produces valid tables, inlined styles, and proper links.
- **Integration Tests**:
  - Test Vanilla UMD bundle loading in a browser DOM (mocked with JSDOM / Vitest).
  - Test React component rendering and unmounting without memory leaks.
  - Test Vue 3 component mounting and data synchronization.
- **Manual Verification**:
  - Run the `examples/vanilla/index.html` via a local dev server to visually test drag-and-drop, inspector edits, and HTML export.
  - Paste exported HTML into an email client previewer or open directly in browser to verify layout fidelity.

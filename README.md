# 📬 Arch Email Editor

> **A powerful, framework-agnostic, embeddable drag-and-drop HTML email editor with 100% email client compatibility, dual-boundary CSS sandbox isolation, and rich JavaScript customization.**

---

## 🌟 Overview

**Arch Email Editor** is a modern, developer-friendly email newsletter builder designed to be embedded directly into **any** website or web application — whether using **Vanilla JavaScript**, **Tailwind CSS**, **Bootstrap**, **React**, **Vue**, **Next.js**, **Laravel**, or **PHP**.

Just like Unlayer or BeeFree, Arch Email Editor guarantees that **your email templates will never break** when embedded, and host page CSS (including aggressive resets like Tailwind Preflight) cannot distort the email layout or the editor UI.

---

## ✨ Key Features

- 🛡️ **Dual-Boundary Sandbox Isolation**: The live email renders inside an isolated HTML `<iframe>`. Host styles, Tailwind Preflight (`border-width: 0;`, `button { background: transparent; }`, `img { max-width: 100%; }`), and CSS resets can **never** penetrate into the email canvas.
- 🎨 **Figma-Like Drag & Drop**: 60fps pointer drag engine with visual ghost cards, auto-layout insertion indicators, and vertical displacement.
- ↔️ **Interactive On-Canvas Drag Resizing**:
  - **Columns**: Drag column seams to adjust column width ratios with live percentage pills (e.g. `40% / 60%`).
  - **Buttons**: Drag corner handles to scale vertical padding and side handles to adjust button width (synced with Outlook VML roundrect).
  - **Text**: Drag side handles to adjust container max-width and corner handles to scale font size smoothly.
  - **Images**: Corner drag handles for smooth width scaling with live dimensions badge.
- ⚡ **Dynamic HTML Injection API**: Dynamically load, replace, or insert custom HTML snippets into the email through JavaScript (`setHTML()`, `loadHTML()`, `insertHTML()`).
- 🔘 **Custom Toolbar Buttons**: Add custom buttons (e.g., **Save**, **Publish**, **Send Test**) into the top-right toolbar via options or runtime API.
- ↩️ **Floating Undo & Redo Widget**: Floating bottom-left canvas pill widget (BeeFree / Figma layout) synchronized with top toolbar buttons and global keyboard shortcuts (`Ctrl+Z` / `Cmd+Z`, `Ctrl+Y` / `Cmd+Shift+Z`).
- 🏷️ **Template Name Controls**: Set the template name via JS options, allow users to click-and-rename inline in the toolbar, and listen for change events.
- 📬 **Bulletproof Email Compilation**:
  - Microsoft Outlook table conditionals (`<!--[if mso]>...<![endif]-->`)
  - VML `<v:roundrect>` vector buttons
  - Responsive fluid-hybrid tables with scoped `@media` queries
  - Live **102 KB Gmail clipping meter**
  - Zero editor markup or HUD artifacts in exported HTML (`editor.getHTML()`)
- 🧩 **Framework Agnostic**: Zero runtime UI dependencies. Native TypeScript core with first-class **React** and **Vue** adapters.

---

## 📦 Installation

### Via Package Manager (npm / yarn / pnpm / bun)

```bash
npm install arch-email-editor
# or
yarn add arch-email-editor
# or
pnpm add arch-email-editor
```

### Via Direct Script Tag (CDN / Plain HTML)

```html
<!-- Stylesheet -->
<link rel="stylesheet" href="path/to/dist/arch-email-editor.css" />

<!-- UMD Script -->
<script src="path/to/dist/arch-email-editor.umd.js"></script>
```

---

## 🚀 Quick Start Examples

### 1. Plain HTML / JavaScript (UMD / CDN)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Newsletter Builder</title>
  <link rel="stylesheet" href="dist/arch-email-editor.css" />
  <style>
    body { margin: 0; padding: 20px; font-family: sans-serif; background: #0f172a; }
    #editor-container { width: 100%; height: 90vh; }
  </style>
</head>
<body>
  <div id="editor-container"></div>

  <script src="dist/arch-email-editor.umd.js"></script>
  <script>
    const editor = ArchEmailEditor.create('#editor-container', {
      templateName: 'Monthly Newsletter',
      customButtons: [
        {
          id: 'save-btn',
          label: 'Save Draft',
          icon: '💾',
          className: 'arch-btn--primary',
          onClick: (editor) => {
            const html = editor.getHTML();
            console.log('Exported Email HTML:', html);
            alert('Saved successfully!');
          }
        }
      ],
      onChange: (doc) => {
        console.log('Document updated:', doc);
      }
    });
  </script>
</body>
</html>
```

---

### 2. Tailwind CSS Website (Zero Configuration)

Arch Email Editor includes built-in defensive resets (`all: initial;` barrier), so **Tailwind Preflight will not affect the editor or the email**.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tailwind App with Email Builder</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Arch Email Editor Styles -->
  <link rel="stylesheet" href="dist/arch-email-editor.css" />
</head>
<body class="bg-slate-900 text-white min-h-screen p-6">
  <div class="max-w-7xl mx-auto flex flex-col h-[90vh]">
    <!-- Header -->
    <header class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Marketing Campaign Studio</h1>
    </header>

    <!-- Editor Container (Ensure it has a height like h-full or h-[800px]) -->
    <div id="editor-container" class="w-full flex-1 rounded-lg overflow-hidden shadow-2xl"></div>
  </div>

  <script src="dist/arch-email-editor.umd.js"></script>
  <script>
    const editor = ArchEmailEditor.create('#editor-container', {
      templateName: 'Black Friday 2026',
      customButtons: [
        {
          id: 'save',
          label: 'Save',
          icon: '💾',
          className: 'arch-btn--primary',
          onClick: (editor) => {
            const html = editor.getHTML();
            // Send to your backend API
          }
        }
      ]
    });
  </script>
</body>
</html>
```

> **Important**: Always ensure the container element where you mount the editor has an explicit height (e.g. `height: 100vh;` or `height: 800px;` or `class="h-full"`). The editor expands to `height: 100%` of its container.

---

### 3. Modern Bundlers / ESM (Vite, Webpack, Next.js)

```typescript
import { ArchEmailEditor } from 'arch-email-editor';
import 'arch-email-editor/style.css';

const container = document.getElementById('editor')!;

const editor = ArchEmailEditor.create(container, {
  templateName: 'Weekly Digest',
  editableTemplateName: true,
  onTemplateNameChange: (newName) => {
    console.log('Template renamed:', newName);
  },
  customButtons: [
    {
      id: 'save-btn',
      label: 'Save',
      icon: '💾',
      className: 'arch-btn--primary',
      onClick: async (editor) => {
        const html = editor.getHTML();
        const json = editor.getJSON();
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, json })
        });
      }
    }
  ]
});
```

---

### 4. React / Next.js Component

```tsx
import React, { useRef } from 'react';
import { ReactEmailEditor, ReactEmailEditorRef } from 'arch-email-editor/react';
import 'arch-email-editor/style.css';

export default function EmailBuilderPage() {
  const editorRef = useRef<ReactEmailEditorRef>(null);

  const handleSave = () => {
    const emailHtml = editorRef.current?.getHTML();
    console.log('Production Email HTML:', emailHtml);
  };

  const handleLoadCustomTemplate = () => {
    editorRef.current?.setHTML(`
      <!DOCTYPE html>
      <html>
        <body>
          <table width="600" class="row">
            <tr>
              <td><h2>Hello from React!</h2></td>
            </tr>
          </table>
        </body>
      </html>
    `);
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', background: '#1e293b', display: 'flex', gap: '8px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleLoadCustomTemplate}>Load Custom HTML</button>
      </div>
      <div style={{ flex: 1, width: '100%' }}>
        <ReactEmailEditor
          ref={editorRef}
          templateName="React Newsletter"
          customButtons={[
            {
              id: 'publish',
              label: 'Publish',
              icon: '🚀',
              onClick: () => handleSave()
            }
          ]}
          onChange={(doc) => console.log('Doc changed:', doc)}
        />
      </div>
    </div>
  );
}
```

---

### 5. Vue 3 Component

```vue
<template>
  <div class="editor-wrapper">
    <VueEmailEditor
      ref="editorRef"
      @change="onContentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { VueEmailEditor } from 'arch-email-editor/vue';
import 'arch-email-editor/style.css';

const editorRef = ref<any>(null);

const onContentChange = (doc: any) => {
  console.log('Document updated:', doc);
};

onMounted(() => {
  // Add a custom button at runtime
  editorRef.value?.addCustomButton({
    id: 'save-btn',
    label: 'Save',
    icon: '💾',
    onClick: (editor: any) => {
      const html = editor.getHTML();
      console.log('Saved HTML:', html);
    }
  });
});
</script>

<style scoped>
.editor-wrapper {
  width: 100%;
  height: 100vh;
}
</style>
```

---

## ⚡ Dynamic HTML Injection & Content Management

Arch Email Editor provides flexible APIs to programmatically manipulate email content dynamically via JavaScript:

### 1. Set or Replace the Entire Email HTML
Use `setHTML()` or `loadHTML()` to dynamically load an HTML string into the editor:

```javascript
// Replaces the active email template dynamically
editor.setHTML(`
  <!DOCTYPE html>
  <html>
    <body>
      <table width="600" align="center" style="margin: 0 auto; background: #ffffff;">
        <tr>
          <td style="padding: 24px; text-align: center;">
            <h1 style="color: #0f172a;">Exclusive Summer Collection</h1>
            <p style="color: #475569;">Explore the latest products crafted for you.</p>
          </td>
        </tr>
      </table>
    </body>
  </html>
`);
```

### 2. Dynamically Insert Custom HTML Snippets
Use `insertHTML()` to inject a custom HTML snippet into the template at runtime:

```javascript
// Automatically wrapped in compliant email table structures
editor.insertHTML(`
  <div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 16px; border-radius: 6px; text-align: center;">
    <h3 style="margin: 0; color: #92400e;">⚡ Limited Time: Use code SUMMER25 for 25% off!</h3>
  </div>
`);
```

You can also target specific positions:
```javascript
// Insert before or after the currently selected element
editor.insertHTML('<p>Inserted after selection</p>', { position: 'after' });
```

### 3. Export Clean, Sending-Ready HTML
```javascript
// Returns clean, cross-client email HTML with Outlook MSO conditionals
const productionHtml = editor.getHTML();
```

---

## 🔘 Top-Right Custom Action Buttons

You can add buttons (e.g., **Save**, **Send Test**, **Publish**, **Sync**) to the top-right toolbar:

### Via Constructor Options
```javascript
const editor = ArchEmailEditor.create('#editor', {
  customButtons: [
    {
      id: 'save',
      label: 'Save',
      icon: '💾',
      className: 'arch-btn--primary',
      title: 'Save template',
      onClick: (editor, event) => {
        const html = editor.getHTML();
        // save to database
      }
    },
    {
      id: 'send-test',
      label: 'Send Test',
      icon: '✉️',
      onClick: (editor) => {
        const email = prompt('Enter recipient:');
        if (email) sendTestEmail(email, editor.getHTML());
      }
    }
  ]
});
```

### Via Runtime JS Methods
```javascript
// Add button dynamically at runtime
editor.addCustomButton({
  id: 'preview-modal',
  label: 'Preview',
  icon: '👁️',
  onClick: (editor) => openMyCustomModal(editor.getHTML())
});

// Remove button dynamically
editor.removeCustomButton('preview-modal');
```

---

## 🏷️ Template Name Controls

Manage and display template names directly in the header toolbar:

### Configure via Options
```javascript
const editor = ArchEmailEditor.create('#editor', {
  templateName: 'Welcome Series — Email #1',
  editableTemplateName: true, // Allows clicking the name or pencil (✎) icon to rename
  onTemplateNameChange: (newName) => {
    console.log('User renamed template to:', newName);
  }
});
```

### Programmatic Methods
```javascript
// Get the current template name
const title = editor.getTemplateName();

// Update the template name programmatically
editor.setTemplateName('Black Friday VIP Launch');
```

---

## 📖 API Reference

### `ArchEmailEditor.create(target, options)`

Initializes and mounts the editor.

- **`target`**: `HTMLElement | string` — DOM element or CSS selector string.
- **`options`**: `EditorOptions` — Configuration options.

---

### `EditorOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialData` | `EmailDocument` | Default Starter Template | Initial JSON template AST or raw HTML. |
| `templateName` | `string` | `'Arch Email Editor'` | Template name displayed in the toolbar. |
| `editableTemplateName`| `boolean` | `true` | Allows inline click-to-edit rename in the toolbar. |
| `onTemplateNameChange`| `(name: string) => void` | `undefined` | Callback fired when the template name changes. |
| `customButtons` | `ToolbarCustomButton[]` | `[]` | Array of custom buttons in the top-right toolbar. |
| `theme` | `'light' \| 'dark'` | `'light'` | UI chrome theme. |
| `readOnly` | `boolean` | `false` | Disables editing mode. |
| `onChange` | `(doc: EmailDocument) => void` | `undefined` | Fired when any content or structure changes. |
| `onSelectBlock` | `(block: BlockNode \| null) => void` | `undefined` | Fired when an element or block is selected. |

---

### `ToolbarCustomButton`

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique button identifier. |
| `label` | `string` | Button text label. |
| `icon` | `string` *(optional)* | Optional icon string (emoji, text, or SVG snippet). |
| `className` | `string` *(optional)* | Extra CSS classes (e.g. `'arch-btn--primary'`). |
| `title` | `string` *(optional)* | Tooltip hover title text. |
| `onClick` | `(editor: ArchEmailEditor, event: MouseEvent) => void` | Click event handler. |

---

### Instance Methods

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `getHTML()` | `string` | Returns production-ready, clean email HTML. |
| `setHTML(html)` | `void` | Loads and sets new email HTML content dynamically. |
| `loadHTML(html)` | `void` | Alias for `setHTML()`. |
| `insertHTML(snippet, options?)` | `void` | Injects custom HTML markup into the email dynamically. |
| `getJSON()` | `EmailDocument` | Returns deep clone of current JSON AST state. |
| `setJSON(doc)` | `void` | Sets document state from a JSON AST. |
| `importHTML(html)` | `void` | Imports and parses an HTML email template. |
| `importHTMLFile(file)` | `Promise<void>` | Reads a local `.html` file and imports it. |
| `setTemplateName(name)` | `void` | Updates the template name in the toolbar. |
| `getTemplateName()` | `string` | Returns the current template name. |
| `addCustomButton(button)` | `void` | Adds a custom button to the top-right toolbar. |
| `removeCustomButton(id)` | `void` | Removes a custom button by its id. |
| `undo()` | `void` | Reverts the last change. |
| `redo()` | `void` | Redoes the previously undone change. |
| `setViewportMode(mode)` | `void` | Changes viewport mode (`'desktop'` \| `'tablet'` \| `'mobile'`). |
| `destroy()` | `void` | Unbinds all listeners and removes the editor from DOM. |

---

## 📬 Email Client Compatibility

Templates generated and exported by Arch Email Editor are compatible with:

- ✅ **Gmail** (Desktop web, iOS app, Android app — zero clipping under 102 KB)
- ✅ **Microsoft Outlook** (2007, 2010, 2013, 2016, 2019, 2021, Office 365, Outlook.com)
  - VML `<v:roundrect>` vector buttons with stroke & fill
  - Conditional table layout envelopes (`<!--[if mso]>`)
- ✅ **Apple Mail** (macOS & iOS)
- ✅ **Yahoo! Mail** (Desktop & Mobile)
- ✅ **Mozilla Thunderbird**

---

## 📄 License

MIT © [dwipsarker2001](https://github.com/dwipsarker2001)

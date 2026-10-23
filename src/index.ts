/**
 * Arch Email Editor - Main Entry Point
 *
 * Exposes the core ArchEmailEditor class, compilers, and types.
 * Supports:
 * - UMD (window.ArchEmailEditor) for direct HTML script tags
 * - ESM (import { ArchEmailEditor } from 'arch-email-editor')
 * - CJS (const { ArchEmailEditor } = require('arch-email-editor'))
 */

import './style.css';
import { ArchEmailEditor } from './editor';
import { compileToEmailHtml, getDefaultDocument, parseHtmlToDocument } from './compiler';

// Attach compiler methods directly onto class for convenient static access
(ArchEmailEditor as any).compileToEmailHtml = compileToEmailHtml;
(ArchEmailEditor as any).getDefaultDocument = getDefaultDocument;
(ArchEmailEditor as any).parseHtmlToDocument = parseHtmlToDocument;

// Expose directly on global window in browser environments
if (typeof window !== 'undefined') {
  (window as any).ArchEmailEditor = ArchEmailEditor;
}

export { ArchEmailEditor, compileToEmailHtml, getDefaultDocument, parseHtmlToDocument };
export default ArchEmailEditor;
export * from './types';

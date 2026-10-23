import './style.css';
import { ArchEmailEditor } from './editor';
import { compileToEmailHtml, getDefaultDocument } from './compiler';

// Attach helper functions directly to class so both static and named usage work
(ArchEmailEditor as any).compileToEmailHtml = compileToEmailHtml;
(ArchEmailEditor as any).getDefaultDocument = getDefaultDocument;

// In browser script tag environment, expose ArchEmailEditor directly on window
if (typeof window !== 'undefined') {
  (window as any).ArchEmailEditor = ArchEmailEditor;
}

export { ArchEmailEditor, compileToEmailHtml, getDefaultDocument };
export default ArchEmailEditor;
export * from './types';

import { describe, it, expect } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { compileToEmailHtml, normalizeDocument } from '../src/compiler';

describe('Robustness and Security Review Fixes', () => {
  it('normalizes empty or invalid JSON documents without throwing', () => {
    // Empty object
    const doc1 = normalizeDocument({});
    expect(doc1.version).toBe('1.0');
    expect(doc1.settings.contentWidth).toBe('600px');
    expect(doc1.blocks).toEqual([]);

    // Null or undefined
    const doc2 = normalizeDocument(null);
    expect(doc2.blocks.length).toBeGreaterThan(0); // Falls back to default template

    // Corrupted settings
    const doc3 = normalizeDocument({ settings: null, blocks: null });
    expect(doc3.settings.contentWidth).toBe('600px');
    expect(doc3.blocks).toEqual([]);

    // Compiling empty doc should not crash
    expect(() => compileToEmailHtml(doc1)).not.toThrow();
  });

  it('initializes ArchEmailEditor safely with empty initialData object', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Initializing with empty object must not crash
    expect(() => {
      const editor = ArchEmailEditor.create(container, { initialData: {} as any });
      expect(editor.getJSON().blocks).toEqual([]);
      editor.destroy();
    }).not.toThrow();

    container.remove();
  });

  it('escapes and neutralizes XSS payloads in block content and compiled HTML', () => {
    const maliciousDoc = {
      version: '1.0' as const,
      settings: {
        contentWidth: '600px',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial',
        textColor: '#000000'
      },
      blocks: [
        {
          id: 'xss_1',
          type: 'heading' as const,
          content: { text: '<script>alert("xss")</script>' },
          style: {}
        },
        {
          id: 'xss_2',
          type: 'button' as const,
          content: { label: 'Click Me', url: 'javascript:alert(1)' },
          style: {}
        }
      ]
    };

    const html = compileToEmailHtml(maliciousDoc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain('href="#"');
  });
});

import { describe, it, expect } from 'vitest';
import { compileToEmailHtml, getDefaultDocument, parseHtmlToDocument } from '../src/compiler';
import { EmailDocument } from '../src/types';

describe('Email HTML Compiler', () => {
  it('returns a valid default document structure', () => {
    const doc = getDefaultDocument();
    expect(doc.version).toBe('1.0');
    expect(doc.settings.contentWidth).toBe('600px');
    expect(doc.blocks).toBeInstanceOf(Array);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it('compiles an empty document to standard email outer table', () => {
    const doc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#f4f4f7',
        fontFamily: 'Arial, sans-serif',
        textColor: '#333333'
      },
      blocks: []
    };

    const html = compileToEmailHtml(doc);

    // Checks standard email HTML requirements
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('width="100%"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="600"');
    expect(html).toContain('background-color: #f4f4f7');
    expect(html).toContain('<!--[if mso]>');
  });

  it('compiles heading and text blocks with proper inline styles', () => {
    const doc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica, Arial, sans-serif',
        textColor: '#111111'
      },
      blocks: [
        {
          id: 'b1',
          type: 'heading',
          content: { text: 'Welcome to Arch Newsletter', level: 1 },
          style: { color: '#0f172a', fontSize: '28px', textAlign: 'center' }
        },
        {
          id: 'b2',
          type: 'text',
          content: { text: 'This is a test newsletter paragraph.' },
          style: { color: '#475569', fontSize: '16px', textAlign: 'left' }
        }
      ]
    };

    const html = compileToEmailHtml(doc);
    expect(html).toContain('Welcome to Arch Newsletter');
    expect(html).toContain('font-size: 28px');
    expect(html).toContain('color: #0f172a');
    expect(html).toContain('This is a test newsletter paragraph.');
    expect(html).toContain('color: #475569');
  });

  it('compiles button as a bulletproof email button', () => {
    const doc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        textColor: '#333333'
      },
      blocks: [
        {
          id: 'b3',
          type: 'button',
          content: { label: 'Read Story', url: 'https://example.com/read' },
          style: {
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '4px',
            textAlign: 'center'
          }
        }
      ]
    };

    const html = compileToEmailHtml(doc);
    expect(html).toContain('https://example.com/read');
    expect(html).toContain('Read Story');
    expect(html).toContain('background-color: #2563eb');
    expect(html).toContain('color: #ffffff');
    expect(html).toContain('border-radius: 4px');
  });

  it('compiles image block with responsive email table constraints and alt text', () => {
    const doc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        textColor: '#333333'
      },
      blocks: [
        {
          id: 'b4',
          type: 'image',
          content: {
            src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
            alt: 'Header Image'
          },
          style: { textAlign: 'center' }
        }
      ]
    };

    const html = compileToEmailHtml(doc);
    expect(html).toContain('src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809"');
    expect(html).toContain('alt="Header Image"');
    expect(html).toContain('border="0"');
    expect(html).toContain('width="600"');
    expect(html).toContain('max-width: 600px');
  });

  it('compiles divider block', () => {
    const doc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        textColor: '#333333'
      },
      blocks: [
        {
          id: 'b5',
          type: 'divider',
          content: {},
          style: { color: '#e2e8f0' }
        }
      ]
    };

    const html = compileToEmailHtml(doc);
    expect(html).toContain('border-top: 1px solid #e2e8f0');
  });

  it('parses prebuilt HTML email string into editable EmailDocument blocks', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <body style="background-color: #f1f5f9;">
          <table width="600" align="center">
            <tr><td><h1 style="color: #1e293b; font-size: 26px;">Summer Newsletter</h1></td></tr>
            <tr><td><img src="https://example.com/banner.jpg" alt="Summer Banner" /></td></tr>
            <tr><td><p style="color: #475569; font-size: 15px;">Enjoy our special summer discount!</p></td></tr>
            <tr><td><a href="https://example.com/shop" style="background-color: #10b981; color: #ffffff; padding: 10px 20px;">Claim Discount</a></td></tr>
            <tr><td><hr style="border-top: 1px solid #cbd5e1;" /></td></tr>
          </table>
        </body>
      </html>
    `;

    // Parse HTML string into structured email document
    const doc = parseHtmlToDocument(sampleHtml);

    expect(doc.version).toBe('1.0');
    expect(doc.blocks.length).toBeGreaterThanOrEqual(4);

    const heading = doc.blocks.find((b: any) => b.type === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.content.text).toBe('Summer Newsletter');

    const image = doc.blocks.find((b: any) => b.type === 'image');
    expect(image).toBeDefined();
    expect(image!.content.src).toBe('https://example.com/banner.jpg');

    const button = doc.blocks.find((b: any) => b.type === 'button');
    expect(button).toBeDefined();
    expect(button!.content.url).toBe('https://example.com/shop');
    expect(button!.content.label).toBe('Claim Discount');
  });
});

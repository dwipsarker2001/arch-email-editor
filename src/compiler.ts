/**
 * Arch Email Editor - HTML Compiler & Document Normalizer
 *
 * Architecture & Email Quirks:
 * Major desktop and mobile email clients (Outlook 2007-2021, Gmail Mobile, Yahoo Mail)
 * do NOT support standard modern CSS layouts (Flexbox, CSS Grid, external stylesheets).
 * 
 * To ensure 100% visual fidelity across 70+ email clients, this module:
 * 1. Outputs nested <table> markup with cellspacing="0" and cellpadding="0".
 * 2. Inlines all CSS attributes into `style="..."` properties.
 * 3. Uses Outlook MSO conditionals (`<!--[if (gte mso 9)|(IE)]>`) for desktop Outlook DPI scaling.
 * 4. Implements bulletproof buttons (table + inline styled anchor).
 * 5. Lossless parsing: Preserves full `rawHtml` (including <head>, <style>, media queries,
 *    and multi-column nested tables) so imported templates never break.
 */

import { EmailDocument, BlockNode } from './types';

/**
 * Normalizes any arbitrary JSON input into a guaranteed valid EmailDocument AST.
 * Prevents runtime crashes from empty `{}` or corrupted database payloads.
 */
export function normalizeDocument(doc?: any): EmailDocument {
  if (!doc || typeof doc !== 'object') {
    return getDefaultDocument();
  }

  const hasBlocks = 'blocks' in doc;
  if (!hasBlocks && Object.keys(doc).length === 0) {
    const emptyDoc: EmailDocument = {
      version: '1.0',
      settings: {
        contentWidth: '600px',
        backgroundColor: '#f4f4f7',
        fontFamily: 'Arial, sans-serif',
        textColor: '#334155'
      },
      blocks: []
    };
    emptyDoc.rawHtml = compileBlocksToHtml(emptyDoc);
    return emptyDoc;
  }

  const settings = doc.settings && typeof doc.settings === 'object' ? doc.settings : {};
  const normalized: EmailDocument = {
    version: '1.0',
    settings: {
      contentWidth: typeof settings.contentWidth === 'string' ? settings.contentWidth : '600px',
      backgroundColor: typeof settings.backgroundColor === 'string' ? settings.backgroundColor : '#f4f4f7',
      fontFamily: typeof settings.fontFamily === 'string' ? settings.fontFamily : 'Arial, sans-serif',
      textColor: typeof settings.textColor === 'string' ? settings.textColor : '#334155'
    },
    blocks: Array.isArray(doc.blocks) ? doc.blocks : []
  };

  if (typeof doc.rawHtml === 'string' && doc.rawHtml.trim()) {
    normalized.rawHtml = doc.rawHtml;
  } else if (normalized.blocks.length > 0) {
    normalized.rawHtml = compileBlocksToHtml(normalized);
  }

  return normalized;
}

/**
 * Returns the default starter email template.
 */
export function getDefaultDocument(): EmailDocument {
  const doc: EmailDocument = {
    version: '1.0',
    settings: {
      contentWidth: '600px',
      backgroundColor: '#f4f4f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      textColor: '#334155'
    },
    blocks: [
      {
        id: 'block_heading_1',
        type: 'heading',
        content: {
          text: 'Welcome to Your Newsletter',
          level: 1
        },
        style: {
          fontSize: '26px',
          color: '#0f172a',
          textAlign: 'center',
          padding: '24px 20px 8px 20px'
        }
      },
      {
        id: 'block_image_1',
        type: 'image',
        content: {
          src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
          alt: 'Header visual'
        },
        style: {
          textAlign: 'center',
          padding: '12px 20px'
        }
      },
      {
        id: 'block_text_1',
        type: 'text',
        content: {
          text: 'This is your framework-agnostic email editor. You can easily drag and reorder blocks, customize typography, configure buttons, and export bulletproof email HTML ready for sending!'
        },
        style: {
          fontSize: '16px',
          color: '#475569',
          textAlign: 'left',
          padding: '12px 20px'
        }
      },
      {
        id: 'block_button_1',
        type: 'button',
        content: {
          label: 'Get Started Now',
          url: 'https://github.com'
        },
        style: {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          borderRadius: '6px',
          fontSize: '16px',
          textAlign: 'center',
          padding: '16px 20px'
        }
      },
      {
        id: 'block_divider_1',
        type: 'divider',
        content: {},
        style: {
          color: '#e2e8f0',
          padding: '16px 20px'
        }
      }
    ]
  };

  doc.rawHtml = compileBlocksToHtml(doc);
  return doc;
}

/**
 * Escapes unsafe HTML characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes URLs against an explicit safe protocol whitelist.
 * Blocks javascript:, vbscript:, data:text/html, etc.
 */
export function sanitizeUrl(url?: string): string {
  if (!url) return '#';
  const trimmed = url.trim();
  // Protocol whitelist: http, https, mailto, tel, or fragment hash
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '#';
}

/**
 * Validates image sources: allows http(s) or raster base64 images.
 */
export function sanitizeImageUrl(src?: string): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (/^(https?:\/\/|data:image\/(png|jpeg|jpg|gif|webp);base64,)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '';
}

/**
 * Renders an individual block into email-compatible table markup.
 */
function renderBlock(block: BlockNode, fontFamily: string, contentWidth: string): string {
  const align = block.style.textAlign || 'left';
  const padding = block.style.padding || '12px 20px';
  const contentWidthNum = parseInt(contentWidth || '600', 10);

  switch (block.type) {
    case 'heading': {
      const text = escapeHtml(block.content.text || '');
      const color = block.style.color || '#0f172a';
      const fontSize = block.style.fontSize || '24px';
      const tag = block.content.level === 1 ? 'h1' : block.content.level === 3 ? 'h3' : 'h2';
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; text-align: ${align};">
            <${tag} style="margin: 0; font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: bold; line-height: 1.3; color: ${color}; text-align: ${align};">
              ${text}
            </${tag}>
          </td>
        </tr>`;
    }

    case 'text': {
      const text = escapeHtml(block.content.text || '').replace(/\n/g, '<br/>');
      const color = block.style.color || '#475569';
      const fontSize = block.style.fontSize || '16px';
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; text-align: ${align};">
            <p style="margin: 0; font-family: ${fontFamily}; font-size: ${fontSize}; line-height: 1.6; color: ${color}; text-align: ${align};">
              ${text}
            </p>
          </td>
        </tr>`;
    }

    case 'button': {
      const label = escapeHtml(block.content.label || 'Click Here');
      const url = sanitizeUrl(block.content.url);
      const bg = block.style.backgroundColor || '#2563eb';
      const color = block.style.color || '#ffffff';
      const borderRadius = block.style.borderRadius || '4px';
      const fontSize = block.style.fontSize || '16px';

      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; text-align: ${align};">
            <table border="0" cellspacing="0" cellpadding="0" style="margin: ${align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0'};">
              <tr>
                <td align="center" style="border-radius: ${borderRadius}; background-color: ${bg};">
                  <a href="${url}" target="_blank" style="font-size: ${fontSize}; font-family: ${fontFamily}; color: ${color}; font-weight: 600; text-decoration: none; border-radius: ${borderRadius}; padding: 12px 24px; border: 1px solid ${bg}; display: inline-block;">
                    ${label}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }

    case 'image': {
      const src = sanitizeImageUrl(block.content.src || '');
      const alt = escapeHtml(block.content.alt || '');
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; text-align: ${align};">
            <img src="${src}" alt="${alt}" border="0" width="${contentWidthNum}" style="display: block; width: 100%; max-width: ${contentWidthNum}px; height: auto; margin: ${align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0'};" />
          </td>
        </tr>`;
    }

    case 'divider': {
      const color = block.style.color || '#e2e8f0';
      return `
        <tr>
          <td style="padding: ${padding};">
            <hr style="border: 0; border-top: 1px solid ${color}; margin: 0;" />
          </td>
        </tr>`;
    }

    case 'html': {
      const customHtml = block.content.html || '';
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; font-family: ${fontFamily};">
            ${customHtml}
          </td>
        </tr>`;
    }

    default:
      return '';
  }
}

/**
 * Compiles an EmailDocument's blocks into table-based email HTML.
 */
export function compileBlocksToHtml(doc: EmailDocument): string {
  const contentWidth = doc.settings.contentWidth || '600px';
  const contentWidthNum = parseInt(contentWidth, 10);
  const bgColor = doc.settings.backgroundColor || '#f4f4f7';
  const fontFamily = doc.settings.fontFamily || 'Arial, sans-serif';

  const rows = doc.blocks.map(b => renderBlock(b, fontFamily, contentWidth)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Newsletter</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: ${fontFamily};">
  <!-- Outer Background Container Table -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor};">
    <tr>
      <td align="center" style="padding: 24px 10px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="${contentWidthNum}">
        <tr>
        <td align="center" valign="top" width="${contentWidthNum}">
        <![endif]-->
        
        <!-- Main Centered Email Container Table -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: ${contentWidthNum}px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tbody>
            ${rows}
          </tbody>
        </table>

        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Compiles a structured EmailDocument into production-ready email HTML.
 * If the document has a preserved `rawHtml` (from an imported template), it returns that
 * ensuring 100% of head styles, media queries, and nested tables are preserved.
 */
export function compileToEmailHtml(inputDoc: EmailDocument): string {
  const doc = normalizeDocument(inputDoc);
  if (doc.rawHtml && doc.rawHtml.trim()) {
    return doc.rawHtml;
  }
  return compileBlocksToHtml(doc);
}

/**
 * Parses an arbitrary prebuilt HTML email template into an EmailDocument.
 * Preserves the full `rawHtml` so templates with media queries, custom CSS,
 * and multi-column tables are NEVER broken.
 */
export function parseHtmlToDocument(htmlString: string): EmailDocument {
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(htmlString, 'text/html');
  const body = parsedDoc.body;

  // 1. Extract Background Color
  const bodyStyle = body.getAttribute('style') || '';
  const bgColorMatch = bodyStyle.match(/background-color:\s*([^;]+)/i);
  let bgColor: string | null = bgColorMatch ? bgColorMatch[1].trim() : body.getAttribute('bgcolor');
  if (!bgColor) {
    const outerTable = body.querySelector('table[bgcolor], table[style*="background"]');
    if (outerTable) {
      const match = outerTable.getAttribute('style')?.match(/background(?:-color)?:\s*([^;]+)/i);
      bgColor = outerTable.getAttribute('bgcolor') || (match ? match[1].trim() : null);
    }
  }
  bgColor = bgColor || '#f4f4f7';

  // 2. Extract Font Family
  const fontFamilyMatch = bodyStyle.match(/font-family:\s*([^;]+)/i);
  const fontFamily = fontFamilyMatch
    ? fontFamilyMatch[1].trim()
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // 3. Extract Content Width
  const innerTable = body.querySelector('table[width="600"], table[width="640"], table[style*="max-width"]') as HTMLElement | null;
  let contentWidth = '600px';
  if (innerTable) {
    const widthAttr = innerTable.getAttribute('width');
    const maxWidthMatch = innerTable.getAttribute('style')?.match(/max-width:\s*(\d+px)/i);
    if (maxWidthMatch) contentWidth = maxWidthMatch[1];
    else if (widthAttr && !widthAttr.includes('%')) contentWidth = `${widthAttr}px`;
  }

  const blocks: BlockNode[] = [];
  let blockIdCounter = 1;
  const processed = new Set<Element>();

  const elements = Array.from(body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, img, a, hr, td, div'));

  for (const el of elements) {
    if (processed.has(el)) continue;

    const tagName = el.tagName.toLowerCase();
    const styleAttr = el.getAttribute('style') || '';
    const styleObj: Record<string, string> = {};
    styleAttr.split(';').forEach(rule => {
      const [k, v] = rule.split(':').map(s => s?.trim());
      if (k && v) styleObj[k.toLowerCase()] = v;
    });

    if (tagName.startsWith('h')) {
      const level = parseInt(tagName[1], 10) || 2;
      const text = el.textContent?.trim() || '';
      if (text) {
        blocks.push({
          id: `block_import_${blockIdCounter++}`,
          type: 'heading',
          content: { text, level: (level <= 3 ? level : 3) as 1 | 2 | 3 },
          style: {
            fontSize: styleObj['font-size'] || (level === 1 ? '26px' : level === 2 ? '22px' : '18px'),
            color: styleObj['color'] || '#0f172a',
            textAlign: (styleObj['text-align'] as any) || 'left',
            padding: styleObj['padding'] || '12px 20px'
          }
        });
        processed.add(el);
      }
    } else if (tagName === 'img') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      if (src) {
        blocks.push({
          id: `block_import_${blockIdCounter++}`,
          type: 'image',
          content: { src, alt },
          style: {
            textAlign: (styleObj['text-align'] as any) || 'center',
            padding: styleObj['padding'] || '12px 20px'
          }
        });
        processed.add(el);
      }
    } else if (tagName === 'a') {
      const label = el.textContent?.trim() || 'Click Here';
      const url = el.getAttribute('href') || '#';
      const bg = styleObj['background-color'] || styleObj['background'] || '#2563eb';

      blocks.push({
        id: `block_import_${blockIdCounter++}`,
        type: 'button',
        content: { label, url },
        style: {
          backgroundColor: bg,
          color: styleObj['color'] || '#ffffff',
          borderRadius: styleObj['border-radius'] || '6px',
          fontSize: styleObj['font-size'] || '16px',
          textAlign: (styleObj['text-align'] as any) || 'center',
          padding: styleObj['padding'] || '14px 20px'
        }
      });
      processed.add(el);
    } else if (tagName === 'hr') {
      blocks.push({
        id: `block_import_${blockIdCounter++}`,
        type: 'divider',
        content: {},
        style: {
          color: styleObj['border-top-color'] || styleObj['border-color'] || '#e2e8f0',
          padding: '16px 20px'
        }
      });
      processed.add(el);
    } else if (tagName === 'p') {
      const text = el.textContent?.trim() || '';
      if (text) {
        blocks.push({
          id: `block_import_${blockIdCounter++}`,
          type: 'text',
          content: { text },
          style: {
            fontSize: styleObj['font-size'] || '16px',
            color: styleObj['color'] || '#475569',
            textAlign: (styleObj['text-align'] as any) || 'left',
            padding: styleObj['padding'] || '12px 20px'
          }
        });
        processed.add(el);
      }
    } else if (tagName === 'td' || tagName === 'div') {
      const hasNestedBlocks = el.querySelector('h1, h2, h3, h4, h5, h6, p, img, a, hr');
      if (!hasNestedBlocks) {
        const text = el.textContent?.trim() || '';
        if (text && text.length > 1) {
          blocks.push({
            id: `block_import_${blockIdCounter++}`,
            type: 'text',
            content: { text },
            style: {
              fontSize: styleObj['font-size'] || '15px',
              color: styleObj['color'] || '#475569',
              textAlign: (styleObj['text-align'] as any) || 'left',
              padding: styleObj['padding'] || '12px 20px'
            }
          });
          processed.add(el);
        }
      }
    }
  }

  // Preserve the entire raw HTML so imported templates are NEVER broken
  return {
    version: '1.0',
    settings: {
      contentWidth: contentWidth,
      backgroundColor: bgColor,
      fontFamily: fontFamily,
      textColor: '#334155'
    },
    blocks,
    rawHtml: htmlString
  };
}

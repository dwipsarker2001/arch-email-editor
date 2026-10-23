import { EmailDocument, BlockNode } from './types';

export function getDefaultDocument(): EmailDocument {
  return {
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
          text: 'This is your framework-agnostic email editor. You can easily add blocks, customize typography, configure buttons, and export bulletproof email HTML ready for sending!'
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
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(url?: string): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed)) return '#';
  return escapeHtml(trimmed);
}

function renderBlock(block: BlockNode, fontFamily: string): string {
  const align = block.style.textAlign || 'left';
  const padding = block.style.padding || '12px 20px';

  switch (block.type) {
    case 'heading': {
      const text = escapeHtml(block.content.text || '');
      const color = block.style.color || '#0f172a';
      const fontSize = block.style.fontSize || '24px';
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: bold; line-height: 1.3; color: ${color}; text-align: ${align};">
            ${text}
          </td>
        </tr>`;
    }

    case 'text': {
      const text = escapeHtml(block.content.text || '').replace(/\n/g, '<br/>');
      const color = block.style.color || '#475569';
      const fontSize = block.style.fontSize || '16px';
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; font-family: ${fontFamily}; font-size: ${fontSize}; line-height: 1.6; color: ${color}; text-align: ${align};">
            ${text}
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
      const src = sanitizeUrl(block.content.src || '');
      const alt = escapeHtml(block.content.alt || '');
      return `
        <tr>
          <td align="${align}" style="padding: ${padding}; text-align: ${align};">
            <img src="${src}" alt="${alt}" border="0" style="display: block; max-width: 100%; height: auto; margin: ${align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0'};" />
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

    default:
      return '';
  }
}

export function compileToEmailHtml(doc: EmailDocument): string {
  const contentWidth = parseInt(doc.settings.contentWidth || '600', 10);
  const bgColor = doc.settings.backgroundColor || '#f4f4f7';
  const fontFamily = doc.settings.fontFamily || 'Arial, sans-serif';

  const rows = doc.blocks.map(b => renderBlock(b, fontFamily)).join('\n');

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
  <!-- Outer Background Container -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor};">
    <tr>
      <td align="center" style="padding: 24px 10px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="${contentWidth}">
        <tr>
        <td align="center" valign="top" width="${contentWidth}">
        <![endif]-->
        
        <!-- Main Email Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: ${contentWidth}px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
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

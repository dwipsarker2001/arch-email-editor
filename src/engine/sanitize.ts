/**
 * Arch Email Editor - HTML Sanitizer, Template Tag Tokenizer & Lossless Serializer
 *
 * Solves:
 * - R1: Strips executable XSS payloads (<script>, on*=, javascript:, <object>, <embed>, <base>)
 *       while preserving <style>, <link rel="stylesheet">, Outlook VML (v:*, o:*), and MSO comments.
 * - R2: Tokenizes block-level Liquid/Handlebars/Jinja tags ({% ... %}, {{#...}}, {{/...}})
 *       into HTML comments (<!--arch-tpl:N-->) before DOM parsing so table foster-parenting
 *       never ejects template loops out of <table>/<tr>/<td>, and detokenizes on export.
 * - R4: Preserves original DOCTYPE, leading comments, and <html xmlns:v ...> attributes.
 */

export interface FrameMeta {
  doctype: string;
  leadingComments: string[];
  htmlAttrs: Record<string, string>;
  tokens: Map<string, string>;
}

/**
 * Extracts original DOCTYPE, leading comments, and <html> attributes from raw HTML.
 */
export function extractFrameMeta(rawHtml: string): FrameMeta {
  const doctypeMatch = rawHtml.match(/<!DOCTYPE[^>]*>/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : '<!DOCTYPE html>';

  const leadingComments: string[] = [];
  const beforeHtmlIdx = rawHtml.search(/<html[\s>]/i);
  if (beforeHtmlIdx > 0) {
    const prologue = rawHtml.slice(0, beforeHtmlIdx);
    const commentMatches = prologue.match(/<!--[\s\S]*?-->/g);
    if (commentMatches) {
      leadingComments.push(...commentMatches);
    }
  }

  const htmlAttrs: Record<string, string> = {};
  const htmlTagMatch = rawHtml.match(/<html\b([^>]*)>/i);
  if (htmlTagMatch && htmlTagMatch[1]) {
    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(htmlTagMatch[1])) !== null) {
      const name = m[1];
      const val = m[2] ?? m[3] ?? m[4] ?? '';
      htmlAttrs[name] = val;
    }
  }

  return {
    doctype,
    leadingComments,
    htmlAttrs,
    tokens: new Map()
  };
}

/**
 * Tokenizes Liquid / Handlebars / Jinja / EJS block tags outside of HTML tag attributes
 * into <!--arch-tpl:N--> comment placeholders so HTML5 table parsing does not foster-parent them.
 */
export function tokenizeTemplateTags(
  rawHtml: string,
  existingTokens?: Map<string, string>
): { html: string; tokens: Map<string, string> } {
  const tokens = existingTokens || new Map<string, string>();
  let counter = tokens.size;

  // Match HTML tags first so we don't replace template tags inside attribute values,
  // or match block-level template tags ({% ... %}, {{#...}}, {{/...}}, {{^...}}, {{ else }}, <% ... %>)
  const regex = /(<[^>]+>)|(\{%[\s\S]*?%\}|\{\{[#/^\s]*(?:if|unless|each|with|for|else|endif|endfor)[\s\S]*?\}\}|<%[\s\S]*?%>)/gi;

  const html = rawHtml.replace(regex, (match, htmlTag, tplTag) => {
    if (htmlTag) return htmlTag;
    if (tplTag) {
      const key = `arch-tpl:${counter++}`;
      tokens.set(key, tplTag);
      return `<!--${key}-->`;
    }
    return match;
  });

  return { html, tokens };
}

/**
 * Restores <!--arch-tpl:N--> comment tokens back into their original template tags
 * and unescapes operators inside {{ ... }} and {% ... %} expressions.
 */
export function detokenizeTemplateTags(html: string, tokens: Map<string, string>): string {
  let result = html;
  if (tokens && tokens.size > 0) {
    result = result.replace(/<!--(arch-tpl:\d+)-->/g, (full, key) => {
      return tokens.has(key) ? tokens.get(key)! : full;
    });
  }

  // Unescape HTML entities that browser DOM serialization may have escaped inside {{ ... }} or {% ... %}
  result = result.replace(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/g, (expr) => {
    return expr
      .replace(/&amp;/g, '&')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<');
  });

  return result;
}

/**
 * Sanitizes raw HTML string before writing into the canvas iframe.
 * Removes <script>, <object>, <embed>, <applet>, <base>, <meta http-equiv="refresh">,
 * inline on* event handlers, and javascript:/vbscript:/data:text/html URLs.
 * Preserves <style>, <link rel="stylesheet">, VML tags, and MSO conditional comments.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let cleaned = rawHtml
    // Strip <script>...</script> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip unclosed <script> tags
    .replace(/<\/?script\b[^>]*>/gi, '')
    // Strip <object>, <embed>, <applet>, <base>, <iframe>
    .replace(/<(object|embed|applet|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(object|embed|applet|base|iframe)\b[^>]*>/gi, '')
    // Strip <meta http-equiv="refresh" ...>
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');

  // Strip inline on* event attributes and dangerous URL protocols inside HTML opening tags
  cleaned = cleaned.replace(/<([a-zA-Z0-9:_-]+)(\s[^>]*)>/g, (fullTag, tagName, attrs) => {
    // Do not touch MSO conditional comments
    if (fullTag.startsWith('<!--')) return fullTag;

    let safeAttrs = attrs
      // Remove on* event handlers (onclick="...", onerror='...', onload=...)
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Neutralize javascript:, vbscript:, data:text/html in href/src/action/formaction/xlink:href
      .replace(
        /(\s+(?:href|src|action|formaction|xlink:href)\s*=\s*)(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*))/gi,
        '$1"#"'
      );

    return `<${tagName}${safeAttrs}>`;
  });

  return cleaned;
}

/**
 * Sanitizes a live DOM tree in-place (extra defense-in-depth after DOM parsing).
 */
export function sanitizeDomTree(root: Document | Element): void {
  const dangerousSelectors = 'script, object, embed, applet, base, iframe, meta[http-equiv="refresh" i]';
  root.querySelectorAll(dangerousSelectors).forEach((el) => el.remove());

  const allElements = root.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        name === 'href' ||
        name === 'src' ||
        name === 'action' ||
        name === 'formaction' ||
        name === 'xlink:href'
      ) {
        const val = attr.value.trim().replace(/[\u0000-\u0020]+/g, '');
        if (/^(javascript:|vbscript:|data:text\/html)/i.test(val)) {
          el.setAttribute(attr.name, '#');
        }
      }
    }
  });
}

/**
 * Serializes the live iframe Document into clean, production-ready email HTML.
 * - Strips any temporary editor attributes (contenteditable, spellcheck, data-arch-*, arch-* classes)
 * - Restores original DOCTYPE, leading comments, and <html xmlns:v ...> attributes
 * - Detokenizes any template tags
 */
export function serializeCleanDocument(
  ifrDoc: Document,
  meta?: FrameMeta
): string {
  const clone = ifrDoc.documentElement.cloneNode(true) as HTMLElement;

  // Remove any internal editor style tags, helper nodes, or empty-column drop placeholders
  clone
    .querySelectorAll(
      '#arch-canvas-editor-style, .arch-floating-toolbar, .arch-empty-col-placeholder, [data-arch-placeholder]'
    )
    .forEach((el) => el.remove());

  // Strip temporary editor classes and attributes
  clone
    .querySelectorAll(
      '[contenteditable], [spellcheck], [draggable], [data-arch-placeholder], [data-arch-displaced], [data-arch-displace-x], [data-arch-displace-y], [class]'
    )
    .forEach((el) => {
      if ((el.hasAttribute('data-arch-displace-x') || el.hasAttribute('data-arch-displace-y')) && (el as HTMLElement).style) {
        (el as HTMLElement).style.removeProperty('transform');
        if (!el.getAttribute('style')?.trim()) {
          el.removeAttribute('style');
        }
      }
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.removeAttribute('draggable');
      el.removeAttribute('data-arch-placeholder');
      el.removeAttribute('data-arch-displaced');
      el.removeAttribute('data-arch-displace-x');
      el.removeAttribute('data-arch-displace-y');

      if (el.hasAttribute('class')) {
        const classes = (el.getAttribute('class') || '')
          .split(/\s+/)
          .filter(
            (c) =>
              c &&
              !c.startsWith('arch-selected') &&
              !c.startsWith('arch-drop') &&
              !c.startsWith('arch-hover') &&
              !c.startsWith('arch-col-') &&
              !c.startsWith('arch-dragging') &&
              !c.startsWith('arch-editing')
          );
        if (classes.length === 0) {
          el.removeAttribute('class');
        } else {
          el.setAttribute('class', classes.join(' '));
        }
      }
    });

  // Restore original <html> attributes (like xmlns:v, xmlns:o, lang, style)
  if (meta && meta.htmlAttrs) {
    for (const [k, v] of Object.entries(meta.htmlAttrs)) {
      if (!clone.hasAttribute(k)) {
        clone.setAttribute(k, v);
      }
    }
  }

  const doctype = meta?.doctype || '<!DOCTYPE html>';
  const leading = meta?.leadingComments?.length ? meta.leadingComments.join('\n') + '\n' : '';
  const rawSerialized = `${doctype}\n${leading}${clone.outerHTML}`;

  return meta?.tokens ? detokenizeTemplateTags(rawSerialized, meta.tokens) : rawSerialized;
}

import Typo from 'typo-js';
import aff from 'typo-js/dictionaries/en_US/en_US.aff?raw';
import dic from 'typo-js/dictionaries/en_US/en_US.dic?raw';

let typoInstance: any = null;

function getTypo(): any {
  if (!typoInstance) {
    typoInstance = new (Typo as any)('en_US', aff, dic);
  }
  return typoInstance;
}

export function isSpelledCorrectly(word: string): boolean {
  if (!word || word.length <= 1) return true;
  return getTypo().check(word);
}

export function getSpellingSuggestions(word: string): string[] {
  if (!word) return [];
  return getTypo().suggest(word) || [];
}

/**
 * Highlights misspelled words across all text nodes in the given document.
 * Uses CSS Custom Highlight API (zero DOM mutation).
 */
export function highlightSpellingErrors(doc: Document | null): void {
  if (!doc?.body) return;
  const win = (doc.defaultView || (typeof window !== 'undefined' ? window : null)) as any;
  const HighlightCtor = win?.Highlight || (typeof Highlight !== 'undefined' ? Highlight : null);
  if (!HighlightCtor || !win?.CSS?.highlights) return;

  const ranges: Range[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const wordRegex = /\b[A-Za-z]+(?:['’][A-Za-z]+)?\b/g;

  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const tag = parent?.tagName.toLowerCase();
    if (tag !== 'script' && tag !== 'style' && tag !== 'code' && tag !== 'pre') {
      const text = node.nodeValue || '';
      let m: RegExpExecArray | null;
      while ((m = wordRegex.exec(text)) !== null) {
        const word = m[0];
        if (word.length > 1 && !isSpelledCorrectly(word)) {
          const r = doc.createRange();
          r.setStart(node, m.index);
          r.setEnd(node, m.index + word.length);
          ranges.push(r);
        }
      }
    }
    node = walker.nextNode();
  }

  if (ranges.length === 0) {
    win.CSS.highlights.delete('arch-spellcheck');
  } else {
    win.CSS.highlights.set('arch-spellcheck', new HighlightCtor(...ranges));
  }
}

export function clearSpellingHighlights(doc: Document | null): void {
  const win = (doc?.defaultView || (typeof window !== 'undefined' ? window : null)) as any;
  win?.CSS?.highlights?.delete('arch-spellcheck');
}

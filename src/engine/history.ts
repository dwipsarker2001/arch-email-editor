/**
 * Arch Email Editor - Unified Undo/Redo History Stack & Structural Integrity Validator
 *
 * Solves:
 * - R11: Provides a unified, deterministic Undo/Redo snapshot stack across DOM moves,
 *        inspector edits, block insertions, and inline typing.
 * - §2.4: Validates table hierarchy (`<tr>`/`<td>` inside `<table>`) after structural commands.
 */

export class HistoryManager {
  private stack: string[] = [];
  private index: number = -1;
  private maxLimit: number;

  constructor(maxLimit = 50) {
    this.maxLimit = maxLimit;
  }

  public reset(initialHtml: string): void {
    this.stack = [initialHtml];
    this.index = 0;
  }

  public push(html: string): void {
    if (!html) return;
    if (this.index >= 0 && this.stack[this.index] === html) {
      return;
    }

    // Truncate any redo history beyond current index
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    this.stack.push(html);
    if (this.stack.length > this.maxLimit) {
      this.stack.shift();
    } else {
      this.index++;
    }
  }

  public canUndo(): boolean {
    return this.index > 0;
  }

  public canRedo(): boolean {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  public undo(): string | null {
    if (!this.canUndo()) return null;
    this.index--;
    return this.stack[this.index];
  }

  public redo(): string | null {
    if (!this.canRedo()) return null;
    this.index++;
    return this.stack[this.index];
  }

  public current(): string | null {
    return this.index >= 0 ? this.stack[this.index] : null;
  }
}

/**
 * Validates that a live email DOM has not suffered table-hierarchy corruption
 * (e.g., orphaned `<tr>`, `<td>`, or `<th>` outside a `<table>`).
 */
export function validateEmailStructure(doc: Document): { valid: boolean; reason?: string } {
  if (!doc || !doc.body) {
    return { valid: false, reason: 'Missing document body' };
  }

  const cells = doc.body.querySelectorAll('td, th');
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.closest('tr') || !cell.closest('table')) {
      return { valid: false, reason: 'Orphaned table cell outside tr/table' };
    }
  }

  const rows = doc.body.querySelectorAll('tr');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.closest('table')) {
      return { valid: false, reason: 'Orphaned table row outside table' };
    }
  }

  return { valid: true };
}

import { html } from '@codemirror/lang-html';
import { Compartment, EditorState } from '@codemirror/state';
import { basicSetup, EditorView } from 'codemirror';

export class CanvasCodeEditor {
  private readonly view: EditorView;
  private readonly readOnlyCompartment = new Compartment();

  constructor(container: HTMLElement, initialHTML: string, readOnly: boolean) {
    this.view = new EditorView({
      parent: container,
      doc: initialHTML,
      extensions: [
        basicSetup,
        html(),
        this.readOnlyCompartment.of(this.getReadOnlyExtensions(readOnly)),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: '#ffffff',
            color: '#1f2937'
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px'
          },
          '.cm-content': {
            padding: '18px 78px 24px 18px'
          }
        }, { dark: false })
      ]
    });
  }

  public getValue(): string {
    return this.view.state.doc.toString();
  }

  public setValue(html: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: html
      }
    });
  }

  public setReadOnly(readOnly: boolean): void {
    this.view.dispatch({
      effects: this.readOnlyCompartment.reconfigure(this.getReadOnlyExtensions(readOnly))
    });
  }

  public focus(): void {
    this.view.focus();
  }

  public destroy(): void {
    this.view.destroy();
  }

  private getReadOnlyExtensions(readOnly: boolean) {
    return [
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly)
    ];
  }
}

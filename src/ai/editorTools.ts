import type { AiToolDefinition } from './types';

export interface EditorToolCallbacks {
  getEmailContext: () => string | Promise<string>;
  replaceSelectedElement: (selection: { selectionToken: string; html: string }) => void | Promise<void>;
  replaceEmailHtml: (html: string) => void | Promise<void>;
}

export type EditorToolExecutor = (argumentsJson: string) => string | Promise<string>;

export interface EditorTools {
  definitions: AiToolDefinition[];
  executors: Record<string, EditorToolExecutor>;
}

function parseArguments(argumentsJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(argumentsJson);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function requireHtml(value: unknown): string {
  if (typeof value !== 'string') throw new Error('html must be a string');
  return value;
}

export function createEditorTools(callbacks: EditorToolCallbacks): EditorTools {
  return {
    definitions: [
      {
        type: 'function',
        function: {
          name: 'get_email_context',
          description: 'Read the current email and editor selection context.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'replace_selected_element',
          description: 'Replace the selected email element using its current selection token.',
          parameters: {
            type: 'object',
            properties: {
              selection_token: { type: 'string' },
              html: { type: 'string' },
            },
            required: ['selection_token', 'html'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'replace_email_html',
          description: 'Replace the complete email HTML.',
          parameters: {
            type: 'object',
            properties: { html: { type: 'string' } },
            required: ['html'],
            additionalProperties: false,
          },
        },
      },
    ],
    executors: {
      get_email_context: async (argumentsJson) => {
        parseArguments(argumentsJson);
        const context = await callbacks.getEmailContext();
        if (typeof context !== 'string') throw new Error('Email context must be a string');
        return context;
      },
      replace_selected_element: async (argumentsJson) => {
        const args = parseArguments(argumentsJson);
        if (typeof args.selection_token !== 'string' || !args.selection_token.trim()) {
          throw new Error('selection_token is required');
        }
        await callbacks.replaceSelectedElement({
          selectionToken: args.selection_token,
          html: requireHtml(args.html),
        });
        return 'Selected element replaced.';
      },
      replace_email_html: async (argumentsJson) => {
        const args = parseArguments(argumentsJson);
        await callbacks.replaceEmailHtml(requireHtml(args.html));
        return 'Email HTML replaced.';
      },
    },
  };
}

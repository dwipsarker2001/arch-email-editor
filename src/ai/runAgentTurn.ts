import type { AiAgentTurnResult, AiMessage, AiProvider } from './types';
import type { EditorTools } from './editorTools';

const MAX_TOOL_EXECUTIONS = 8;

export type AiToolProgressStatus = 'running' | 'complete' | 'error';

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === 'string') return rec.message;
    if (typeof rec.error === 'string') return rec.error;
    if (typeof rec.error === 'object' && rec.error !== null) {
      const inner = rec.error as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
    }
  }
  return String(error);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
  }
}

export async function runAgentTurn(
  provider: AiProvider,
  messages: AiMessage[],
  tools: EditorTools,
  signal: AbortSignal,
  onProgress?: (toolName: string, status: AiToolProgressStatus) => void,
): Promise<AiAgentTurnResult> {
  const conversation = [...messages];
  let executions = 0;

  while (true) {
    throwIfAborted(signal);

    let turn;
    try {
      turn = await provider.complete(conversation, tools.definitions, signal);
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      conversation.push({ role: 'assistant', content: `Error: ${errorText(error)}` });
      return { messages: conversation, limitReached: false };
    }
    throwIfAborted(signal);

    conversation.push({
      role: 'assistant',
      content: turn.content,
      ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls } : {}),
    });

    if (!turn.toolCalls.length) return { messages: conversation, limitReached: false };

    for (const call of turn.toolCalls) {
      throwIfAborted(signal);
      if (executions >= MAX_TOOL_EXECUTIONS) {
        return { messages: conversation, limitReached: true };
      }

      executions++;
      onProgress?.(call.name, 'running');
      let content: string;
      try {
        const execute = tools.executors[call.name];
        if (!execute) throw new Error(`Unknown tool: ${call.name}`);
        content = await execute(call.arguments);
        onProgress?.(call.name, 'complete');
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
        content = `Tool error: ${errorText(error)}`;
        onProgress?.(call.name, 'error');
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }
}

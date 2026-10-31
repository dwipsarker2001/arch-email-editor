export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: string;
  type?: 'function';
  function?: {
    name: string;
    arguments: string;
  };
}

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiAssistantTurn {
  content: string | null;
  toolCalls: AiToolCall[];
}

export interface AiAgentTurnResult {
  messages: AiMessage[];
  limitReached: boolean;
}

export interface AiProvider {
  complete(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    signal: AbortSignal
  ): Promise<AiAssistantTurn>;
}

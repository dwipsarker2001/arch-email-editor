import type { AiAssistantTurn, AiMessage, AiProvider, AiToolCall, AiToolDefinition } from './types';

interface OpenAICompatibleOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(): Error {
  return new Error('Invalid AI response: expected an assistant message with content or tool calls');
}

export class OpenAICompatibleProvider implements AiProvider {
  constructor(private readonly options: OpenAICompatibleOptions) {}

  async complete(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    signal: AbortSignal
  ): Promise<AiAssistantTurn> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`;

    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: this.options.model, messages, tools }),
      signal,
    });
    if (!response.ok) throw new Error(`AI request failed with HTTP ${response.status}`);

    const result: unknown = await response.json();
    if (!isRecord(result) || !Array.isArray(result.choices) || !isRecord(result.choices[0])) {
      throw invalidResponse();
    }

    const message = result.choices[0].message;
    if (!isRecord(message) || (message.content !== undefined && message.content !== null
      && typeof message.content !== 'string')) {
      throw invalidResponse();
    }

    let toolCalls: AiToolCall[] = [];
    if (message.tool_calls !== undefined) {
      if (!Array.isArray(message.tool_calls)) throw invalidResponse();
      toolCalls = message.tool_calls.map((call): AiToolCall => {
        if (!isRecord(call) || typeof call.id !== 'string' || !isRecord(call.function)
          || typeof call.function.name !== 'string' || typeof call.function.arguments !== 'string') {
          throw invalidResponse();
        }
        return {
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        };
      });
    }

    const content = typeof message.content === 'string' ? message.content : null;
    if (content === null && toolCalls.length === 0) throw invalidResponse();
    return { content, toolCalls };
  }
}

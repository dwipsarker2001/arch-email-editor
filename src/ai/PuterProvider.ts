import { toWireMessages } from './toWireMessages';
import type { AiAssistantTurn, AiMessage, AiProvider, AiToolCall, AiToolDefinition } from './types';

interface PuterAi {
  chat(
    messages: unknown[],
    options: { tools: AiToolDefinition[]; signal: AbortSignal; normalize: true }
  ): Promise<unknown>;
}

interface PuterClient {
  ai: PuterAi;
}

declare global {
  interface Window {
    puter?: PuterClient;
  }
}

let puterLoadPromise: Promise<PuterClient> | undefined;

function getPuterClient(): Promise<PuterClient> {
  if (typeof window !== 'undefined' && typeof window.puter?.ai?.chat === 'function') {
    return Promise.resolve(window.puter);
  }
  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise<PuterClient>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.addEventListener('load', () => {
      if (typeof window.puter?.ai?.chat === 'function') resolve(window.puter);
      else reject(new Error('Puter AI SDK loaded without puter.ai.chat'));
    }, { once: true });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('Failed to load the Puter AI SDK'));
    }, { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    puterLoadPromise = undefined;
    throw error;
  });

  return puterLoadPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(): Error {
  return new Error('Invalid Puter AI response: expected assistant content or tool calls');
}

function normalizeToolCalls(value: unknown): AiToolCall[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidResponse();
  return value.map((call): AiToolCall => {
    if (!isRecord(call) || typeof call.id !== 'string' || !isRecord(call.function)
      || typeof call.function.name !== 'string') {
      throw invalidResponse();
    }
    const args = call.function.arguments;
    if (typeof args !== 'string' && !isRecord(args)) throw invalidResponse();
    return {
      id: call.id,
      name: call.function.name,
      arguments: typeof args === 'string' ? args : JSON.stringify(args),
    };
  });
}

export class PuterProvider implements AiProvider {
  async complete(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    signal: AbortSignal
  ): Promise<AiAssistantTurn> {
    const puter = await getPuterClient();
    const result = await puter.ai.chat(toWireMessages(messages), { tools, signal, normalize: true });

    if (isRecord(result)) {
      if (result.error !== undefined || result.code === 'bad_request') {
        const errorMsg = typeof result.message === 'string'
          ? result.message
          : typeof result.error === 'string'
            ? result.error
            : isRecord(result.error) && typeof result.error.message === 'string'
              ? result.error.message
              : 'Puter AI request failed';
        throw new Error(errorMsg);
      }
    }

    const message = isRecord(result) && isRecord(result.message) ? result.message : null;
    if (!message || (message.content !== undefined && message.content !== null
      && typeof message.content !== 'string')) {
      throw invalidResponse();
    }

    const content = typeof message.content === 'string' ? message.content : null;
    const toolCalls = normalizeToolCalls(message.tool_calls);
    if (content === null && toolCalls.length === 0) throw invalidResponse();
    return { content, toolCalls };
  }
}

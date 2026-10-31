import type { AiMessage } from './types';

/**
 * Transforms an array of internal AiMessage objects into the wire format expected
 * by OpenAI-compatible APIs and Puter.js.
 *
 * Specifically, any assistant message with tool calls must format each tool_call
 * with an explicit `type: 'function'` and nested `function: { name, arguments }`
 * property, as required by the OpenAI/Puter specification.
 */
export function toWireMessages(messages: AiMessage[]): unknown[] {
  const needsTransform = messages.some(
    (m) => m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0
  );
  if (!needsTransform) return messages;

  return messages.map((message) => {
    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      return {
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls.map((call) => {
          const fnName = call.function?.name ?? call.name;
          const fnArgs = typeof call.function?.arguments === 'string'
            ? call.function.arguments
            : typeof call.arguments === 'string'
              ? call.arguments
              : JSON.stringify(call.function?.arguments ?? call.arguments ?? {});
          return {
            id: call.id,
            type: 'function',
            function: {
              name: fnName,
              arguments: fnArgs,
            },
          };
        }),
      };
    }
    return message;
  });
}

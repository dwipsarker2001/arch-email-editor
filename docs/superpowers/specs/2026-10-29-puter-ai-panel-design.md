# Puter.js AI Assistant Design

## Goal

Turn the existing empty AI sidepanel into a reusable, agentic assistant for
email editing. Puter.js is the default provider. Each editor consumer can opt
into an OpenAI-compatible custom chat-completions endpoint through the public
editor options.

The assistant can use the current email and selected canvas element as context,
make direct edits through bounded editor tools, and rely on the editor's undo
history to reverse those edits.

## Public configuration

Add an optional `ai` configuration to `EditorOptions`:

- `endpoint`: complete URL for an OpenAI-compatible Chat Completions endpoint.
- `model`: model identifier required when `endpoint` is set.
- `apiKey`: optional bearer credential for that endpoint.

If `endpoint` is not configured, use Puter.js. If it is configured but invalid
or unavailable, show the error; do not silently fall back to Puter. Provider
configuration is scoped to the editor instance and is never persisted by the
library.

The custom endpoint must support browser CORS and OpenAI-compatible tool calls.
Credentials configured in browser code are visible to users; production
consumers should use a server-side proxy or short-lived credentials. The
custom endpoint path uses browser `fetch`; the default provider loads the
official Puter.js browser SDK on demand. When Puter is active, show a
`Powered by Puter` link to `https://developer.puter.com/`.

## Agent and canvas tools

Use one small tool-calling loop shared by Puter and the custom endpoint. Do not
add a general-purpose agent framework.

For each user turn, provide the assistant with the current email HTML and, if
there is a selection, the selected element's useful content and attributes.
The assistant can call only these editor operations:

1. Read the current email and selected-element context.
2. Replace the selected element's content/markup.
3. Replace the complete email HTML.

Selection-targeted actions must verify that the original target is still
available before applying an edit. If it is stale or no longer selected, reject
that action and tell the assistant; never apply it to a different element.
Whole-email changes go through the editor's existing HTML import pathway.
Selected-element changes must use an editor mutation pathway that records
history and emits the normal change event. No arbitrary JavaScript execution,
external network tools, or user-defined plugins are included.

Tool calls are sequential and limited to eight calls per user turn. When the
limit is reached, stop the agent turn and present its progress. The user can
cancel an in-flight turn. Conversation history remains in memory while the
panel is open and is cleared when it closes or the editor is destroyed.

## Panel behavior

The current AI button continues to open the sidepanel. Replace its empty body
with a lightweight chat containing:

- A conversation transcript and prompt input.
- Send and Stop controls.
- A visible indication when selected content is included as context.
- In-progress, cancellation, and actionable error states.

The assistant may execute its editor tools directly. Every completed edit is
undoable with the existing Ctrl+Z/toolbar undo behavior. The panel does not add
a model picker, saved conversations, or settings for credentials; provider
configuration comes from the embedding project's `EditorOptions`.

## Provider behavior and errors

- With no custom endpoint, load and call the official Puter.js browser SDK.
- With a custom endpoint, send OpenAI-compatible chat-completions requests,
  including tool definitions and results, to the configured URL.
- Puter loading/authentication failures, endpoint HTTP/CORS failures, malformed
  responses, tool errors, cancellation, and tool-limit stops must be visible in
  the panel.
- Do not silently retry through a different provider or present an error as a
  successful response.
- Avoid storing or logging API keys and full prompt contents.

## Validation

Tests should verify:

- Puter is selected only when no custom endpoint is configured.
- Custom endpoint/model/key configuration is passed to the custom provider.
- Tool calls execute serially and stop at the per-turn limit.
- Current email and selected-element context are provided to the agent.
- Selected-content edits reject stale targets; successful edits emit normal
  changes and can be undone.
- Whole-email edits use the existing import/history behavior.
- Panel loading, send, stop, error, close, and destroy behavior.

## Out of scope

- Server-side AI infrastructure or credential management.
- Non-OpenAI-compatible custom provider protocols.
- Arbitrary code execution, general web browsing, and custom tool registration.
- Persisted conversation history and provider/model selection UI.

## References

- [Puter.js developer site](https://developer.puter.com/)
- [Puter.js AI overview](https://docs.puter.com/AI/)
- [Puter.js chat API](https://docs.puter.com/AI/chat/)

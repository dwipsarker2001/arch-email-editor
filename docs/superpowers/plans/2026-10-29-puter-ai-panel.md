# Puter.js AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable agentic AI chat panel that uses Puter.js by default, supports an OpenAI-compatible custom endpoint, and can directly edit selected content or the full email through undoable editor operations.

**Architecture:** Keep provider requests, bounded tool execution, editor mutations, and chat UI in separate units. The public `EditorOptions.ai` configuration selects Puter unless a custom endpoint is present; both providers implement one tool-calling interface. The UI receives only editor context and mutation callbacks, while editor-owned callbacks enforce selection identity and history behavior.

**Tech Stack:** TypeScript, browser DOM APIs, native `fetch`, official Puter.js browser SDK, Vitest, existing Vite build.

## Global Constraints

- Puter.js is the default provider; use the custom endpoint only when one is configured.
- The custom endpoint must support browser CORS and OpenAI-compatible Chat Completions tool calls.
- Provider configuration is scoped to an editor instance and is never persisted by the library.
- Do not silently fall back to Puter when a configured custom endpoint fails.
- Agent tools are sequential and limited to eight calls per user turn.
- The agent can only read editor context, replace selected content, or replace complete email HTML.
- Do not expose arbitrary JavaScript execution, external network tools, or user-defined plugins.
- Successful selected-content changes must record history and emit the normal change event; full-email changes use the existing import pathway.
- Stale selection targets must be rejected rather than redirected to a different element.
- Show provider, network, authentication, malformed-response, tool, cancellation, and limit errors in the panel.
- Do not store or log API keys or full prompt contents.
- Browser-configured endpoint credentials are visible to users; document host proxies or short-lived credentials for production.
- Show a `Powered by Puter` link to `https://developer.puter.com/` when Puter is active.
- Keep chat history in memory only while the panel is open; clear it when the panel closes or the editor is destroyed.

---

## File Structure

- Modify `src/types.ts`: add typed public AI configuration to `EditorOptions`.
- Create `src/ai/types.ts`: provider message, tool-call, tool-definition, tool-result, and provider interfaces.
- Create `src/ai/PuterProvider.ts`: lazy-load the official browser SDK and normalize its chat/tool-call response.
- Create `src/ai/OpenAICompatibleProvider.ts`: issue and validate native `fetch` requests to the configured endpoint.
- Create `src/ai/createProvider.ts`: validate provider options and select the configured provider without fallback.
- Create `src/ai/runAgentTurn.ts`: run ordered tool calls with the eight-call limit and cancellation.
- Create `src/components/AiAssistant.ts`: render the chat and own per-open transcript/request lifecycle.
- Modify `src/components/RightPanel.ts`: mount and dispose `AiAssistant` in the existing AI sidepanel.
- Modify `src/components/Canvas.ts`: expose a selected-element replacement operation that validates target identity and refreshes the normal canvas content pipeline.
- Modify `src/editor.ts`: wire public options, provide email/selection context and guarded mutations, and update selection revision state.
- Modify `src/style.css`: style chat messages, prompt form, status, errors, and Puter attribution within the existing panel.
- Create `tests/ai-provider.test.ts`, `tests/ai-agent.test.ts`, and `tests/ai-assistant.test.ts`; extend existing canvas/editor tests for selection mutation and undo.
- Modify `README.md`: document provider configuration, usage, CORS, and browser credential visibility.

## Task 1: Add typed providers and provider selection

**Files:**
- Modify: `src/types.ts`
- Create: `src/ai/types.ts`
- Create: `src/ai/PuterProvider.ts`
- Create: `src/ai/OpenAICompatibleProvider.ts`
- Create: `src/ai/createProvider.ts`
- Test: `tests/ai-provider.test.ts`

**Interfaces:**
- Produces `EditorOptions.ai?: { endpoint?: string; model?: string; apiKey?: string }`.
- Produces `AiProvider.complete(messages, tools, signal): Promise<AiAssistantTurn>`.
- `AiAssistantTurn` contains `content: string | null` and `toolCalls: AiToolCall[]`.
- Produces `AiAgentTurnResult` containing `messages: AiMessage[]` and `limitReached: boolean`.
- `createProvider(options)` selects Puter when `endpoint` is absent, and the custom provider when present.

- [ ] **Step 1: Write failing provider tests**

Create `tests/ai-provider.test.ts` with tests that assert:

1. `createProvider({})` returns the Puter adapter.
2. `createProvider({ endpoint: 'https://ai.example.test/v1/chat/completions', model: 'mail-model', apiKey: 'secret' })` returns the custom adapter.
3. An endpoint without a model throws a configuration error.
4. The custom adapter sends `POST`, JSON `messages` and `tools`, and `Authorization: Bearer secret`.
5. A non-2xx response and a response without a valid assistant choice reject with visible errors.
6. A configured endpoint failure never constructs or invokes Puter.

Stub `globalThis.fetch` with `vi.stubGlobal`, return a JSON OpenAI Chat Completions response, and restore mocks in `afterEach`. Assert the request body and headers; do not make real network calls.

- [ ] **Step 2: Run the provider tests and confirm they fail**

Run: `npm test -- tests/ai-provider.test.ts --reporter=dot`

Expected: FAIL because the public AI options and provider modules do not exist.

- [ ] **Step 3: Define the shared provider contract**

Create `src/ai/types.ts` with these shared types:

```ts
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
```

Add exported `AiOptions` to `src/types.ts` with optional `endpoint`, `model`, and `apiKey`, then add `ai?: AiOptions` to `EditorOptions`. Do not add a package dependency.

- [ ] **Step 4: Implement the OpenAI-compatible provider**

Create `src/ai/OpenAICompatibleProvider.ts`. Its constructor accepts `{ endpoint: string; model: string; apiKey?: string }`. `complete` sends one JSON POST with `{ model, messages, tools }`, passes the supplied `AbortSignal`, adds a bearer header only when `apiKey` is present, rejects non-2xx responses with the HTTP status, and validates `choices[0].message`. Convert OpenAI `tool_calls` function entries into `AiToolCall` values. If an assistant message contains neither string content nor tool calls, reject with an invalid-response error.

- [ ] **Step 5: Implement the lazy Puter provider and resolver**

Create `src/ai/PuterProvider.ts` to load `https://js.puter.com/v2/` only on the first Puter request. Reuse an existing load promise so concurrent editor instances do not add duplicate script tags. Reject when the script fails to load or `window.puter.ai.chat` is unavailable. Call `puter.ai.chat` with the current message array and function-tool definitions; pass the abort signal using Puter’s documented request option and normalize text/tool calls into `AiAssistantTurn`.

Create `src/ai/createProvider.ts`. When `endpoint` is absent, construct `PuterProvider`; when present, require a non-empty `model` and construct `OpenAICompatibleProvider`. Never catch a custom-provider error and switch providers.

- [ ] **Step 6: Run provider tests**

Run: `npm test -- tests/ai-provider.test.ts --reporter=dot`

Expected: all provider selection, request-shape, validation, and no-fallback tests pass.

- [ ] **Step 7: Commit the provider boundary**

```powershell
git add src/types.ts src/ai/types.ts src/ai/PuterProvider.ts src/ai/OpenAICompatibleProvider.ts src/ai/createProvider.ts tests/ai-provider.test.ts
git commit -m "feat: add Puter and custom AI providers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Implement the bounded agent turn and editor tool definitions

**Files:**
- Create: `src/ai/runAgentTurn.ts`
- Create: `src/ai/editorTools.ts`
- Test: `tests/ai-agent.test.ts`

**Interfaces:**
- Consumes `AiProvider`, `AiMessage`, `AiToolDefinition`, and `AiToolCall` from Task 1.
- Produces `runAgentTurn(provider, messages, tools, signal, onProgress): Promise<AiAgentTurnResult>`.
- `createEditorTools(callbacks)` returns exactly the three allowed tools and their executor map.

- [ ] **Step 1: Write failing agent tests**

Create tests for:

1. A plain assistant response ends the turn without running a tool.
2. Tool calls execute sequentially, and each tool result is appended as a `tool` message using the call ID.
3. The next provider request receives the assistant tool-call message and prior tool results.
4. The ninth requested tool call is not executed; the turn reports a tool-limit stop after eight executions.
5. An aborted signal stops before another provider request.
6. `createEditorTools` exposes only `get_email_context`, `replace_selected_element`, and `replace_email_html`.
7. Malformed tool arguments and unknown tool names become explicit tool errors and do not call editor callbacks.

Use an in-memory fake `AiProvider` whose `complete` method returns a predefined sequence of assistant turns. Assert ordering by recording each fake tool callback.

- [ ] **Step 2: Run the agent tests and confirm they fail**

Run: `npm test -- tests/ai-agent.test.ts --reporter=dot`

Expected: FAIL because the agent and tool modules do not exist.

- [ ] **Step 3: Implement typed editor tools**

Create `src/ai/editorTools.ts` with callbacks for reading context, replacing the selected element with a request-scoped selection token, and replacing the complete email. Define schemas for these three functions only. Parse JSON arguments inside each executor; reject invalid JSON, non-string HTML, missing selection tokens, and unknown function names. Return concise tool result strings; do not include API keys or credentials.

- [ ] **Step 4: Implement the sequential agent loop**

Create `src/ai/runAgentTurn.ts` with return type `Promise<AiAgentTurnResult>`. Append the user message to a local message list. Request a completion, append the assistant message, and return `{ messages, limitReached: false }` when there are no tool calls. For each tool call, check cancellation, parse and execute it, append `{ role: 'tool', tool_call_id, content }`, and call `onProgress` with the tool name/status. Continue until a text response or eight tool executions have completed. If another tool call is requested after the eighth, return `{ messages, limitReached: true }` without executing it. Propagate aborts; convert other provider/tool failures into errors the UI can render.

- [ ] **Step 5: Run the agent tests**

Run: `npm test -- tests/ai-agent.test.ts --reporter=dot`

Expected: all ordering, limit, cancellation, and tool-allowlist tests pass.

- [ ] **Step 6: Commit the agent loop**

```powershell
git add src/ai/runAgentTurn.ts src/ai/editorTools.ts tests/ai-agent.test.ts
git commit -m "feat: add bounded editor AI agent tools" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Add guarded selected-element replacement and preserve undo

**Files:**
- Modify: `src/components/Canvas.ts`
- Modify: `src/editor.ts`
- Test: `tests/ai-agent.test.ts`
- Test: `tests/editor.test.ts`

**Interfaces:**
- Produces a Canvas operation accepting the expected selected element reference and replacement HTML.
- Produces editor callbacks that capture current email/selection context and reject stale selection tokens.
- Full-email replacement uses existing `importHTML`; selected replacement emits the existing `onContentChange` path.

- [ ] **Step 1: Add failing editor mutation tests**

Extend `tests/editor.test.ts` to create an editor from simple HTML, select a canvas element through the existing canvas selection events/test helpers, capture the AI context, and assert:

1. The context includes full email HTML and the selected element’s `outerHTML`.
2. Replacing selected markup updates `getHTML()` and emits `change`.
3. Calling `undo()` after replacement restores the previous HTML.
4. Changing selection after context capture causes the stale-target action to reject without modifying either element.
5. Replacing full email HTML uses `importHTML` behavior and is undoable.

- [ ] **Step 2: Run the focused tests and confirm the missing behavior**

Run: `npm test -- tests/editor.test.ts --reporter=dot`

Expected: FAIL because no AI context or guarded selected replacement callbacks exist.

- [ ] **Step 3: Track selection revision in the editor**

In `src/editor.ts`, add a monotonically increasing selection revision and increment it only when the user changes selection in `selectElement` or `selectBlock`. Expose an internal context callback that returns `{ html, selectedHtml, selectedText, selectedType, selectionToken }`, using `getHTML()` and the current `SelectedElementInfo.element.outerHTML`. Do not include the DOM element reference in the serialized context sent to a provider.

- [ ] **Step 4: Add the Canvas replacement operation**

Add `Canvas.replaceSelectedElement(expectedElement, html): HTMLElement`. Verify the iframe document still contains `expectedElement` and it is still the selected element; otherwise throw a stale-target error. Parse replacement markup in a detached template, reject empty output, multiple root elements, `script` elements, inline `on*` attributes, and `javascript:` URLs. Replace only the expected root, update internal selection references to the new root, invoke `onStructureChanged()` so the existing serializer, history, and change callbacks run, and return the replacement root.

- [ ] **Step 5: Wire guarded editor callbacks**

In `src/editor.ts`, provide the AI callbacks that capture the selection token and selected element for a user turn. Before selected replacement, compare the token with the current revision and reject if they differ; call `Canvas.replaceSelectedElement` and retain its returned root for any later selected replacement in the same turn. Suppress selection-revision changes caused synchronously by that AI-owned canvas refresh so multiple edits can target the same logical selection; normal user selection changes during provider requests still invalidate the token. Implement full-email replacement with `importHTML(html)`. Ensure `readOnly` editors reject both mutation tools before invoking Canvas or `importHTML`.

- [ ] **Step 6: Run focused editor and agent tests**

Run: `npm test -- tests/editor.test.ts tests/ai-agent.test.ts --reporter=dot`

Expected: selected and full-email mutations update HTML, fire change events, stale targets are rejected, and undo restores the exact prior HTML.

- [ ] **Step 7: Commit guarded editor mutations**

```powershell
git add src/components/Canvas.ts src/editor.ts tests/editor.test.ts tests/ai-agent.test.ts
git commit -m "feat: apply guarded AI edits through editor history" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Build the chat panel and connect providers to editor tools

**Files:**
- Create: `src/components/AiAssistant.ts`
- Modify: `src/components/RightPanel.ts`
- Modify: `src/editor.ts`
- Modify: `src/style.css`
- Test: `tests/ai-assistant.test.ts`
- Test: `tests/ai-panel.test.ts`

**Interfaces:**
- `AiAssistant` receives `AiOptions` and the editor context/mutation callbacks from Task 3.
- `RightPanel.openAiPanel()` mounts one `AiAssistant`; `closeAiPanel()` disposes it and clears transcript state.
- `ArchEmailEditor.destroy()` disposes the panel and aborts in-flight requests.

- [ ] **Step 1: Add failing panel tests**

Extend `tests/ai-panel.test.ts` and create `tests/ai-assistant.test.ts`. Test:

1. The panel contains an accessible transcript, prompt input, Send and Stop controls.
2. Submitting a prompt calls the provider with current full-email and selected-element context.
3. Provider assistant tool calls invoke only the three editor tools and display the final response.
4. Stop aborts a pending completion and prevents later tool calls.
5. Provider, tool, and tool-limit errors are visible in the transcript.
6. Closing the panel clears the transcript, aborts work, and removes `Powered by Puter`; the attribution appears only when the default provider is active.
7. A read-only editor disables Send-triggered mutation tools while allowing assistant responses.

Stub `globalThis.fetch` for the custom provider and provide a fake `window.puter.ai.chat` for the Puter path; never invoke real AI services from tests.

- [ ] **Step 2: Run panel tests and confirm they fail**

Run: `npm test -- tests/ai-panel.test.ts tests/ai-assistant.test.ts --reporter=dot`

Expected: FAIL because the panel is empty and `AiAssistant` is not implemented.

- [ ] **Step 3: Implement the accessible chat component**

Create `AiAssistant` with a `role="log"` transcript and `aria-live="polite"`, a labeled textarea, Send and Stop buttons, and a selected-content context indicator. Prevent blank submissions. While a request runs, disable Send, enable Stop, and show a busy state. Render errors and limit/cancel states as visible transcript entries; do not remove previous assistant messages on failure.

- [ ] **Step 4: Connect each send to provider and agent**

On Send, snapshot editor context and selection token, create the permitted tool callbacks for that snapshot, build provider messages from the system instructions and in-memory transcript, then call `runAgentTurn`. Render assistant text, tool progress, and the `limitReached` result. Use one `AbortController` per turn; Stop, close, and destroy abort it. Clear transcript and abort work on close.

- [ ] **Step 5: Mount and dispose the component from the panel**

Change `RightPanel` to receive `AiOptions` and AI callbacks. Replace its empty `.arch-assets-body` with `AiAssistant`, preserving the existing close button and toggle semantics. Dispose the `AiAssistant` in `closeAiPanel`, tab changes, and `RightPanel.destroy`. In `src/editor.ts`, pass `this.options.ai`, the guarded callbacks from Task 3, and read-only state.

- [ ] **Step 6: Style the chat and provider attribution**

In `src/style.css`, add namespaced `.arch-ai-*` rules for transcript scrolling, user/assistant messages, input, button states, status/error text, and selected-context badge. Match the existing sidepanel light theme and ensure controls remain usable at the current sidebar width. Add the `Powered by Puter` anchor only when `createProvider` selected Puter.

- [ ] **Step 7: Run focused panel tests**

Run: `npm test -- tests/ai-panel.test.ts tests/ai-assistant.test.ts --reporter=dot`

Expected: panel lifecycle, context, provider calls, cancellation, error rendering, read-only behavior, and Puter attribution all pass.

- [ ] **Step 8: Commit the chat panel**

```powershell
git add src/components/AiAssistant.ts src/components/RightPanel.ts src/editor.ts src/style.css tests/ai-assistant.test.ts tests/ai-panel.test.ts
git commit -m "feat: add agentic AI assistant panel" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 5: Document reusable integration and run full verification

**Files:**
- Modify: `README.md`
- Verify: all new AI tests and existing editor/canvas tests

**Interfaces:**
- Documents the public `EditorOptions.ai` contract and both provider paths.
- Does not add project-specific defaults, a model picker, or persisted settings.

- [ ] **Step 1: Document the public options**

Add a README example:

```ts
const editor = ArchEmailEditor.create('#editor', {
  ai: {
    endpoint: 'https://your-proxy.example/v1/chat/completions',
    model: 'your-model'
  }
});
```

Explain that omitting `ai.endpoint` selects Puter.js, custom endpoints must support CORS and OpenAI-compatible tool calls, browser API keys are visible to users, a server proxy or short-lived credential is recommended, and AI changes can be undone through the editor’s normal undo controls.

- [ ] **Step 2: Run all tests**

Run: `npm test -- --reporter=dot`

Expected: all existing and new tests pass.

- [ ] **Step 3: Build the package and declarations**

Run: `npm run build`

Expected: Vite emits ESM/UMD/CSS bundles and TypeScript declaration generation completes without errors.

- [ ] **Step 4: Check whitespace and review the exact diff**

Run: `git diff --check`

Expected: no whitespace errors. Review `git status --short` and ensure only AI implementation/documentation changes are staged or committed; preserve the pre-existing CodeMirror work and `.gitignore` modification.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md
git commit -m "docs: explain AI provider configuration" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Self-review

- **Spec coverage:** Public provider options and Puter default are covered by Task 1; OpenAI-compatible custom requests and no silent fallback by Task 1; bounded sequential tool calling by Task 2; selected and full-email context, stale target protection, history, and change notifications by Task 3; panel lifecycle, cancellation, errors, attribution, and read-only behavior by Task 4; public configuration and credential guidance by Task 5.
- **Placeholder scan:** No TBD/TODO implementation steps are present; each task names concrete files, behavior, test cases, and commands.
- **Type consistency:** The provider contract is introduced in Task 1 and consumed by Task 2; the editor callback contract is introduced in Task 3 and passed to `AiAssistant` in Task 4.

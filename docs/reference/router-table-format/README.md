# Router Table Format — Architecture Reference

## Overview

The Airove backend is structured as a **coordinator swarm** — a single Hono server dispatching work to multiple isolated AI agents. The `RouterTable` is the central registry that defines:

- Which agents exist
- What tools each agent can use
- How requests flow through the system

All routes are **streaming-first** by default (SSE), with optional buffered non-streaming via `stream: false` in the body.

---

## File Locations

| File | Path |
|------|------|
| Schema | `apps/api/src/lib/agents/router-table-schema.ts` |
| Table | `apps/api/src/lib/agents/router-table.ts` |
| Router builder | `apps/api/src/lib/agents/router.ts` |
| Engine | `apps/api/src/lib/agents/engine.ts` |
| Middleware | `apps/api/src/lib/agents/middleware/` |
| Data | `apps/api/src/lib/agents/data/` |

---

## Schema: `agentEntrySchema`

```
{
  id: string              — Unique agent identifier (e.g. "coordinator", "coder")
  name: string            — Human-readable display name
  description: string     — System description; injected into coordinator context
  subagents?: string[]    — IDs of child agents (coordinator uses this for routing)
  enabled?: boolean       — Defaults to true; false removes from routing
  systemPrompt: string    — Full system prompt for this agent
  api: {
    provider: "anthropic" | "openai"
    model: string         — Model ID (e.g. "claude-sonnet-4-5", "gpt-5")
    apiKey?: string       — Optional override; falls back to env (ANTHROPIC_API_KEY, OPENAI_API_KEY)
    temperature?: number  — Default: 1
    maxTokens?: number    — Default: 8192
    streaming?: boolean   — Default: true
    headers?: Record<string, string>  — Extra HTTP headers for provider request
  }
  mcpServers?: Record<string, McpServerConfig>  — MCP server connections
  tools?: Tool[]          — Native tools (web-search, execute-code, ...)
}
```

### MCP Server Config

```
{
  url?: string            — SSE/Streamable HTTP transport URL
  command?: string        — Stdio transport: command to run
  args?: string[]         — Stdio transport: arguments
  env?: Record<string, string>  — Stdio transport: environment variables
}
```

### Native Tool Definitions

Three built-in tools are defined in `data/tool-definitions.ts`:

| Tool | Type | Description |
|------|------|-------------|
| `web-search` | `function` | Search the web via Apify (DDGS/Brave) + Jina AI reader. Accepts `{ query, maxResults?, rawHtml? }`. Returns `{ success, results[], query }`. |
| `execute-code` | `function` | Sandboxed Node.js code execution via VM2. Accepts `{ language, code, timeout? }`. Returns `{ success, output?, error?, executionTimeMs }`. |
| `generate-ui` | `function` | Generate React UI via LLM. Accepts `{ description, context? }`. Returns `{ success, files[], metadata? }`. |

---

## The Router Table: `ROUTER_TABLE`

**Location:** `apps/api/src/lib/agents/router-table.ts`

The `buildRouterTable()` function constructs a Map of `agentId → AgentConfig` (the runtime type, not the Zod schema). Here is the full table:

| Agent ID | Name | Provider | Model | Subagents | Tools | Purpose |
|----------|------|----------|-------|-----------|-------|---------|
| `coordinator` | Coordinator | Anthropic | Claude Sonnet 4.5 | `coder`, `designer`, `researcher` | — | Orchestrator; receives full agent manifest in system prompt, delegates to children |
| `coder` | Coder | Anthropic | Claude Sonnet 4.5 | — | `web-search`, `execute-code`, `generate-ui` | Full-stack engineering tasks |
| `designer` | Designer | OpenAI | GPT-5 | — | `web-search`, `generate-ui` | Design, branding, UI/UX |
| `researcher` | Researcher | OpenAI | GPT-5 | — | `web-search` | Deep research and fact-finding |

### Key Patterns

- **All agents use streaming by default** (`streaming: true`)
- **Anthropic agents** set `maxTokens: 8192`
- **OpenAI agents** set `maxTokens: 16384` and include `X-Stainless-Helper: true` header
- **Temperature** is `1.0` for all agents (per system prompt requirements)
- **Disabled agents** (e.g. `client` with `enabled: false`) are excluded from the routing map at build time
- **The coordinator system prompt is dynamically generated** by `buildCoordinatorPrompt()`, which injects all child agent descriptions as a manifest, then delegates back to the original static prompt

### `buildCoordinatorPrompt(originalPrompt: string): string`

This function is called at table-build time. It prepends a dynamic section to the coordinator's system prompt:

```
You have the following agents available:
  • coder (id: coder): Full-stack engineering tasks...  — tools: web-search, execute-code, generate-ui
  • designer (id: designer): Design, branding, UI/UX... — tools: web-search, generate-ui
  • researcher (id: researcher): Deep research...        — tools: web-search

When a user message arrives:
1. If it targets one agent → call delegate with that agent
2. If it could help from multiple → call delegate for each useful agent
3. If unclear → call delegate with coder as a sensible default
4. Never call delegate with your own id; use other agents for execution

{originalPrompt verbatim}
```

---

## Data Layer

### `data/agent-metadata.ts`

Static registry of agent visual/UI metadata:

| Field | Purpose |
|-------|---------|
| `id` | Agent identifier |
| `name` | Display name |
| `avatar` | Avatar URL or `null` |
| `accentColor` | Hex color for UI theming (e.g. `#6366f1`) |

### `data/agent-prompts.ts`

Each agent has two exports:

- `{agent}AgentSystemPrompt` — Full system prompt string (static, injected at build time)
- `{agent}AgentConfig` — Partial `AgentEntryInput` with id, name, description, provider, model, tools, mcpServers

The coordinator's config is **merged at build time** with the output of `buildCoordinatorPrompt()`.

### `data/tool-definitions.ts`

Exports `webSearchTool`, `executeCodeTool`, and `generateUiTool` as typed `AgentEntryInput["api"]`-compatible objects. These are spread into each agent's `tools` array.

---

## Router Construction Flow

```
1. buildRouterTable()
   ├── Creates Map<string, AgentConfig>
   ├── Calls buildCoordinatorPrompt() to generate dynamic system prompt
   ├── For each entry in ROUTER_TABLE:
   │   ├── Validates with agentEntrySchema.parse(entry)
   │   ├── Resolves provider from api.provider field
   │   ├── Resolves apiKey: api.apiKey ?? env for provider
   │   ├── Builds Tool[] from toolDefinitions array
   │   ├── Maps mcpServers from AgentEntryInput to McpServerConfig
   │   └── Sets defaults: temperature=1, maxTokens=8192, streaming=true
   └── Filters out disabled agents (enabled !== false)

2. createRouter(table)
   ├── Validates table shape
   ├── Extracts subagents from each entry to build children map
   ├── Creates AgentRuntime per child agent:
   │   ├── Builds AgentConfig with model, temperature, maxTokens, system prompt, tools, headers
   │   ├── Validates apiKey exists (warns if missing)
   │   ├── Creates AI provider (Anthropic or OpenAI) via ai-sdk
   │   └── Creates AgentRuntime with provider, tools, mcpClients, metadata
   ├── Creates coordinator AgentRuntime (if coordinator entry exists)
   ├── Builds delegate tool definitions from child metadata
   ├── Builds delegate tool implementations (createToolHandler for each child)
   └── Returns Hono routes:
       ├── POST /              → streamOrBuffer (streaming/non-streaming dispatch)
       ├── POST /chat          → streamOrBuffer (alias)
       ├── GET  /:agentId      → streamAgentGet
       └── GET  /:agentId/chat → streamAgentGet
```

### Request Flow (Streaming)

```
Client → POST /agents/coordinator
  ├── Parse: body.messages, body.agentId, body.stream
  ├── Merge auth header from request
  ├── Check model overrides (x-airove-* headers)
  ├── Run beforeAgent middlewares:
  │   ├── workspaceMiddleware (loads workspace context)
  │   ├── skillMiddleware (loads active skill)
  │   └── modelOverrideMiddleware (applies header overrides)
  ├── resolveAgentRuntime(agentId):
  │   ├── Look up agentId in table
  │   ├── Merge runtime options (model, temperature, maxTokens, system prompt, apiKey)
  │   └── Create AgentRuntime with resolved config
  ├── createAgentStreamPayload(runtime, messages, context):
  │   ├── Build AI SDK messages (convert roles, inject context)
  │   ├── Build tools map from runtime
  │   ├── If coordinator: attach delegate tools + implementations
  │   └── Resolve system prompt (with context, workspace, skill)
  └── streamText() → SSE stream → client
```

### Non-Streaming Flow

When `body.stream === false`, the same pipeline runs but `generateText()` is used instead of `streamText()`, and the result is buffered into a single JSON response.

### Delegate Flow (Coordinator → Child)

```
Coordinator agent calls delegate tool
  └── createToolHandler(childId):
        ├── Find child runtime from children map
        ├── Convert coordinator messages to child format
        ├── Merge agent metadata + context into first message
        ├── If child.stream !== false:
        │   └── streamText(childRuntime, messages, tools) → stream
        └── If child.stream === false:
              └── generateText(childRuntime, messages, tools) → buffer
```

---

## Middleware Chain

Applied in order for each request:

1. **`beforeAgent` array** — Each middleware can:
   - Add to `context` (via `ctx.set()`)
   - Modify `messages` array
   - Modify `AgentRuntimeOptions` (model, temperature, system prompt, etc.)

2. **Model override resolution** — Checks `x-airove-*` headers against a catalog of known models, applies matching overrides

3. **`resolveAgentRuntime(agentId, options)`** — Creates the final runtime with all resolved options

---

## Error Handling

The router returns structured JSON errors:

```json
{
  "success": false,
  "error": {
    "code": "MISSING_API_KEY",
    "message": "Missing ANTHROPIC_API_KEY",
    "details": { "agentId": "coordinator" }
  }
}
```

### Error Codes

| Code | When |
|------|------|
| `MISSING_API_KEY` | No API key in environment or agent config |
| `AGENT_NOT_FOUND` | Agent ID not in router table |
| `AGENT_DISABLED` | Agent exists but `enabled: false` |
| `INVALID_REQUEST` | Missing messages or malformed body |
| `PROVIDER_ERROR` | AI SDK / upstream API failure |
| `MCP_ERROR` | MCP server connection or tool call failure |
| `TIMEOUT` | Request exceeded timeout |
| `MIDDLEWARE_ERROR` | A middleware threw an error |
| `CONTEXT_ERROR` | Context injection or workspace loading failed |
| `TOOL_ERROR` | A tool (web-search, execute-code, generate-ui) failed |

---

## How to Add a New Agent

### Step 1: Create the prompt and config

In `apps/api/src/lib/agents/data/`, create or update `agent-prompts.ts`:

```ts
export const analystAgentSystemPrompt = `You are an analyst...`;

export const analystAgentConfig = {
  id: 'analyst',
  name: 'Analyst',
  description: 'Data analysis and insights.',
  tools: ['web-search'],
  mcpServers: {},
  api: {
    provider: 'openai' as const,
    model: 'gpt-5',
  },
};
```

### Step 2: Register in the router table

In `router-table.ts`, add to `ROUTER_TABLE`:

```ts
{
  id: 'analyst',
  name: 'Analyst',
  description: 'Data analysis and insights.',
  systemPrompt: analystAgentSystemPrompt,
  api: {
    provider: 'openai',
    model: 'gpt-5',
    apiKey: process.env.OPENAI_API_KEY,
  },
  tools: ['web-search'],
  mcpServers: {},
}
```

### Step 3: Add as a subagent of coordinator

Update the coordinator entry:

```ts
subagents: ['coder', 'designer', 'researcher', 'analyst'],
```

### Step 4: Add metadata (optional)

In `data/agent-metadata.ts`:

```ts
{ id: 'analyst', name: 'Analyst', avatar: null, accentColor: '#10b981' }
```

### Step 5: Add UI (if needed)

In `apps/web/src/routes/(app)/agents/`, add routing/panels for the new agent.

---

## Environment Variables

| Variable | Provider | Used By |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic | `coordinator`, `coder` |
| `OPENAI_API_KEY` | OpenAI | `designer`, `researcher` |
| `APIFY_TOKEN` | Apify | `web-search` tool |
| `APP_URL` | — | `generate-ui` tool (returns URLs) |

---

## Key Invariants

1. **Streaming is the default.** Non-streaming requires explicit `stream: false` in the body.
2. **The coordinator never executes tools itself.** It delegates to children via the `delegate` tool.
3. **All children share the same message history.** The coordinator converts its messages to child format.
4. **Disabled agents are excluded from routing** but their config remains in the table for reference.
5. **API keys are resolved lazily** — missing keys log warnings but don't crash the server until an agent is actually invoked.
6. **The delegate tool is synthetic** — it's not defined in `tool-definitions.ts` but is injected at router construction time based on the coordinator's `subagents` list.
7. **MCP servers are optional** — agents work without them; MCP tools are merged into the agent's tool set at runtime.
8. **Context injection happens at stream creation**, not at table build time — the system prompt is dynamically enriched with workspace data, skills, and metadata before each request.

# Multi-Agent Swarm Guide

## Overview

Airove's backend is a **multi-agent swarm** — a single HTTP server coordinating multiple AI agents that work together. This guide explains how the system works, how agents collaborate, and how to configure it.

---

## What Is a Multi-Agent Swarm?

Instead of one AI doing everything, the system splits work across specialized agents:

| Agent | Role | Model | Tools |
|-------|------|-------|-------|
| **Coordinator** | Orchestrator — breaks down tasks, delegates to the right agent, synthesizes results | Claude Sonnet 4.5 | Delegate only (routes to children) |
| **Coder** | Engineering — writes code, executes it, generates UI | Claude Sonnet 4.5 | `web-search`, `execute-code`, `generate-ui` |
| **Designer** | Design — branding, UI/UX, visual systems | GPT-5 | `web-search`, `generate-ui` |
| **Researcher** | Research — fact-finding, competitive analysis, deep dives | GPT-5 | `web-search` |

Each agent has its own system prompt, model configuration, and tool set. The coordinator decides which agent(s) to invoke and combines their outputs.

---

## How Requests Flow

### 1. Client Sends a Message

```
POST /agents/coordinator
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Build me a landing page for a SaaS startup" }
  ]
}
```

### 2. Coordinator Receives the Request

The coordinator's system prompt includes a dynamic manifest of all available agents:

```
You have the following agents available:
  • coder (id: coder): Full-stack engineering tasks — tools: web-search, execute-code, generate-ui
  • designer (id: designer): Design, branding, UI/UX — tools: web-search, generate-ui
  • researcher (id: researcher): Deep research — tools: web-search
```

### 3. Coordinator Delegates

The coordinator calls the `delegate` tool, which routes to the appropriate child agent(s):

```
coordinator decides:
  "I need a designer for the visual direction AND a coder for implementation"
  → delegate(designer, "Design a modern SaaS landing page...")
  → delegate(coder, "Implement the landing page as a React component...")
```

### 4. Child Agent Executes

Each child agent runs independently with its own system prompt, model, and tools:

```
designer → generates design system, color palette, component mockups
coder → writes React code, executes test runs, generates the UI
```

### 5. Results Stream Back

All responses stream via Server-Sent Events (SSE). The client receives tokens as they're generated.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                   Hono Server                    │
│                                                  │
│  POST /agents/coordinator                        │
│  POST /agents/coordinator/chat                   │
│  GET  /agents/:agentId                           │
│  GET  /agents/:agentId/chat                      │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │          Middleware Chain                  │   │
│  │  workspace → skill → modelOverride        │   │
│  └───────────────────┬───────────────────────┘   │
│                      │                           │
│  ┌───────────────────▼───────────────────────┐   │
│  │           Router Table                     │   │
│  │  coordinator → [coder, designer, researcher]│  │
│  └──────┬──────────┬──────────┬──────────────┘   │
│         │          │          │                   │
│  ┌──────▼───┐ ┌────▼────┐ ┌──▼──────┐           │
│  │ Claude   │ │ Claude  │ │ GPT-5   │           │
│  │ Sonnet   │ │ Sonnet  │ │ (OpenAI)│           │
│  │ 4.5      │ │ 4.5     │ │         │           │
│  └──────┬───┘ └────┬────┘ └──┬──────┘           │
│         │          │          │                   │
│  ┌──────▼──────────▼──────────▼──────────────┐   │
│  │            Tool Layer                      │   │
│  │  web-search │ execute-code │ generate-ui   │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Agent Direct Access

You can bypass the coordinator and talk to any agent directly:

```bash
# Talk to the coder agent directly
curl -X POST http://localhost:4000/agents/coder \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Write a React hook for debouncing" }
    ]
  }'

# Talk to the designer agent
curl -X POST http://localhost:4000/agents/designer \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Design a dark-mode color system for a fintech app" }
    ]
  }'
```

---

## Streaming Behavior

All routes stream by default via SSE. Each event has the format:

```
event: text
data: {"type":"text","text":"Hello","agentId":"coder","agentName":"Coder"}

event: tool-call
data: {"type":"tool-call","toolCallId":"...","toolName":"web-search","args":{"query":"..."}}

event: tool-result
data: {"type":"tool-result","toolCallId":"...","result":"..."}

event: finish
data: {"type":"finish","finishReason":"stop","agentId":"coder","agentName":"Coder"}

event: done
data: [DONE]
```

### Non-Streaming Mode

Set `"stream": false` in the request body to get a single buffered JSON response:

```json
{
  "messages": [{ "role": "user", "content": "What is 2+2?" }],
  "stream": false
}
```

---

## MCP (Model Context Protocol) Integration

Each agent can connect to external MCP servers for additional tools. In `router-table.ts`:

```ts
{
  id: 'coder',
  mcpServers: {
    filesystem: {
      url: 'http://localhost:3001/sse',  // SSE transport
    },
    database: {
      command: 'npx',                    // Stdio transport
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { DATABASE_URL: '...' },
    },
  },
}
```

MCP tools are merged into the agent's tool set automatically at runtime.

---

## Custom Model Overrides

Override the model at request time using headers:

```bash
curl -X POST http://localhost:4000/agents/coordinator \
  -H "Content-Type: application/json" \
  -H "x-airove-provider: openai" \
  -H "x-airove-model: gpt-5" \
  -d '{
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  }'
```

Valid model overrides:

| Header Value | Resolves To |
|-------------|-------------|
| `claude-sonnet-4-5-20250514` | Anthropic Claude Sonnet 4.5 |
| `claude-haiku-4-5-20251001` | Anthropic Claude Haiku 4.5 |
| `gpt-5` | OpenAI GPT-5 |
| `gpt-5-mini` | OpenAI GPT-5 Mini |

---

## Adding a New Agent

### 1. Create the prompt and config

```ts
// apps/api/src/lib/agents/data/agent-prompts.ts
export const analystAgentSystemPrompt = `You are an analyst...`;

export const analystAgentConfig = {
  id: 'analyst',
  name: 'Analyst',
  description: 'Data analysis and insights.',
  tools: ['web-search'],
  mcpServers: {},
  api: { provider: 'openai' as const, model: 'gpt-5' },
};
```

### 2. Register in the router table

```ts
// apps/api/src/lib/agents/router-table.ts
{
  id: 'analyst',
  name: 'Analyst',
  description: 'Data analysis and insights.',
  systemPrompt: analystAgentSystemPrompt,
  api: { provider: 'openai', model: 'gpt-5', apiKey: process.env.OPENAI_API_KEY },
  tools: ['web-search'],
  mcpServers: {},
}
```

### 3. Add as a coordinator subagent

```ts
// In the coordinator entry:
subagents: ['coder', 'designer', 'researcher', 'analyst'],
```

### 4. Add metadata (optional)

```ts
// apps/api/src/lib/agents/data/agent-metadata.ts
{ id: 'analyst', name: 'Analyst', avatar: null, accentColor: '#10b981' }
```

### 5. Add UI routing

```ts
// apps/web/src/routes/(app)/agents/index.tsx
const AGENT_ROUTES = {
  coordinator: { ... },
  coder: { ... },
  designer: { ... },
  researcher: { ... },
  analyst: { ... },  // Add here
};
```

---

## Adding a New Tool

### 1. Define the tool

```ts
// apps/api/src/lib/agents/data/tool-definitions.ts
export const calendarTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calendar',
    description: 'Manage calendar events and scheduling.',
    parameters: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'delete'] },
        title: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
      },
    },
  },
};
```

### 2. Register in the tool registry

```ts
// apps/api/src/lib/agents/tools/tool-registry.ts
const toolDefinitions = { 'calendar': calendarTool };
const toolImplementations = { 'calendar': calendarHandler };
```

### 3. Add to agent(s)

```ts
// In router-table.ts, update the agent's tools array:
tools: ['web-search', 'calendar']
```

---

## Architecture Patterns

### Coordinator Pattern

The coordinator is the "brain" — it doesn't execute tasks, it orchestrates:

```
User → Coordinator → [Coder, Designer, Researcher] → Results → User
```

The coordinator's system prompt explicitly says: **"Never call delegate with your own id; use other agents for execution."**

### Direct Access Pattern

For single-agent tasks, bypass the coordinator:

```
User → Coder (direct) → Tools → Result
```

### Parallel Delegation

The coordinator can delegate to multiple agents simultaneously:

```
User → Coordinator → Coder ─────┐
                └→ Designer ─────┤→ Synthesized Result
                └→ Researcher ───┘
```

---

## Default Agent

When the coordinator can't determine which agent to use, it defaults to `coder`:

```
"When unsure about which agent fits best, delegate to coder as a sensible default."
```

---

## Error Handling

Each tool and agent returns structured errors:

```json
{
  "success": false,
  "error": {
    "code": "MCP_ERROR",
    "message": "MCP server unavailable: filesystem",
    "details": { "agentId": "coder" }
  }
}
```

Common errors:

| Code | Cause |
|------|-------|
| `MISSING_API_KEY` | No API key in env or agent config |
| `AGENT_NOT_FOUND` | Agent ID doesn't exist in table |
| `AGENT_DISABLED` | Agent exists but `enabled: false` |
| `PROVIDER_ERROR` | AI SDK / upstream API failure |
| `MCP_ERROR` | MCP server connection or tool failure |
| `TOOL_ERROR` | Built-in tool (web-search, execute-code, generate-ui) failed |

---

## Prompt Inheritance

When a child agent receives a request via delegation:

1. Its **own system prompt** is used (from `router-table.ts`)
2. The **user message** is replaced with the delegation context:
   ```
   [Delegated from coordinator]
   Original user request: {original message}
   Specific task: {delegate task}
   {agent metadata and context}
   ```
3. The child's **tools** are its own (not the coordinator's)
4. The child **does not have delegate access** — it can only use its own tools

This ensures clean separation: the coordinator orchestrates, children execute.

---

## Performance Considerations

- **Streaming starts immediately** — no waiting for the full response
- **Parallel delegation** — the coordinator can invoke multiple agents simultaneously
- **Tool results are streamed** — you see tool calls and results as they happen
- **MCP servers are lazy-loaded** — connections are established on first use
- **Model overrides are per-request** — no server restart needed
- **Context injection is per-request** — workspace data is loaded fresh each time

---

## Monitoring

Each agent logs via `pino` with a named logger:

```
[agent-router] Routing request to agentId=coordinator model=claude-sonnet-4-5
[agent-engine] Executing agent coordinator model=claude-sonnet-4-5 stream=true
[agent-middleware] Model override applied: openai/gpt-5 (from x-airove-* headers)
```

Tool calls are logged with full args and results for debugging.

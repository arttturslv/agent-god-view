# OpenCode Events and AgentEvent Mapping

Reference for stage 4 (recording) and stage 5 (normalization) of the project
roadmap. It covers the spool envelope, the events captured in the fixtures, the
properties each event carries, and how `mapEvent(raw)` should translate them
into the normalized `AgentEvent` union from `@agent-god-view/core`.

## Spool envelope

The recorder plugin (`.opencode/plugins/agent-god-view.ts`) appends one JSON
object per line:

```json
{"ts":1793232005300,"type":"permission.asked","data":{"id":"per_01HTEST0001","sessionID":"ses_01HTEST0001","agentId":"coder","agentName":"Coder","what":"Edit file src/app.ts","tool":"edit"}}
```

- `ts`: epoch milliseconds when the recorder wrote the line.
- `type`: raw opencode event name (`event.type`) or hook name
  (`tool.execute.before`, `tool.execute.after`).
- `data`: `event.properties` for opencode events; tool hooks currently record
  `{ tool }` plus session/agent metadata in the fixtures. No file contents or
  full command text are recorded by the plugin.

The fixtures are deterministic recordings in this envelope. Extra agent fields
(`agentId`, `agentName`) are included so mapping tests do not depend on a live
session map; production payloads may only carry `sessionID` and require the
fallback rules below.

## Fixture inventory

| Fixture | Scenario | Total | Event counts |
| --- | --- | --- | --- |
| `fixtures/opencode-session-01.ndjson` | Successful session: plan, read, approved edit, tests, idle | 11 | `agents_defined` 1, `message.updated` 3, `tool.execute.before` 2, `tool.execute.after` 2, `permission.asked` 1, `permission.replied` 1, `session.idle` 1 |
| `fixtures/opencode-session-02.ndjson` | Denied permission followed by a session error | 5 | `agents_defined` 1, `message.updated` 1, `permission.asked` 1, `permission.replied` 1, `session.error` 1 |

Inspect any spool or fixture with:

```powershell
node scripts/analyze-spool.js fixtures/opencode-session-01.ndjson
```

Without an argument, the script reads `fixtures/opencode-session-01.ndjson`.

## Event mapping

| OpenCode event | Main `data` properties | `AgentEvent` | Mapping notes |
| --- | --- | --- | --- |
| `agents_defined` | `agents[]` (`id`, `name`, `description`, `model`) | `agents_defined` | Not emitted by opencode. Synthesized from `readProject()` at startup/replay so the reducer knows the cast before activity arrives. |
| `message.updated` | `sessionID`, `messageID`, `role`, `agentId`, `agentName`, `task` | `agent_active` | Emit once per assistant update that changes the task. Deduplicate by `messageID` if the same message arrives repeatedly. `task` falls back to a short text excerpt or `message:<id>`. |
| `message.part.updated` | `sessionID`, `messageID`, `part` | `agent_active` | Fallback when `message.updated` does not identify the agent. Ignore non-text parts that do not carry activity. |
| `tool.execute.before` | `tool`, `sessionID`, `agentId`, `agentName`, `callID` | `agent_active` | Task is `tool:<name>` (for example `tool:read`). Resolve the agent from the event or the session map. |
| `tool.execute.after` | `tool`, `sessionID`, `agentId`, `agentName`, `callID` | none | Do not emit `idle` here: the agent usually continues after a tool. The next activity event keeps it `working`; timeouts or `session.idle` finish it. |
| `permission.asked` | `id`, `sessionID`, `agentId`, `agentName`, `what`, `tool` | `permission_request` | `id` is the correlation key. `what` is a human-readable description (prefer `description`/`title`; otherwise `tool` + target). If the agent is absent, resolve it from the session map. |
| `permission.replied` | `id`, `sessionID`, `granted` | `permission_resolved` | Preserve `granted: false`; the reducer clears the pending permission and the subsequent `session.error` marks the agent as `error`. |
| `session.idle` | `sessionID` (fixtures also include `agentId`) | `idle` | Resolve the agent from the session's last active agent when `agentId` is missing. If several agents share the session, emit `idle` for the one currently `working`. |
| `session.error` | `message`, `sessionID`, `agentId`, `agentName` | `error` | Extract the message from `data.message` or `data.error.message`. Attach the session agent when missing; if no agent can be resolved, emit `error` without `agentId`. |
| `session.created` | `sessionID`, `parentID`, `agent`/`agentId` | `handoff` (subagent only) | Use for the session-to-agent map. If `parentID` is present and the child agent differs from the parent agent, emit one `handoff` from parent to child. |
| `session.updated` | `sessionID`, `title`, metadata | none | Update the session map (agent, title) and keep the state. |
| `session.deleted` | `sessionID` | none | Remove the session map entry; do not change agent status by itself. |
| `message.removed`, other events | varies | none | Ignore until the event appears in a real fixture and its fields are documented here. |

### Permission ordering

In the approved fixture, the permission appears exactly between the assistant
message and the tool execution:

1. `permission.asked` (fixture 01, line 6) — `per_01HTEST0001`, `what = "Edit file src/app.ts"`.
2. `permission.replied` (fixture 01, line 7) — `granted: true`.
3. `tool.execute.before` (fixture 01, line 8) — `tool: "edit"`.
4. `tool.execute.after` (fixture 01, line 9) — `tool: "edit"`.

The denied fixture has the same correlation id across `permission.asked`
(line 3) and `permission.replied` (line 4, `granted: false`), followed by
`session.error` on line 5.

### Agent resolution order

`mapEvent` should resolve the owning agent in this order:

1. `data.agentId`
2. the last agent recorded for `data.sessionID` by `message.updated` /
   `session.created`
3. the parent session agent for child sessions
4. otherwise, skip agent-scoped events or emit `error` without `agentId`

### Handoff and subagents

The fixtures do not contain a child session. A subagent normally appears as a
new session with a `parentID` (field name varies by opencode version). When that
child session is first seen with an agent different from the parent's agent,
emit:

```ts
{ type: 'handoff', ts, from: parentAgentId, to: childAgentId }
```

Emit the handoff only once per parent/child pair. Do not infer handoffs from
tool names; wait for the session relationship or a captured fixture.

## Mapping examples

```ts
// message.updated
{ type: 'agent_active', ts, agentId: 'coder', task: 'Implementing src/app.ts' }

// permission.asked
{ type: 'permission_request', ts, agentId: 'coder', id: 'per_01HTEST0001', what: 'Edit file src/app.ts' }

// permission.replied
{ type: 'permission_resolved', ts, id: 'per_01HTEST0001', granted: true }

// session.idle
{ type: 'idle', ts, agentId: 'tester' }

// session.error
{ type: 'error', ts, agentId: 'coder', message: 'Permission denied: bash command was not executed.' }
```

## Version caveat

Exact property names and nesting vary across opencode releases. Validate against
a real spool before finalizing `mapEvent`; if a build nests the permission under
`data.permission`, extract `data.permission.id` and keep the same `AgentEvent`
output. Never invent event names: extend this table and the fixtures first.

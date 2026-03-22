# Configuration

`createCallLogEngine(config)` accepts a `CallLogEngineConfig` object. This page documents every option.

## `db` (required)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `db.connection` | `mongoose.Connection` | **required** | Mongoose connection instance |
| `db.collectionPrefix` | `string` | `undefined` | Prefix for all collection names (pipelines, calllogs, calllogsettings) |

## `logger` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `LogAdapter` | `noopLogger` | Logger with `info`, `warn`, `error`, `debug` methods |

The `LogAdapter` interface:

```ts
interface LogAdapter {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}
```

If omitted, a no-op logger from `@astralibx/core` is used.

## `agents` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agents.collectionName` | `string` | `'chatagents'` | Name of the MongoDB collection for agents. Defaults to the same collection used by chat-engine |
| `agents.resolveAgent` | `(agentId: string) => Promise<AgentInfo \| null>` | `undefined` | Resolves an agent ID to display info. Used by analytics for agent name resolution |

See [Agent Sharing](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/agent-sharing.md) for details on sharing agents with chat-engine.

### `AgentInfo`

```ts
interface AgentInfo {
  agentId: string;
  displayName: string;
  avatar?: string;
  teamId?: string;
}
```

## `adapters` (required)

| Adapter | Type | Required | Description |
|---------|------|----------|-------------|
| `adapters.lookupContact` | `(query: { phone?: string; email?: string; externalId?: string }) => Promise<ContactInfo \| null>` | **Yes** | Looks up a contact from your contact store |
| `adapters.addContact` | `(data: { displayName: string; phone?: string; email?: string; metadata?: Record<string, unknown> }) => Promise<ContactInfo>` | No | Creates a new contact when the form submits one |
| `adapters.authenticateAgent` | `(token: string) => Promise<AuthResult \| null>` | **Yes** | Verifies a bearer token and returns agent identity |

See [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/adapters.md) for detailed documentation of each adapter.

### `ContactInfo`

```ts
interface ContactInfo {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}
```

### `AuthResult`

```ts
interface AuthResult {
  adminUserId: string;
  displayName: string;
}
```

## `hooks` (optional)

| Hook | Signature | Description |
|------|-----------|-------------|
| `onCallCreated` | `(callLog: ICallLog) => void \| Promise<void>` | After call log is created |
| `onStageChanged` | `(callLog: ICallLog, fromStage: string, toStage: string) => void \| Promise<void>` | After stage transition |
| `onCallClosed` | `(callLog: ICallLog) => void \| Promise<void>` | After call reaches terminal stage or manual close |
| `onCallAssigned` | `(callLog: ICallLog, previousAgentId?: string) => void \| Promise<void>` | After call is reassigned |
| `onFollowUpDue` | `(callLog: ICallLog) => void \| Promise<void>` | Fired by FollowUpWorker when follow-up date is reached |
| `onMetric` | `(metric: CallLogMetric) => void \| Promise<void>` | Operational metrics for monitoring |

See [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/hooks.md) for detailed documentation.

## `options` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `options.maxTimelineEntries` | `number` | `200` | Maximum number of timeline entries per call log |
| `options.followUpCheckIntervalMs` | `number` | `60000` (1 min) | How often the follow-up worker polls for due follow-ups |

## `CallLogEngine` Return Type

`createCallLogEngine()` returns an object with these members:

| Member | Type | Description |
|--------|------|-------------|
| `pipelines` | `PipelineService` | CRUD operations on pipelines and stages |
| `callLogs` | `CallLogService` | CRUD, stage changes, assignment, close/reopen, follow-ups |
| `timeline` | `TimelineService` | Add notes, get call/contact timelines |
| `analytics` | `AnalyticsService` | Dashboard stats, agent/pipeline/team stats, reports |
| `settings` | `SettingsService` | Get/update global settings |
| `export` | `ExportService` | Export call logs and pipeline reports |
| `routes` | `express.Router` | Mounted REST API router |
| `models` | `{ Pipeline, CallLog, CallLogSettings }` | Raw Mongoose models for advanced queries |
| `destroy` | `() => Promise<void>` | Stops the follow-up worker and cleans up |

The follow-up worker starts automatically when the factory is called. Call `destroy()` on graceful shutdown to stop it.

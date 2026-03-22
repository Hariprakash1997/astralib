# Call Log Manager — Design Specification

**Date:** 2026-03-21
**Module:** `packages/call-log/`
**Approach:** Independent module, shared agent collection with chat-engine (Approach C)

---

## 1. Overview

A manual call logging system with admin-configurable pipelines, timeline-based call notes, and full analytics. Support agents are shared with the chat module — one agent record serves both chat and call responsibilities. Contacts are owned by the consumer's platform, not the library.

**Key decisions:**
- Pipeline-style configurable statuses (admin creates pipelines with ordered stages)
- Timeline-based call notes (not single text field, not template forms)
- Both inbound and outbound call logging
- Agent collection shared with chat-engine at the MongoDB level
- Contact management via consumer-provided adapters
- Unified support UI as a separate optional package

---

## 2. Package Structure

```
packages/call-log/
├── call-log-types/          @astralibx/call-log-types    (pure TS, no runtime deps)
│   └── src/
│       ├── index.ts
│       ├── enums.ts                   (TypeScript enums — shared across packages)
│       ├── pipeline.types.ts
│       ├── call-log.types.ts
│       ├── timeline.types.ts
│       ├── analytics.types.ts         (includes CallLogMetric, ExportFormat)
│       ├── adapter.types.ts           (AgentInfo, ContactInfo, AuthResult)
│       └── config.types.ts
│
├── call-log-engine/         @astralibx/call-log-engine   (peer: express, mongoose)
│   └── src/
│       ├── index.ts                   (createCallLogEngine factory)
│       ├── constants/index.ts         (as const objects, error codes, defaults)
│       ├── errors/index.ts            (typed error classes extending AlxError)
│       ├── schemas/
│       │   ├── pipeline.schema.ts
│       │   ├── call-log.schema.ts
│       │   └── call-log-settings.schema.ts
│       ├── services/
│       │   ├── pipeline.service.ts
│       │   ├── call-log.service.ts
│       │   ├── timeline.service.ts
│       │   ├── analytics.service.ts
│       │   ├── settings.service.ts
│       │   └── export.service.ts
│       ├── workers/
│       │   └── follow-up.worker.ts    (periodic check for due follow-ups)
│       ├── routes/index.ts
│       ├── validation/
│       │   └── pipeline.validator.ts
│       └── types/
│           └── config.types.ts
│
├── call-log-ui/             @astralibx/call-log-ui       (peer: lit)
│   └── src/
│       ├── index.ts
│       ├── config.ts                  (CallLogUIConfig singleton)
│       ├── api/
│       │   ├── call-log-api-client.ts
│       │   └── http-client.ts
│       └── components/
│           ├── pipelines/             (pipeline board, stage editor)
│           ├── call-logs/             (call list, call detail, call form)
│           ├── timeline/              (contact timeline, call timeline)
│           ├── analytics/             (dashboards, funnel, leaderboard)
│           └── settings/              (admin settings panel)
│
└── docs/
```

**Dependency graph:**
```
@astralibx/core
     |
     +-- call-log-types         (pure TS, zero deps)
              |
              +-- call-log-engine   (peer: express, mongoose)
              |
              +-- call-log-ui       (peer: lit)
```

No imports from chat-engine. Both modules share `@astralibx/core` utilities only.

---

## 3. Enums (call-log-types/src/enums.ts)

TypeScript enums for domain values shared across packages:

```ts
export enum CallDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

export enum CallPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum TimelineEntryType {
  Note = 'note',
  StageChange = 'stage_change',
  Assignment = 'assignment',
  FollowUpSet = 'follow_up_set',
  FollowUpCompleted = 'follow_up_completed',
  System = 'system',
}
```

---

## 4. Constants (call-log-engine/src/constants/index.ts)

`as const` objects for internal engine constants:

```ts
// Error Codes
export const ERROR_CODE = {
  PipelineNotFound: 'CALL_PIPELINE_NOT_FOUND',
  InvalidPipeline: 'CALL_INVALID_PIPELINE',
  StageNotFound: 'CALL_STAGE_NOT_FOUND',
  StageInUse: 'CALL_STAGE_IN_USE',
  CallLogNotFound: 'CALL_LOG_NOT_FOUND',
  CallLogClosed: 'CALL_LOG_CLOSED',
  ContactNotFound: 'CALL_CONTACT_NOT_FOUND',
  AgentCapacityFull: 'CALL_AGENT_CAPACITY_FULL',
  InvalidConfig: 'CALL_INVALID_CONFIG',
  AuthFailed: 'CALL_AUTH_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

// Error Messages
export const ERROR_MESSAGE = {
  PipelineNotFound: 'Pipeline not found',
  PipelineNoDefaultStage: 'Pipeline must have exactly one default stage',
  PipelineNoTerminalStage: 'Pipeline must have at least one terminal stage',
  PipelineDuplicateStageNames: 'Stage names must be unique within a pipeline',
  StageNotFound: 'Stage not found in pipeline',
  StageInUse: 'Cannot remove stage that has active calls',
  CallLogNotFound: 'Call log not found',
  CallLogClosed: 'Cannot modify a closed call log',
  ContactNotFound: 'Contact not found',
  AgentCapacityFull: 'Agent has reached maximum concurrent calls',
  AuthFailed: 'Authentication failed',
} as const;

// Pipeline Defaults
export const PIPELINE_DEFAULTS = {
  MaxStages: 20,
} as const;

// Call Log Defaults
export const CALL_LOG_DEFAULTS = {
  MaxTimelineEntries: 200,
  DefaultFollowUpDays: 3,
  TimelinePageSize: 20,
} as const;

// Agent Call Defaults
export const AGENT_CALL_DEFAULTS = {
  MaxConcurrentCalls: 10,
} as const;

// System Timeline Messages
export const SYSTEM_TIMELINE = {
  CallCreated: 'Call log created',
  CallClosed: 'Call closed',
  FollowUpCompleted: 'Follow-up completed',
} as const;

export const SYSTEM_TIMELINE_FN = {
  stageChanged: (from: string, to: string) => `Stage changed from "${from}" to "${to}"`,
  callAssigned: (agentName: string) => `Call assigned to ${agentName}`,
  callReassigned: (from: string, to: string) => `Call reassigned from ${from} to ${to}`,
  followUpSet: (date: string) => `Follow-up scheduled for ${date}`,
} as const;
```

---

## 5. Error Hierarchy (call-log-engine/src/errors/index.ts)

```
AlxError (from @astralibx/core)
  └── AlxCallLogError (base — code prefix: CALL_*)
        ├── PipelineNotFoundError       { pipelineId }
        ├── InvalidPipelineError        { pipelineId, reason }
        ├── StageNotFoundError          { pipelineId, stageId }
        ├── StageInUseError             { pipelineId, stageId, activeCallCount }
        ├── CallLogNotFoundError        { callLogId }
        ├── CallLogClosedError          { callLogId, attemptedAction }
        ├── ContactNotFoundError        { contactQuery }
        ├── AgentCapacityError          { agentId, currentCalls, maxCalls }
        └── InvalidConfigError          { field, reason }
```

Each error includes typed context properties and a human-readable message, same pattern as chat-engine.

---

## 6. Schemas

### 6.1 Pipeline Schema (`IPipeline`)

```ts
interface IPipelineStage {
  stageId: string;         // UUID
  name: string;            // "Demo Scheduled"
  color: string;           // hex — for UI rendering
  order: number;           // display order
  isTerminal: boolean;     // true = end state (Won, Lost, Closed)
  isDefault: boolean;      // new calls start here (exactly one per pipeline)
}

interface IPipeline {
  pipelineId: string;      // UUID, unique index
  name: string;
  description?: string;
  stages: IPipelineStage[];
  isActive: boolean;       // admin can temporarily deactivate
  isDeleted: boolean;      // soft delete — distinct from isActive
  isDefault: boolean;      // default pipeline for new calls
  createdBy: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `pipelineId` (unique), `isActive`, `tenantId` (sparse)
**Validation:** Exactly one default stage, at least one terminal stage, unique stage names within pipeline.

### 6.2 Call Log Schema (`ICallLog`)

```ts
interface IContactRef {
  externalId: string;      // ID in consumer's contacts table
  displayName: string;     // cached for display
  phone?: string;
  email?: string;
}

interface IStageChange {
  fromStageId: string;
  toStageId: string;
  fromStageName: string;
  toStageName: string;
  changedBy: string;       // agentId
  changedAt: Date;
  timeInStageMs: number;   // duration in previous stage
}

interface ITimelineEntry {
  entryId: string;         // UUID
  type: TimelineEntryType; // enum
  content?: string;
  authorId?: string;
  authorName?: string;
  fromStageId?: string;    // for stage_change — stage UUID
  fromStageName?: string;  // for stage_change — human-readable
  toStageId?: string;
  toStageName?: string;
  fromAgentId?: string;    // for assignment — agent ObjectId as string
  fromAgentName?: string;
  toAgentId?: string;
  toAgentName?: string;
  createdAt: Date;
}

interface ICallLog {
  callLogId: string;       // UUID, unique index
  pipelineId: string;
  currentStageId: string;

  contactRef: IContactRef;

  direction: CallDirection;    // enum: inbound | outbound
  callDate: Date;
  nextFollowUpDate?: Date;
  priority: CallPriority;     // enum: low | medium | high | urgent

  agentId: ObjectId;           // ObjectId because it references a Mongoose document in the shared agent collection
  assignedBy?: string;         // All other domain IDs (callLogId, pipelineId, stageId) are UUID strings generated by the engine

  tags: string[];
  category?: string;

  timeline: ITimelineEntry[];
  stageHistory: IStageChange[];

  isClosed: boolean;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  tenantId?: string;
  metadata?: Record<string, unknown>;
}
```

**Indexes:**
- `callLogId` (unique)
- `pipelineId`
- `currentStageId`
- `agentId`
- `contactRef.externalId`
- `nextFollowUpDate`
- `callDate`
- `isClosed`
- `tags`
- `tenantId` (sparse)
- Compound: `pipelineId + currentStageId`, `agentId + isClosed`

### 6.3 Call Log Settings Schema (`ICallLogSettings`)

Singleton document per tenant.

```ts
interface IPriorityConfig {
  value: string;           // matches CallPriority enum value
  label: string;           // display label (admin can rename)
  color: string;           // hex color
  order: number;
}

interface ICallLogSettings {
  key: 'global';

  availableTags: string[];
  availableCategories: string[];
  priorityLevels: IPriorityConfig[];

  defaultFollowUpDays: number;          // default: 3
  followUpReminderEnabled: boolean;     // default: true

  defaultPipelineId?: string;
  timelinePageSize: number;             // default: 20
  maxConcurrentCalls: number;           // default: 10

  tenantId?: string;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}
```

**Indexes:** Compound unique `(key, tenantId)` — ensures one singleton per tenant. For single-tenant deployments, `tenantId` is null so `key: 'global'` alone is unique.

---

## 7. Factory & Config

**Adapter return types** (defined in `call-log-types/src/adapter.types.ts`):

```ts
interface AgentInfo {
  agentId: string;
  displayName: string;
  avatar?: string;
  teamId?: string;        // from shared agent collection — used for team analytics
}

interface ContactInfo {
  externalId: string;      // ID in consumer's contacts table
  displayName: string;
  phone?: string;
  email?: string;
}

interface AuthResult {
  adminUserId: string;
  displayName: string;
}

type ExportFormat = 'json' | 'csv';

interface CallLogMetric {
  name: string;            // e.g., 'call_created', 'stage_changed', 'follow_up_overdue'
  labels: Record<string, string>;
  value?: number;
}
```

**Engine config:**

```ts
interface CallLogEngineConfig {
  db: {
    connection: mongoose.Connection;
    collectionPrefix?: string;
  };

  logger?: LogAdapter;       // from @astralibx/core — defaults to noopLogger

  agents: {
    collectionName?: string;     // default: 'chatagents'
    resolveAgent?: (agentId: string) => Promise<AgentInfo | null>;
  };

  adapters: {
    lookupContact: (query: { phone?: string; email?: string; externalId?: string }) => Promise<ContactInfo | null>;
    addContact?: (data: { displayName: string; phone?: string; email?: string; metadata?: Record<string, unknown> }) => Promise<ContactInfo>;
    authenticateAgent: (token: string) => Promise<AuthResult | null>;
  };

  hooks?: {
    onCallCreated?: (callLog: ICallLog) => void | Promise<void>;
    onStageChanged?: (callLog: ICallLog, fromStage: string, toStage: string) => void | Promise<void>;
    onCallClosed?: (callLog: ICallLog) => void | Promise<void>;
    onCallAssigned?: (callLog: ICallLog, previousAgentId?: string) => void | Promise<void>;
    onFollowUpDue?: (callLog: ICallLog) => void | Promise<void>;
    onMetric?: (metric: CallLogMetric) => void | Promise<void>;
  };

  options?: {
    maxTimelineEntries?: number;             // default: 200
    followUpCheckIntervalMs?: number;        // default: 60_000 (1 minute)
  };
}
```

**Factory returns:**
```ts
interface CallLogEngine {
  pipelines: PipelineService;
  callLogs: CallLogService;
  timeline: TimelineService;
  analytics: AnalyticsService;
  settings: SettingsService;
  export: ExportService;
  routes: express.Router;
  models: { Pipeline: Model<IPipeline>; CallLog: Model<ICallLog>; CallLogSettings: Model<ICallLogSettings> };
  destroy: () => Promise<void>;  // stops FollowUpWorker, cleans up
}
```

---

## 8. Services

### 8.1 PipelineService

| Method | Description |
|--------|-------------|
| `create(data)` | Create pipeline with stages, validate defaults/terminal |
| `update(pipelineId, data)` | Update name, description, isActive |
| `delete(pipelineId)` | Sets `isDeleted: true` (distinct from `isActive: false` which is temporary deactivation). Fails if non-closed calls reference it. Closed calls on deleted pipelines remain queryable in analytics. |
| `list(filter?)` | List pipelines, filter by isActive |
| `get(pipelineId)` | Get single pipeline |
| `addStage(pipelineId, stage)` | Add a stage to pipeline |
| `removeStage(pipelineId, stageId)` | Remove — fails if calls are in this stage |
| `updateStage(pipelineId, stageId, data)` | Rename, recolor, toggle terminal/default |
| `reorderStages(pipelineId, stageIds[])` | Reorder stages |

**Validation rules:**
- Exactly one `isDefault: true` stage per pipeline
- At least one `isTerminal: true` stage per pipeline
- Stage names unique within pipeline
- Cannot remove a stage that has active (non-closed) calls

### 8.2 CallLogService

| Method | Description |
|--------|-------------|
| `create(data)` | Create call log, set default stage, add "Call Created" timeline entry, fire `onCallCreated` |
| `update(callLogId, data)` | Update priority, tags, category, followUpDate. Fails if closed. |
| `changeStage(callLogId, newStageId, agentId)` | Move to new stage using atomic `findOneAndUpdate` with `currentStageId` condition (optimistic concurrency — prevents race conditions if two agents change stage simultaneously). Record `stageHistory` with `timeInStageMs`, add timeline entry, fire `onStageChanged`. If terminal → `isClosed=true`, fire `onCallClosed` |
| `assign(callLogId, agentId, assignedBy)` | Reassign, add timeline entry, fire `onCallAssigned` |
| `list(filter)` | Filter by: pipeline, stage, agent, tags, category, dateRange, isClosed, contactRef.externalId, priority, direction |
| `get(callLogId)` | Full call log |
| `getByContact(externalId)` | All calls for a contact |
| `getFollowUpsDue(agentId?, dateRange?)` | Calls with `nextFollowUpDate <= now` and `isClosed == false` |
| `bulkChangeStage(callLogIds[], newStageId, agentId)` | Batch stage change |
| `close(callLogId, agentId)` | Manually close without moving to terminal stage |

### 8.3 TimelineService

| Method | Description |
|--------|-------------|
| `addNote(callLogId, content, authorId, authorName)` | Add note entry. Fails if closed. |
| `addSystemEntry(callLogId, content)` | System-generated entry |
| `getTimeline(callLogId, { page, limit })` | Paginated timeline for one call |
| `getContactTimeline(externalId, { page, limit })` | Merged timeline across ALL calls for a contact, sorted by `createdAt` desc |

### 8.4 AnalyticsService

**Agent-focused:**

| Method | Description |
|--------|-------------|
| `getAgentStats(agentId, dateRange)` | Total calls, avg calls/day, follow-ups completed, overdue follow-ups, calls by pipeline, calls closed |
| `getAgentLeaderboard(dateRange)` | Rank agents by call volume, close rate |

**Pipeline-focused:**

| Method | Description |
|--------|-------------|
| `getPipelineStats(pipelineId, dateRange)` | Calls per stage, conversion rates between stages, avg time per stage, bottleneck detection |
| `getPipelineFunnel(pipelineId, dateRange)` | Funnel visualization: entries at each stage, drop-off rates |

**Team & overall:**

| Method | Description |
|--------|-------------|
| `getTeamStats(teamId?, dateRange)` | Aggregated agent stats for a team. `teamId` corresponds to the `teamId` field on the shared agent document (from chat-engine's agent schema). Filters agents by team, then aggregates their call stats. |
| `getDailyReport(dateRange)` | Calls per day, by direction, by pipeline, by agent |
| `getWeeklyTrends(weeks)` | Week-over-week comparison |
| `getOverallReport(dateRange)` | Total calls, closed calls, avg time to close, follow-up compliance rate, tag distribution, category distribution, peak call hours |

All use MongoDB `$group` / `$unwind` / `$bucket` aggregations, matching chat-engine's `ReportService` pattern.

### 8.5 SettingsService

| Method | Description |
|--------|-------------|
| `get()` | Get or auto-create default singleton |
| `update(data)` | Update settings |

### 8.6 ExportService

| Method | Description |
|--------|-------------|
| `exportCallLog(callLogId, format)` | Single call with timeline — JSON or CSV |
| `exportCallLogs(filter, format)` | Bulk export with filters |
| `exportPipelineReport(pipelineId, dateRange, format)` | Pipeline analytics as JSON/CSV |

---

## 9. REST Routes

### Pipelines
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/pipelines` | Protected | List pipelines |
| `POST` | `/pipelines` | Protected | Create pipeline |
| `GET` | `/pipelines/:id` | Protected | Get pipeline |
| `PUT` | `/pipelines/:id` | Protected | Update pipeline |
| `DELETE` | `/pipelines/:id` | Protected | Delete pipeline |
| `POST` | `/pipelines/:id/stages` | Protected | Add stage |
| `PUT` | `/pipelines/:id/stages/:stageId` | Protected | Update stage |
| `DELETE` | `/pipelines/:id/stages/:stageId` | Protected | Remove stage |
| `PUT` | `/pipelines/:id/stages/reorder` | Protected | Reorder stages |

### Call Logs
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/calls` | Protected | List call logs (filterable) |
| `POST` | `/calls` | Protected | Create call log |
| `GET` | `/calls/follow-ups` | Protected | Due follow-ups |
| `GET` | `/calls/:id` | Protected | Get call log |
| `PUT` | `/calls/:id` | Protected | Update call log |
| `PUT` | `/calls/:id/stage` | Protected | Change stage |
| `PUT` | `/calls/:id/assign` | Protected | Reassign |
| `PUT` | `/calls/:id/close` | Protected | Manual close |
| `POST` | `/calls/:id/notes` | Protected | Add timeline note |
| `GET` | `/calls/:id/timeline` | Protected | Paginated timeline |
| `PUT` | `/calls/-/bulk/stage` | Protected | Bulk stage change (prefixed to avoid `:id` conflict) |

### Contacts
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/contacts/:externalId/calls` | Protected | All calls for a contact |
| `GET` | `/contacts/:externalId/timeline` | Protected | Merged contact timeline |

### Analytics
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/analytics/agent/:agentId` | Protected | Agent stats |
| `GET` | `/analytics/agent-leaderboard` | Protected | Agent ranking |
| `GET` | `/analytics/pipeline/:id` | Protected | Pipeline stats |
| `GET` | `/analytics/pipeline/:id/funnel` | Protected | Funnel data |
| `GET` | `/analytics/team` | Protected | Team stats |
| `GET` | `/analytics/daily` | Protected | Daily report |
| `GET` | `/analytics/weekly-trends` | Protected | Weekly trends |
| `GET` | `/analytics/overall` | Protected | Overall report |

### Settings & Export
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/settings` | Protected | Get settings |
| `PUT` | `/settings` | Protected | Update settings |
| `GET` | `/export/calls` | Protected | Export call logs (bulk) |
| `GET` | `/export/calls/:id` | Protected | Export single call log with timeline |
| `GET` | `/export/pipeline/:id` | Protected | Export pipeline report |

---

## 10. Agent Collection Sharing

Both `chat-engine` and `call-log-engine` point to the **same MongoDB collection** (default: `chatagents`).

`call-log-engine` registers a Mongoose schema that extends the agent document with call-specific fields:

```ts
// Added by call-log-engine to shared agent documents
callCapacity: {
  maxConcurrentCalls: { type: Number, default: AGENT_CALL_DEFAULTS.MaxConcurrentCalls },
  activeCalls: { type: Number, default: 0 },
  totalCallsHandled: { type: Number, default: 0 },
}
```

Mongoose schemas are additive — chat-engine's schema defines chat fields, call-log-engine adds call fields. Each engine ignores fields it doesn't define. No schema conflicts.

**Consumer setup:**
```ts
const chatEngine = createChatEngine({ db: { connection }, ... });
const callLogEngine = createCallLogEngine({
  db: { connection },
  agents: { collectionName: 'chatagents' },
  ...
});

app.use('/api/chat', chatEngine.routes);
app.use('/api/call-log', callLogEngine.routes);
```

---

## 11. Unified Support UI (optional)

A separate package `@astralibx/support-ui` that combines chat-ui and call-log-ui:

```
packages/support-ui/         @astralibx/support-ui  (peer: lit, @astralibx/chat-ui, @astralibx/call-log-ui)
└── src/
    └── components/
        ├── alx-support-dashboard.ts       (tabs: Overview, Chats, Calls, Analytics, Settings)
        ├── alx-unified-agent-view.ts      (agent's chats + calls in one view)
        ├── alx-unified-contact-view.ts    (contact chat sessions + call timeline)
        └── alx-unified-analytics.ts       (combined metrics from both engines)
```

Optional — consumers can use `call-log-ui` standalone.

---

## 12. Hooks System

```ts
hooks: {
  onCallCreated:   (callLog) => void        // fired when a call log is created
  onStageChanged:  (callLog, from, to) => void  // fired on every stage transition
  onCallClosed:    (callLog) => void        // fired when call reaches terminal stage or manual close
  onCallAssigned:  (callLog, prevAgentId?) => void  // fired on assignment/reassignment
  onFollowUpDue:   (callLog) => void        // fired by FollowUpWorker when follow-up date is reached
  onMetric:        (metric) => void         // operational metrics for Prometheus/Datadog
}
```

### FollowUpWorker (`workers/follow-up.worker.ts`)

Runs on `followUpCheckIntervalMs` interval (default 60s), matching the pattern of chat-engine's `SessionTimeoutWorker` and `AutoAwayWorker`:

1. Query call logs where `nextFollowUpDate <= now` AND `isClosed == false` AND not already notified
2. For each due follow-up, fire `onFollowUpDue` hook
3. Mark as notified to prevent duplicate firings (via a `followUpNotifiedAt` field on the call log)

Started automatically by `createCallLogEngine()`, stopped by `destroy()`.

---

## 13. Testing Strategy

Following chat-engine patterns (326 tests):

- **Schema tests** — validation rules, defaults, indexes, enum values
- **Pipeline validation tests** — default stage rules, terminal stage rules, duplicate names, stage removal with active calls
- **Service unit tests** — mock models, test business logic for each service method
- **Analytics tests** — aggregation pipeline correctness with seeded data
- **Timeline tests** — entry creation, pagination, contact timeline merging
- **Integration tests** — factory creation, route handlers, adapter wiring, auth middleware
- **Export tests** — JSON and CSV format correctness

**Target:** ~200+ tests across call-log-engine (analytics aggregations alone require extensive coverage)

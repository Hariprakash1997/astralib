# @astralibx/call-log-types

[![npm version](https://img.shields.io/npm/v/@astralibx/call-log-types.svg)](https://www.npmjs.com/package/@astralibx/call-log-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Shared TypeScript type definitions, enums, and contracts for the call-log module.

## Install

```bash
npm install @astralibx/call-log-types
```

No runtime dependencies -- pure TypeScript declarations and enums.

## Enums

| Enum | Values | Description |
|------|--------|-------------|
| `CallDirection` | `Inbound`, `Outbound` | Direction of the call |
| `CallPriority` | `Low`, `Medium`, `High`, `Urgent` | Priority level for a call log |
| `TimelineEntryType` | `Note`, `StageChange`, `Assignment`, `FollowUpSet`, `FollowUpCompleted`, `System` | Type of timeline entry |

### Enum values

```ts
import { CallDirection, CallPriority, TimelineEntryType } from '@astralibx/call-log-types';

CallDirection.Inbound    // 'inbound'
CallDirection.Outbound   // 'outbound'

CallPriority.Low         // 'low'
CallPriority.Medium      // 'medium'
CallPriority.High        // 'high'
CallPriority.Urgent      // 'urgent'

TimelineEntryType.Note              // 'note'
TimelineEntryType.StageChange       // 'stage_change'
TimelineEntryType.Assignment        // 'assignment'
TimelineEntryType.FollowUpSet       // 'follow_up_set'
TimelineEntryType.FollowUpCompleted // 'follow_up_completed'
TimelineEntryType.System            // 'system'
```

## Interfaces

| Interface | Source | Description |
|-----------|--------|-------------|
| `IPipeline` | `pipeline.types` | Pipeline with stages, active/default flags, tenant scoping |
| `IPipelineStage` | `pipeline.types` | Single stage: name, color, order, isTerminal, isDefault |
| `ICallLog` | `call-log.types` | Call log with contact ref, pipeline/stage, timeline, stage history, follow-up, channel, outcome, isFollowUp, soft delete |
| `IContactRef` | `call-log.types` | Embedded contact reference: externalId, displayName, phone, email |
| `IStageChange` | `call-log.types` | Stage transition record with from/to IDs, names, timestamps, time-in-stage |
| `ITimelineEntry` | `call-log.types` | Single timeline entry: type, content, author, stage/agent change details |
| `ICallLogSettings` | `settings.types` | Global settings: tags, categories, priority levels, follow-up defaults, availableChannels, availableOutcomes |
| `IPriorityConfig` | `settings.types` | Priority level config: value, label, color, order |
| `AgentInfo` | `adapter.types` | Agent reference: agentId, displayName, avatar, teamId |
| `ContactInfo` | `adapter.types` | Contact lookup result: externalId, displayName, phone, email |
| `AuthResult` | `adapter.types` | Authentication result: adminUserId, displayName, role (optional, for agent-scoping bypass) |
| `CallLogEngineConfig` | `config.types` | Full engine configuration: db, logger, agents, adapters, hooks, options (includes enableAgentScoping) |
| `ResolvedOptions` | `config.types` | Resolved options with defaults applied |
| `CallLogMetric` | `analytics.types` | Metric event: name, labels, value |
| `DateRange` | `analytics.types` | Date range filter: from, to |
| `AgentCallStats` | `analytics.types` | Agent performance stats |
| `PipelineStageStats` | `analytics.types` | Per-stage stats with avg time and conversion rate |
| `PipelineReport` | `analytics.types` | Pipeline report with stage breakdown and bottleneck |
| `PipelineFunnel` | `analytics.types` | Pipeline funnel with entered/exited/dropOff per stage |
| `DailyReport` | `analytics.types` | Daily report by direction, pipeline, agent |
| `OverallCallReport` | `analytics.types` | Overall stats: totals, avg close time, compliance, distributions |
| `WeeklyTrend` | `analytics.types` | Weekly trend with direction and pipeline breakdown |
| `DashboardStats` | `analytics.types` | Quick dashboard counters: open, closed today, overdue, agents |
| `ExportFilter` | `analytics.types` | Export filter options |
| `ExportFormat` | `analytics.types` | Export format type: `'json' \| 'csv'` |
| `ChannelDistribution` | `analytics.types` | Channel breakdown entry: `{ channel: string, count: number }` |
| `OutcomeDistribution` | `analytics.types` | Outcome breakdown entry: `{ outcome: string, count: number }` |
| `FollowUpStats` | `analytics.types` | Follow-up ratio stats: `{ followUpCalls: number, totalCalls: number, followUpRatio: number }` |

## Phase 2 Fields

### ICallLog

| Field | Type | Description |
|-------|------|-------------|
| `channel` | `string` | Communication channel for the call (phone, whatsapp, telegram, etc.) |
| `outcome` | `string` | Result of the call (interested, not_interested, no_answer, etc.) |
| `isFollowUp` | `boolean` | Marks the call as a follow-up rather than a fresh outreach |
| `isDeleted` | `boolean` | Soft delete flag — excluded from all queries and analytics by default |
| `deletedAt` | `Date?` | Timestamp set when the call is soft-deleted |

### ICallLogSettings

| Field | Type | Description |
|-------|------|-------------|
| `availableChannels` | `string[]` | Admin-configurable list of channel options shown in the UI |
| `availableOutcomes` | `string[]` | Admin-configurable list of outcome options shown in the UI |

### CallLogEngineConfig options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableAgentScoping` | `boolean` | `true` | When true, non-owner staff see only their own calls; owners see everything |

### AuthResult

| Field | Type | Description |
|-------|------|-------------|
| `role` | `string?` | Agent role returned by `authenticateAgent`. Owners are excluded from agent-scoped filtering when role indicates ownership. |

## Usage

```ts
import type { ICallLog, IPipeline, ITimelineEntry, CallLogEngineConfig } from '@astralibx/call-log-types';
import { CallDirection, CallPriority, TimelineEntryType } from '@astralibx/call-log-types';

// Type a call log
const call: ICallLog = {
  callLogId: '...',
  pipelineId: '...',
  currentStageId: '...',
  contactRef: { externalId: 'c1', displayName: 'John Doe' },
  direction: CallDirection.Inbound,
  callDate: new Date(),
  priority: CallPriority.High,
  agentId: '...',
  tags: ['vip'],
  timeline: [],
  stageHistory: [],
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-types)
- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-types/CHANGELOG.md)

## License

MIT

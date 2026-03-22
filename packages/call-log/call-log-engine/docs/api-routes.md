# REST API Routes

All routes are mounted on the router returned by `engine.routes`. All responses use the envelope format:

```json
{ "success": true, "data": ... }
```

```json
{ "success": false, "error": "message" }
```

All routes are protected by the `authenticateAgent` adapter when provided. The adapter extracts the bearer token from the `Authorization` header.

## Pipelines

Mounted at `/pipelines`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/pipelines` | Yes | List pipelines (query: `isActive`) |
| `POST` | `/pipelines` | Yes | Create pipeline (body: `{ name, description?, stages, isDefault?, metadata? }`) |
| `GET` | `/pipelines/:id` | Yes | Get single pipeline |
| `PUT` | `/pipelines/:id` | Yes | Update pipeline |
| `DELETE` | `/pipelines/:id` | Yes | Delete pipeline (fails if stages have active calls) |
| `POST` | `/pipelines/:id/stages` | Yes | Add stage (body: `{ name, color, order, isTerminal?, isDefault? }`) |
| `PUT` | `/pipelines/:id/stages/reorder` | Yes | Reorder stages (body: `{ stageIds: string[] }`) |
| `PUT` | `/pipelines/:id/stages/:stageId` | Yes | Update stage |
| `DELETE` | `/pipelines/:id/stages/:stageId` | Yes | Remove stage (fails if stage has active calls) |

> **Route ordering note:** The `PUT /pipelines/:id/stages/reorder` route is registered before `PUT /pipelines/:id/stages/:stageId` to prevent `reorder` from being captured as a `:stageId` parameter.

## Call Logs

Mounted at `/calls`.

> **Route ordering note:** Static routes (`/follow-ups` and `/-/bulk/stage`) are registered before the `/:id` parameterized routes.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/calls/follow-ups` | Yes | List due follow-ups (query: `agentId`, `from`, `to`) |
| `PUT` | `/calls/-/bulk/stage` | Yes | Bulk stage change (body: `{ callLogIds: string[], newStageId, agentId }`) |
| `GET` | `/calls` | Yes | List call logs (query: `pipelineId`, `currentStageId`, `agentId`, `category`, `isClosed`, `contactExternalId`, `contactName`, `contactPhone`, `contactEmail`, `priority`, `direction`, `from`, `to`, `page`, `limit`) |
| `POST` | `/calls` | Yes | Create call log |
| `GET` | `/calls/:id` | Yes | Get single call log |
| `PUT` | `/calls/:id` | Yes | Update call log |
| `PUT` | `/calls/:id/stage` | Yes | Change stage (body: `{ newStageId, agentId }`) |
| `PUT` | `/calls/:id/assign` | Yes | Reassign (body: `{ agentId, assignedBy }`) |
| `PUT` | `/calls/:id/close` | Yes | Manual close (body: `{ agentId }`) |
| `PUT` | `/calls/:id/reopen` | Yes | Reopen closed call (body: `{ agentId }`) |
| `POST` | `/calls/:id/notes` | Yes | Add timeline note (body: `{ content, authorId, authorName }`) |
| `GET` | `/calls/:id/timeline` | Yes | Paginated timeline (query: `page`, `limit`) |

### Create Call Log Body

```json
{
  "pipelineId": "...",
  "contactRef": {
    "externalId": "...",
    "displayName": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com"
  },
  "direction": "inbound",
  "callDate": "2025-01-15T10:00:00Z",
  "priority": "high",
  "agentId": "...",
  "tags": ["vip"],
  "category": "sales",
  "durationMinutes": 15,
  "nextFollowUpDate": "2025-01-18T10:00:00Z",
  "metadata": {}
}
```

## Contacts

Mounted at `/contacts`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/contacts/:externalId/calls` | Yes | All call logs for a contact |
| `GET` | `/contacts/:externalId/timeline` | Yes | Merged cross-call timeline (query: `page`, `limit`) |

## Analytics

Mounted at `/analytics`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/stats` | Yes | Quick dashboard stats (open calls, closed today, overdue follow-ups, total agents, calls today) |
| `GET` | `/analytics/agent/:agentId` | Yes | Agent stats (query: `from`, `to`) |
| `GET` | `/analytics/agent-leaderboard` | Yes | Agent ranking (query: `from`, `to`) |
| `GET` | `/analytics/pipeline/:id` | Yes | Pipeline stats with stage breakdown (query: `from`, `to`) |
| `GET` | `/analytics/pipeline/:id/funnel` | Yes | Pipeline funnel with drop-off rates (query: `from`, `to`) |
| `GET` | `/analytics/team` | Yes | Team stats (query: `teamId`, `from`, `to`) |
| `GET` | `/analytics/daily` | Yes | Daily report by direction, pipeline, agent (query: `from`, `to`) |
| `GET` | `/analytics/weekly-trends` | Yes | Weekly trends (query: `weeks`, default 4) |
| `GET` | `/analytics/overall` | Yes | Overall report: totals, avg close time, compliance, distributions (query: `from`, `to`) |

## Settings and Export

Mounted at root level (no prefix).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings` | Yes | Get global settings |
| `PUT` | `/settings` | Yes | Update settings (body: partial `ICallLogSettings`) |
| `GET` | `/export/calls` | Yes | Bulk export (query: `format=json\|csv`, `pipelineId`, `agentId`, `isClosed`, `from`, `to`) |
| `GET` | `/export/calls/:id` | Yes | Single call export (query: `format=json\|csv`) |
| `GET` | `/export/pipeline/:id` | Yes | Pipeline report export (query: `format=json\|csv`, `from`, `to`) |

### Settings Body

```json
{
  "availableTags": ["vip", "callback", "complaint"],
  "availableCategories": ["sales", "support", "billing"],
  "priorityLevels": [
    { "value": "low", "label": "Low", "color": "#94a3b8", "order": 1 },
    { "value": "medium", "label": "Medium", "color": "#f59e0b", "order": 2 },
    { "value": "high", "label": "High", "color": "#ef4444", "order": 3 },
    { "value": "urgent", "label": "Urgent", "color": "#dc2626", "order": 4 }
  ],
  "defaultFollowUpDays": 3,
  "followUpReminderEnabled": true,
  "defaultPipelineId": "...",
  "timelinePageSize": 20,
  "maxConcurrentCalls": 10
}
```

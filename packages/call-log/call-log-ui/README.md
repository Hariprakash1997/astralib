# @astralibx/call-log-ui

[![npm version](https://img.shields.io/npm/v/@astralibx/call-log-ui.svg)](https://www.npmjs.com/package/@astralibx/call-log-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Lit Web Components for the @astralibx call-log admin dashboard -- 14 components for pipeline management, call log views, timelines, analytics, agent dashboard, and settings.

## Install

```bash
npm install @astralibx/call-log-ui
```

`lit` and `@astralibx/call-log-types` are bundled dependencies -- no separate peer install needed.

## Components

| Component | Tag | Key Properties | Description |
|-----------|-----|----------------|-------------|
| `AlxCallLogDashboard` | `alx-call-log-dashboard` | `defaultTab`, `theme`, `agentId` | Top-level dashboard with My Calls, Pipelines, Calls, Analytics, Settings tabs |
| `AlxAgentDashboard` | `alx-agent-dashboard` | `agentId` | Agent-specific view: active calls, upcoming follow-ups, personal stats |
| `AlxPipelineList` | `alx-pipeline-list` | -- | Pipeline list with create/edit/delete actions |
| `AlxPipelineBoard` | `alx-pipeline-board` | `pipelineId` | Kanban board with drag-drop stage transitions |
| `AlxPipelineStageEditor` | `alx-pipeline-stage-editor` | `pipelineId` | Stage form: name, color, order, terminal/default toggles |
| `AlxCallLogList` | `alx-call-log-list` | -- | Filterable table: pipeline, stage, agent, priority, direction, date range |
| `AlxCallLogDetail` | `alx-call-log-detail` | `callLogId` | Detail view with contact info, current stage, embedded timeline |
| `AlxCallLogForm` | `alx-call-log-form` | `open`, `callLogId` | Create/edit drawer: contact, direction, pipeline, priority, tags, follow-up |
| `AlxCallTimeline` | `alx-call-timeline` | `callLogId` | Single call timeline with entry type icons and note input |
| `AlxContactTimeline` | `alx-contact-timeline` | `externalId` | Merged cross-call timeline for a contact |
| `AlxCallAnalyticsDashboard` | `alx-call-analytics-dashboard` | -- | Overview stats, daily volume, tag distribution, peak hours |
| `AlxPipelineFunnel` | `alx-pipeline-funnel` | -- | Pipeline funnel visualization with stage drop-off rates |
| `AlxAgentLeaderboard` | `alx-agent-leaderboard` | -- | Ranked agent performance table |
| `AlxCallLogSettings` | `alx-call-log-settings` | -- | Admin panel for tags, categories, priority levels, follow-up defaults |

## Quick Start

```ts
import { CallLogUIConfig } from '@astralibx/call-log-ui';

CallLogUIConfig.setup({
  callLogApi: '/api/call-log',
  authToken: 'Bearer ...',
  theme: 'dark',
});

import '@astralibx/call-log-ui';
```

```html
<alx-call-log-dashboard defaultTab="pipelines" theme="dark"></alx-call-log-dashboard>
```

### Agent-specific dashboard

```html
<alx-call-log-dashboard defaultTab="mycalls" agentId="agent-123" theme="dark"></alx-call-log-dashboard>
```

### Individual components

```html
<!-- Pipeline Kanban board -->
<alx-pipeline-board pipelineId="pipeline-abc"></alx-pipeline-board>

<!-- Call log detail panel -->
<alx-call-log-detail callLogId="call-xyz"></alx-call-log-detail>

<!-- Contact timeline -->
<alx-contact-timeline externalId="contact-456"></alx-contact-timeline>
```

## API Client

The `CallLogApiClient` is available as a standalone export for programmatic use:

```ts
import { CallLogApiClient } from '@astralibx/call-log-ui';

const api = new CallLogApiClient();

// Pipelines
const pipelines = await api.listPipelines();
const pipeline = await api.createPipeline({ name: 'Sales', stages: [] });

// Call logs
const logs = await api.listCallLogs({ pipelineId: '...', isClosed: false });
const log = await api.createCallLog({ ... });
await api.changeStage(logId, stageId, agentId);

// Analytics
const stats = await api.getDashboardStats();
const overall = await api.getOverallReport({ from: '2025-01-01' });
const funnel = await api.getPipelineFunnel(pipelineId);
const board = await api.getAgentLeaderboard();
```

## Theming

The dashboard supports `light` and `dark` themes. Set the theme via the `theme` attribute or toggle at runtime:

```html
<alx-call-log-dashboard theme="light"></alx-call-log-dashboard>
```

Or programmatically via `CallLogUIConfig.setup({ theme: 'dark' })`.

CSS custom properties used for theming:

| Property | Light | Dark |
|----------|-------|------|
| `--alx-bg` | `#f8fafc` | `#0f1117` |
| `--alx-surface` | `#ffffff` | `#181a20` |
| `--alx-surface-alt` | `#f1f5f9` | `#1e2028` |
| `--alx-border` | `#e2e8f0` | `#2a2d37` |
| `--alx-text` | `#0f172a` | `#e1e4ea` |
| `--alx-text-muted` | `#64748b` | `#8b8fa3` |

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-ui)
- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-ui/CHANGELOG.md)

## License

MIT

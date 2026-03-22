# Call Log Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual call logging system with admin-configurable pipelines, timeline-based notes, contact adapter integration, shared agent collection with chat-engine, and full analytics.

**Architecture:** Independent module at `packages/call-log/` with three packages: `call-log-types` (pure TS enums/interfaces), `call-log-engine` (Express + Mongoose services, workers, routes), and `call-log-ui` (Lit web components). Shares agent collection with chat-engine at the MongoDB level via configurable collection name. Contacts managed via consumer-provided adapters.

**Tech Stack:** TypeScript, Mongoose 8, Express 5, Zod validation, Vitest, tsup (engine/types), Vite (UI), Lit 3 (UI components)

**Spec:** `docs/superpowers/specs/2026-03-21-call-log-manager-design.md`

---

## File Structure

### `packages/call-log/call-log-types/`
| File | Responsibility |
|------|---------------|
| `package.json` | Package config, no runtime deps |
| `tsconfig.json` | Extends `../../../tsconfig.base.json` |
| `tsup.config.ts` | Dual CJS/ESM build |
| `src/index.ts` | Barrel re-exports |
| `src/enums.ts` | `CallDirection`, `CallPriority`, `TimelineEntryType` enums |
| `src/pipeline.types.ts` | `IPipelineStage`, `IPipeline` interfaces |
| `src/call-log.types.ts` | `IContactRef`, `IStageChange`, `ITimelineEntry`, `ICallLog` |
| `src/settings.types.ts` | `IPriorityConfig`, `ICallLogSettings` |
| `vitest.config.ts` | Test config scoped to `src/__tests__/` |
| `src/analytics.types.ts` | Report interfaces, `CallLogMetric`, `ExportFormat` |
| `src/adapter.types.ts` | `AgentInfo`, `ContactInfo`, `AuthResult` |
| `src/config.types.ts` | `CallLogEngineConfig`, `CallLogEngine`, `ResolvedOptions`, `DEFAULT_OPTIONS` |
| `src/__tests__/enums.spec.ts` | Enum value tests |
| `README.md` | Package docs |

### `packages/call-log/call-log-engine/`
| File | Responsibility |
|------|---------------|
| `package.json` | Package config, peer deps: express, mongoose |
| `tsconfig.json` | Extends `../../../tsconfig.base.json` |
| `tsup.config.ts` | Dual CJS/ESM build |
| `vitest.config.ts` | Test config, 80/75/80/80 thresholds |
| `src/index.ts` | `createCallLogEngine()` factory + barrel exports |
| `src/constants/index.ts` | `ERROR_CODE`, `ERROR_MESSAGE`, `PIPELINE_DEFAULTS`, `CALL_LOG_DEFAULTS`, `AGENT_CALL_DEFAULTS`, `SYSTEM_TIMELINE`, `SYSTEM_TIMELINE_FN` |
| `src/errors/index.ts` | `AlxCallLogError` base + 10 domain error classes |
| `src/schemas/pipeline.schema.ts` | `IPipeline` Mongoose schema + model |
| `src/schemas/call-log.schema.ts` | `ICallLog` Mongoose schema + model with embedded timeline/stageHistory |
| `src/schemas/call-log-settings.schema.ts` | `ICallLogSettings` singleton schema + model |
| `src/validation/pipeline.validator.ts` | Pipeline stage validation rules |
| `src/services/pipeline.service.ts` | Pipeline CRUD + stage management |
| `src/services/call-log.service.ts` | Call log CRUD, stage changes (atomic), assign, list/filter, follow-ups |
| `src/services/timeline.service.ts` | Note/system entries, paginated timeline, contact timeline |
| `src/services/settings.service.ts` | Settings singleton get/update with auto-create |
| `src/services/analytics.service.ts` | Agent stats, pipeline stats, funnel, team, daily, weekly, overall reports |
| `src/services/export.service.ts` | JSON/CSV export for single call, bulk calls, pipeline reports |
| `src/workers/follow-up.worker.ts` | Periodic follow-up check, fires `onFollowUpDue` hook |
| `src/routes/index.ts` | `createRoutes()` — mounts sub-routers with auth middleware |
| `src/routes/pipeline.routes.ts` | Pipeline CRUD + stage management routes |
| `src/routes/call-log.routes.ts` | Call log CRUD, stage change, assign, close, notes, timeline routes |
| `src/routes/contact.routes.ts` | Contact calls and timeline routes |
| `src/routes/analytics.routes.ts` | All analytics/reporting routes |
| `src/routes/settings.routes.ts` | Settings and export routes |
| `src/__tests__/constants.spec.ts` | Constants validation |
| `src/__tests__/errors.spec.ts` | Error class tests |
| `src/__tests__/schemas/pipeline.schema.spec.ts` | Pipeline schema validation |
| `src/__tests__/schemas/call-log.schema.spec.ts` | Call log schema validation |
| `src/__tests__/schemas/call-log-settings.schema.spec.ts` | Settings schema validation |
| `src/__tests__/validation/pipeline.validator.spec.ts` | Pipeline validation logic |
| `src/__tests__/services/pipeline.service.spec.ts` | Pipeline service tests |
| `src/__tests__/services/call-log.service.spec.ts` | Call log service tests |
| `src/__tests__/services/timeline.service.spec.ts` | Timeline service tests |
| `src/__tests__/services/settings.service.spec.ts` | Settings service tests |
| `src/__tests__/services/analytics.service.spec.ts` | Analytics aggregation tests |
| `src/__tests__/services/export.service.spec.ts` | Export format tests |
| `src/__tests__/workers/follow-up.worker.spec.ts` | Worker tests |
| `src/__tests__/routes/index.spec.ts` | Route handler tests |
| `src/__tests__/index.spec.ts` | Factory integration tests |
| `README.md` | Package docs with CHANGELOG link |

---

## Task 1: Project Scaffolding — call-log-types

**Files:**
- Create: `packages/call-log/call-log-types/package.json`
- Create: `packages/call-log/call-log-types/tsconfig.json`
- Create: `packages/call-log/call-log-types/tsup.config.ts`
- Create: `packages/call-log/call-log-types/vitest.config.ts`
- Create: `packages/call-log/call-log-types/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@astralibx/call-log-types",
  "version": "0.1.0",
  "description": "Shared TypeScript type definitions, enums, and contracts for the call-log module",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/call-log/call-log-types"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "keywords": ["call-log", "types", "pipeline", "analytics"],
  "license": "MIT",
  "devDependencies": {
    "@vitest/coverage-v8": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "incremental": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  skipNodeModulesBundle: true,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.mjs' };
  },
});
```

- [ ] **Step 4: Create README.md**

```markdown
# @astralibx/call-log-types

Shared TypeScript type definitions, enums, and contracts for the call-log module.

## Installation

\`\`\`bash
npm install @astralibx/call-log-types
\`\`\`

## Links

- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-types/CHANGELOG.md)
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/__tests__/**/*.spec.ts'],
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add packages/call-log/call-log-types/
git commit -m "chore: scaffold call-log-types package"
```

---

## Task 2: Enums & Types — call-log-types

**Files:**
- Create: `src/enums.ts`
- Create: `src/pipeline.types.ts`
- Create: `src/call-log.types.ts`
- Create: `src/analytics.types.ts`
- Create: `src/adapter.types.ts`
- Create: `src/config.types.ts`
- Create: `src/index.ts`
- Create: `src/__tests__/enums.spec.ts`

All paths relative to `packages/call-log/call-log-types/`.

- [ ] **Step 1: Write enum tests**

```ts
// src/__tests__/enums.spec.ts
import { describe, it, expect } from 'vitest';
import { CallDirection, CallPriority, TimelineEntryType } from '../enums';

describe('CallDirection', () => {
  it('should have inbound and outbound values', () => {
    expect(CallDirection.Inbound).toBe('inbound');
    expect(CallDirection.Outbound).toBe('outbound');
  });

  it('should have exactly 2 members', () => {
    const values = Object.values(CallDirection);
    expect(values).toHaveLength(2);
  });
});

describe('CallPriority', () => {
  it('should have all priority levels', () => {
    expect(CallPriority.Low).toBe('low');
    expect(CallPriority.Medium).toBe('medium');
    expect(CallPriority.High).toBe('high');
    expect(CallPriority.Urgent).toBe('urgent');
  });

  it('should have exactly 4 members', () => {
    const values = Object.values(CallPriority);
    expect(values).toHaveLength(4);
  });
});

describe('TimelineEntryType', () => {
  it('should have all entry types', () => {
    expect(TimelineEntryType.Note).toBe('note');
    expect(TimelineEntryType.StageChange).toBe('stage_change');
    expect(TimelineEntryType.Assignment).toBe('assignment');
    expect(TimelineEntryType.FollowUpSet).toBe('follow_up_set');
    expect(TimelineEntryType.FollowUpCompleted).toBe('follow_up_completed');
    expect(TimelineEntryType.System).toBe('system');
  });

  it('should have exactly 6 members', () => {
    const values = Object.values(TimelineEntryType);
    expect(values).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/call-log/call-log-types && npx vitest run`
Expected: FAIL — module not found

- [ ] **Step 3: Implement enums.ts**

```ts
// src/enums.ts
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

- [ ] **Step 4: Implement adapter.types.ts**

```ts
// src/adapter.types.ts
export interface AgentInfo {
  agentId: string;
  displayName: string;
  avatar?: string;
  teamId?: string;
}

export interface ContactInfo {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}

export interface AuthResult {
  adminUserId: string;
  displayName: string;
}
```

- [ ] **Step 5: Implement pipeline.types.ts**

```ts
// src/pipeline.types.ts
export interface IPipelineStage {
  stageId: string;
  name: string;
  color: string;
  order: number;
  isTerminal: boolean;
  isDefault: boolean;
}

export interface IPipeline {
  pipelineId: string;
  name: string;
  description?: string;
  stages: IPipelineStage[];
  isActive: boolean;
  isDeleted: boolean;
  isDefault: boolean;
  createdBy: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 6: Implement call-log.types.ts**

```ts
// src/call-log.types.ts
import { CallDirection, CallPriority, TimelineEntryType } from './enums';

export interface IContactRef {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}

export interface IStageChange {
  fromStageId: string;
  toStageId: string;
  fromStageName: string;
  toStageName: string;
  changedBy: string;
  changedAt: Date;
  timeInStageMs: number;
}

export interface ITimelineEntry {
  entryId: string;
  type: TimelineEntryType;
  content?: string;
  authorId?: string;
  authorName?: string;
  fromStageId?: string;
  fromStageName?: string;
  toStageId?: string;
  toStageName?: string;
  fromAgentId?: string;
  fromAgentName?: string;
  toAgentId?: string;
  toAgentName?: string;
  createdAt: Date;
}

export interface ICallLog {
  callLogId: string;
  pipelineId: string;
  currentStageId: string;
  contactRef: IContactRef;
  direction: CallDirection;
  callDate: Date;
  nextFollowUpDate?: Date;
  followUpNotifiedAt?: Date;
  priority: CallPriority;
  agentId: string; // string here because types package has no Mongoose dep; schema uses Schema.Types.ObjectId. Cast in lean queries.
  assignedBy?: string;
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

- [ ] **Step 7: Implement settings.types.ts**

```ts
// src/settings.types.ts
export interface IPriorityConfig {
  value: string;
  label: string;
  color: string;
  order: number;
}

export interface ICallLogSettings {
  key: 'global';
  availableTags: string[];
  availableCategories: string[];
  priorityLevels: IPriorityConfig[];
  defaultFollowUpDays: number;
  followUpReminderEnabled: boolean;
  defaultPipelineId?: string;
  timelinePageSize: number;
  maxConcurrentCalls: number;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}
```

- [ ] **Step 8: Implement analytics.types.ts**

```ts
// src/analytics.types.ts
export type ExportFormat = 'json' | 'csv';

export interface CallLogMetric {
  name: string;
  labels: Record<string, string>;
  value?: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface AgentCallStats {
  agentId: string;
  agentName: string;
  totalCalls: number;
  avgCallsPerDay: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  callsByPipeline: { pipelineId: string; pipelineName: string; count: number }[];
  callsClosed: number;
  closeRate: number;
}

export interface PipelineStageStats {
  stageId: string;
  stageName: string;
  count: number;
  avgTimeMs: number;
  conversionRate: number;
}

export interface PipelineReport {
  pipelineId: string;
  pipelineName: string;
  totalCalls: number;
  stages: PipelineStageStats[];
  bottleneckStage: string | null;
}

export interface PipelineFunnel {
  pipelineId: string;
  pipelineName: string;
  stages: { stageId: string; stageName: string; entered: number; exited: number; dropOff: number }[];
}

export interface DailyReport {
  date: string;
  total: number;
  byDirection: { direction: string; count: number }[];
  byPipeline: { pipelineId: string; pipelineName: string; count: number }[];
  byAgent: { agentId: string; agentName: string; count: number }[];
}

export interface OverallCallReport {
  totalCalls: number;
  closedCalls: number;
  avgTimeToCloseMs: number;
  followUpComplianceRate: number;
  tagDistribution: { tag: string; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  peakCallHours: { hour: number; count: number }[];
}

export interface ExportFilter {
  pipelineId?: string;
  stageId?: string;
  agentId?: string;
  tags?: string[];
  category?: string;
  isClosed?: boolean;
  dateFrom?: string;
  dateTo?: string;
}
```

- [ ] **Step 9: Implement config.types.ts**

```ts
// src/config.types.ts
import type { ICallLog } from './call-log.types';
import type { AgentInfo, ContactInfo, AuthResult } from './adapter.types';
import type { CallLogMetric } from './analytics.types';

export interface CallLogEngineConfig {
  db: {
    connection: unknown; // mongoose.Connection — avoid hard dep in types package
    collectionPrefix?: string;
  };

  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };

  agents: {
    collectionName?: string;
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
    maxTimelineEntries?: number;
    followUpCheckIntervalMs?: number;
  };
}

export const DEFAULT_OPTIONS = {
  maxTimelineEntries: 200,
  followUpCheckIntervalMs: 60_000,
} as const;

export interface ResolvedOptions {
  maxTimelineEntries: number;
  followUpCheckIntervalMs: number;
}
```

- [ ] **Step 10: Implement index.ts barrel**

```ts
// src/index.ts
export * from './enums';
export * from './pipeline.types';
export * from './call-log.types';
export * from './settings.types';
export * from './analytics.types';
export * from './adapter.types';
export * from './config.types';
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `cd packages/call-log/call-log-types && npx vitest run`
Expected: PASS — all enum tests green

- [ ] **Step 12: Build and verify**

Run: `cd packages/call-log/call-log-types && npx tsup`
Expected: Build succeeds, `dist/` contains `.cjs`, `.mjs`, `.d.ts` files

- [ ] **Step 13: Commit**

```bash
git add packages/call-log/call-log-types/src/
git commit -m "feat(call-log-types): add enums, interfaces, and adapter types"
```

---

## Task 3: Project Scaffolding — call-log-engine

**Files:**
- Create: `packages/call-log/call-log-engine/package.json`
- Create: `packages/call-log/call-log-engine/tsconfig.json`
- Create: `packages/call-log/call-log-engine/tsup.config.ts`
- Create: `packages/call-log/call-log-engine/vitest.config.ts`
- Create: `packages/call-log/call-log-engine/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@astralibx/call-log-engine",
  "version": "0.1.0",
  "description": "Call log engine with pipelines, timeline-based notes, contact adapters, analytics, and shared agent support",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/call-log/call-log-engine"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "keywords": ["call-log", "pipeline", "analytics", "timeline", "support"],
  "license": "MIT",
  "dependencies": {
    "@astralibx/call-log-types": "^0.1.0",
    "@astralibx/core": "^1.2.1",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "express": "^4.18.0 || ^5.0.0",
    "mongoose": "^7.0.0 || ^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "express": "^5.0.0",
    "mongoose": "^8.12.1",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, tsup.config.ts, vitest.config.ts**

`tsconfig.json` — identical to chat-engine pattern.
`tsup.config.ts` — identical to chat-engine pattern.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: ['**/*.ts'],
      exclude: ['**/types/**', '**/__tests__/**', '**/index.ts'],
    },
  },
});
```

- [ ] **Step 3: Create README.md**

```markdown
# @astralibx/call-log-engine

Call log engine with admin-configurable pipelines, timeline notes, contact adapters, analytics, and shared agent support.

## Installation

\`\`\`bash
npm install @astralibx/call-log-engine
npm install express mongoose  # peer deps
\`\`\`

## Links

- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/CHANGELOG.md)
```

- [ ] **Step 4: Commit**

```bash
git add packages/call-log/call-log-engine/
git commit -m "chore: scaffold call-log-engine package"
```

---

## Task 4: Constants & Errors

**Files:**
- Create: `packages/call-log/call-log-engine/src/constants/index.ts`
- Create: `packages/call-log/call-log-engine/src/errors/index.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/constants.spec.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/errors.spec.ts`

- [ ] **Step 1: Write constants tests**

Test that all error codes have `CALL_` prefix, all defaults have correct values, all system timeline messages are strings, and all system timeline functions return strings.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement constants/index.ts**

All `as const` objects from the spec section 4: `ERROR_CODE`, `ERROR_MESSAGE`, `PIPELINE_DEFAULTS`, `CALL_LOG_DEFAULTS`, `AGENT_CALL_DEFAULTS`, `SYSTEM_TIMELINE`, `SYSTEM_TIMELINE_FN`. Derive types with `typeof X[keyof typeof X]` pattern.

- [ ] **Step 4: Write error class tests**

Test each error class: correct `code`, `message` contains context values, `instanceof AlxCallLogError`, `instanceof AlxError`.

- [ ] **Step 5: Implement errors/index.ts**

Base class `AlxCallLogError extends AlxError`. Ten domain errors: `PipelineNotFoundError`, `InvalidPipelineError`, `StageNotFoundError`, `StageInUseError`, `CallLogNotFoundError`, `CallLogClosedError`, `ContactNotFoundError`, `AgentCapacityError`, `InvalidConfigError`, `AuthFailedError` (maps to `CALL_AUTH_FAILED` code, used by route auth middleware).

- [ ] **Step 6: Run all tests to verify they pass**

Run: `cd packages/call-log/call-log-engine && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(call-log-engine): add constants and error hierarchy"
```

---

## Task 5: Mongoose Schemas

**Files:**
- Create: `packages/call-log/call-log-engine/src/schemas/pipeline.schema.ts`
- Create: `packages/call-log/call-log-engine/src/schemas/call-log.schema.ts`
- Create: `packages/call-log/call-log-engine/src/schemas/call-log-settings.schema.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/schemas/pipeline.schema.spec.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/schemas/call-log.schema.spec.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/schemas/call-log-settings.schema.spec.ts`

- [ ] **Step 1: Write pipeline schema tests**

Test: required fields validation (`pipelineId`, `name`, `stages`), `isActive` default `true`, `isDeleted` default `false`, index definitions, UUID generation for `pipelineId`, timestamps.

- [ ] **Step 2: Implement pipeline.schema.ts**

Mongoose schema with `IPipelineStage` subdocument schema and `IPipeline` document. Indexes: `pipelineId` unique, `isActive`, `tenantId` sparse. Register model with configurable name (for `collectionPrefix` support). Export a `createPipelineModel(connection, prefix?)` function.

- [ ] **Step 3: Write call-log schema tests**

Test: required fields, `IContactRef` subdocument validation, `ITimelineEntry` embedded array, `IStageChange` embedded array, `isClosed` default `false`, all indexes, `direction` enum validation, `priority` enum validation, compound indexes.

- [ ] **Step 4: Implement call-log.schema.ts**

Mongoose schema for `ICallLog`. `agentId` as `Schema.Types.ObjectId`. Embedded subdocument schemas for `IContactRef`, `ITimelineEntry`, `IStageChange`. All indexes from spec section 6.2. Export `createCallLogModel(connection, prefix?)`.

- [ ] **Step 5: Write settings schema tests**

Test: `key` defaults to `'global'`, compound unique index on `(key, tenantId)`, `defaultFollowUpDays` default 3, `timelinePageSize` default 20, `maxConcurrentCalls` default 10, `followUpReminderEnabled` default `true`.

- [ ] **Step 6: Implement call-log-settings.schema.ts**

Singleton pattern with `key: 'global'`. Compound unique index on `(key, tenantId)`. Default `priorityLevels` array with the 4 `CallPriority` values. Export `createCallLogSettingsModel(connection, prefix?)`.

- [ ] **Step 7: Run all tests**

Run: `cd packages/call-log/call-log-engine && npx vitest run`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(call-log-engine): add pipeline, call-log, and settings schemas"
```

---

## Task 6: Pipeline Validation

**Files:**
- Create: `packages/call-log/call-log-engine/src/validation/pipeline.validator.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/validation/pipeline.validator.spec.ts`

- [ ] **Step 1: Write validation tests**

Test cases:
- Valid pipeline passes
- No default stage → throws `InvalidPipelineError`
- Multiple default stages → throws `InvalidPipelineError`
- No terminal stage → throws `InvalidPipelineError`
- Duplicate stage names → throws `InvalidPipelineError`
- Exceeds `PIPELINE_DEFAULTS.MaxStages` → throws `InvalidPipelineError`
- Empty stages array → throws `InvalidPipelineError`

- [ ] **Step 2: Implement pipeline.validator.ts**

Pure function `validatePipelineStages(stages: IPipelineStage[], pipelineId?: string): void`. Throws `InvalidPipelineError` with specific `reason` for each validation failure.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add pipeline validation rules"
```

---

## Task 7: Settings Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/settings.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/settings.service.spec.ts`

- [ ] **Step 1: Write settings service tests**

Test: `get()` returns existing settings, `get()` auto-creates defaults when none exist, `update()` applies partial updates with dotted-path `$set`, `update()` validates integer ranges, compound unique key per tenant.

- [ ] **Step 2: Implement settings.service.ts**

Follow chat-engine's `SettingsService` pattern: constructor takes `(model, logger, tenantId?)`, `settingsFilter` getter, `get()` with auto-create, `update()` with `findOneAndUpdate` and dotted-path `$set`.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add settings service with auto-create"
```

---

## Task 8: Pipeline Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/pipeline.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/pipeline.service.spec.ts`

- [ ] **Step 1: Write pipeline service tests**

Test: `create()` validates stages and persists, `create()` rejects invalid stages, `update()` modifies name/description/isActive, `delete()` sets `isDeleted: true`, `delete()` fails when non-closed calls exist, `list()` excludes deleted pipelines, `addStage()` appends and validates, `removeStage()` fails when calls use that stage, `updateStage()` renames/recolors, `reorderStages()` sets correct order values, only one default pipeline allowed.

- [ ] **Step 2: Implement pipeline.service.ts**

Constructor takes `(PipelineModel, CallLogModel, logger)`. Uses `validatePipelineStages()` on create/addStage/updateStage. `delete()` checks `CallLogModel.countDocuments({ pipelineId, isClosed: false })` — any non-closed call blocks deletion. `removeStage()` checks `CallLogModel.countDocuments({ pipelineId, currentStageId: stageId, isClosed: false })` — only blocks if calls are in that specific stage.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add pipeline service with stage management"
```

---

## Task 9: Timeline Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/timeline.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/timeline.service.spec.ts`

- [ ] **Step 1: Write timeline service tests**

Test: `addNote()` appends a `TimelineEntryType.Note` entry with UUID, author, and timestamp. `addNote()` fails on closed call log. `addNote()` respects `maxTimelineEntries`. `addSystemEntry()` appends system entry. `getTimeline()` returns paginated entries sorted by `createdAt` desc. `getContactTimeline()` merges entries across multiple call logs for the same `contactRef.externalId`.

- [ ] **Step 2: Implement timeline.service.ts**

Constructor takes `(CallLogModel, logger, options: ResolvedOptions)`. `addNote()` uses `$push` with `$slice: -maxTimelineEntries`. `getContactTimeline()` uses `aggregate` with `$unwind` on `timeline`, `$match` on `contactRef.externalId`, `$sort` by `createdAt`, and `$skip/$limit` for pagination.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add timeline service with contact timeline merge"
```

---

## Task 10: Call Log Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/call-log.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/call-log.service.spec.ts`

- [ ] **Step 1: Write call log service tests**

Test: `create()` sets default stage from pipeline, adds "Call Created" timeline entry, fires `onCallCreated` hook. `update()` modifies priority/tags/category/followUpDate, fails if closed. `changeStage()` uses atomic `findOneAndUpdate` with `currentStageId` condition, records `stageHistory` with `timeInStageMs`, adds timeline entry, fires `onStageChanged`. `changeStage()` to terminal stage sets `isClosed: true` and fires `onCallClosed`. Concurrent `changeStage()` — second call returns null (optimistic lock failure). `assign()` reassigns agent, adds timeline entry, fires `onCallAssigned`. `list()` filters correctly. `getByContact()` returns all calls for `externalId`. `getFollowUpsDue()` returns calls with `nextFollowUpDate <= now` and `isClosed == false`. `bulkChangeStage()` processes each call individually. `close()` manually closes.

- [ ] **Step 2: Implement call-log.service.ts**

Constructor takes `(CallLogModel, PipelineModel, TimelineService, logger, hooks, options)`.

Key implementation detail for `changeStage()`:
```ts
const updated = await this.CallLog.findOneAndUpdate(
  { callLogId, currentStageId: currentStageId }, // optimistic lock
  { $set: { currentStageId: newStageId, ... }, $push: { stageHistory: change, timeline: entry } },
  { new: true }
);
if (!updated) throw new Error('Concurrent stage change detected');
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add call log service with atomic stage changes"
```

---

## Task 11: Analytics Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/analytics.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/analytics.service.spec.ts`

- [ ] **Step 1: Write analytics service tests**

Test with seeded data: `getAgentStats()` returns correct totals and averages. `getAgentLeaderboard()` ranks by call volume. `getPipelineStats()` returns per-stage counts, conversion rates, avg time, identifies bottleneck. `getPipelineFunnel()` returns entry/exit/dropoff per stage. `getTeamStats()` filters by `teamId` on agent collection. `getDailyReport()` groups by date. `getWeeklyTrends()` returns N entries (one per requested week), each with a week label and per-direction/pipeline/agent counts, confirming week-over-week comparison structure. `getOverallReport()` returns totals, tag/category distribution, peak hours.

- [ ] **Step 2: Implement analytics.service.ts**

Constructor takes `(CallLogModel, AgentModel, PipelineModel, logger)`. All methods use MongoDB `aggregate()` pipelines. `getTeamStats()` first queries agents by `teamId`, then aggregates call logs by those agent IDs. `getPipelineFunnel()` uses `$unwind` on `stageHistory` to track per-stage entry/exit counts.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add analytics service with pipeline funnel and team reports"
```

---

## Task 12: Export Service

**Files:**
- Create: `packages/call-log/call-log-engine/src/services/export.service.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/services/export.service.spec.ts`

- [ ] **Step 1: Write export service tests**

Test: `exportCallLog()` returns JSON with timeline. `exportCallLog()` returns CSV with headers. `exportCallLogs()` applies filters. `exportPipelineReport()` returns analytics data. Not-found throws `CallLogNotFoundError`.

- [ ] **Step 2: Implement export.service.ts**

Follow chat-engine's `ExportService` pattern. Constructor takes `(CallLogModel, AnalyticsService, logger)`. Private `toCSV()` and `escapeCSV()` helpers. CSV columns: `callLogId, contactName, contactPhone, contactEmail, direction, pipeline, stage, priority, agentId, callDate, isClosed, tags`.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add export service with JSON and CSV formats"
```

---

## Task 13: Follow-Up Worker

**Files:**
- Create: `packages/call-log/call-log-engine/src/workers/follow-up.worker.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/workers/follow-up.worker.spec.ts`

- [ ] **Step 1: Write worker tests**

Test: `start()` begins interval. `stop()` clears interval. `tick()` finds due follow-ups and fires `onFollowUpDue`. `tick()` marks `followUpNotifiedAt` to prevent duplicate notifications. `tick()` skips already-notified calls. `tick()` error in one call does not abort others. Double `start()` is a no-op.

- [ ] **Step 2: Implement follow-up.worker.ts**

Follow chat-engine's `SessionTimeoutWorker` pattern:
- `FollowUpWorkerDeps` interface: `{ CallLog, hooks, logger, options }`
- `start()` / `stop()` with `intervalId` and `running` guard
- `tick()`: query `{ nextFollowUpDate: { $lte: now }, isClosed: false, followUpNotifiedAt: null }`, iterate results, fire hook, set `followUpNotifiedAt`
- Per-call error isolation in try/catch

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add follow-up worker with duplicate notification prevention"
```

---

## Task 14: REST Routes

**Files:**
- Create: `packages/call-log/call-log-engine/src/routes/index.ts`
- Create: `packages/call-log/call-log-engine/src/routes/pipeline.routes.ts`
- Create: `packages/call-log/call-log-engine/src/routes/call-log.routes.ts`
- Create: `packages/call-log/call-log-engine/src/routes/contact.routes.ts`
- Create: `packages/call-log/call-log-engine/src/routes/analytics.routes.ts`
- Create: `packages/call-log/call-log-engine/src/routes/settings.routes.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/routes/index.spec.ts`

- [ ] **Step 1: Write route tests**

Test key routes with mocked services: `POST /pipelines` creates pipeline. `GET /calls` lists with filters. `PUT /calls/:id/stage` changes stage. `POST /calls/:id/notes` adds timeline note. `GET /contacts/:externalId/timeline` returns merged timeline. `GET /analytics/overall` returns report. Auth middleware rejects unauthenticated requests.

Route ordering tests: `GET /calls/follow-ups` is NOT captured by `GET /calls/:id` handler. `PUT /calls/-/bulk/stage` resolves to bulk handler, NOT single-call handler.

- [ ] **Step 2: Implement sub-route files**

Create per-domain route files matching chat-engine pattern:
- `pipeline.routes.ts` — `createPipelineRoutes(service, logger): Router`
- `call-log.routes.ts` — `createCallLogRoutes(services, logger): Router` — IMPORTANT: register `/follow-ups` and `/-/bulk/stage` BEFORE `/:id`
- `contact.routes.ts` — `createContactRoutes(services, logger): Router`
- `analytics.routes.ts` — `createAnalyticsRoutes(service, logger): Router`
- `settings.routes.ts` — `createSettingsRoutes(services, logger): Router` — includes export routes

- [ ] **Step 3: Implement routes/index.ts**

`createRoutes(services: RouteServices, options: RouteOptions): Router`. Builds auth middleware from `authenticateRequest` adapter. All routes go into `protectedRouter` (no public routes in call-log). Mounts sub-routers: `protectedRouter.use('/pipelines', ...)`, `protectedRouter.use('/calls', ...)`, etc.

Use `sendSuccess(res, data)` and `sendError(res, message, statusCode)` from `@astralibx/core`.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(call-log-engine): add REST routes with auth middleware"
```

---

## Task 15: Factory — createCallLogEngine

**Files:**
- Create: `packages/call-log/call-log-engine/src/index.ts`
- Create: `packages/call-log/call-log-engine/src/__tests__/index.spec.ts`

- [ ] **Step 1: Write factory integration tests**

Test: `createCallLogEngine()` returns object with all services, routes, models, destroy. Config validation with Zod rejects invalid config. `destroy()` stops the follow-up worker. All barrel exports are accessible.

- [ ] **Step 2: Implement index.ts**

Follow chat-engine factory pattern:
1. Validate config with Zod
2. Resolve options with `DEFAULT_OPTIONS`
3. Register Mongoose models with optional `collectionPrefix`
4. Create all services in dependency order: Settings → Pipeline → Timeline → CallLog → Analytics → Export
5. Create routes via `createRoutes()`
6. Start `FollowUpWorker`
7. Return `CallLogEngine` object

Barrel re-export all constants, types, errors, validators, schemas.

- [ ] **Step 3: Run full test suite**

Run: `cd packages/call-log/call-log-engine && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Build and verify**

Run: `cd packages/call-log/call-log-engine && npx tsup`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(call-log-engine): add createCallLogEngine factory with full wiring"
```

---

## Task 16: Install Dependencies & Verify Full Build

- [ ] **Step 1: Install dependencies for both packages**

Run: `cd packages/call-log/call-log-types && npm install`
Run: `cd packages/call-log/call-log-engine && npm install`

- [ ] **Step 2: Run full test suite for both packages**

Run: `cd packages/call-log/call-log-types && npx vitest run`
Run: `cd packages/call-log/call-log-engine && npx vitest run`
Expected: All tests pass in both packages

- [ ] **Step 3: Build both packages**

Run: `cd packages/call-log/call-log-types && npx tsup`
Run: `cd packages/call-log/call-log-engine && npx tsup`
Expected: Both build successfully

- [ ] **Step 4: Commit if any fixes were needed**

---

## Task 17: Project Scaffolding — call-log-ui

**Files:**
- Create: `packages/call-log/call-log-ui/package.json`
- Create: `packages/call-log/call-log-ui/tsconfig.json`
- Create: `packages/call-log/call-log-ui/vite.config.ts`
- Create: `packages/call-log/call-log-ui/src/config.ts`
- Create: `packages/call-log/call-log-ui/src/api/http-client.ts`
- Create: `packages/call-log/call-log-ui/src/api/call-log-api-client.ts`
- Create: `packages/call-log/call-log-ui/src/api/index.ts`
- Create: `packages/call-log/call-log-ui/src/index.ts`
- Create: `packages/call-log/call-log-ui/README.md`

- [ ] **Step 1: Create package.json and tsconfig.json**

Create `tsconfig.json` with `lib: ['ES2020', 'DOM', 'DOM.Iterable']` for Lit decorator support, extending `../../../tsconfig.base.json`.

```json
{
  "name": "@astralibx/call-log-ui",
  "version": "0.1.0",
  "description": "Lit Web Components for the @astralibx call-log admin dashboard",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/call-log/call-log-ui"
  },
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    },
    "./api": {
      "import": { "types": "./dist/api.d.ts", "default": "./dist/api.js" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite"
  },
  "dependencies": {
    "lit": "^3.0.0",
    "@astralibx/call-log-types": "^0.1.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vite-plugin-dts": "^4.0.0",
    "typescript": "^5.8.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) =>
        id === 'lit' ||
        id.startsWith('lit/') ||
        id.startsWith('@astralibx/'),
    },
    sourcemap: true,
    minify: false,
  },
});
```

- [ ] **Step 3: Create config.ts (CallLogUIConfig singleton)**

```ts
// src/config.ts
export interface CallLogUIConfigOptions {
  callLogApi: string;
  authToken?: string;
}

class CallLogUIConfigSingleton {
  private _config: CallLogUIConfigOptions | null = null;

  setup(config: CallLogUIConfigOptions): void {
    this._config = config;
  }

  get config(): CallLogUIConfigOptions {
    if (!this._config) throw new Error('CallLogUIConfig.setup() must be called before using components');
    return this._config;
  }

  get callLogApi(): string { return this.config.callLogApi; }
  get authToken(): string | undefined { return this.config.authToken; }
}

export const CallLogUIConfig = new CallLogUIConfigSingleton();
```

- [ ] **Step 4: Create API client files**

`src/api/http-client.ts` — thin HTTP wrapper using `fetch()`, reads base URL and auth token from `CallLogUIConfig`.

`src/api/call-log-api-client.ts` — typed methods for all REST routes: `listPipelines()`, `createPipeline()`, `listCalls()`, `createCall()`, `changeStage()`, `addNote()`, `getContactTimeline()`, `getAgentStats()`, `getPipelineFunnel()`, `getOverallReport()`, `getSettings()`, `updateSettings()`, etc.

`src/api/index.ts` — re-exports `CallLogUIConfig` and `CallLogApiClient`.

- [ ] **Step 5: Create src/index.ts barrel**

Empty for now — will be populated when UI components are added in later tasks. Exports `CallLogUIConfig` for initial setup.

- [ ] **Step 6: Create README.md**

- [ ] **Step 7: Build and verify**

Run: `cd packages/call-log/call-log-ui && npm install && npx vite build`

- [ ] **Step 8: Commit**

```bash
git add packages/call-log/call-log-ui/
git commit -m "feat(call-log-ui): scaffold UI package with API client and config"
```

---

## Task 18: UI Components — Pipelines

**Files:**
- Create: `packages/call-log/call-log-ui/src/components/pipelines/alx-pipeline-board.ts`
- Create: `packages/call-log/call-log-ui/src/components/pipelines/alx-pipeline-stage-editor.ts`
- Create: `packages/call-log/call-log-ui/src/components/pipelines/alx-pipeline-list.ts`

- [ ] **Step 1: Implement pipeline board component**

Kanban-style board showing call logs grouped by stage columns. Uses `CallLogApiClient` to fetch data. Supports drag-and-drop stage transitions.

- [ ] **Step 2: Implement stage editor component**

Admin form for creating/editing pipeline stages: name, color picker, terminal/default toggles, reorder buttons.

- [ ] **Step 3: Implement pipeline list component**

List of all pipelines with create/edit/delete/activate actions.

- [ ] **Step 4: Export from index.ts**

- [ ] **Step 5: Build and verify**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(call-log-ui): add pipeline board, stage editor, and list components"
```

---

## Task 19: UI Components — Call Logs & Timeline

**Files:**
- Create: `packages/call-log/call-log-ui/src/components/call-logs/alx-call-log-list.ts`
- Create: `packages/call-log/call-log-ui/src/components/call-logs/alx-call-log-detail.ts`
- Create: `packages/call-log/call-log-ui/src/components/call-logs/alx-call-log-form.ts`
- Create: `packages/call-log/call-log-ui/src/components/timeline/alx-call-timeline.ts`
- Create: `packages/call-log/call-log-ui/src/components/timeline/alx-contact-timeline.ts`

- [ ] **Step 1: Implement call log list**

Filterable, sortable table of call logs. Filters: pipeline, stage, agent, tags, priority, direction, date range, open/closed.

- [ ] **Step 2: Implement call log detail**

Detail view showing call info, current stage, contact info, follow-up date, and embedded timeline.

- [ ] **Step 3: Implement call log form**

Create/edit form: contact lookup (via API), direction, pipeline, priority, tags, category, follow-up date, initial note.

- [ ] **Step 4: Implement call timeline component**

Timeline view for a single call log — renders entries by type with icons: notes, stage changes, assignments, follow-ups, system messages.

- [ ] **Step 5: Implement contact timeline component**

Merged timeline across all calls for a contact. Shows call log context (which pipeline/stage) alongside each entry.

- [ ] **Step 6: Export from index.ts, build, verify**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(call-log-ui): add call log list, detail, form, and timeline components"
```

---

## Task 20: UI Components — Analytics & Settings

**Files:**
- Create: `packages/call-log/call-log-ui/src/components/analytics/alx-call-analytics-dashboard.ts`
- Create: `packages/call-log/call-log-ui/src/components/analytics/alx-pipeline-funnel.ts`
- Create: `packages/call-log/call-log-ui/src/components/analytics/alx-agent-leaderboard.ts`
- Create: `packages/call-log/call-log-ui/src/components/settings/alx-call-log-settings.ts`

- [ ] **Step 1: Implement analytics dashboard**

Overview with daily call counts, overall stats, trend charts. Date range picker. Tabs for agent/pipeline/team views.

- [ ] **Step 2: Implement pipeline funnel component**

Visual funnel chart for a selected pipeline showing stage-by-stage conversion rates and drop-offs.

- [ ] **Step 3: Implement agent leaderboard component**

Ranked table of agents by call volume, close rate, follow-up compliance.

- [ ] **Step 4: Implement settings component**

Admin panel for: tags, categories, priority labels, follow-up defaults, default pipeline, max concurrent calls.

- [ ] **Step 5: Create main dashboard component**

`alx-call-log-dashboard.ts` — top-level component with tabs: Pipelines, Calls, Analytics, Settings.

- [ ] **Step 6: Export all from index.ts, build, verify**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(call-log-ui): add analytics, funnel, leaderboard, settings, and dashboard components"
```

---

## Task 21: Final Integration Test & Documentation

- [ ] **Step 1: Run full test suite across all packages**

Run: `cd packages/call-log/call-log-types && npx vitest run`
Run: `cd packages/call-log/call-log-engine && npx vitest run`
Expected: All tests pass, coverage thresholds met

- [ ] **Step 2: Build all packages**

Run: `cd packages/call-log/call-log-types && npx tsup`
Run: `cd packages/call-log/call-log-engine && npx tsup`
Run: `cd packages/call-log/call-log-ui && npx vite build`

- [ ] **Step 3: Create module-level README**

Create `packages/call-log/README.md` with architecture overview, package table, dependency graph, setup example, and links — following the pattern of `packages/chat/README.md`.

- [ ] **Step 4: Final commit**

```bash
git add packages/call-log/
git commit -m "feat(call-log): complete call-log module with engine, types, and UI"
```

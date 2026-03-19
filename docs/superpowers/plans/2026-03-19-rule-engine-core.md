# @astralibx/rule-engine Core Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@astralibx/rule-engine` — a platform-agnostic rule engine core with templates owning collection/join data sources, structured conditions, pipeline builder, and condition preview.

**Architecture:** Extracted from `@astralibx/email-rule-engine`, generalized with generic `send` adapter, shared MongoDB collections with `platform` field, templates owning `collectionName` + `joins`, and `POST /rules/preview-conditions` endpoint. The email package becomes a thin wrapper in a future sub-project.

**Tech Stack:** TypeScript, Mongoose 8, Express 5, ioredis, Handlebars, Zod, Vitest, tsup

**Spec:** `docs/superpowers/specs/2026-03-19-rule-engine-core-design.md`

**Reference implementation:** `packages/email/rule-engine/src/` — the source code to generalize from.

---

## File Map

All paths relative to `packages/rule-engine/core/`.

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Create | Package config, dependencies |
| `tsconfig.json` | Create | TypeScript config |
| `tsup.config.ts` | Create | Build config |
| `src/types/collection.types.ts` | Create | FieldDefinition, JoinDefinition, CollectionSchema, FlattenedField |
| `src/types/rule.types.ts` | Create | RuleCondition, QueryTarget, ListTarget, RuleTarget, Rule, RuleRunStats |
| `src/types/template.types.ts` | Create | Template with collectionName + joins, Attachment |
| `src/types/config.types.ts` | Create | RuleEngineConfig, adapters, SendParams, AgentSelection |
| `src/types/run.types.ts` | Create | RunProgress, RunStatus, RunStatusResponse |
| `src/types/index.ts` | Create | Barrel export |
| `src/constants/field-types.ts` | Create | FIELD_TYPE, TYPE_OPERATORS |
| `src/constants/index.ts` | Create | RULE_OPERATOR, RULE_TYPE, TARGET_MODE, RUN_TRIGGER, SEND_STATUS, etc. |
| `src/errors/index.ts` | Create | AlxRuleEngineError and subclasses |
| `src/schemas/shared-schemas.ts` | Create | createRunStatsSchema |
| `src/schemas/template.schema.ts` | Create | Template Mongoose schema with collectionName + joins |
| `src/schemas/rule.schema.ts` | Create | Rule Mongoose schema (no collectionName/joins) |
| `src/schemas/send-log.schema.ts` | Create | Send log schema |
| `src/schemas/run-log.schema.ts` | Create | Run log schema |
| `src/schemas/error-log.schema.ts` | Create | Error log schema |
| `src/schemas/throttle-config.schema.ts` | Create | Throttle + send window config schema |
| `src/schemas/index.ts` | Create | Barrel export |
| `src/validation/config.validator.ts` | Create | Zod-based config validation |
| `src/validation/condition.validator.ts` | Create | validateConditions, validateJoinAliases |
| `src/utils/pipeline-builder.ts` | Create | buildAggregationPipeline |
| `src/utils/helpers.ts` | Create | filterUpdateableFields, buildDateRangeFilter, etc. |
| `src/controllers/collection.controller.ts` | Create | flattenFields, list collections, get fields |
| `src/controllers/template.controller.ts` | Create | Template CRUD endpoints |
| `src/controllers/rule.controller.ts` | Create | Rule CRUD + preview-conditions |
| `src/controllers/runner.controller.ts` | Create | Run trigger, status, cancel |
| `src/controllers/settings.controller.ts` | Create | Throttle config endpoints |
| `src/controllers/send-log.controller.ts` | Create | Send log list endpoint |
| `src/services/template-render.service.ts` | Create | Handlebars compile/render + shared helpers |
| `src/services/template.service.ts` | Create | Template CRUD logic + collection validation |
| `src/services/rule.service.ts` | Create | Rule CRUD + condition validation against template's collection |
| `src/services/rule-runner.service.ts` | Create | Runner orchestration with generic send |
| `src/services/scheduler.service.ts` | Create | BullMQ-based cron scheduler |
| `src/routes/index.ts` | Create | Express router wiring |
| `src/index.ts` | Create | createRuleEngine factory + all exports |
| `src/__tests__/constants.spec.ts` | Create | Constants tests |
| `src/__tests__/errors.spec.ts` | Create | Error classes tests |
| `src/__tests__/collection.spec.ts` | Create | flattenFields, validateConditions, validateJoinAliases |
| `src/__tests__/pipeline-builder.spec.ts` | Create | Pipeline builder tests |
| `src/__tests__/template-render.service.spec.ts` | Create | Handlebars rendering tests |
| `src/__tests__/config-validation.spec.ts` | Create | Config validation tests |
| `src/__tests__/rule-runner.service.spec.ts` | Create | Runner service tests |
| `src/__tests__/integration.spec.ts` | Create | Full CRUD + execution integration tests |

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/rule-engine/core/package.json`
- Create: `packages/rule-engine/core/tsconfig.json`
- Create: `packages/rule-engine/core/tsup.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@astralibx/rule-engine",
  "version": "0.1.0",
  "description": "Platform-agnostic rule engine with templates, conditions, collection schemas, and join support",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/rule-engine/core"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
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
  "keywords": ["rule-engine", "automation", "handlebars", "throttle", "conditions"],
  "license": "MIT",
  "dependencies": {
    "@astralibx/core": "*",
    "handlebars": "^4.7.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "@astralibx/core": "^1.2.0",
    "express": "^4.18.0 || ^5.0.0",
    "ioredis": "^5.0.0",
    "mongoose": "^7.0.0 || ^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "express": "^5.0.0",
    "ioredis": "^5.4.2",
    "mongoose": "^8.12.1",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0",
    "mongodb-memory-server": "^10.0.0"
  }
}
```

Note: No `mjml` or `html-to-text` — those stay in the email package.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/**/*.spec.ts"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
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

- [ ] **Step 4: Create directory structure**

Run: `mkdir -p packages/rule-engine/core/src/{types,constants,errors,schemas,validation,utils,controllers,services,routes,__tests__}`

- [ ] **Step 5: Install dependencies**

Run: `cd packages/rule-engine/core && npm install`

- [ ] **Step 6: Commit**

```bash
git add packages/rule-engine/core/package.json packages/rule-engine/core/tsconfig.json packages/rule-engine/core/tsup.config.ts
git commit -m "chore: scaffold @astralibx/rule-engine core package"
```

---

## Task 2: Constants & Field Types

**Files:**
- Create: `packages/rule-engine/core/src/constants/field-types.ts`
- Create: `packages/rule-engine/core/src/constants/index.ts`
- Test: `packages/rule-engine/core/src/__tests__/constants.spec.ts`

- [ ] **Step 1: Create field-types.ts**

Self-contained — defines `FieldType` inline to avoid circular dependency with types (which are created in Task 3):

```typescript
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';

export const FIELD_TYPE = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Date: 'date',
  ObjectId: 'objectId',
  Array: 'array',
  Object: 'object',
} as const;

export const TYPE_OPERATORS: Record<FieldType, string[]> = {
  string: ['eq', 'neq', 'contains', 'in', 'not_in', 'exists', 'not_exists'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'exists', 'not_exists'],
  boolean: ['eq', 'neq', 'exists', 'not_exists'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'],
  objectId: ['eq', 'neq', 'in', 'not_in', 'exists', 'not_exists'],
  array: ['contains', 'in', 'not_in', 'exists', 'not_exists'],
  object: ['exists', 'not_exists'],
};
```

- [ ] **Step 2: Create constants/index.ts**

Generalized from email — renamed `EMAIL_TYPE` to `RULE_TYPE`, `EMAIL_SEND_STATUS` to `SEND_STATUS`:

```typescript
export const TEMPLATE_CATEGORY = {
  Onboarding: 'onboarding',
  Engagement: 'engagement',
  Transactional: 'transactional',
  ReEngagement: 're-engagement',
  Announcement: 'announcement',
} as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];

export const TEMPLATE_AUDIENCE = {
  Customer: 'customer',
  Provider: 'provider',
  All: 'all',
} as const;

export type TemplateAudience = (typeof TEMPLATE_AUDIENCE)[keyof typeof TEMPLATE_AUDIENCE];

export const RULE_OPERATOR = {
  Eq: 'eq',
  Neq: 'neq',
  Gt: 'gt',
  Gte: 'gte',
  Lt: 'lt',
  Lte: 'lte',
  Exists: 'exists',
  NotExists: 'not_exists',
  In: 'in',
  NotIn: 'not_in',
  Contains: 'contains',
} as const;

export type RuleOperator = (typeof RULE_OPERATOR)[keyof typeof RULE_OPERATOR];

export const RULE_TYPE = {
  Automated: 'automated',
  Transactional: 'transactional',
} as const;

export type RuleType = (typeof RULE_TYPE)[keyof typeof RULE_TYPE];

export const RUN_TRIGGER = {
  Cron: 'cron',
  Manual: 'manual',
} as const;

export type RunTrigger = (typeof RUN_TRIGGER)[keyof typeof RUN_TRIGGER];

export const THROTTLE_WINDOW = {
  Rolling: 'rolling',
} as const;

export type ThrottleWindow = (typeof THROTTLE_WINDOW)[keyof typeof THROTTLE_WINDOW];

export const SEND_STATUS = {
  Sent: 'sent',
  Error: 'error',
  Skipped: 'skipped',
  Invalid: 'invalid',
  Throttled: 'throttled',
} as const;

export type SendStatus = (typeof SEND_STATUS)[keyof typeof SEND_STATUS];

export const TARGET_MODE = {
  Query: 'query',
  List: 'list',
} as const;

export type TargetMode = (typeof TARGET_MODE)[keyof typeof TARGET_MODE];

export const RUN_LOG_STATUS = {
  Completed: 'completed',
  Cancelled: 'cancelled',
  Failed: 'failed',
} as const;

export type RunLogStatus = (typeof RUN_LOG_STATUS)[keyof typeof RUN_LOG_STATUS];

export { FIELD_TYPE, TYPE_OPERATORS, type FieldType } from './field-types';
```

- [ ] **Step 3: Write constants test**

Create `src/__tests__/constants.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, RULE_TYPE,
  RUN_TRIGGER, THROTTLE_WINDOW, SEND_STATUS, TARGET_MODE, RUN_LOG_STATUS,
  FIELD_TYPE, TYPE_OPERATORS
} from '../constants';

describe('constants', () => {
  it('should have unique values in each enum', () => {
    const enums = [
      TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, RULE_TYPE,
      RUN_TRIGGER, THROTTLE_WINDOW, SEND_STATUS, TARGET_MODE, RUN_LOG_STATUS, FIELD_TYPE
    ];
    for (const e of enums) {
      const values = Object.values(e);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('should have 11 rule operators', () => {
    expect(Object.keys(RULE_OPERATOR)).toHaveLength(11);
  });

  it('should have TYPE_OPERATORS for all field types', () => {
    for (const type of Object.values(FIELD_TYPE)) {
      expect(TYPE_OPERATORS[type as keyof typeof TYPE_OPERATORS]).toBeDefined();
    }
  });
});
```

- [ ] **Step 4: Verify test passes**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/constants.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/rule-engine/core/src/constants/ packages/rule-engine/core/src/__tests__/constants.spec.ts
git commit -m "feat(rule-engine): add constants and field type operators"
```

---

## Task 3: Type Definitions

**Files:**
- Create: `packages/rule-engine/core/src/types/collection.types.ts`
- Create: `packages/rule-engine/core/src/types/rule.types.ts`
- Create: `packages/rule-engine/core/src/types/template.types.ts`
- Create: `packages/rule-engine/core/src/types/config.types.ts`
- Create: `packages/rule-engine/core/src/types/run.types.ts`
- Create: `packages/rule-engine/core/src/types/index.ts`

- [ ] **Step 1: Create collection.types.ts**

Imports `FieldType` from constants (defined in Task 2):

```typescript
import type { FieldType } from '../constants/field-types';
export type { FieldType };

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  fields?: FieldDefinition[];
}

export interface JoinDefinition {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
}

export interface CollectionSchema {
  name: string;
  label?: string;
  description?: string;
  identifierField?: string;
  fields: FieldDefinition[];
  joins?: JoinDefinition[];
}

export interface FlattenedField {
  path: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}
```

- [ ] **Step 2: Create rule.types.ts**

Generalized — no `collectionName` or `joins` on QueryTarget, renamed `emailType` to `ruleType`:

```typescript
import type { RuleOperator, RuleType, RunTrigger } from '../constants';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface RuleRunStats {
  matched: number;
  sent: number;
  skipped: number;
  throttled: number;
  failed: number;
}

export interface QueryTarget {
  mode: 'query';
  role: string;
  platform: string;
  conditions: RuleCondition[];
}

export interface ListTarget {
  mode: 'list';
  identifiers: string[];
}

export type RuleTarget = QueryTarget | ListTarget;

export interface Rule {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  platform: string;

  target: RuleTarget;
  templateId: string;

  sendOnce: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove: boolean;
  maxPerRun?: number;

  validFrom?: Date;
  validTill?: Date;

  bypassThrottle: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  ruleType: RuleType;

  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };

  totalSent: number;
  totalSkipped: number;
  lastRunAt?: Date;
  lastRunStats?: RuleRunStats;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  platform: string;
  target: RuleTarget;
  templateId: string;
  sortOrder?: number;
  sendOnce?: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove?: boolean;
  maxPerRun?: number;
  validFrom?: Date;
  validTill?: Date;
  bypassThrottle?: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  ruleType?: RuleType;
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  target?: RuleTarget;
  templateId?: string;
  sendOnce?: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove?: boolean;
  maxPerRun?: number;
  validFrom?: Date;
  validTill?: Date;
  bypassThrottle?: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  ruleType?: RuleType;
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };
}

export interface PerRuleStats extends RuleRunStats {
  ruleId: string;
  ruleName: string;
}

export interface RuleRunLog {
  _id: string;
  runAt: Date;
  triggeredBy: RunTrigger;
  duration: number;
  rulesProcessed: number;
  totalStats: RuleRunStats;
  perRuleStats: PerRuleStats[];
}
```

- [ ] **Step 3: Create template.types.ts**

```typescript
export interface Attachment {
  filename: string;
  url: string;
  contentType: string;
}

export interface Template {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  version: number;

  subjects: string[];
  bodies: string[];
  preheaders?: string[];
  textBody?: string;
  fields: Record<string, string>;
  variables: string[];

  collectionName?: string;
  joins?: string[];

  attachments?: Attachment[];
  metadata?: Record<string, unknown>;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  textBody?: string;
  subjects: string[];
  bodies: string[];
  preheaders?: string[];
  fields?: Record<string, string>;
  variables?: string[];
  collectionName?: string;
  joins?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  audience?: string;
  platform?: string;
  textBody?: string;
  subjects?: string[];
  bodies?: string[];
  preheaders?: string[];
  fields?: Record<string, string>;
  variables?: string[];
  collectionName?: string;
  joins?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}
```

- [ ] **Step 4: Create config.types.ts**

```typescript
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import type { RuleTarget, RuleRunStats, PerRuleStats } from './rule.types';
import type { CollectionSchema, JoinDefinition } from './collection.types';

export type { LogAdapter } from '@astralibx/core';

export interface SendParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  subject?: string;
  body: string;
  textBody?: string;
  ruleId: string;
  autoApprove: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentSelection {
  accountId: string;
  contactValue: string;
  metadata: Record<string, unknown>;
}

export interface RecipientIdentifier {
  id: string;
  contactId: string;
}

export interface BeforeSendParams {
  body: string;
  textBody?: string;
  subject?: string;
  account: { id: string; contactValue: string; metadata: Record<string, unknown> };
  user: { id: string; contactValue: string; name: string };
  context: {
    ruleId: string;
    templateId: string;
    runId: string;
  };
}

export interface BeforeSendResult {
  body: string;
  textBody?: string;
  subject?: string;
}

export interface RuleEngineAdapters {
  queryUsers: (
    target: RuleTarget,
    limit: number,
    context?: { collectionSchema?: CollectionSchema; activeJoins?: JoinDefinition[] }
  ) => Promise<Record<string, unknown>[]>;

  resolveData: (user: Record<string, unknown>) => Record<string, unknown>;

  send: (params: SendParams) => Promise<void>;

  selectAgent: (
    identifierId: string,
    context?: { ruleId: string; templateId: string }
  ) => Promise<AgentSelection | null>;

  findIdentifier: (contactValue: string) => Promise<RecipientIdentifier | null>;

  sendTest?: (
    to: string,
    body: string,
    subject?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}

export interface RuleEngineConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  redis: {
    connection: Redis;
    keyPrefix?: string;
  };

  adapters: RuleEngineAdapters;

  collections?: CollectionSchema[];
  platforms?: string[];
  audiences?: string[];
  categories?: string[];

  logger?: LogAdapter;

  options?: {
    lockTTLMs?: number;
    defaultMaxPerRun?: number;
    sendWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
    };
    delayBetweenSendsMs?: number;
    jitterMs?: number;
  };

  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string; runId: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number; templateId: string; runId: string }) => void;
    onSend?: (info: {
      ruleId: string;
      ruleName: string;
      contactValue: string;
      status: string;
      accountId: string;
      templateId: string;
      runId: string;
      subjectIndex: number;
      bodyIndex: number;
      failureReason?: string;
    }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats; templateId: string; runId: string }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[]; runId: string }) => void;
    beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
  };
}
```

- [ ] **Step 5: Create run.types.ts**

```typescript
export interface RunProgress {
  rulesTotal: number;
  rulesCompleted: number;
  sent: number;
  failed: number;
  skipped: number;
  invalid: number;
}

export type RunStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface RunStatusResponse {
  runId: string;
  status: RunStatus;
  currentRule: string;
  progress: RunProgress;
  startedAt: string;
  elapsed: number;
}
```

- [ ] **Step 6: Create types/index.ts**

```typescript
export * from './collection.types';
export * from './rule.types';
export * from './template.types';
export * from './config.types';
export * from './run.types';
```

- [ ] **Step 7: Verify build**

Run: `cd packages/rule-engine/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/rule-engine/core/src/types/
git commit -m "feat(rule-engine): add core type definitions"
```

---

## Task 4: Error Classes

**Files:**
- Create: `packages/rule-engine/core/src/errors/index.ts`
- Test: `packages/rule-engine/core/src/__tests__/errors.spec.ts`

- [ ] **Step 1: Create errors/index.ts**

Generalized from email — renamed `AlxEmailError` to `AlxRuleEngineError`:

```typescript
import { AlxError } from '@astralibx/core';

export class AlxRuleEngineError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AlxRuleEngineError';
  }
}

export class ConfigValidationError extends AlxRuleEngineError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class TemplateNotFoundError extends AlxRuleEngineError {
  constructor(public readonly templateId: string) {
    super(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateSyntaxError extends AlxRuleEngineError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'TEMPLATE_SYNTAX');
    this.name = 'TemplateSyntaxError';
  }
}

export class RuleNotFoundError extends AlxRuleEngineError {
  constructor(public readonly ruleId: string) {
    super(`Rule not found: ${ruleId}`, 'RULE_NOT_FOUND');
    this.name = 'RuleNotFoundError';
  }
}

export class RuleTemplateIncompatibleError extends AlxRuleEngineError {
  constructor(public readonly reason: string) {
    super(`Rule-template incompatibility: ${reason}`, 'RULE_TEMPLATE_INCOMPATIBLE');
    this.name = 'RuleTemplateIncompatibleError';
  }
}

export class LockAcquisitionError extends AlxRuleEngineError {
  constructor() {
    super('Could not acquire distributed lock — another run is in progress', 'LOCK_ACQUISITION');
    this.name = 'LockAcquisitionError';
  }
}

export class DuplicateSlugError extends AlxRuleEngineError {
  constructor(public readonly slug: string) {
    super(`Template with slug "${slug}" already exists`, 'DUPLICATE_SLUG');
    this.name = 'DuplicateSlugError';
  }
}
```

- [ ] **Step 2: Write errors test**

Create `src/__tests__/errors.spec.ts` following the email pattern at `packages/email/rule-engine/src/__tests__/errors.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  AlxRuleEngineError, ConfigValidationError, TemplateNotFoundError,
  TemplateSyntaxError, RuleNotFoundError, RuleTemplateIncompatibleError,
  LockAcquisitionError, DuplicateSlugError
} from '../errors';

describe('Error classes', () => {
  it('AlxRuleEngineError should extend Error', () => {
    const err = new AlxRuleEngineError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.name).toBe('AlxRuleEngineError');
  });

  it('ConfigValidationError should include field', () => {
    const err = new ConfigValidationError('bad config', 'db');
    expect(err.field).toBe('db');
    expect(err).toBeInstanceOf(AlxRuleEngineError);
  });

  it('TemplateNotFoundError should include templateId', () => {
    const err = new TemplateNotFoundError('abc123');
    expect(err.templateId).toBe('abc123');
    expect(err.message).toContain('abc123');
  });

  it('TemplateSyntaxError should include errors array', () => {
    const err = new TemplateSyntaxError('bad syntax', ['err1', 'err2']);
    expect(err.errors).toEqual(['err1', 'err2']);
  });

  it('RuleNotFoundError should include ruleId', () => {
    const err = new RuleNotFoundError('rule1');
    expect(err.ruleId).toBe('rule1');
  });

  it('RuleTemplateIncompatibleError should include reason', () => {
    const err = new RuleTemplateIncompatibleError('mismatch');
    expect(err.reason).toBe('mismatch');
  });

  it('LockAcquisitionError should have fixed message', () => {
    const err = new LockAcquisitionError();
    expect(err.message).toContain('lock');
  });

  it('DuplicateSlugError should include slug', () => {
    const err = new DuplicateSlugError('my-slug');
    expect(err.slug).toBe('my-slug');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/errors.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/core/src/errors/ packages/rule-engine/core/src/__tests__/errors.spec.ts
git commit -m "feat(rule-engine): add error classes"
```

---

## Task 5: Validation — Condition Validator + Join Aliases + Pipeline Builder

**Files:**
- Create: `packages/rule-engine/core/src/validation/condition.validator.ts`
- Create: `packages/rule-engine/core/src/utils/pipeline-builder.ts`
- Create: `packages/rule-engine/core/src/controllers/collection.controller.ts`
- Test: `packages/rule-engine/core/src/__tests__/collection.spec.ts`
- Test: `packages/rule-engine/core/src/__tests__/pipeline-builder.spec.ts`

- [ ] **Step 1: Create collection.controller.ts**

Copy from `packages/email/rule-engine/src/controllers/collection.controller.ts` and apply these changes:
- `list`: add `joinCount` + `joins` array (with `alias`, `from`, `label` derived from joined collection's label)
- `getFields`: accept optional `?joins=` query param, filter joined fields accordingly

Full code:

```typescript
import type { Request, Response } from 'express';
import type { CollectionSchema, FieldDefinition, FlattenedField } from '../types/collection.types';
import { TYPE_OPERATORS } from '../constants/field-types';

export function flattenFields(fields: FieldDefinition[], prefix = '', parentIsArray = false): FlattenedField[] {
  const result: FlattenedField[] = [];
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const isArray = field.type === 'array';
    if (field.type === 'object' && field.fields?.length) {
      result.push({ path, type: 'object', label: field.label, description: field.description });
      result.push(...flattenFields(field.fields, path, false));
    } else if (isArray && field.fields?.length) {
      result.push({ path: `${path}[]`, type: 'array', label: field.label, description: field.description, isArray: true });
      result.push(...flattenFields(field.fields, `${path}[]`, true));
    } else {
      result.push({ path, type: field.type, label: field.label, description: field.description, enumValues: field.enumValues, isArray: parentIsArray || isArray });
    }
  }
  return result;
}

export function createCollectionController(collections: CollectionSchema[]) {
  return {
    list(_req: Request, res: Response) {
      const summary = collections.map(c => ({
        name: c.name, label: c.label, description: c.description, identifierField: c.identifierField,
        fieldCount: c.fields.length, joinCount: c.joins?.length ?? 0,
        joins: (c.joins ?? []).map(j => ({
          alias: j.as, from: j.from,
          label: collections.find(x => x.name === j.from)?.label ?? j.from,
        })),
      }));
      res.json({ collections: summary });
    },
    getFields(req: Request, res: Response) {
      const { name } = req.params;
      const collection = collections.find(c => c.name === name);
      if (!collection) { res.status(404).json({ error: `Collection "${name}" not found` }); return; }
      const fields = flattenFields(collection.fields);
      const requestedJoins = req.query.joins ? (req.query.joins as string).split(',') : undefined;
      if (collection.joins?.length) {
        for (const join of collection.joins) {
          if (requestedJoins && !requestedJoins.includes(join.as)) continue;
          const joinedCollection = collections.find(c => c.name === join.from);
          if (joinedCollection) { fields.push(...flattenFields(joinedCollection.fields, join.as)); }
        }
      }
      res.json({ name: collection.name, label: collection.label, identifierField: collection.identifierField, fields, typeOperators: TYPE_OPERATORS });
    },
  };
}
```

- [ ] **Step 2: Create condition.validator.ts**

```typescript
import type { RuleCondition } from '../types/rule.types';
import type { CollectionSchema, FlattenedField } from '../types/collection.types';
import { TYPE_OPERATORS } from '../constants/field-types';
import { flattenFields } from '../controllers/collection.controller';

export interface ConditionValidationError {
  index: number;
  field: string;
  message: string;
}

export function validateConditions(
  conditions: RuleCondition[],
  collectionName: string | undefined,
  collections: CollectionSchema[],
  activeJoinAliases?: string[]
): ConditionValidationError[] {
  if (!collectionName || collections.length === 0) return [];
  const collection = collections.find(c => c.name === collectionName);
  if (!collection) return [];

  const flatFields = flattenFields(collection.fields);

  if (collection.joins?.length) {
    for (const join of collection.joins) {
      if (activeJoinAliases && !activeJoinAliases.includes(join.as)) continue;
      const joinedCollection = collections.find(c => c.name === join.from);
      if (joinedCollection) { flatFields.push(...flattenFields(joinedCollection.fields, join.as)); }
    }
  }

  const fieldMap = new Map<string, FlattenedField>();
  for (const f of flatFields) { fieldMap.set(f.path, f); }

  const errors: ConditionValidationError[] = [];
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const fieldDef = fieldMap.get(cond.field);
    if (!fieldDef) {
      errors.push({ index: i, field: cond.field, message: `Field "${cond.field}" does not exist in collection "${collectionName}"` });
      continue;
    }
    const allowedOps = TYPE_OPERATORS[fieldDef.type];
    if (allowedOps && !allowedOps.includes(cond.operator)) {
      errors.push({ index: i, field: cond.field, message: `Operator "${cond.operator}" is not valid for field type "${fieldDef.type}"` });
    }
  }
  return errors;
}

export function validateJoinAliases(
  joinAliases: string[],
  collectionName: string,
  collections: CollectionSchema[]
): string[] {
  if (joinAliases.length === 0) return [];
  const collection = collections.find(c => c.name === collectionName);
  if (!collection) return [`Collection "${collectionName}" not found`];
  const validAliases = new Set((collection.joins ?? []).map(j => j.as));
  const errors: string[] = [];
  for (const alias of joinAliases) {
    if (!validAliases.has(alias)) {
      errors.push(`Join alias "${alias}" is not defined for collection "${collectionName}"`);
    }
  }
  return errors;
}
```

- [ ] **Step 3: Create pipeline-builder.ts**

```typescript
import type { JoinDefinition } from '../types/collection.types';
import type { RuleCondition } from '../types/rule.types';

export interface PipelineBuilderOptions {
  joins: JoinDefinition[];
  conditions: RuleCondition[];
  limit?: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOperatorExpression(operator: string, value: unknown): unknown {
  switch (operator) {
    case 'eq': return value;
    case 'neq': return { $ne: value };
    case 'gt': return { $gt: value };
    case 'gte': return { $gte: value };
    case 'lt': return { $lt: value };
    case 'lte': return { $lte: value };
    case 'contains': return { $regex: escapeRegex(String(value ?? '')), $options: 'i' };
    case 'in': return { $in: Array.isArray(value) ? value : [value] };
    case 'not_in': return { $nin: Array.isArray(value) ? value : [value] };
    case 'exists': return { $exists: true };
    case 'not_exists': return { $exists: false };
    default: return value;
  }
}

export function buildAggregationPipeline(options: PipelineBuilderOptions): object[] {
  const pipeline: object[] = [];
  for (const join of options.joins) {
    pipeline.push({
      $lookup: { from: join.from, localField: join.localField, foreignField: join.foreignField, as: join.as },
    });
    pipeline.push({
      $unwind: { path: `$${join.as}`, preserveNullAndEmptyArrays: true },
    });
  }
  if (options.conditions.length > 0) {
    pipeline.push({
      $match: {
        $and: options.conditions.map(cond => ({
          [cond.field]: buildOperatorExpression(cond.operator, cond.value),
        })),
      },
    });
  }
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }
  return pipeline;
}
```

- [ ] **Step 4: Write collection.spec.ts**

Copy `flattenFields` tests from `packages/email/rule-engine/src/__tests__/collection.spec.ts` (all 6 tests). Add these new tests for join-aware validation and `validateJoinAliases`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { flattenFields, createCollectionController } from '../controllers/collection.controller';
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';
import type { CollectionSchema, FieldDefinition } from '../types/collection.types';

// ... flattenFields tests (copy all 6 from email package's collection.spec.ts) ...

describe('validateConditions', () => {
  // ... copy existing tests from email package ...

  // Add join-aware tests:
  it('should validate joined fields when activeJoinAliases provided', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    expect(validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols, ['sub'])).toHaveLength(0);
  });

  it('should reject joined fields when join not active', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    const errors = validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols, []);
    expect(errors).toHaveLength(1);
  });

  it('should include all joins when activeJoinAliases undefined', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    expect(validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols)).toHaveLength(0);
  });
});

describe('validateJoinAliases', () => {
  const cols: CollectionSchema[] = [{
    name: 'users', fields: [{ name: 'name', type: 'string' }],
    joins: [
      { from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' },
      { from: 'pay', localField: '_id', foreignField: 'userId', as: 'payment' },
    ],
  }];

  it('should return no errors for valid aliases', () => { expect(validateJoinAliases(['sub'], 'users', cols)).toHaveLength(0); });
  it('should return error for invalid alias', () => { expect(validateJoinAliases(['bad'], 'users', cols)[0]).toContain('not defined'); });
  it('should return error for missing collection', () => { expect(validateJoinAliases(['sub'], 'nope', cols)[0]).toContain('not found'); });
  it('should return empty for empty aliases', () => { expect(validateJoinAliases([], 'users', cols)).toHaveLength(0); });
});

describe('createCollectionController', () => {
  const cols: CollectionSchema[] = [
    { name: 'users', label: 'Users', fields: [{ name: 'name', type: 'string' }],
      joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
    { name: 'subs', label: 'Subscriptions', fields: [{ name: 'plan', type: 'string' }] },
  ];
  const ctrl = createCollectionController(cols);
  const mockRes = () => { const r: any = { json: vi.fn(), status: vi.fn(() => r) }; return r; };

  it('list includes joins with alias and label', () => {
    const res = mockRes();
    ctrl.list({} as any, res);
    const data = res.json.mock.calls[0][0];
    expect(data.collections[0].joins[0]).toEqual({ alias: 'sub', from: 'subs', label: 'Subscriptions' });
  });

  it('getFields without joins param returns all', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: {} } as any, res);
    const paths = res.json.mock.calls[0][0].fields.map((f: any) => f.path);
    expect(paths).toContain('name');
    expect(paths).toContain('sub.plan');
  });

  it('getFields with joins param filters', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: { joins: 'sub' } } as any, res);
    expect(res.json.mock.calls[0][0].fields.map((f: any) => f.path)).toContain('sub.plan');
  });
});
```

- [ ] **Step 5: Write pipeline-builder.spec.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { buildAggregationPipeline } from '../utils/pipeline-builder';
import type { JoinDefinition } from '../types/collection.types';

describe('buildAggregationPipeline', () => {
  const subJoin: JoinDefinition = { from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' };

  it('returns empty pipeline with no joins/conditions', () => {
    expect(buildAggregationPipeline({ joins: [], conditions: [] })).toEqual([]);
  });

  it('adds $lookup + $unwind per join', () => {
    const p = buildAggregationPipeline({ joins: [subJoin], conditions: [] });
    expect(p).toHaveLength(2);
    expect(p[0]).toHaveProperty('$lookup');
    expect(p[1]).toHaveProperty('$unwind');
  });

  it('builds $match with $and from conditions', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'age', operator: 'gt', value: 18 },
      { field: 'status', operator: 'eq', value: 'active' },
    ]});
    expect((p[0] as any).$match.$and).toHaveLength(2);
  });

  it('handles same-field multiple conditions', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'age', operator: 'gte', value: 18 },
      { field: 'age', operator: 'lt', value: 65 },
    ]});
    expect((p[0] as any).$match.$and[0].age).toEqual({ $gte: 18 });
    expect((p[0] as any).$match.$and[1].age).toEqual({ $lt: 65 });
  });

  it('escapes regex in contains operator', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'name', operator: 'contains', value: 'test.val(1)' },
    ]});
    expect((p[0] as any).$match.$and[0].name.$regex).toBe('test\\.val\\(1\\)');
  });

  it('wraps non-array value in array for in operator', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 's', operator: 'in', value: 'x' },
    ]});
    expect((p[0] as any).$match.$and[0].s.$in).toEqual(['x']);
  });

  it('orders stages: $lookup → $unwind → $match → $limit', () => {
    const p = buildAggregationPipeline({
      joins: [subJoin],
      conditions: [{ field: 'sub.status', operator: 'eq', value: 'active' }],
      limit: 50,
    });
    expect(p).toHaveLength(4);
    expect(p[0]).toHaveProperty('$lookup');
    expect(p[1]).toHaveProperty('$unwind');
    expect(p[2]).toHaveProperty('$match');
    expect(p[3]).toEqual({ $limit: 50 });
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/collection.spec.ts src/__tests__/pipeline-builder.spec.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/rule-engine/core/src/validation/ packages/rule-engine/core/src/utils/pipeline-builder.ts packages/rule-engine/core/src/controllers/collection.controller.ts packages/rule-engine/core/src/__tests__/collection.spec.ts packages/rule-engine/core/src/__tests__/pipeline-builder.spec.ts
git commit -m "feat(rule-engine): add condition validation, join validation, pipeline builder, and collection controller"
```

---

## Task 6: Utility Helpers

**Files:**
- Create: `packages/rule-engine/core/src/utils/helpers.ts`

- [ ] **Step 1: Create helpers.ts**

Copy utility functions from `packages/email/rule-engine/src/utils/index.ts` — these are already platform-agnostic:

```typescript
import type { Request, Response, NextFunction } from 'express';

export function filterUpdateableFields(
  input: Record<string, unknown>,
  allowedFields: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowedFields.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function buildDateRangeFilter(
  field: string,
  from?: string | Date,
  to?: string | Date
): Record<string, unknown> | null {
  const filter: Record<string, unknown> = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return Object.keys(filter).length > 0 ? { [field]: filter } : null;
}

export function calculatePagination(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(200, Math.max(1, limit ?? 50));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not found')) return 404;
    if (msg.includes('validation') || msg.includes('incompatib') || msg.includes('invalid')) return 400;
    if (msg.includes('duplicate') || msg.includes('already exists')) return 409;
  }
  return 500;
}

export function isValidValue<T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/core/src/utils/helpers.ts
git commit -m "feat(rule-engine): add shared utility helpers"
```

---

## Task 7: Mongoose Schemas

**Files:**
- Create: `packages/rule-engine/core/src/schemas/shared-schemas.ts`
- Create: `packages/rule-engine/core/src/schemas/template.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/rule.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/send-log.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/run-log.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/error-log.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/throttle-config.schema.ts`
- Create: `packages/rule-engine/core/src/schemas/index.ts`

- [ ] **Step 1: Create shared-schemas.ts**

Unified `RuleRunStats` — combines email + telegram stats:

```typescript
import { Schema } from 'mongoose';

export function createRunStatsSchema() {
  return new Schema({
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    throttled: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  }, { _id: false });
}
```

- [ ] **Step 2: Create template.schema.ts**

Based on email's template schema. Key changes: shared collection name (`{prefix}templates`), adds `collectionName` + `joins` + `metadata`:

```typescript
import { Schema, Model, HydratedDocument } from 'mongoose';
import { TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE } from '../constants';
import type { Template, CreateTemplateInput } from '../types/template.types';

export interface ITemplate extends Omit<Template, '_id'> {}
export type TemplateDocument = HydratedDocument<ITemplate>;

export interface TemplateStatics {
  findBySlug(slug: string): Promise<TemplateDocument | null>;
  findActive(platform?: string): Promise<TemplateDocument[]>;
  findByCategory(category: string): Promise<TemplateDocument[]>;
  findByAudience(audience: string): Promise<TemplateDocument[]>;
  createTemplate(input: CreateTemplateInput): Promise<TemplateDocument>;
}

export type TemplateModel = Model<ITemplate> & TemplateStatics;

export function createTemplateSchema(
  platformValues?: string[],
  audienceValues?: string[],
  categoryValues?: string[],
  collectionPrefix?: string
) {
  const schema = new Schema<ITemplate>(
    {
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true, maxlength: 200 },
      description: String,
      category: { type: String, enum: categoryValues || Object.values(TEMPLATE_CATEGORY), required: true },
      audience: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE), required: true },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },
      version: { type: Number, default: 1 },

      textBody: String,
      subjects: { type: [{ type: String }], default: [] },
      bodies: { type: [{ type: String }], required: true, validate: [(v: string[]) => v.length >= 1, 'At least one body is required'] },
      preheaders: [{ type: String }],

      fields: {
        type: Schema.Types.Mixed,
        default: {},
        validate: {
          validator: (v: any) => {
            if (!v || typeof v !== 'object') return true;
            return Object.values(v).every(val => typeof val === 'string');
          },
          message: 'All field values must be strings'
        }
      },
      variables: [{ type: String }],

      collectionName: { type: String },
      joins: [{ type: String }],

      attachments: {
        type: [{
          _id: false,
          filename: { type: String, required: true },
          url: { type: String, required: true },
          contentType: { type: String, required: true },
        }],
        default: [],
      },
      metadata: { type: Schema.Types.Mixed, default: undefined },

      isActive: { type: Boolean, default: true }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}templates`,

      statics: {
        findBySlug(slug: string) {
          return this.findOne({ slug });
        },

        findActive(platform?: string) {
          const filter: Record<string, unknown> = { isActive: true };
          if (platform) filter.platform = platform;
          return this.find(filter).sort({ category: 1, name: 1 });
        },

        findByCategory(category: string) {
          return this.find({ category, isActive: true }).sort({ name: 1 });
        },

        findByAudience(audience: string) {
          return this.find({
            $or: [{ audience }, { audience: TEMPLATE_AUDIENCE.All }],
            isActive: true
          }).sort({ name: 1 });
        },

        async createTemplate(input: CreateTemplateInput) {
          return this.create({
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            audience: input.audience,
            platform: input.platform,
            textBody: input.textBody,
            subjects: input.subjects || [],
            bodies: input.bodies,
            preheaders: input.preheaders || [],
            fields: input.fields || {},
            variables: input.variables || [],
            collectionName: input.collectionName,
            joins: input.joins || [],
            attachments: input.attachments || [],
            metadata: input.metadata,
            version: 1,
            isActive: true
          });
        }
      }
    }
  );

  schema.index({ category: 1, isActive: 1 });
  schema.index({ audience: 1, platform: 1, isActive: 1 });

  return schema;
}
```

Note: `subjects` default is `[]` not required — telegram doesn't use subjects.

- [ ] **Step 3: Create rule.schema.ts**

Based on email's rule schema. Key changes: shared collection name (`{prefix}rules`), no `collectionName`/`joins` on target, `ruleType` replaces `emailType`:

```typescript
import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RULE_OPERATOR, RULE_TYPE, TEMPLATE_AUDIENCE, TARGET_MODE } from '../constants';
import { createRunStatsSchema } from './shared-schemas';
import type { Rule, CreateRuleInput } from '../types/rule.types';

export interface IRule extends Omit<Rule, '_id' | 'templateId'> {
  templateId: Types.ObjectId;
}

export type RuleDocument = HydratedDocument<IRule>;

export interface RuleStatics {
  findActive(platform?: string): Promise<RuleDocument[]>;
  findByTemplateId(templateId: string | Types.ObjectId): Promise<RuleDocument[]>;
  createRule(input: CreateRuleInput): Promise<RuleDocument>;
}

export type RuleModel = Model<IRule> & RuleStatics;

export function createRuleSchema(platformValues?: string[], audienceValues?: string[], collectionPrefix?: string) {
  const RuleConditionSchema = new Schema({
    field: { type: String, required: true },
    operator: { type: String, enum: Object.values(RULE_OPERATOR), required: true },
    value: { type: Schema.Types.Mixed }
  }, { _id: false });

  const RuleTargetSchema = new Schema({
    mode: { type: String, enum: Object.values(TARGET_MODE), required: true },
    role: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE) },
    platform: {
      type: String,
      ...(platformValues ? { enum: platformValues } : {})
    },
    conditions: [RuleConditionSchema],
    identifiers: [{ type: String }],
  }, { _id: false });

  const RuleRunStatsSchema = createRunStatsSchema();

  const schema = new Schema<IRule>(
    {
      name: { type: String, required: true },
      description: String,
      isActive: { type: Boolean, default: false },
      sortOrder: { type: Number, default: 10 },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },

      target: { type: RuleTargetSchema, required: true },
      templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },

      sendOnce: { type: Boolean, default: true },
      resendAfterDays: Number,
      cooldownDays: Number,
      autoApprove: { type: Boolean, default: true },
      maxPerRun: Number,

      validFrom: { type: Date },
      validTill: { type: Date },

      bypassThrottle: { type: Boolean, default: false },
      throttleOverride: {
        type: {
          maxPerUserPerDay: { type: Number },
          maxPerUserPerWeek: { type: Number },
          minGapDays: { type: Number },
        },
        _id: false,
        default: undefined,
      },
      ruleType: { type: String, enum: Object.values(RULE_TYPE), default: RULE_TYPE.Automated },

      schedule: {
        type: {
          enabled: { type: Boolean, default: false },
          cron: { type: String },
          timezone: { type: String, default: 'UTC' },
        },
        _id: false,
      },

      totalSent: { type: Number, default: 0 },
      totalSkipped: { type: Number, default: 0 },
      lastRunAt: Date,
      lastRunStats: RuleRunStatsSchema
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}rules`,

      statics: {
        findActive(platform?: string) {
          const filter: Record<string, unknown> = { isActive: true };
          if (platform) filter.platform = platform;
          return this.find(filter).sort({ sortOrder: 1 });
        },

        findByTemplateId(templateId: string | Types.ObjectId) {
          return this.find({ templateId });
        },

        async createRule(input: CreateRuleInput) {
          return this.create({
            name: input.name,
            description: input.description,
            isActive: false,
            sortOrder: input.sortOrder ?? 10,
            platform: input.platform,
            target: input.target,
            templateId: input.templateId,
            sendOnce: input.sendOnce ?? true,
            resendAfterDays: input.resendAfterDays,
            cooldownDays: input.cooldownDays,
            autoApprove: input.autoApprove ?? true,
            maxPerRun: input.maxPerRun,
            validFrom: input.validFrom,
            validTill: input.validTill,
            bypassThrottle: input.bypassThrottle ?? false,
            throttleOverride: input.throttleOverride,
            schedule: input.schedule,
            ruleType: input.ruleType ?? RULE_TYPE.Automated,
            totalSent: 0,
            totalSkipped: 0
          });
        }
      }
    }
  );

  schema.index({ isActive: 1, sortOrder: 1 });
  schema.index({ platform: 1, isActive: 1 });

  return schema;
}
```

- [ ] **Step 4: Create remaining schemas**

Create `send-log.schema.ts`, `run-log.schema.ts`, `error-log.schema.ts`, `throttle-config.schema.ts` — these are straightforward copies from the email package with generalized collection names (`{prefix}send_logs`, `{prefix}run_logs`, `{prefix}error_logs`, `{prefix}throttle_config`). Use the unified `RuleRunStats` schema.

Reference files:
- `packages/email/rule-engine/src/schemas/rule-send.schema.ts` → `send-log.schema.ts`
- `packages/email/rule-engine/src/schemas/run-log.schema.ts` → `run-log.schema.ts`
- `packages/email/rule-engine/src/schemas/throttle-config.schema.ts` → `throttle-config.schema.ts`
- New: `error-log.schema.ts` — simple schema with `{ ruleId, ruleName, contactValue, error, stack, context, createdAt }`

- [ ] **Step 5: Create schemas/index.ts barrel export**

```typescript
export { createTemplateSchema, type TemplateModel, type TemplateDocument } from './template.schema';
export { createRuleSchema, type RuleModel, type RuleDocument } from './rule.schema';
export { createSendLogSchema, type SendLogModel } from './send-log.schema';
export { createRunLogSchema, type RunLogModel } from './run-log.schema';
export { createErrorLogSchema, type ErrorLogModel } from './error-log.schema';
export { createThrottleConfigSchema, type ThrottleConfigModel } from './throttle-config.schema';
export { createRunStatsSchema } from './shared-schemas';
```

- [ ] **Step 6: Verify build**

Run: `cd packages/rule-engine/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/rule-engine/core/src/schemas/
git commit -m "feat(rule-engine): add Mongoose schemas with shared collections and template-owned joins"
```

---

## Task 8: Config Validation

**Files:**
- Create: `packages/rule-engine/core/src/validation/config.validator.ts`
- Test: `packages/rule-engine/core/src/__tests__/config-validation.spec.ts`

- [ ] **Step 1: Create config.validator.ts**

Generalized from email's Zod validation — validates `adapters.send` instead of `adapters.sendEmail`:

```typescript
import { z } from 'zod';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  db: z.object({
    connection: z.any().refine(v => v && typeof v.model === 'function', 'Must be a Mongoose connection'),
    collectionPrefix: z.string().optional(),
  }),
  redis: z.object({
    connection: z.any().refine(v => v !== null && v !== undefined, 'Redis connection is required'),
    keyPrefix: z.string().optional(),
  }),
  adapters: z.object({
    queryUsers: z.function(),
    resolveData: z.function(),
    send: z.function(),
    selectAgent: z.function(),
    findIdentifier: z.function(),
    sendTest: z.function().optional(),
  }),
  collections: z.array(z.any()).optional(),
  platforms: z.array(z.string()).optional(),
  audiences: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  logger: z.any().optional(),
  options: z.any().optional(),
  hooks: z.any().optional(),
});

export function validateConfig(config: unknown): void {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const field = firstError.path.join('.');
    throw new ConfigValidationError(firstError.message, field);
  }
}
```

- [ ] **Step 2: Write config validation tests**

Follow the pattern from `packages/email/rule-engine/src/__tests__/config-validation.spec.ts`. Test that:
- Valid config passes
- Missing `db`, `redis`, `adapters` each fail with appropriate error
- Missing individual adapters (`send`, `queryUsers`, etc.) fail
- Optional fields don't cause errors when omitted

- [ ] **Step 3: Run tests**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/config-validation.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/core/src/validation/config.validator.ts packages/rule-engine/core/src/__tests__/config-validation.spec.ts
git commit -m "feat(rule-engine): add Zod-based config validation"
```

---

## Task 9: Template Render Service

**Files:**
- Create: `packages/rule-engine/core/src/services/template-render.service.ts`
- Test: `packages/rule-engine/core/src/__tests__/template-render.service.spec.ts`

- [ ] **Step 1: Create template-render.service.ts**

Copy from `packages/email/rule-engine/src/services/template-render.service.ts`. Remove all MJML rendering — keep only Handlebars compilation, rendering, and shared helpers.

Key methods:
- `compile(templateStr, options?)` — compile Handlebars template (strict: false by default)
- `render(compiled, data)` — render with data
- `compileBatchVariants(subjects, bodies, preheaders?)` — compile A/B variants into function arrays
- `renderFromCompiled(compiledSubjects, compiledBodies, data, subjectIndex, bodyIndex)` — render specific variant
- `extractVariables(templateStr)` — parse `{{variable}}` patterns
- `validateTemplate(templateStr)` — validate Handlebars syntax
- `registerHelper(name, fn)` — add custom Handlebars helpers

Shared helpers registered on construction: `capitalize`, `lowercase`, `uppercase`, `eq`, `neq`, `not`, `gt`, `lt`, `gte`, `lte`, `join`, `pluralize`.

No `currency` or `formatDate` — those are email-specific and can be added via `registerHelper`.

Return type for render: `{ subject?: string; body: string; textBody?: string }` — subject is optional since telegram doesn't use it.

- [ ] **Step 2: Write template render tests**

Follow the pattern from `packages/email/rule-engine/src/__tests__/template-render.service.spec.ts`. Test:
- `compile` + `render` with variables
- `compileBatchVariants` + `renderFromCompiled`
- `extractVariables`
- `validateTemplate` — valid and invalid syntax
- All shared helpers
- `registerHelper` — custom helper works

Skip MJML-specific tests (those stay in the email package).

- [ ] **Step 3: Run tests**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/template-render.service.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/core/src/services/template-render.service.ts packages/rule-engine/core/src/__tests__/template-render.service.spec.ts
git commit -m "feat(rule-engine): add Handlebars template render service with shared helpers"
```

---

## Task 10: Template Service

**Files:**
- Create: `packages/rule-engine/core/src/services/template.service.ts`

- [ ] **Step 1: Create template.service.ts**

Based on `packages/email/rule-engine/src/services/template.service.ts`. Key changes:
- Validates `collectionName` exists in config collections on create/update
- Validates `joins` aliases are valid for that collection on create/update
- Uses `validateJoinAliases` from condition.validator
- No MJML rendering — delegates to `TemplateRenderService` for Handlebars only
- Platform filtering: `list()` accepts optional `platform` param

```typescript
import type { TemplateModel, TemplateDocument } from '../schemas/template.schema';
import type { RuleModel } from '../schemas/rule.schema';
import type { CreateTemplateInput, UpdateTemplateInput } from '../types/template.types';
import type { RuleEngineConfig } from '../types/config.types';
import { TemplateNotFoundError, DuplicateSlugError, RuleTemplateIncompatibleError } from '../errors';
import { validateJoinAliases } from '../validation/condition.validator';
import { filterUpdateableFields } from '../utils/helpers';

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'category', 'audience', 'platform',
  'textBody', 'subjects', 'bodies', 'preheaders',
  'fields', 'variables', 'collectionName', 'joins',
  'attachments', 'metadata', 'isActive'
]);

export class TemplateService {
  constructor(
    private Template: TemplateModel,
    private config: RuleEngineConfig,
    private Rule?: RuleModel
  ) {}

  async list(opts?: { page?: number; limit?: number; platform?: string }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 200, 200);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (opts?.platform) filter.platform = opts.platform;
    const [templates, total] = await Promise.all([
      this.Template.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit),
      this.Template.countDocuments(filter),
    ]);
    return { templates, total };
  }

  async getById(id: string): Promise<TemplateDocument | null> {
    return this.Template.findById(id);
  }

  async create(input: CreateTemplateInput): Promise<TemplateDocument> {
    const existing = await this.Template.findBySlug(input.slug);
    if (existing) throw new DuplicateSlugError(input.slug);

    this.validateCollectionAndJoins(input.collectionName, input.joins);

    return this.Template.createTemplate(input);
  }

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateDocument | null> {
    const template = await this.Template.findById(id);
    if (!template) return null;

    const effectiveCollectionName = input.collectionName !== undefined ? input.collectionName : template.collectionName;
    const effectiveJoins = input.joins !== undefined ? input.joins : template.joins;
    this.validateCollectionAndJoins(effectiveCollectionName, effectiveJoins);

    if (input.isActive !== undefined || input.subjects || input.bodies) {
      const setFields = filterUpdateableFields(input as Record<string, unknown>, UPDATEABLE_FIELDS);
      if (Object.keys(setFields).length > 0) {
        setFields.version = (template.version || 1) + 1;
      }
      return this.Template.findByIdAndUpdate(id, { $set: setFields }, { new: true });
    }

    const setFields = filterUpdateableFields(input as Record<string, unknown>, UPDATEABLE_FIELDS);
    return this.Template.findByIdAndUpdate(id, { $set: setFields }, { new: true });
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const result = await this.Template.findByIdAndDelete(id);
    return { deleted: !!result };
  }

  async toggleActive(id: string): Promise<TemplateDocument | null> {
    const template = await this.Template.findById(id);
    if (!template) return null;
    template.isActive = !template.isActive;
    await template.save();
    return template;
  }

  async clone(sourceId: string, newName?: string): Promise<TemplateDocument> {
    const source = await this.Template.findById(sourceId);
    if (!source) throw new TemplateNotFoundError(sourceId);
    const { _id, __v, createdAt, updatedAt, slug, ...rest } = source.toObject() as any;
    rest.name = newName || `${rest.name} (copy)`;
    rest.slug = `${slug}-copy-${Date.now()}`;
    rest.isActive = false;
    rest.version = 1;
    return this.Template.create(rest);
  }

  private validateCollectionAndJoins(collectionName?: string, joins?: string[]): void {
    if (!collectionName || !this.config.collections?.length) return;

    const collection = this.config.collections.find(c => c.name === collectionName);
    if (!collection) {
      throw new RuleTemplateIncompatibleError(`Collection "${collectionName}" is not registered`);
    }

    if (joins?.length) {
      const errors = validateJoinAliases(joins, collectionName, this.config.collections);
      if (errors.length > 0) {
        throw new RuleTemplateIncompatibleError(`Invalid joins: ${errors.join('; ')}`);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/core/src/services/template.service.ts
git commit -m "feat(rule-engine): add template service with collection/join validation"
```

---

## Task 11: Rule Service with Template-Based Collection Validation

**Files:**
- Create: `packages/rule-engine/core/src/services/rule.service.ts`

- [ ] **Step 1: Create rule.service.ts**

Based on `packages/email/rule-engine/src/services/rule.service.ts`. Key changes:
- Reads `collectionName` + `joins` from the linked template (not from rule target)
- Validates conditions against template's collection + active joins
- `previewConditions()` — new method for the preview endpoint
- `dryRun()` — passes `activeJoins` resolved from template

```typescript
import type { RuleModel, RuleDocument } from '../schemas/rule.schema';
import type { TemplateModel, TemplateDocument } from '../schemas/template.schema';
import type { RunLogModel } from '../schemas/run-log.schema';
import type { CreateRuleInput, UpdateRuleInput, RuleTarget, QueryTarget } from '../types/rule.types';
import type { RuleEngineConfig } from '../types/config.types';
import type { JoinDefinition } from '../types/collection.types';
import { TemplateNotFoundError, RuleNotFoundError, RuleTemplateIncompatibleError } from '../errors';
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';
import { filterUpdateableFields } from '../utils/helpers';

function isQueryTarget(target: RuleTarget): target is QueryTarget {
  return !target.mode || target.mode === 'query';
}

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'sortOrder', 'target', 'templateId',
  'sendOnce', 'resendAfterDays', 'cooldownDays', 'autoApprove',
  'maxPerRun', 'bypassThrottle', 'throttleOverride', 'ruleType',
  'validFrom', 'validTill', 'schedule'
]);

export class RuleService {
  constructor(
    private Rule: RuleModel,
    private Template: TemplateModel,
    private RunLog: RunLogModel,
    private config: RuleEngineConfig
  ) {}

  async list(opts?: { page?: number; limit?: number; platform?: string }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 200, 200);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (opts?.platform) filter.platform = opts.platform;
    const [rules, total] = await Promise.all([
      this.Rule.find(filter).populate('templateId', 'name slug collectionName joins').sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
      this.Rule.countDocuments(filter),
    ]);
    return { rules, total };
  }

  async getById(id: string): Promise<RuleDocument | null> {
    return this.Rule.findById(id);
  }

  async create(input: CreateRuleInput): Promise<RuleDocument> {
    const template = await this.Template.findById(input.templateId);
    if (!template) throw new TemplateNotFoundError(input.templateId);

    if (isQueryTarget(input.target)) {
      this.validateConditionsAgainstTemplate(input.target, template);
    } else {
      if (!input.target.identifiers || input.target.identifiers.length === 0) {
        throw new RuleTemplateIncompatibleError('target.identifiers must be a non-empty array for list mode');
      }
    }

    return this.Rule.createRule(input);
  }

  async update(id: string, input: UpdateRuleInput): Promise<RuleDocument | null> {
    const rule = await this.Rule.findById(id);
    if (!rule) return null;

    const templateId = input.templateId ?? rule.templateId.toString();
    const template = await this.Template.findById(templateId);
    if (!template) throw new TemplateNotFoundError(templateId);

    const effectiveTarget = (input.target ?? rule.target) as RuleTarget;

    if (isQueryTarget(effectiveTarget)) {
      this.validateConditionsAgainstTemplate(effectiveTarget, template);
    }

    const setFields = filterUpdateableFields(input as Record<string, unknown>, UPDATEABLE_FIELDS);
    return this.Rule.findByIdAndUpdate(id, { $set: setFields }, { new: true });
  }

  async delete(id: string): Promise<{ deleted: boolean; disabled?: boolean }> {
    const rule = await this.Rule.findById(id);
    if (!rule) return { deleted: false };
    if (rule.totalSent > 0) {
      rule.isActive = false;
      await rule.save();
      return { deleted: false, disabled: true };
    }
    await this.Rule.findByIdAndDelete(id);
    return { deleted: true };
  }

  async toggleActive(id: string): Promise<RuleDocument | null> {
    const rule = await this.Rule.findById(id);
    if (!rule) return null;
    if (!rule.isActive) {
      const template = await this.Template.findById(rule.templateId);
      if (!template) throw new TemplateNotFoundError(rule.templateId.toString());
      if (!template.isActive) throw new RuleTemplateIncompatibleError('Cannot activate rule: linked template is inactive');
    }
    rule.isActive = !rule.isActive;
    await rule.save();
    return rule;
  }

  async dryRun(id: string) {
    const rule = await this.Rule.findById(id);
    if (!rule) throw new RuleNotFoundError(id);

    const effectiveLimit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    const target = rule.target as unknown as RuleTarget;

    if (target.mode === 'list') {
      const identifiers = (target as any).identifiers || [];
      return {
        matchedCount: identifiers.length,
        effectiveLimit,
        willProcess: Math.min(identifiers.length, effectiveLimit),
        ruleId: id,
        sample: identifiers.slice(0, 10).map((id: string) => ({ contactValue: id })),
      };
    }

    const template = await this.Template.findById(rule.templateId);
    const { collectionSchema, activeJoins } = this.resolveCollectionContext(template);

    const users = await this.config.adapters.queryUsers(
      rule.target, 50000,
      collectionSchema ? { collectionSchema, activeJoins } : undefined
    );

    return {
      matchedCount: users.length,
      effectiveLimit,
      willProcess: Math.min(users.length, effectiveLimit),
      ruleId: id,
      sample: users.slice(0, 10).map((u: any) => ({
        contactValue: u.email || u.phone || u.userId || '',
        name: u.name || u.firstName || '',
        ...(u._id ? { id: String(u._id) } : {}),
      })),
    };
  }

  async previewConditions(body: { collectionName: string; joins?: string[]; conditions: any[] }) {
    const { collectionName, joins, conditions } = body;

    if (!this.config.collections?.length) {
      throw new RuleTemplateIncompatibleError('No collections configured');
    }

    const collection = this.config.collections.find(c => c.name === collectionName);
    if (!collection) {
      throw new RuleTemplateIncompatibleError(`Collection "${collectionName}" not found`);
    }

    if (joins?.length) {
      const joinErrors = validateJoinAliases(joins, collectionName, this.config.collections);
      if (joinErrors.length > 0) {
        throw new RuleTemplateIncompatibleError(`Invalid joins: ${joinErrors.join('; ')}`);
      }
    }

    const condErrors = validateConditions(conditions, collectionName, this.config.collections, joins);
    if (condErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(`Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`);
    }

    const activeJoins: JoinDefinition[] = collection.joins?.filter(j => joins?.includes(j.as)) ?? [];
    const target: QueryTarget = { mode: 'query', role: 'all', platform: 'all', conditions };

    const users = await this.config.adapters.queryUsers(
      target, 50000,
      { collectionSchema: collection, activeJoins }
    );

    return {
      matchedCount: users.length,
      sample: users.slice(0, 10).map((u: any) => ({
        contactValue: u.email || u.phone || u.userId || '',
        name: u.name || u.firstName || '',
        ...(u._id ? { id: String(u._id) } : {}),
      })),
    };
  }

  async clone(sourceId: string, newName?: string): Promise<any> {
    const source = await this.Rule.findById(sourceId);
    if (!source) throw new RuleNotFoundError(sourceId);
    const { _id, __v, createdAt, updatedAt, ...rest } = source.toObject() as any;
    rest.name = newName || `${rest.name} (copy)`;
    rest.isActive = false;
    rest.totalSent = 0;
    rest.totalSkipped = 0;
    rest.lastRunAt = undefined;
    rest.lastRunStats = undefined;
    return this.Rule.create(rest);
  }

  private validateConditionsAgainstTemplate(target: QueryTarget, template: TemplateDocument): void {
    const collectionName = template.collectionName;
    if (!collectionName || !this.config.collections?.length) return;

    const templateJoins = template.joins ?? [];
    const condErrors = validateConditions(
      target.conditions || [], collectionName, this.config.collections, templateJoins
    );
    if (condErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(
        `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
      );
    }
  }

  private resolveCollectionContext(template: TemplateDocument | null) {
    if (!template?.collectionName || !this.config.collections?.length) {
      return { collectionSchema: undefined, activeJoins: [] as JoinDefinition[] };
    }
    const collectionSchema = this.config.collections.find(c => c.name === template.collectionName);
    const joinAliases = template.joins ?? [];
    const activeJoins: JoinDefinition[] = collectionSchema?.joins?.filter(
      j => joinAliases.includes(j.as)
    ) ?? [];
    return { collectionSchema, activeJoins };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/core/src/services/rule.service.ts
git commit -m "feat(rule-engine): add rule service with template-based condition validation and preview"
```

---

## Task 12: Rule Runner Service

**Files:**
- Create: `packages/rule-engine/core/src/services/rule-runner.service.ts`
- Test: `packages/rule-engine/core/src/__tests__/rule-runner.service.spec.ts`

- [ ] **Step 1: Create rule-runner.service.ts**

Generalize from `packages/email/rule-engine/src/services/rule-runner.service.ts`. Key changes:
- Calls `adapters.send()` instead of `adapters.sendEmail()`
- Reads `collectionName` + `joins` from the linked template (not from rule target)
- Passes `{ collectionSchema, activeJoins }` to `queryUsers`
- Uses unified `RuleRunStats` (matched, sent, skipped, throttled, failed)
- Generic `contactValue` instead of `email`

This is the largest file (~700 lines). Copy the email runner and apply these transformations:
1. Replace all `sendEmail` → `send` in adapter calls
2. Replace `email` references → `contactValue` in user processing
3. Replace `emailType` → `ruleType`
4. Replace `skippedByThrottle` → `throttled`, `errorCount` → `failed` in stats
5. In `executeQueryMode()`: fetch template, read `template.collectionName` + `template.joins`, resolve collection schema + active joins, pass to `queryUsers`
6. Remove MJML-specific rendering — use `TemplateRenderService` for Handlebars only

- [ ] **Step 2: Write runner tests**

Based on `packages/email/rule-engine/src/__tests__/rule-runner.service.spec.ts`. Focus on:
- Lock acquisition and release
- Query mode: user matching, throttling, send via generic adapter
- List mode: identifier processing
- Template collection context: verifies `activeJoins` passed to `queryUsers`
- Send window enforcement
- Validity window (validFrom/validTill)
- Run cancellation via Redis
- Stats tracking

- [ ] **Step 3: Run tests**

Run: `cd packages/rule-engine/core && npx vitest run src/__tests__/rule-runner.service.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/core/src/services/rule-runner.service.ts packages/rule-engine/core/src/__tests__/rule-runner.service.spec.ts
git commit -m "feat(rule-engine): add generic rule runner service with template-based collection context"
```

---

## Task 13: Scheduler Service

**Files:**
- Create: `packages/rule-engine/core/src/services/scheduler.service.ts`

- [ ] **Step 1: Create scheduler.service.ts**

Copy from `packages/email/rule-engine/src/services/scheduler.service.ts`. Change queue name to be configurable (default: `'rule-engine-scheduler'`). Add `destroy()` method for cleanup.

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/core/src/services/scheduler.service.ts
git commit -m "feat(rule-engine): add BullMQ scheduler service"
```

---

## Task 14: Controllers

**Files:**
- Create: `packages/rule-engine/core/src/controllers/template.controller.ts`
- Create: `packages/rule-engine/core/src/controllers/rule.controller.ts`
- Create: `packages/rule-engine/core/src/controllers/runner.controller.ts`
- Create: `packages/rule-engine/core/src/controllers/settings.controller.ts`
- Create: `packages/rule-engine/core/src/controllers/send-log.controller.ts`

- [ ] **Step 1: Create all controllers**

Copy from respective email controllers. Key changes:
- `rule.controller.ts`: add `previewConditions` handler for `POST /rules/preview-conditions`
- All list endpoints: accept optional `?platform=` query param for filtering
- Generic naming: `sendEmail` → `send`, `emailType` → `ruleType`
- `template.controller.ts`: no MJML rendering in preview — returns Handlebars-rendered body

The `previewConditions` handler in `rule.controller.ts`:
```typescript
async previewConditions(req: Request, res: Response) {
  try {
    const result = await ruleService.previewConditions(req.body);
    res.json(result);
  } catch (err) {
    const status = getErrorStatus(err);
    res.status(status).json({ error: (err as Error).message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/core/src/controllers/
git commit -m "feat(rule-engine): add controllers with preview-conditions and platform filtering"
```

---

## Task 15: Routes + Factory + Index

**Files:**
- Create: `packages/rule-engine/core/src/routes/index.ts`
- Create: `packages/rule-engine/core/src/index.ts`

- [ ] **Step 1: Create routes/index.ts**

Based on `packages/email/rule-engine/src/routes/index.ts`. Add the new route:

```typescript
ruleRouter.post('/preview-conditions', ruleCtrl.previewConditions);
```

Full route structure matches the spec's Routes section.

- [ ] **Step 2: Create index.ts — the factory**

```typescript
import type { RuleEngineConfig } from './types/config.types';
import type { Router } from 'express';
import { createTemplateSchema, type TemplateModel } from './schemas/template.schema';
import { createRuleSchema, type RuleModel } from './schemas/rule.schema';
import { createSendLogSchema, type SendLogModel } from './schemas/send-log.schema';
import { createRunLogSchema, type RunLogModel } from './schemas/run-log.schema';
import { createErrorLogSchema, type ErrorLogModel } from './schemas/error-log.schema';
import { createThrottleConfigSchema, type ThrottleConfigModel } from './schemas/throttle-config.schema';
import { TemplateService } from './services/template.service';
import { RuleService } from './services/rule.service';
import { RuleRunnerService } from './services/rule-runner.service';
import { createRoutes } from './routes';
import { validateConfig } from './validation/config.validator';

export interface RuleEngine {
  routes: Router;
  services: {
    template: TemplateService;
    rule: RuleService;
    runner: RuleRunnerService;
  };
  models: {
    Template: TemplateModel;
    Rule: RuleModel;
    SendLog: SendLogModel;
    RunLog: RunLogModel;
    ErrorLog: ErrorLogModel;
    ThrottleConfig: ThrottleConfigModel;
  };
  destroy: () => Promise<void>;
}

export function createRuleEngine(config: RuleEngineConfig): RuleEngine {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';

  const Template = conn.model<any>(
    `${prefix}Template`,
    createTemplateSchema(config.platforms, config.audiences, config.categories, prefix)
  ) as TemplateModel;

  const Rule = conn.model<any>(
    `${prefix}Rule`,
    createRuleSchema(config.platforms, config.audiences, prefix)
  ) as RuleModel;

  const SendLog = conn.model<any>(
    `${prefix}SendLog`,
    createSendLogSchema(prefix)
  ) as SendLogModel;

  const RunLog = conn.model<any>(
    `${prefix}RunLog`,
    createRunLogSchema(prefix)
  ) as RunLogModel;

  const ErrorLog = conn.model<any>(
    `${prefix}ErrorLog`,
    createErrorLogSchema(prefix)
  ) as ErrorLogModel;

  const ThrottleConfig = conn.model<any>(
    `${prefix}ThrottleConfig`,
    createThrottleConfigSchema(prefix)
  ) as ThrottleConfigModel;

  const templateService = new TemplateService(Template, config, Rule);
  const ruleService = new RuleService(Rule, Template, RunLog, config);
  const runnerService = new RuleRunnerService(
    Rule, Template, SendLog, RunLog, ErrorLog, ThrottleConfig, config
  );

  const routes = createRoutes({
    templateService,
    ruleService,
    runnerService,
    RunLog,
    SendLog,
    ThrottleConfig,
    platformValues: config.platforms,
    categoryValues: config.categories,
    audienceValues: config.audiences,
    logger: config.logger,
    collections: config.collections || [],
  });

  return {
    routes,
    services: { template: templateService, rule: ruleService, runner: runnerService },
    models: { Template, Rule, SendLog, RunLog, ErrorLog, ThrottleConfig },
    destroy: async () => {
      // Cleanup scheduler if running
    },
  };
}

// Re-export everything
export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.validator';
export { validateConditions, validateJoinAliases, type ConditionValidationError } from './validation/condition.validator';
export { flattenFields } from './controllers/collection.controller';
export { buildAggregationPipeline, type PipelineBuilderOptions } from './utils/pipeline-builder';
export * from './schemas';
export { TemplateRenderService } from './services/template-render.service';
export { TemplateService } from './services/template.service';
export { RuleService } from './services/rule.service';
export { RuleRunnerService } from './services/rule-runner.service';
export { SchedulerService } from './services/scheduler.service';
export { RedisLock } from '@astralibx/core';
```

- [ ] **Step 3: Verify build**

Run: `cd packages/rule-engine/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/core/src/routes/ packages/rule-engine/core/src/index.ts
git commit -m "feat(rule-engine): add routes, factory function, and package exports"
```

---

## Task 16: Integration Tests

**Files:**
- Test: `packages/rule-engine/core/src/__tests__/integration.spec.ts`

- [ ] **Step 1: Write integration tests**

Based on `packages/email/rule-engine/src/__tests__/integration.spec.ts`. Uses `MongoMemoryServer` and mock Redis. Test:

1. **Template CRUD** — create with collectionName + joins, update, delete, toggle, clone
2. **Template collection validation** — reject invalid collectionName, reject invalid join aliases
3. **Rule CRUD** — create with conditions validated against template's collection, update, delete, toggle, clone
4. **Rule condition validation** — reject conditions referencing fields not in template's collection + active joins
5. **Preview conditions** — `POST /rules/preview-conditions` returns matched count + sample
6. **Dry run** — passes activeJoins to queryUsers
7. **Full send pipeline** — query users → render → send via generic adapter → log
8. **Collection endpoints** — `GET /collections` returns join details, `GET /collections/:name/fields?joins=` filters correctly
9. **Platform filtering** — templates and rules filter by `?platform=`
10. **Throttle enforcement** — maxPerUserPerDay limit

- [ ] **Step 2: Run all tests**

Run: `cd packages/rule-engine/core && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/rule-engine/core/src/__tests__/integration.spec.ts
git commit -m "feat(rule-engine): add comprehensive integration tests"
```

---

## Task 17: Build Verification

- [ ] **Step 1: Run full test suite**

Run: `cd packages/rule-engine/core && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build the package**

Run: `cd packages/rule-engine/core && npx tsup`
Expected: Build succeeds, outputs to `dist/`

- [ ] **Step 3: Verify exports**

Run: `node -e "const m = require('./packages/rule-engine/core/dist/index.cjs'); console.log(typeof m.createRuleEngine, typeof m.buildAggregationPipeline, typeof m.validateConditions)"`
Expected: `function function function`

- [ ] **Step 4: Final commit**

```bash
git add -A packages/rule-engine/core/
git commit -m "feat(rule-engine): @astralibx/rule-engine core package complete"
```

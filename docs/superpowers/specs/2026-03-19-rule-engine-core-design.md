# @astralibx/rule-engine — Core Package Design

**Issue:** #72 (expanded scope) — Extract platform-agnostic rule engine core
**Date:** 2026-03-19
**Status:** Design
**Sub-project:** 1 of 3 (core backend only; UI and email refactor are separate)

---

## Problem

The email and telegram rule engines share ~70-80% identical code: rule CRUD, template CRUD, runner orchestration, throttling, distributed locking, Handlebars rendering, scheduling, and condition validation. This duplication means:

- Bug fixes must be applied in multiple places
- New features (collection schemas, join support, condition preview) must be built twice
- Adding a new platform (WhatsApp) requires copying the entire engine again

Additionally, the collection/join system (issue #72) needs to be built. Templates should own the data source (collection + joins) since they define what data is available, while rules define targeting conditions on that data.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Package location | `packages/rule-engine/core/` as `@astralibx/rule-engine` |
| Collections/joins owned by | Templates |
| Storage | Shared collections with `platform` field (one `rules` table, one `templates` table) |
| Template rendering | Handlebars + shared helpers in core; MJML stays in email package |
| Runner send step | Generic `adapters.send(params)` — platform provides implementation |
| Pipeline builder | Exported utility + raw metadata passed to adapter |
| Condition preview | New `POST /rules/preview-conditions` endpoint (works before rule is saved) |
| Join definition | Developers in config; admins select from available joins on templates |
| Join chains | Flat only — all joins from primary collection |
| UI | Separate `@astralibx/rule-engine-ui` package (sub-project 2) |
| Breaking changes | None to worry about — nobody uses collection/join features yet |

---

## Architecture

### Package Structure

```
packages/rule-engine/core/
├── src/
│   ├── index.ts                    ← createRuleEngine() factory, all exports
│   ├── types/
│   │   ├── config.types.ts         ← RuleEngineConfig, adapters interface
│   │   ├── rule.types.ts           ← RuleCondition, QueryTarget, ListTarget, RuleTarget
│   │   ├── template.types.ts       ← Template with collectionName, joins, variables
│   │   ├── collection.types.ts     ← CollectionSchema, JoinDefinition, FieldDefinition
│   │   ├── run.types.ts            ← RunProgress, RunStatus, RuleRunStats
│   │   └── index.ts
│   ├── schemas/
│   │   ├── rule.schema.ts
│   │   ├── template.schema.ts
│   │   ├── send-log.schema.ts
│   │   ├── run-log.schema.ts
│   │   ├── error-log.schema.ts
│   │   ├── throttle-config.schema.ts
│   │   └── shared-schemas.ts
│   ├── services/
│   │   ├── rule.service.ts
│   │   ├── template.service.ts
│   │   ├── rule-runner.service.ts
│   │   ├── template-render.service.ts
│   │   └── scheduler.service.ts
│   ├── controllers/
│   │   ├── rule.controller.ts
│   │   ├── template.controller.ts
│   │   ├── runner.controller.ts
│   │   ├── collection.controller.ts
│   │   ├── settings.controller.ts
│   │   └── send-log.controller.ts
│   ├── validation/
│   │   ├── config.validator.ts
│   │   └── condition.validator.ts
│   ├── utils/
│   │   ├── pipeline-builder.ts
│   │   └── helpers.ts
│   ├── constants/
│   │   ├── index.ts
│   │   └── field-types.ts
│   ├── errors/
│   │   └── index.ts
│   ├── routes/
│   │   └── index.ts
│   └── __tests__/
│       ├── collection.spec.ts
│       ├── pipeline-builder.spec.ts
│       ├── condition-validator.spec.ts
│       ├── rule-runner.service.spec.ts
│       ├── template-render.service.spec.ts
│       ├── config-validation.spec.ts
│       └── integration.spec.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Dependency Graph

```
@astralibx/core (existing)
    ↑
@astralibx/rule-engine (this package)
    ↑                         ↑
@astralibx/rule-engine-ui    @astralibx/email-rule-engine
(sub-project 2)              (sub-project 3)
```

### Data Flow

```
Developer config                   Admin (Template Editor)              Admin (Rule Editor)                Execution
─────────────────                  ───────────────────────              ───────────────────                ─────────
RuleEngineConfig {          →   Template:                         →   Rule:                          →   Runner:
  collections: [{                1. Pick collection 'users'           1. Pick template                    1. Fetch rule + template
    name: 'users',               2. Enable join 'subscription' ✓      2. Conditions auto-load from       2. Read template.collectionName
    fields: [...],               3. Insert {{subscription.plan}}          template's collection              + template.joins
    joins: [{                    4. Save template                     3. Build conditions on             3. Resolve collectionSchema
      from: 'subscriptions',                                             subscription.status                + activeJoins
      as: 'subscription'         Template stores:                     4. Preview: 142 match              4. queryUsers(target, limit,
    }]                             collectionName: 'users'            5. Save rule                          { collectionSchema, activeJoins })
  }]                               joins: ['subscription']                                              5. send() per user
}
```

---

## Factory Function

```typescript
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';

interface RuleEngineConfig {
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
    sendWindow?: { startHour: number; endHour: number; timezone: string };
    delayBetweenSendsMs?: number;
    jitterMs?: number;
  };

  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string; runId: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number; templateId: string; runId: string }) => void;
    onSend?: (info: { ruleId: string; ruleName: string; contactValue: string; status: string; accountId: string; templateId: string; runId: string; subjectIndex: number; bodyIndex: number; failureReason?: string }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats; templateId: string; runId: string }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[]; runId: string }) => void;
    beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
  };
}

// Usage:
const engine = createRuleEngine(config);

engine.routes;                    // Express Router — mount on any path
engine.services.rule;             // RuleService
engine.services.template;         // TemplateService
engine.services.runner;           // RuleRunnerService
engine.models.Rule;               // Mongoose model
engine.models.Template;           // Mongoose model
engine.models.SendLog;            // Mongoose model
engine.models.RunLog;             // Mongoose model
engine.models.ErrorLog;           // Mongoose model
engine.models.ThrottleConfig;     // Mongoose model
engine.destroy();                 // Cleanup scheduler worker, close connections
```

---

## Adapters Interface

```typescript
interface SendParams {
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

interface AgentSelection {
  accountId: string;
  contactValue: string;   // generic: email address, phone number, telegram userId, etc.
  metadata: Record<string, unknown>;
}

interface RecipientIdentifier {
  id: string;
  contactId: string;
}

interface RuleEngineAdapters {
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
```

---

## Template Type

```typescript
interface Template {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  version: number;

  // Content — platform-agnostic
  // Email: subjects[0] = main subject, bodies[0] = MJML/HTML body
  // Telegram: subjects unused, bodies[0] = message text
  // A/B variants: subjects[0..N], bodies[0..N]
  subjects: string[];
  bodies: string[];
  preheaders?: string[];          // email-specific, ignored by other platforms
  textBody?: string;              // plain text fallback
  fields: Record<string, string>; // static template fields
  variables: string[];            // declared variables

  // Data source ownership
  collectionName?: string;
  joins?: string[];

  // Attachments / media — generic
  // Email: { filename, url, contentType }
  // Telegram: { filename, url, contentType } with contentType indicating media type
  attachments?: Array<{ filename: string; url: string; contentType: string }>;

  // Platform-specific extras
  metadata?: Record<string, unknown>;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Platform mapping:**
- **Email:** uses `subjects`, `bodies` (MJML), `preheaders`, `textBody`, `attachments`
- **Telegram:** uses `bodies` (plain text messages), `attachments` (media), ignores `subjects`/`preheaders`
- **WhatsApp:** uses `bodies` (message templates), `metadata` (buttons, quick replies)

`bodies` is the universal content field. Each platform interprets it according to its own rendering pipeline.

**Template owns the data source.** When a template has `collectionName` + `joins`:
- Variable picker shows fields from that collection + active joins
- Rules linked to this template inherit the collection context for condition building
- Runner reads template's collection info when executing

**Templates without a collection** are valid — they just don't have field-based variable picking or condition validation.

---

## Rule Type

```typescript
interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

interface QueryTarget {
  mode: 'query';
  role: string;
  platform: string;
  conditions: RuleCondition[];
}

interface ListTarget {
  mode: 'list';
  identifiers: string[];
}

type RuleTarget = QueryTarget | ListTarget;

interface Rule {
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

  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };

  ruleType: string;          // 'automated' | 'transactional' — replaces email's emailType

  totalSent: number;
  totalSkipped: number;
  lastRunAt?: Date;
  lastRunStats?: RuleRunStats;

  createdAt: Date;
  updatedAt: Date;
}
```

**Key change:** `QueryTarget` no longer has `collectionName` or `joins`. These are read from the linked template at execution time.

### Run Stats Types

```typescript
interface RuleRunStats {
  matched: number;
  sent: number;
  skipped: number;
  throttled: number;
  failed: number;
}

interface PerRuleStats extends RuleRunStats {
  ruleId: string;
  ruleName: string;
}
```

This is a unified shape combining email's `skippedByThrottle`/`errorCount` and telegram's `throttled`/`failed` into a single consistent type.

---

## Collection Schema System

```typescript
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';

interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  fields?: FieldDefinition[];
}

interface JoinDefinition {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
}

interface CollectionSchema {
  name: string;
  label?: string;
  description?: string;
  identifierField?: string;
  fields: FieldDefinition[];
  joins?: JoinDefinition[];
}

interface FlattenedField {
  path: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}
```

These types are extracted from the current email-rule-engine. The `queryUsers` adapter context adds `activeJoins` — this is a new addition that adapter implementers must handle.

**Note for telegram adoption:** Telegram currently uses freeform `conditions: Record<string, unknown>` on its `QueryTarget`. The core standardizes on structured `RuleCondition[]`. Telegram consumers migrating to the core must update their `queryUsers` adapter to handle structured conditions. Collections are optional — telegram consumers can omit `collections` from config and everything works without field validation or join support.

---

## Collection Controller

```
GET /collections
```
Returns all registered collections with join details. Join `label` is derived from the joined collection's `label` field (falls back to `from` name if no label):
```json
{
  "collections": [
    {
      "name": "users",
      "label": "Users",
      "fieldCount": 5,
      "joinCount": 2,
      "joins": [
        { "alias": "subscription", "from": "subscriptions", "label": "Subscriptions" },
        { "alias": "lastPayment", "from": "payments", "label": "Payments" }
      ]
    }
  ]
}
```

```
GET /collections/:name/fields?joins=subscription,lastPayment
```
Returns flattened fields. Optional `joins` query param filters which joined fields are included. Without it, all joined fields are returned.

---

## Condition Preview Endpoint

```
POST /rules/preview-conditions
```

**Request:**
```json
{
  "collectionName": "users",
  "joins": ["subscription"],
  "conditions": [
    { "field": "subscription.status", "operator": "eq", "value": "active" }
  ]
}
```

**Response:**
```json
{
  "matchedCount": 142,
  "sample": [
    { "email": "john@example.com", "name": "John" },
    { "email": "jane@example.com", "name": "Jane" }
  ]
}
```

**Controller:** Handled by `rule.controller.ts` (it's a rule-related operation that uses the `queryUsers` adapter).

**Implementation:**
1. Validate `collectionName` exists in config
2. Validate `joins` aliases exist for that collection
3. Validate conditions against schema — only fields from the collection + active joins are valid
4. Resolve `activeJoins` from `JoinDefinition[]` (filter by provided join aliases)
5. Call `queryUsers({ mode: 'query', role: 'all', platform: 'all', conditions }, 50000, { collectionSchema, activeJoins })`
6. Return count + first 10 rows

---

## Pipeline Builder Utility

Exported for consumers who want auto-generated MongoDB aggregation pipelines:

```typescript
import { buildAggregationPipeline } from '@astralibx/rule-engine';

const pipeline = buildAggregationPipeline({
  joins: activeJoins,         // JoinDefinition[]
  conditions: target.conditions,
  limit: 500,
});

// Generates: $lookup → $unwind → $match ($and) → $limit
```

- Uses `$and` for conditions (handles same-field multiple conditions)
- `$unwind` with `preserveNullAndEmptyArrays: true` (left-outer-join)
- Escapes regex for `contains` operator
- Wraps non-array values in array for `in`/`not_in`

---

## Validation Flow

### Template Save
1. If `collectionName` is set, verify it exists in `config.collections`
2. If `joins` is set, verify each alias exists in the collection's `joins[]`
3. Save template

### Rule Create/Update
1. Verify linked template exists
2. If template has `collectionName`:
   - Resolve active joins from template's `joins` aliases
   - Validate rule conditions against template's collection + **only the template's active joins** (not all joins on the collection)
   - Field existence check — condition fields must exist in primary collection or active joined collections
   - Operator-type compatibility check
3. Validate target compatibility (role/platform match between rule and template)
4. Save rule

### Execution (Runner)
1. Fetch rule → fetch linked template
2. Read `template.collectionName` + `template.joins`
3. Resolve `collectionSchema` from `config.collections`
4. Filter `activeJoins` from schema based on `template.joins`
5. Call `queryUsers(rule.target, limit, { collectionSchema, activeJoins })`

---

## Template Render Service

Handlebars-only. Core provides shared helpers:

```
capitalize, lowercase, uppercase, eq, neq, not, gt, lt, gte, lte, join, pluralize
```

Platform packages extend with their own helpers (e.g. email adds `currency`, `formatDate`):

```typescript
const engine = createRuleEngine({
  // ...
});

// Email package adds MJML rendering on top:
engine.services.template.registerHelper('currency', (val) => /* INR format */);
```

Handlebars compilation uses `strict: false` by default (tolerates missing variables). Consumers can override per-call if needed.

The render service provides:
- `compile(template, options?)` — compile Handlebars template string
- `render(compiled, data)` — render with data
- `compileBatchVariants(subjects, bodies, preheaders?)` — compile A/B variants
- `extractVariables(templateStr)` — parse `{{variable}}` patterns
- `validateTemplate(templateStr)` — validate Handlebars syntax
- `registerHelper(name, fn)` — add custom helpers

---

## Routes

All endpoints support `?platform=email` query param for filtering.

```
Templates:
  GET    /templates                    — list (filterable by platform, audience, category)
  POST   /templates                    — create
  GET    /templates/:id                — get by ID
  PUT    /templates/:id                — update
  DELETE /templates/:id                — delete
  PATCH  /templates/:id/toggle         — toggle active
  POST   /templates/:id/preview        — preview rendered
  POST   /templates/:id/clone          — clone
  POST   /templates/:id/test-send      — test send via sendTest adapter

Rules:
  GET    /rules                        — list (filterable by platform)
  POST   /rules                        — create
  GET    /rules/:id                    — get by ID
  PATCH  /rules/:id                    — update
  DELETE /rules/:id                    — delete
  POST   /rules/:id/toggle             — toggle active
  POST   /rules/:id/dry-run            — dry run with full stats
  POST   /rules/:id/clone              — clone
  POST   /rules/preview-conditions     — NEW: preview conditions before save

Runner:
  POST   /runner                       — trigger manual run
  GET    /runner/status                — latest run status
  GET    /runner/status/:runId         — specific run status
  POST   /runner/cancel/:runId         — cancel run
  GET    /runner/logs                  — run history

Collections:
  GET    /collections                  — list registered collections
  GET    /collections/:name/fields     — flattened fields (with optional ?joins= filter)

Settings:
  GET    /throttle                     — get throttle config
  PUT    /throttle                     — update throttle + send window

Sends:
  GET    /sends                        — send log
```

---

## Shared MongoDB Collections

```
{prefix}rules              — platform field distinguishes email/telegram/etc
{prefix}templates          — platform field distinguishes
{prefix}send_logs          — all platform sends in one collection
{prefix}run_logs           — all platform runs in one collection
{prefix}error_logs         — error tracking (extracted from telegram's ErrorLog)
{prefix}throttle_config    — single config document (or per-platform)
```

---

## UX Notes

**Collection selection on templates is optional.** Not every template needs database-driven variables. Some templates are static announcements. The flow:

1. **No collections configured by developer** → manual variable typing (legacy behavior)
2. **Collections configured, admin picks one** → variable picker shows guided fields, join checklist appears
3. **Collections configured, admin picks none** → valid template, no field-based variables

When collections ARE configured, the collection dropdown shows placeholder: *"Select a collection to enable field-based variables"*.

---

## Edge Cases

**Stale join aliases:** If a developer removes a join from config after templates were saved with that join alias, the template still has the alias in `joins`. On next save, validation rejects it. On execution, the runner filters `activeJoins` from current config — stale aliases are silently ignored.

**One-to-many cardinality:** The pipeline builder's `$unwind` with `preserveNullAndEmptyArrays: true` produces a left-outer-join. If a joined collection has multiple matching docs, `$unwind` duplicates the primary document. Consumers who need first/latest match should handle this in their adapter.

**Template without collection + rule with conditions:** Valid. Conditions are passed to `queryUsers` as raw data. No field validation occurs. The adapter must handle unvalidated conditions.

**Cross-platform template reuse:** A template with `platform: 'all'` could be used by email and telegram rules. The `send` adapter handles the rendering differences.

---

## Breaking Changes from Current Email Engine

This is a new package — no breaking changes to existing code. The email-rule-engine refactor (sub-project 3) will handle migration:

- `createEmailRuleEngine()` becomes a thin wrapper over `createRuleEngine()`
- `sendEmail` adapter maps to generic `send`
- `collectionName` moves from rules to templates
- `email_rules` → shared `rules` collection (migration script)

---

## Files Created

| File | Purpose |
|------|---------|
| `packages/rule-engine/core/package.json` | Package config |
| `packages/rule-engine/core/tsconfig.json` | TypeScript config |
| `packages/rule-engine/core/tsup.config.ts` | Build config |
| `packages/rule-engine/core/src/index.ts` | Factory + exports |
| `packages/rule-engine/core/src/types/*.ts` | All type definitions |
| `packages/rule-engine/core/src/schemas/*.ts` | Mongoose schemas |
| `packages/rule-engine/core/src/services/*.ts` | Business logic services |
| `packages/rule-engine/core/src/controllers/*.ts` | Express route handlers |
| `packages/rule-engine/core/src/validation/*.ts` | Config + condition validation |
| `packages/rule-engine/core/src/utils/pipeline-builder.ts` | Aggregation pipeline builder |
| `packages/rule-engine/core/src/utils/helpers.ts` | Shared utilities |
| `packages/rule-engine/core/src/constants/*.ts` | Enums + field type operators |
| `packages/rule-engine/core/src/errors/index.ts` | Error classes |
| `packages/rule-engine/core/src/routes/index.ts` | Express router setup |
| `packages/rule-engine/core/src/__tests__/*.ts` | Test files |

## Files Modified

None — this is a new package. Existing email/telegram packages are unchanged until sub-project 3.

---

## Verification

1. `npx vitest run` — all tests pass
2. `npx tsup` — builds successfully
3. `createRuleEngine()` with mock adapters — engine starts, routes mount
4. CRUD operations on templates (with collection + joins) work
5. CRUD operations on rules (conditions validated against template's collection) work
6. `POST /rules/preview-conditions` returns matched count + sample
7. Runner executes with `activeJoins` passed to `queryUsers`
8. `buildAggregationPipeline()` generates correct pipeline
9. Platform filtering via `?platform=email` works on all list endpoints

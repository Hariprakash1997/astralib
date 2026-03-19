# Multi-Collection Targeting with Join Support

**Issue:** #72 — email-rule-engine: multi-collection targeting with join support for queryUsers
**Date:** 2026-03-19
**Status:** Design

---

## Problem

Rules target a single `collectionName`. The collection schema system supports `JoinDefinition` in developer config and the condition validator + collection controller already flatten joined fields — but:

1. **Joins are invisible to admins** — no UI to see or select which joins a rule needs
2. **All joins activate implicitly** — `getFields` and `validateConditions` include ALL joins for a collection, even when a rule only needs one
3. **No `joins` field on the rule** — the `queryUsers` adapter receives the full `CollectionSchema` but can't tell which joins the admin actually selected
4. **No aggregation pipeline helper** — consumers write `$lookup` logic from scratch every time
5. **Template variables from joined collections work** but there's no connection between join selection and variable availability

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Who defines joins? | Developers register in config; admins select from available joins |
| Join selection per rule | Admin picks which joins to include via checklist |
| Field display | Prefixed with join alias (e.g. `subscription.status`), grouped by section |
| Join storage | Explicit `joins: string[]` on `rule.target` (stores join aliases) |
| Pipeline builder | Library exports utility + passes raw metadata to adapter |
| Join chains | Flat only — all joins from primary collection (no A→B→C) |

---

## Architecture

### Data Flow

```
Developer config                   Admin UI                          Execution
─────────────────                  ────────                          ─────────
CollectionSchema {          →   Rule Editor:                    →   queryUsers adapter receives:
  name: 'users',                 1. Pick collection 'users'         - rule.target (with joins[])
  fields: [...],                 2. See available joins              - context.collectionSchema
  joins: [                       3. Check "subscription" ✓           - context.activeJoins[]
    { from: 'subscriptions',     4. Build conditions on              - context.pipelineBuilder()
      localField: '_id',            subscription.status
      foreignField: 'userId',   5. Insert {{subscription.plan}}
      as: 'subscription' },        in template
    { from: 'payments', ... }
  ]
}
```

### Changes by Layer

**Backend types** → **Mongoose schema** → **Validation** → **API endpoints** → **Services** → **Pipeline builder** → **UI types** → **UI components**

---

## Phase 1: Backend — Types & Schema

### 1.1 Add `joins` to `QueryTarget`

**File:** `packages/email/rule-engine/src/types/rule.types.ts`

```typescript
export interface QueryTarget {
  mode: 'query';
  role: string;
  platform: string;
  conditions: RuleCondition[];
  collectionName?: string;
  joins?: string[];  // NEW — join aliases selected by admin (e.g. ['subscription', 'lastPayment'])
}
```

### 1.2 Extend `queryUsers` adapter context

**File:** `packages/email/rule-engine/src/types/config.types.ts`

```typescript
import type { JoinDefinition } from './collection.types';

// Adapter context — extended
queryUsers: (
  target: RuleTarget,
  limit: number,
  context?: {
    collectionSchema?: CollectionSchema;
    activeJoins?: JoinDefinition[];  // NEW — only the joins the rule selected
  }
) => Promise<Record<string, unknown>[]>;
```

### 1.3 Add `joins` to Mongoose rule schema

**File:** `packages/email/rule-engine/src/schemas/rule.schema.ts`

Add to `RuleTargetSchema`:
```typescript
joins: [{ type: String }]  // stores join alias strings
```

### 1.4 Add `JoinSummary` to collection list response

**File:** `packages/email/rule-engine/src/controllers/collection.controller.ts`

The `list` endpoint already returns `joinCount`. Extend it to include join details so the UI can render the checklist:

```typescript
list(_req: Request, res: Response) {
  const summary = collections.map(c => ({
    name: c.name,
    label: c.label,
    description: c.description,
    identifierField: c.identifierField,
    fieldCount: c.fields.length,
    joinCount: c.joins?.length ?? 0,           // KEEP existing field
    joins: (c.joins ?? []).map(j => ({         // NEW — join details for UI checklist
      alias: j.as,
      from: j.from,
      label: collections.find(x => x.name === j.from)?.label ?? j.from,
    })),
  }));
  res.json({ collections: summary });
}
```

### 1.5 Update `getFields` to accept optional `joins` query param

**File:** `packages/email/rule-engine/src/controllers/collection.controller.ts`

Currently `getFields` includes ALL joins. Change to filter by selected joins:

```typescript
getFields(req: Request, res: Response) {
  const { name } = req.params;
  const collection = collections.find(c => c.name === name);
  if (!collection) { res.status(404).json({ error: `...` }); return; }

  const fields = flattenFields(collection.fields);

  // NEW: filter joins by query param
  const requestedJoins = req.query.joins
    ? (req.query.joins as string).split(',')
    : undefined;

  if (collection.joins?.length) {
    for (const join of collection.joins) {
      // If joins param provided, only include requested ones; otherwise include all
      if (requestedJoins && !requestedJoins.includes(join.as)) continue;
      const joinedCollection = collections.find(c => c.name === join.from);
      if (joinedCollection) {
        fields.push(...flattenFields(joinedCollection.fields, join.as));
      }
    }
  }

  res.json({
    name: collection.name,
    label: collection.label,
    identifierField: collection.identifierField,
    fields,
    typeOperators: TYPE_OPERATORS,
  });
}
```

**Backward compatible:** omitting `joins` param returns all fields (current behavior).

---

## Phase 2: Backend — Validation & Services

### 2.1 Update condition validator to respect active joins

**File:** `packages/email/rule-engine/src/validation/condition.validator.ts`

```typescript
export function validateConditions(
  conditions: RuleCondition[],
  collectionName: string | undefined,
  collections: CollectionSchema[],
  activeJoinAliases?: string[]  // NEW — optional, filters which joins to validate against
): ConditionValidationError[] {
  // ... existing lookup ...

  if (collection.joins?.length) {
    for (const join of collection.joins) {
      // If activeJoinAliases provided, only include selected joins
      if (activeJoinAliases && !activeJoinAliases.includes(join.as)) continue;
      const joinedCollection = collections.find(c => c.name === join.from);
      if (joinedCollection) {
        flatFields.push(...flattenFields(joinedCollection.fields, join.as));
      }
    }
  }

  // ... rest unchanged ...
}
```

### 2.2 Validate join aliases exist

**File:** `packages/email/rule-engine/src/validation/condition.validator.ts`

New function:
```typescript
export function validateJoinAliases(
  joinAliases: string[],
  collectionName: string,
  collections: CollectionSchema[]
): string[] {
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

### 2.3 Update RuleService to validate joins and pass activeJoins

**File:** `packages/email/rule-engine/src/services/rule.service.ts`

In `create()` and `update()`, after existing collectionName validation:

```typescript
// Validate join aliases
if (qt.joins?.length && qt.collectionName && this.config.collections?.length) {
  const joinErrors = validateJoinAliases(qt.joins, qt.collectionName, this.config.collections);
  if (joinErrors.length > 0) {
    throw new RuleTemplateIncompatibleError(`Invalid joins: ${joinErrors.join('; ')}`);
  }
}

// Pass activeJoinAliases to condition validation
const condErrors = validateConditions(
  qt.conditions, qt.collectionName, this.config.collections, qt.joins
);
```

### 2.4 Update RuleRunnerService to pass activeJoins

**File:** `packages/email/rule-engine/src/services/rule-runner.service.ts`

In `executeQueryMode()` (line ~612-617):

```typescript
const collectionName = rule.target?.collectionName;
const collectionSchema = collectionName
  ? this.config.collections?.find((c: any) => c.name === collectionName)
  : undefined;

// NEW: resolve active joins from rule target
const joinAliases: string[] = rule.target?.joins ?? [];
const activeJoins = collectionSchema?.joins?.filter(
  (j: JoinDefinition) => joinAliases.includes(j.as)
) ?? [];

users = await this.config.adapters.queryUsers(
  rule.target, limit,
  collectionSchema ? { collectionSchema, activeJoins } : undefined  // NEW: activeJoins
);
```

Apply the same pattern in `dryRun()` in RuleService (lines 224-229):

```typescript
const queryTarget = rule.target as unknown as QueryTarget;
const collectionName = queryTarget.collectionName;
const collectionSchema = collectionName
  ? this.config.collections?.find(c => c.name === collectionName)
  : undefined;

// NEW: resolve active joins
const joinAliases: string[] = queryTarget.joins ?? [];
const activeJoins = collectionSchema?.joins?.filter(
  (j: JoinDefinition) => joinAliases.includes(j.as)
) ?? [];

const users = await this.config.adapters.queryUsers(
  rule.target, 50000,
  collectionSchema ? { collectionSchema, activeJoins } : undefined
);
```

---

## Phase 3: Pipeline Builder Utility

### 3.1 New file: `packages/email/rule-engine/src/utils/pipeline-builder.ts`

Exported utility that converts joins + conditions into a MongoDB aggregation pipeline:

```typescript
import type { JoinDefinition } from '../types/collection.types';
import type { RuleCondition } from '../types/rule.types';

export interface PipelineBuilderOptions {
  joins: JoinDefinition[];
  conditions: RuleCondition[];
  limit?: number;
}

export function buildAggregationPipeline(options: PipelineBuilderOptions): object[] {
  const pipeline: object[] = [];

  // 1. Add $lookup stages for each active join
  for (const join of options.joins) {
    pipeline.push({
      $lookup: {
        from: join.from,
        localField: join.localField,
        foreignField: join.foreignField,
        as: join.as,
      },
    });

    // $unwind with preserveNullAndEmptyArrays so non-matching docs aren't dropped
    pipeline.push({
      $unwind: {
        path: `$${join.as}`,
        preserveNullAndEmptyArrays: true,
      },
    });
  }

  // 2. Build $match from conditions (use $and to handle multiple conditions on same field)
  if (options.conditions.length > 0) {
    pipeline.push({
      $match: {
        $and: options.conditions.map(cond => ({
          [cond.field]: buildOperatorExpression(cond.operator, cond.value),
        })),
      },
    });
  }

  // 3. Apply limit
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }

  return pipeline;
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
```

### 3.2 Export from package index

**File:** `packages/email/rule-engine/src/index.ts`

```typescript
export { buildAggregationPipeline } from './utils/pipeline-builder';
export type { PipelineBuilderOptions } from './utils/pipeline-builder';
```

---

## Phase 4: UI — Rule Editor Join Selection

### 4.1 Extend UI types

**File:** `packages/email/ui/src/components/rules/alx-rule-editor.types.ts`

```typescript
// NEW
export interface JoinOption {
  alias: string;
  from: string;
  label: string;
}

// Updated CollectionSummary
export interface CollectionSummary {
  name: string;
  label?: string;
  description?: string;
  fieldCount: number;
  joins: JoinOption[];  // NEW
}

// Updated RuleData
export interface RuleData {
  // ... existing fields ...
  joins: string[];  // NEW — selected join aliases
  // ...
}

// Updated EMPTY_RULE
export const EMPTY_RULE: RuleData = {
  // ... existing fields ...
  joins: [],  // NEW
  // ...
};
```

### 4.2 Add join selection UI to rule editor

**File:** `packages/email/ui/src/components/rules/alx-rule-editor.ts`

After the collection name dropdown, add a join checklist section:

**New state:**
```typescript
@state() private _availableJoins: JoinOption[] = [];
```

**When collection changes** (in existing `_loadCollectionFields`):
```typescript
private async _loadCollectionFields(collectionName: string): Promise<void> {
  if (!collectionName) {
    this._collectionFields = [];
    this._availableJoins = [];
    return;
  }

  // Use already-loaded collections list (fetched in connectedCallback)
  const col = this._collections.find((c: any) => c.name === collectionName);
  this._availableJoins = col?.joins ?? [];

  // Reset selected joins when collection changes
  this._form = { ...this._form, joins: [] };

  // Fetch fields (without joins initially)
  await this._refreshFields();
}
```

**Update `getCollectionFields` API method to accept joins param:**

**File:** `packages/email/ui/src/api/rule.api.ts`

```typescript
getCollectionFields(name: string, joins?: string[]): Promise<any> {
  const params = joins?.length ? `?joins=${joins.join(',')}` : '';
  return this.http.get(`/collections/${name}/fields${params}`);
}
```

**New method — refresh fields based on selected joins:**
```typescript
private async _refreshFields(): Promise<void> {
  const joins = this._form.joins.length > 0 ? this._form.joins : undefined;
  const res = await this._api.getCollectionFields(this._form.collectionName, joins);
  this._collectionFields = res.fields ?? [];
}
```

**New method — toggle join:**
```typescript
private _toggleJoin(alias: string): void {
  const joins = this._form.joins.includes(alias)
    ? this._form.joins.filter(j => j !== alias)
    : [...this._form.joins, alias];
  this._form = { ...this._form, joins };
  this._refreshFields();  // re-fetch fields with updated joins
}
```

**Render — join checklist (in the target section, after collection dropdown):**
```html
${this._availableJoins.length > 0 ? html`
  <div class="join-section">
    <label>Include Related Collections</label>
    <div class="join-options">
      ${this._availableJoins.map(j => html`
        <label class="join-option">
          <input type="checkbox"
            .checked=${this._form.joins.includes(j.alias)}
            @change=${() => this._toggleJoin(j.alias)}
          />
          <span class="join-label">${j.label}</span>
          <span class="join-alias">(${j.alias})</span>
        </label>
      `)}
    </div>
  </div>
` : nothing}
```

### 4.3 Update field dropdown grouping

**File:** `packages/email/ui/src/components/rules/alx-rule-editor.ts`

In the condition builder field dropdown, group fields by source:

```html
<select @change=${...}>
  <option value="">Select field...</option>
  <!-- Primary collection fields (no prefix) -->
  <optgroup label="${this._form.collectionName}">
    ${primaryFields.map(f => html`
      <option value="${f.path}">${f.label || f.path} (${f.type})</option>
    `)}
  </optgroup>
  <!-- Joined collection fields (prefixed) -->
  ${this._form.joins.map(alias => html`
    <optgroup label="${this._availableJoins.find(j => j.alias === alias)?.label || alias}">
      ${this._collectionFields.filter(f => f.path.startsWith(alias + '.')).map(f => html`
        <option value="${f.path}">${f.label || f.path.replace(alias + '.', '')} (${f.type})</option>
      `)}
    </optgroup>
  `)}
</select>
```

### 4.4 Update template variable picker

**File:** `packages/email/ui/src/components/rules/alx-template-editor.ts`

The template editor is a standalone component (not rendered inline by the rule editor). It already has a variable picker that calls `getCollectionFields(name)`. Since the template editor doesn't know about rule-level join selections, it will continue to show all available fields (current behavior — `getFields` without `joins` param returns all fields).

**No change needed here.** The variable picker already works because:
- Without `joins` param, the backend returns all joined fields (backward compatible)
- Templates are edited independently from rules
- The admin sees all possible fields when building templates, which is correct — a template may be used by multiple rules with different join selections

> **Note:** If we later want template-level join awareness, the template editor could accept an optional `collectionName` + `joins` property. This is a future enhancement, not needed for this feature.

### 4.5 Update API payload serialization

**File:** `packages/email/ui/src/components/rules/alx-rule-editor.ts`

In the `_save()` method, include `joins` in the target payload:

```typescript
const payload = {
  // ...existing fields...
  target: {
    mode: this._form.targetMode,
    role: this._form.audience,
    platform: this._form.platform,
    collectionName: this._form.collectionName || undefined,
    joins: this._form.joins.length > 0 ? this._form.joins : undefined,  // NEW
    conditions: this._form.target.conditions,
  },
  // ...
};
```

### 4.6 Update rule data deserialization

When loading a rule for editing, populate `joins` from the target:

```typescript
// In _loadRule or wherever rule data is mapped to form
this._form = {
  // ...existing mapping...
  joins: rule.target?.joins ?? [],
};
```

---

## Phase 5: Styles

**File:** `packages/email/ui/src/components/rules/alx-rule-editor.styles.ts`

```css
.join-section {
  margin-top: 12px;
}

.join-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.join-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.join-option:has(input:checked) {
  border-color: var(--primary-color, #4f46e5);
  background: var(--primary-bg, #eef2ff);
}

.join-alias {
  color: var(--text-muted, #6b7280);
  font-size: 11px;
}
```

---

## Files Modified

| File | Package | Change |
|------|---------|--------|
| `rule-engine/src/types/rule.types.ts` | rule-engine | Add `joins?: string[]` to QueryTarget |
| `rule-engine/src/types/config.types.ts` | rule-engine | Add `activeJoins` to queryUsers context |
| `rule-engine/src/schemas/rule.schema.ts` | rule-engine | Add `joins` to RuleTargetSchema |
| `rule-engine/src/controllers/collection.controller.ts` | rule-engine | Return join details in list, filter fields by joins param |
| `rule-engine/src/validation/condition.validator.ts` | rule-engine | Accept activeJoinAliases, add validateJoinAliases |
| `rule-engine/src/services/rule.service.ts` | rule-engine | Validate joins, pass activeJoins to queryUsers |
| `rule-engine/src/services/rule-runner.service.ts` | rule-engine | Resolve and pass activeJoins to queryUsers |
| `rule-engine/src/index.ts` | rule-engine | Export buildAggregationPipeline |
| `ui/src/components/rules/alx-rule-editor.types.ts` | ui | Add JoinOption, update RuleData/EMPTY_RULE |
| `ui/src/components/rules/alx-rule-editor.ts` | ui | Join checklist, grouped field dropdowns |
| `ui/src/components/rules/alx-rule-editor.styles.ts` | ui | Join checklist styles |
| `ui/src/api/rule.api.ts` | ui | Add optional joins param to getCollectionFields |

## Files Created

| File | Package | Purpose |
|------|---------|---------|
| `rule-engine/src/utils/pipeline-builder.ts` | rule-engine | Aggregation pipeline builder utility |

---

## UX Notes

**Collection selection is optional.** Not every rule needs database-driven conditions. Some rules blast emails without personalization (e.g. announcements). The flow:

1. **No collections configured by developer** → free-text field input (legacy behavior)
2. **Collections configured, admin picks one** → dropdown fields, joins checklist, full schema guidance
3. **Collections configured, admin picks none** → valid rule, no conditions/personalization needed

When collections ARE configured, the collection dropdown should show placeholder text: *"Select a collection to enable field-based conditions"* so non-tech admins understand the purpose without needing technical context.

---

## Edge Cases

**Stale join aliases:** If a developer removes a join from config after rules were saved with that join alias, the rule will still have the alias in `target.joins`. On next save, `validateJoinAliases` will reject it. On execution, the runner filters `activeJoins` from the current config — stale aliases are silently ignored (no crash, just no $lookup for the removed join).

**One-to-many cardinality:** The pipeline builder's `$unwind` with `preserveNullAndEmptyArrays: true` produces a left-outer-join. If a joined collection has multiple matching docs (e.g. multiple payments per user), `$unwind` duplicates the primary document. This is standard MongoDB behavior. Consumers who need only the first/latest match should add `$sort` + `$group` in their own adapter or use `$lookup` pipeline syntax instead of the utility.

---

## Breaking Changes: NONE

- `joins` is optional on `QueryTarget` — existing rules without joins work unchanged
- `activeJoins` is optional in queryUsers context — existing adapter implementations unaffected
- `getFields` without `joins` param returns all fields (current behavior preserved)
- Pipeline builder is a new export — no existing code affected
- Template editor unchanged — continues showing all fields (no joins filtering)

---

## Verification

1. `npx vitest run` — all existing + new tests pass
2. Create rule with collection + joins selected → `target.joins` saved to DB
3. Condition builder shows fields grouped by primary + selected joins
4. Template variable picker shows joined fields when joins are active
5. `queryUsers` adapter receives `activeJoins` in context
6. `buildAggregationPipeline()` generates correct `$lookup` + `$match` stages
7. Rule without joins selected → behaves exactly as before (backward compat)
8. Dry run with joins → passes activeJoins to adapter

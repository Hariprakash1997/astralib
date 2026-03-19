# Multi-Collection Join Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to select pre-defined joins per rule, see joined fields in condition builder/variable picker, and provide a pipeline builder utility for consumers.

**Architecture:** Developers register `CollectionSchema` with `JoinDefinition[]` in config. Rules store selected join aliases in `target.joins: string[]`. The `queryUsers` adapter receives `activeJoins: JoinDefinition[]` in context. A `buildAggregationPipeline()` utility is exported for consumers who want auto-generated `$lookup` + `$match` pipelines.

**Tech Stack:** TypeScript, Mongoose, Express, Lit (web components), Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-multi-collection-join-support-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/email/rule-engine/src/types/rule.types.ts` | Modify | Add `joins?: string[]` to `QueryTarget` |
| `packages/email/rule-engine/src/types/config.types.ts` | Modify | Add `activeJoins?` to queryUsers context type |
| `packages/email/rule-engine/src/schemas/rule.schema.ts` | Modify | Add `joins` array to `RuleTargetSchema` |
| `packages/email/rule-engine/src/validation/condition.validator.ts` | Modify | Accept `activeJoinAliases`, add `validateJoinAliases()` |
| `packages/email/rule-engine/src/controllers/collection.controller.ts` | Modify | Return join details in list, filter fields by `joins` query param |
| `packages/email/rule-engine/src/services/rule.service.ts` | Modify | Validate joins on create/update, pass `activeJoins` in dryRun |
| `packages/email/rule-engine/src/services/rule-runner.service.ts` | Modify | Resolve and pass `activeJoins` to queryUsers |
| `packages/email/rule-engine/src/utils/pipeline-builder.ts` | Create | Aggregation pipeline builder utility |
| `packages/email/rule-engine/src/index.ts` | Modify | Export `buildAggregationPipeline` |
| `packages/email/rule-engine/src/__tests__/collection.spec.ts` | Modify | Tests for join-aware validation + validateJoinAliases |
| `packages/email/rule-engine/src/__tests__/pipeline-builder.spec.ts` | Create | Tests for pipeline builder |
| `packages/email/ui/src/components/rules/alx-rule-editor.types.ts` | Modify | Add `JoinOption`, update `CollectionSummary`, `RuleData`, `EMPTY_RULE` |
| `packages/email/ui/src/components/rules/alx-rule-editor.ts` | Modify | Join checklist, grouped field dropdowns, save/load joins |
| `packages/email/ui/src/components/rules/alx-rule-editor.styles.ts` | Modify | Join checklist styles |
| `packages/email/ui/src/api/rule.api.ts` | Modify | Add `joins` param to `getCollectionFields` |

---

## Task 1: Backend Types — Add `joins` to QueryTarget and adapter context

**Files:**
- Modify: `packages/email/rule-engine/src/types/rule.types.ts:17-23`
- Modify: `packages/email/rule-engine/src/types/config.types.ts:84-85`

- [ ] **Step 1: Add `joins` to `QueryTarget`**

In `packages/email/rule-engine/src/types/rule.types.ts`, add `joins?: string[]` to `QueryTarget`:

```typescript
export interface QueryTarget {
  mode: 'query';
  role: string;
  platform: string;
  conditions: RuleCondition[];
  collectionName?: string;
  joins?: string[];
}
```

- [ ] **Step 2: Extend queryUsers adapter context**

In `packages/email/rule-engine/src/types/config.types.ts`, update the existing import at line 5 to add `JoinDefinition`:

```typescript
// Line 5 — change FROM:
import type { CollectionSchema } from './collection.types';
// TO:
import type { CollectionSchema, JoinDefinition } from './collection.types';
```

Update the `queryUsers` signature (line 85):

```typescript
queryUsers: (target: RuleTarget, limit: number, context?: { collectionSchema?: CollectionSchema; activeJoins?: JoinDefinition[] }) => Promise<Record<string, unknown>[]>;
```

- [ ] **Step 3: Verify build**

Run: `cd packages/email/rule-engine && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/email/rule-engine/src/types/rule.types.ts packages/email/rule-engine/src/types/config.types.ts
git commit -m "feat(rule-engine): add joins to QueryTarget and activeJoins to queryUsers context"
```

---

## Task 2: Mongoose Schema — Add `joins` to RuleTargetSchema

**Files:**
- Modify: `packages/email/rule-engine/src/schemas/rule.schema.ts:27-37`

- [ ] **Step 1: Add `joins` field to RuleTargetSchema**

In `packages/email/rule-engine/src/schemas/rule.schema.ts`, add `joins` after `collectionName` (line 36):

```typescript
const RuleTargetSchema = new Schema({
  mode: { type: String, enum: Object.values(TARGET_MODE), required: true },
  role: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE) },
  platform: {
    type: String,
    ...(platformValues ? { enum: platformValues } : {})
  },
  conditions: [RuleConditionSchema],
  identifiers: [{ type: String }],
  collectionName: { type: String },
  joins: [{ type: String }]
}, { _id: false });
```

- [ ] **Step 2: Verify build**

Run: `cd packages/email/rule-engine && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/email/rule-engine/src/schemas/rule.schema.ts
git commit -m "feat(rule-engine): add joins array to rule target schema"
```

---

## Task 3: Validation — Join-aware condition validation and alias validation

**Files:**
- Modify: `packages/email/rule-engine/src/validation/condition.validator.ts`
- Modify: `packages/email/rule-engine/src/__tests__/collection.spec.ts`

- [ ] **Step 1: Write failing tests for join-aware condition validation**

Add to `packages/email/rule-engine/src/__tests__/collection.spec.ts` inside the `validateConditions` describe block:

```typescript
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';

// ... existing tests ...

it('should validate joined fields when activeJoinAliases provided', () => {
  const colsWithJoins: CollectionSchema[] = [
    {
      name: 'users',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ],
      joins: [
        { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
      ],
    },
    {
      name: 'subscriptions',
      fields: [
        { name: 'plan', type: 'string' },
        { name: 'status', type: 'string', enumValues: ['active', 'inactive'] },
      ],
    },
  ];

  // With join active, subscription.plan is valid
  const errors = validateConditions(
    [{ field: 'subscription.plan', operator: 'eq', value: 'premium' }],
    'users',
    colsWithJoins,
    ['subscription'],
  );
  expect(errors).toHaveLength(0);
});

it('should reject joined fields when join is not in activeJoinAliases', () => {
  const colsWithJoins: CollectionSchema[] = [
    {
      name: 'users',
      fields: [{ name: 'name', type: 'string' }],
      joins: [
        { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
      ],
    },
    {
      name: 'subscriptions',
      fields: [{ name: 'plan', type: 'string' }],
    },
  ];

  // subscription join NOT in activeJoinAliases — subscription.plan should fail
  const errors = validateConditions(
    [{ field: 'subscription.plan', operator: 'eq', value: 'premium' }],
    'users',
    colsWithJoins,
    [],
  );
  expect(errors).toHaveLength(1);
  expect(errors[0].message).toContain('does not exist');
});

it('should include all joins when activeJoinAliases is undefined (backward compat)', () => {
  const colsWithJoins: CollectionSchema[] = [
    {
      name: 'users',
      fields: [{ name: 'name', type: 'string' }],
      joins: [
        { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
      ],
    },
    {
      name: 'subscriptions',
      fields: [{ name: 'plan', type: 'string' }],
    },
  ];

  // No activeJoinAliases param — all joins included (current behavior)
  const errors = validateConditions(
    [{ field: 'subscription.plan', operator: 'eq', value: 'premium' }],
    'users',
    colsWithJoins,
  );
  expect(errors).toHaveLength(0);
});
```

- [ ] **Step 2: Write failing tests for validateJoinAliases**

Add a new `describe` block in `collection.spec.ts`:

```typescript
describe('validateJoinAliases', () => {
  const collections: CollectionSchema[] = [
    {
      name: 'users',
      fields: [{ name: 'name', type: 'string' }],
      joins: [
        { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
        { from: 'payments', localField: '_id', foreignField: 'userId', as: 'lastPayment' },
      ],
    },
  ];

  it('should return no errors for valid join aliases', () => {
    const errors = validateJoinAliases(['subscription'], 'users', collections);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors for multiple valid aliases', () => {
    const errors = validateJoinAliases(['subscription', 'lastPayment'], 'users', collections);
    expect(errors).toHaveLength(0);
  });

  it('should return error for invalid join alias', () => {
    const errors = validateJoinAliases(['nonexistent'], 'users', collections);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not defined');
  });

  it('should return error when collection not found', () => {
    const errors = validateJoinAliases(['subscription'], 'unknown', collections);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not found');
  });

  it('should return empty for empty aliases array', () => {
    const errors = validateJoinAliases([], 'users', collections);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/collection.spec.ts`
Expected: New tests FAIL (validateJoinAliases not exported, activeJoinAliases param not accepted)

- [ ] **Step 4: Implement — update `validateConditions` to accept `activeJoinAliases`**

In `packages/email/rule-engine/src/validation/condition.validator.ts`, update the function signature and join filtering:

```typescript
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

  // Include joined fields — filter by activeJoinAliases if provided
  if (collection.joins?.length) {
    for (const join of collection.joins) {
      if (activeJoinAliases && !activeJoinAliases.includes(join.as)) continue;
      const joinedCollection = collections.find(c => c.name === join.from);
      if (joinedCollection) {
        flatFields.push(...flattenFields(joinedCollection.fields, join.as));
      }
    }
  }

  const fieldMap = new Map<string, FlattenedField>();
  for (const f of flatFields) {
    fieldMap.set(f.path, f);
  }

  const errors: ConditionValidationError[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];

    const fieldDef = fieldMap.get(cond.field);
    if (!fieldDef) {
      errors.push({
        index: i,
        field: cond.field,
        message: `Field "${cond.field}" does not exist in collection "${collectionName}"`,
      });
      continue;
    }

    const allowedOps = TYPE_OPERATORS[fieldDef.type];
    if (allowedOps && !allowedOps.includes(cond.operator)) {
      errors.push({
        index: i,
        field: cond.field,
        message: `Operator "${cond.operator}" is not valid for field type "${fieldDef.type}"`,
      });
    }
  }

  return errors;
}
```

- [ ] **Step 5: Implement — add `validateJoinAliases` function**

Add to the same file:

```typescript
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/collection.spec.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/email/rule-engine/src/validation/condition.validator.ts packages/email/rule-engine/src/__tests__/collection.spec.ts
git commit -m "feat(rule-engine): join-aware condition validation and validateJoinAliases"
```

---

## Task 4: Collection Controller — Return join details, filter by joins param

**Files:**
- Modify: `packages/email/rule-engine/src/controllers/collection.controller.ts:44-88`

- [ ] **Step 1: Update `list` to return join details**

In `collection.controller.ts`, update the `list` method to include join details alongside existing `joinCount`:

```typescript
list(_req: Request, res: Response) {
  const summary = collections.map(c => ({
    name: c.name,
    label: c.label,
    description: c.description,
    identifierField: c.identifierField,
    fieldCount: c.fields.length,
    joinCount: c.joins?.length ?? 0,
    joins: (c.joins ?? []).map(j => ({
      alias: j.as,
      from: j.from,
      label: collections.find(x => x.name === j.from)?.label ?? j.from,
    })),
  }));
  res.json({ collections: summary });
},
```

- [ ] **Step 2: Update `getFields` to filter by `joins` query param**

Update the `getFields` method:

```typescript
getFields(req: Request, res: Response) {
  const { name } = req.params;
  const collection = collections.find(c => c.name === name);
  if (!collection) {
    res.status(404).json({ error: `Collection "${name}" not found` });
    return;
  }

  const fields = flattenFields(collection.fields);

  const requestedJoins = req.query.joins
    ? (req.query.joins as string).split(',')
    : undefined;

  if (collection.joins?.length) {
    for (const join of collection.joins) {
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
},
```

- [ ] **Step 3: Add controller tests for join details in list and getFields filtering**

Add to `packages/email/rule-engine/src/__tests__/collection.spec.ts`, a new describe block:

```typescript
describe('createCollectionController', () => {
  const { createCollectionController } = await import('../controllers/collection.controller');

  const collections: CollectionSchema[] = [
    {
      name: 'users',
      label: 'Users',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ],
      joins: [
        { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
        { from: 'payments', localField: '_id', foreignField: 'userId', as: 'lastPayment' },
      ],
    },
    {
      name: 'subscriptions',
      label: 'Subscriptions',
      fields: [
        { name: 'plan', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    },
    {
      name: 'payments',
      fields: [
        { name: 'amount', type: 'number' },
      ],
    },
  ];

  const ctrl = createCollectionController(collections);

  function mockRes() {
    const res: any = { json: vi.fn(), status: vi.fn(() => res) };
    return res;
  }

  it('list should include joins with alias, from, and label', () => {
    const res = mockRes();
    ctrl.list({} as any, res);
    const data = res.json.mock.calls[0][0];
    const users = data.collections.find((c: any) => c.name === 'users');
    expect(users.joinCount).toBe(2);
    expect(users.joins).toHaveLength(2);
    expect(users.joins[0]).toEqual({ alias: 'subscription', from: 'subscriptions', label: 'Subscriptions' });
    expect(users.joins[1]).toEqual({ alias: 'lastPayment', from: 'payments', label: 'payments' });
  });

  it('getFields without joins param should return all joined fields', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: {} } as any, res);
    const data = res.json.mock.calls[0][0];
    const paths = data.fields.map((f: any) => f.path);
    expect(paths).toContain('name');
    expect(paths).toContain('subscription.plan');
    expect(paths).toContain('lastPayment.amount');
  });

  it('getFields with joins=subscription should only return subscription fields', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: { joins: 'subscription' } } as any, res);
    const data = res.json.mock.calls[0][0];
    const paths = data.fields.map((f: any) => f.path);
    expect(paths).toContain('name');
    expect(paths).toContain('subscription.plan');
    expect(paths).not.toContain('lastPayment.amount');
  });

  it('getFields with joins=subscription,lastPayment should return both', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: { joins: 'subscription,lastPayment' } } as any, res);
    const data = res.json.mock.calls[0][0];
    const paths = data.fields.map((f: any) => f.path);
    expect(paths).toContain('subscription.plan');
    expect(paths).toContain('lastPayment.amount');
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/collection.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Verify build**

Run: `cd packages/email/rule-engine && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/email/rule-engine/src/controllers/collection.controller.ts packages/email/rule-engine/src/__tests__/collection.spec.ts
git commit -m "feat(rule-engine): return join details in list, filter getFields by joins param"
```

---

## Task 5: Services — Validate joins and pass activeJoins to queryUsers

**Files:**
- Modify: `packages/email/rule-engine/src/services/rule.service.ts:1-7, 77-111, 146-156, 224-229`
- Modify: `packages/email/rule-engine/src/services/rule-runner.service.ts:612-617`

- [ ] **Step 1: Update imports in RuleService**

In `rule.service.ts`, add `validateJoinAliases` to the import:

```typescript
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';
```

- [ ] **Step 2: Add join validation to `create()`**

In `rule.service.ts`, after the existing condition validation block (line ~101-108), add join alias validation. The new block goes BEFORE the condition validation so we validate aliases first:

```typescript
// After line 99 (end of template compat check), before existing condition validation:
if (isQueryTarget(input.target) && input.target.joins?.length && input.target.collectionName && this.config.collections?.length) {
  const joinErrors = validateJoinAliases(input.target.joins, input.target.collectionName, this.config.collections);
  if (joinErrors.length > 0) {
    throw new RuleTemplateIncompatibleError(`Invalid joins: ${joinErrors.join('; ')}`);
  }
}

// Existing condition validation — update to pass joins:
if (isQueryTarget(input.target) && input.target.collectionName && this.config.collections?.length) {
  const condErrors = validateConditions(input.target.conditions, input.target.collectionName, this.config.collections, input.target.joins);
  if (condErrors.length > 0) {
    throw new RuleTemplateIncompatibleError(
      `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
    );
  }
}
```

- [ ] **Step 3: Add join validation to `update()`**

In `rule.service.ts`, in the `update()` method, add the same pattern after the existing condition validation block (line ~146-156):

```typescript
// Add join validation before condition validation in update():
if (isQueryTarget(effectiveTarget as RuleTarget)) {
  const qt = effectiveTarget as QueryTarget;

  // Validate join aliases
  if (qt.joins?.length && qt.collectionName && this.config.collections?.length) {
    const joinErrors = validateJoinAliases(qt.joins, qt.collectionName, this.config.collections);
    if (joinErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(`Invalid joins: ${joinErrors.join('; ')}`);
    }
  }

  // Existing condition validation — update to pass joins:
  if (qt.collectionName && this.config.collections?.length) {
    const condErrors = validateConditions(qt.conditions || [], qt.collectionName, this.config.collections, qt.joins);
    if (condErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(
        `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
      );
    }
  }
}
```

- [ ] **Step 4: Update `dryRun()` to pass activeJoins**

In `rule.service.ts`, replace lines 224-229 in the `dryRun()` method:

```typescript
const queryTarget = rule.target as unknown as QueryTarget;
const collectionName = queryTarget.collectionName;
const collectionSchema = collectionName
  ? this.config.collections?.find(c => c.name === collectionName)
  : undefined;
const joinAliases: string[] = queryTarget.joins ?? [];
const activeJoins = collectionSchema?.joins?.filter(j => joinAliases.includes(j.as)) ?? [];
const users = await this.config.adapters.queryUsers(
  rule.target, 50000,
  collectionSchema ? { collectionSchema, activeJoins } : undefined
);
```

- [ ] **Step 5: Add `QueryTarget` to the import in rule.service.ts if not already there**

Check line 4 — it already imports `QueryTarget`. Good.

- [ ] **Step 6: Update `executeQueryMode` in RuleRunnerService**

In `rule-runner.service.ts`, update lines 612-617 inside `executeQueryMode()`:

First add the import at the top of the file:
```typescript
import type { JoinDefinition } from '../types/collection.types';
```

Then update the queryUsers call:

```typescript
const collectionName = rule.target?.collectionName;
const collectionSchema = collectionName
  ? this.config.collections?.find((c: any) => c.name === collectionName)
  : undefined;
const joinAliases: string[] = rule.target?.joins ?? [];
const activeJoins: JoinDefinition[] = collectionSchema?.joins?.filter(
  (j: JoinDefinition) => joinAliases.includes(j.as)
) ?? [];
users = await this.config.adapters.queryUsers(
  rule.target, limit,
  collectionSchema ? { collectionSchema, activeJoins } : undefined
);
```

- [ ] **Step 7: Verify build and run all tests**

Run: `cd packages/email/rule-engine && npx tsc --noEmit && npx vitest run`
Expected: All tests PASS (existing tests still work — no breaking changes)

- [ ] **Step 8: Commit**

```bash
git add packages/email/rule-engine/src/services/rule.service.ts packages/email/rule-engine/src/services/rule-runner.service.ts
git commit -m "feat(rule-engine): validate joins and pass activeJoins to queryUsers adapter"
```

---

## Task 6: Pipeline Builder Utility

**Files:**
- Create: `packages/email/rule-engine/src/utils/pipeline-builder.ts`
- Create: `packages/email/rule-engine/src/__tests__/pipeline-builder.spec.ts`
- Modify: `packages/email/rule-engine/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/email/rule-engine/src/__tests__/pipeline-builder.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAggregationPipeline } from '../utils/pipeline-builder';
import type { JoinDefinition } from '../types/collection.types';

describe('buildAggregationPipeline', () => {
  const subscriptionJoin: JoinDefinition = {
    from: 'subscriptions',
    localField: '_id',
    foreignField: 'userId',
    as: 'subscription',
  };

  const paymentJoin: JoinDefinition = {
    from: 'payments',
    localField: '_id',
    foreignField: 'userId',
    as: 'lastPayment',
  };

  it('should return empty pipeline when no joins and no conditions', () => {
    const pipeline = buildAggregationPipeline({ joins: [], conditions: [] });
    expect(pipeline).toEqual([]);
  });

  it('should add $lookup and $unwind for each join', () => {
    const pipeline = buildAggregationPipeline({
      joins: [subscriptionJoin],
      conditions: [],
    });

    expect(pipeline).toHaveLength(2);
    expect(pipeline[0]).toEqual({
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'userId',
        as: 'subscription',
      },
    });
    expect(pipeline[1]).toEqual({
      $unwind: {
        path: '$subscription',
        preserveNullAndEmptyArrays: true,
      },
    });
  });

  it('should add $lookup stages for multiple joins', () => {
    const pipeline = buildAggregationPipeline({
      joins: [subscriptionJoin, paymentJoin],
      conditions: [],
    });

    // 2 joins × 2 stages ($lookup + $unwind) = 4
    expect(pipeline).toHaveLength(4);
  });

  it('should build $match with $and from conditions', () => {
    const pipeline = buildAggregationPipeline({
      joins: [],
      conditions: [
        { field: 'age', operator: 'gt', value: 18 },
        { field: 'status', operator: 'eq', value: 'active' },
      ],
    });

    expect(pipeline).toHaveLength(1);
    expect(pipeline[0]).toEqual({
      $match: {
        $and: [
          { age: { $gt: 18 } },
          { status: 'active' },
        ],
      },
    });
  });

  it('should handle same-field multiple conditions via $and', () => {
    const pipeline = buildAggregationPipeline({
      joins: [],
      conditions: [
        { field: 'age', operator: 'gte', value: 18 },
        { field: 'age', operator: 'lt', value: 65 },
      ],
    });

    expect(pipeline[0]).toEqual({
      $match: {
        $and: [
          { age: { $gte: 18 } },
          { age: { $lt: 65 } },
        ],
      },
    });
  });

  it('should add $limit when provided', () => {
    const pipeline = buildAggregationPipeline({
      joins: [],
      conditions: [],
      limit: 100,
    });

    expect(pipeline).toEqual([{ $limit: 100 }]);
  });

  it('should order stages: $lookup → $unwind → $match → $limit', () => {
    const pipeline = buildAggregationPipeline({
      joins: [subscriptionJoin],
      conditions: [{ field: 'subscription.status', operator: 'eq', value: 'active' }],
      limit: 50,
    });

    expect(pipeline).toHaveLength(4);
    expect(pipeline[0]).toHaveProperty('$lookup');
    expect(pipeline[1]).toHaveProperty('$unwind');
    expect(pipeline[2]).toHaveProperty('$match');
    expect(pipeline[3]).toEqual({ $limit: 50 });
  });

  it('should map all operators correctly', () => {
    const ops: Array<{ op: string; value: unknown; expected: unknown }> = [
      { op: 'eq', value: 'x', expected: 'x' },
      { op: 'neq', value: 'x', expected: { $ne: 'x' } },
      { op: 'gt', value: 5, expected: { $gt: 5 } },
      { op: 'gte', value: 5, expected: { $gte: 5 } },
      { op: 'lt', value: 5, expected: { $lt: 5 } },
      { op: 'lte', value: 5, expected: { $lte: 5 } },
      { op: 'in', value: ['a', 'b'], expected: { $in: ['a', 'b'] } },
      { op: 'not_in', value: ['a'], expected: { $nin: ['a'] } },
      { op: 'exists', value: true, expected: { $exists: true } },
      { op: 'not_exists', value: false, expected: { $exists: false } },
    ];

    for (const { op, value, expected } of ops) {
      const pipeline = buildAggregationPipeline({
        joins: [],
        conditions: [{ field: 'f', operator: op, value }],
      });
      expect((pipeline[0] as any).$match.$and[0].f).toEqual(expected);
    }
  });

  it('should escape regex special chars in contains operator', () => {
    const pipeline = buildAggregationPipeline({
      joins: [],
      conditions: [{ field: 'name', operator: 'contains', value: 'test.value(1)' }],
    });

    const match = (pipeline[0] as any).$match.$and[0].name;
    expect(match.$regex).toBe('test\\.value\\(1\\)');
    expect(match.$options).toBe('i');
  });

  it('should wrap non-array value in array for in operator', () => {
    const pipeline = buildAggregationPipeline({
      joins: [],
      conditions: [{ field: 'status', operator: 'in', value: 'active' }],
    });

    const match = (pipeline[0] as any).$match.$and[0].status;
    expect(match.$in).toEqual(['active']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/pipeline-builder.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pipeline builder**

Create `packages/email/rule-engine/src/utils/pipeline-builder.ts`:

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
      $lookup: {
        from: join.from,
        localField: join.localField,
        foreignField: join.foreignField,
        as: join.as,
      },
    });

    pipeline.push({
      $unwind: {
        path: `$${join.as}`,
        preserveNullAndEmptyArrays: true,
      },
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/pipeline-builder.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Export from package index**

In `packages/email/rule-engine/src/index.ts`, add:

```typescript
export { buildAggregationPipeline } from './utils/pipeline-builder';
export type { PipelineBuilderOptions } from './utils/pipeline-builder';
```

- [ ] **Step 6: Run full test suite**

Run: `cd packages/email/rule-engine && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/email/rule-engine/src/utils/pipeline-builder.ts packages/email/rule-engine/src/__tests__/pipeline-builder.spec.ts packages/email/rule-engine/src/index.ts
git commit -m "feat(rule-engine): add buildAggregationPipeline utility"
```

---

## Task 7: UI Types — Add JoinOption, update RuleData and EMPTY_RULE

**Files:**
- Modify: `packages/email/ui/src/components/rules/alx-rule-editor.types.ts`

- [ ] **Step 1: Add `JoinOption` interface**

Add after the `CollectionField` interface (line 14):

```typescript
export interface JoinOption {
  alias: string;
  from: string;
  label: string;
}
```

- [ ] **Step 2: Update `CollectionSummary` to include joins**

```typescript
export interface CollectionSummary {
  name: string;
  label?: string;
  description?: string;
  fieldCount: number;
  joins: JoinOption[];
}
```

- [ ] **Step 3: Add `joins` to `RuleData`**

Add `joins: string[];` after `collectionName: string;` (line 44):

```typescript
export interface RuleData {
  _id?: string;
  name: string;
  templateId: string;
  platform: string;
  audience: string;
  collectionName: string;
  joins: string[];
  targetMode: 'query' | 'list';
  // ... rest unchanged
}
```

- [ ] **Step 4: Add `joins` to `EMPTY_RULE`**

Add `joins: [],` after `collectionName: '',`:

```typescript
export const EMPTY_RULE: RuleData = {
  name: '',
  templateId: '',
  platform: '',
  audience: '',
  collectionName: '',
  joins: [],
  targetMode: 'query',
  // ... rest unchanged
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/email/ui/src/components/rules/alx-rule-editor.types.ts
git commit -m "feat(ui): add JoinOption type, update RuleData with joins field"
```

---

## Task 8: UI API — Add joins param to getCollectionFields

**Files:**
- Modify: `packages/email/ui/src/api/rule.api.ts`

- [ ] **Step 1: Update `getCollectionFields` to accept optional joins param**

Find the existing method and update:

```typescript
getCollectionFields(name: string, joins?: string[]): Promise<any> {
  const params = joins?.length ? `?joins=${joins.join(',')}` : '';
  return this.http.get(`/collections/${name}/fields${params}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/email/ui/src/api/rule.api.ts
git commit -m "feat(ui): add joins param to getCollectionFields API method"
```

---

## Task 9: UI Rule Editor — Join checklist, grouped fields, save/load

**Files:**
- Modify: `packages/email/ui/src/components/rules/alx-rule-editor.ts:67-104, 130-178, 189-230, 232-299, 505-618`
- Modify: `packages/email/ui/src/components/rules/alx-rule-editor.styles.ts`

- [ ] **Step 1: Add state and import for JoinOption**

In `alx-rule-editor.ts`, update the import from types file to include `JoinOption`:

```typescript
import type { RuleData, Condition, CollectionField, CollectionSummary, TemplateOption, JoinOption } from './alx-rule-editor.types';
```

Add new state property alongside existing `_collectionFields`:

```typescript
@state() private _availableJoins: JoinOption[] = [];
```

- [ ] **Step 2: Update `_loadCollectionFields` to populate available joins**

Replace the existing `_loadCollectionFields` method (lines 93-104):

```typescript
private async _loadCollectionFields(name: string): Promise<void> {
  if (!name) {
    this._collectionFields = [];
    this._availableJoins = [];
    return;
  }
  try {
    // Get available joins from already-loaded collections list
    const col = this._collections.find(c => c.name === name);
    this._availableJoins = col?.joins ?? [];

    // Reset selected joins when collection changes
    this._form = { ...this._form, joins: [] };

    // Fetch fields without joins initially
    await this._refreshCollectionFields();
  } catch {
    this._collectionFields = [];
    this._availableJoins = [];
  }
}
```

- [ ] **Step 3: Add `_refreshCollectionFields` and `_toggleJoin` methods**

Add after `_loadCollectionFields`:

```typescript
private async _refreshCollectionFields(): Promise<void> {
  try {
    const joins = this._form.joins.length > 0 ? this._form.joins : undefined;
    const res = await this._api.getCollectionFields(this._form.collectionName, joins) as { fields: CollectionField[] };
    this._collectionFields = res.fields ?? [];
  } catch {
    this._collectionFields = [];
  }
}

private _toggleJoin(alias: string): void {
  const joins = this._form.joins.includes(alias)
    ? this._form.joins.filter(j => j !== alias)
    : [...this._form.joins, alias];
  this._form = { ...this._form, joins };
  this._refreshCollectionFields();
}
```

- [ ] **Step 4: Update `_loadRule` to populate `joins` from rule data**

In the `_loadRule` method (line ~130-178), add `joins` to the form mapping:

```typescript
// In the _form assignment, add after collectionName:
joins: target.joins ?? [],
```

And after the `if (target.collectionName)` block, load available joins:

```typescript
if (target.collectionName) {
  const col = this._collections.find(c => c.name === target.collectionName);
  this._availableJoins = col?.joins ?? [];
  const joins = target.joins?.length ? target.joins : undefined;
  const fieldsRes = await this._api.getCollectionFields(target.collectionName, joins) as { fields: CollectionField[] };
  this._collectionFields = fieldsRes.fields ?? [];
}
```

- [ ] **Step 5: Update `_onSave` to include joins in the target payload**

In the `_onSave` method (line ~232-299), update the query-mode target building:

```typescript
const target: Record<string, unknown> = this._form.targetMode === 'list'
  ? { mode: 'list', identifiers: this._form.target.identifiers ?? [] }
  : {
      mode: 'query',
      role: this._form.audience || undefined,
      platform: this._form.platform || undefined,
      conditions: this._form.target.conditions ?? [],
      ...(this._form.collectionName ? { collectionName: this._form.collectionName } : {}),
      ...(this._form.joins.length > 0 ? { joins: this._form.joins } : {}),
    };
```

- [ ] **Step 6: Add join checklist to the render template**

In the condition builder render section, after the collection dropdown and before the "Target Conditions" section title, add:

```typescript
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

- [ ] **Step 7: Update field dropdown to group by source**

In the condition builder, update the field `<select>` to use `<optgroup>` when joins are active:

```typescript
${hasFields ? html`
  <select
    .value=${c.field}
    @change=${(e: Event) =>
      this._updateCondition(i, 'field', (e.target as HTMLSelectElement).value)}
  >
    <option value="">Select field</option>
    ${this._form.joins.length > 0 ? html`
      <optgroup label="${this._form.collectionName}">
        ${this._collectionFields
          .filter(f => f.type !== 'object' && !this._form.joins.some(alias => f.path.startsWith(alias + '.')))
          .map(f => html`<option value=${f.path} ?selected=${c.field === f.path}>
            ${f.label || f.path} (${f.type})
          </option>`)}
      </optgroup>
      ${this._form.joins.map(alias => {
        const joinLabel = this._availableJoins.find(j => j.alias === alias)?.label || alias;
        return html`
          <optgroup label="${joinLabel}">
            ${this._collectionFields
              .filter(f => f.path.startsWith(alias + '.') && f.type !== 'object')
              .map(f => html`<option value=${f.path} ?selected=${c.field === f.path}>
                ${f.label || f.path.replace(alias + '.', '')} (${f.type})
              </option>`)}
          </optgroup>
        `;
      })}
    ` : html`
      ${this._collectionFields
        .filter(f => f.type !== 'object')
        .map(f => html`<option value=${f.path} ?selected=${c.field === f.path}>
          ${f.path} (${f.type})
        </option>`)}
    `}
  </select>
` : html`
  <input type="text" .value=${c.field}
    @input=${(e: Event) => this._updateCondition(i, 'field', (e.target as HTMLInputElement).value)}
    placeholder="Field path"
  />
`}
```

- [ ] **Step 8: Add join styles**

In `packages/email/ui/src/components/rules/alx-rule-editor.styles.ts`, add:

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

- [ ] **Step 9: Verify build**

Run: `cd packages/email/ui && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add packages/email/ui/src/components/rules/alx-rule-editor.ts packages/email/ui/src/components/rules/alx-rule-editor.types.ts packages/email/ui/src/components/rules/alx-rule-editor.styles.ts packages/email/ui/src/api/rule.api.ts
git commit -m "feat(ui): add join selection checklist with grouped field dropdowns in rule editor"
```

---

## Task 10: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full rule-engine test suite**

Run: `cd packages/email/rule-engine && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run full UI build**

Run: `cd packages/email/ui && npx tsup`
Expected: Build succeeds

- [ ] **Step 3: Run full rule-engine build**

Run: `cd packages/email/rule-engine && npx tsup`
Expected: Build succeeds

- [ ] **Step 4: Verify exports**

Run: `node -e "const m = require('./packages/email/rule-engine/dist/index.cjs'); console.log(typeof m.buildAggregationPipeline)"`
Expected: `function`

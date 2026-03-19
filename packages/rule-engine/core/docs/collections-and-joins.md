# Collections and Joins

## What Are Collections?

Collections define your database schema for the rule engine. Developers register them once in the engine config, and the engine uses them throughout the system for:

- **Field validation** — conditions referencing unknown fields are rejected at save time
- **Operator-type compatibility** — the engine enforces that operators match the field's declared type (e.g., `contains` is invalid on a `number` field)
- **Variable picker in UI** — guides admins to valid fields when building rule conditions on a template
- **Join support** — enables multi-collection queries so conditions can reference fields from related collections

Collections are entirely optional. Without them, condition fields are free-text (no validation), and template variables must be typed manually.

---

## Defining Collections

Pass a `CollectionSchema[]` array when configuring the engine. Each schema declares its fields and optional joins to other collections.

```typescript
import { createRuleEngine } from '@astralibx/rule-engine';
import type { CollectionSchema } from '@astralibx/rule-engine';

const collections: CollectionSchema[] = [
  {
    name: 'users',
    label: 'Users',
    identifierField: 'email',
    fields: [
      { name: 'name',   type: 'string', label: 'Full Name' },
      { name: 'email',  type: 'string' },
      { name: 'age',    type: 'number' },
      { name: 'status', type: 'string', enumValues: ['active', 'inactive'] },
      {
        name: 'address', type: 'object',
        fields: [
          { name: 'city', type: 'string' },
          { name: 'zip',  type: 'string' },
        ],
      },
      {
        name: 'orders', type: 'array',
        fields: [
          { name: 'amount', type: 'number' },
          { name: 'date',   type: 'date' },
        ],
      },
    ],
    joins: [
      {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'userId',
        as: 'subscription',
      },
    ],
  },
  {
    name: 'subscriptions',
    label: 'Subscriptions',
    fields: [
      { name: 'plan',   type: 'string', enumValues: ['free', 'pro', 'enterprise'] },
      { name: 'active', type: 'boolean' },
    ],
  },
];

createRuleEngine({ collections, /* ...other config */ });
```

### CollectionSchema fields

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Unique collection identifier (matches MongoDB collection name) |
| `label` | `string` | no | Human-readable name shown in the UI |
| `description` | `string` | no | Optional tooltip or help text |
| `identifierField` | `string` | no | Field used to identify individual records (e.g. `email`, `_id`) |
| `fields` | `FieldDefinition[]` | yes | List of top-level fields |
| `joins` | `JoinDefinition[]` | no | Joins to other registered collections |

### FieldDefinition fields

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Field name as stored in the database |
| `type` | `FieldType` | yes | One of `string`, `number`, `boolean`, `date`, `objectId`, `array`, `object` |
| `label` | `string` | no | Display name in the UI variable picker |
| `description` | `string` | no | Optional help text |
| `enumValues` | `string[]` | no | Allowed values — used for UI dropdowns |
| `fields` | `FieldDefinition[]` | no | Nested fields for `object` and `array` types |

---

## Field Types and Operators

The engine enforces that each condition's operator is compatible with the field's declared type. Invalid combinations are rejected during condition validation.

| Type | Valid Operators |
|---|---|
| `string` | `eq`, `neq`, `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `number` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists` |
| `boolean` | `eq`, `neq`, `exists`, `not_exists` |
| `date` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists` |
| `objectId` | `eq`, `neq`, `in`, `not_in`, `exists`, `not_exists` |
| `array` | `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `object` | `exists`, `not_exists` |

`object` and `array` fields with sub-fields are flattened for use in conditions. For example, `address.city` (from the `object` example above) is accessible as its own `string` field. Array items are addressed as `orders[].amount`.

---

## Joins

### How joins work

A `JoinDefinition` maps to a MongoDB `$lookup`. The developer declares which collection to join (`from`), which fields to match on (`localField`, `foreignField`), and the alias the joined document will appear under in the pipeline (`as`).

```typescript
interface JoinDefinition {
  from: string;         // source collection name (must also be registered)
  localField: string;   // field on the primary collection
  foreignField: string; // field on the joined collection
  as: string;           // alias — joined fields are prefixed with this in conditions
}
```

Joins are flat: they always originate from the primary collection. Chained or nested joins are not supported.

### Joins on templates

Each template owns its `collectionName` and an optional `joins` list of alias strings. When an admin builds conditions on a template, only the joins declared on that template are active. The condition validator only resolves joined fields for active aliases.

### Accessing joined fields

Once a join is active, its fields are prefixed with the `as` alias. Given the example above, the joined `subscriptions` collection is accessed as:

- `subscription.plan`
- `subscription.active`

These paths are what admins use in condition `field` values, and what the pipeline builder maps to `$match` filters.

---

## Pipeline Builder

`buildAggregationPipeline()` converts a list of active joins and evaluated conditions into a ready-to-run MongoDB aggregation pipeline.

### Signature

```typescript
import { buildAggregationPipeline } from '@astralibx/rule-engine';

const pipeline = buildAggregationPipeline({
  joins: JoinDefinition[];
  conditions: RuleCondition[];
  limit?: number;
});
```

### Generated pipeline structure

The output always follows this order:

1. `$lookup` + `$unwind` — one pair per active join (`preserveNullAndEmptyArrays: true`)
2. `$match` with `$and` — one expression per condition
3. `$limit` — only included when `limit` is provided

### Example adapter

```typescript
import { buildAggregationPipeline } from '@astralibx/rule-engine';
import type { JoinDefinition, RuleCondition } from '@astralibx/rule-engine';
import { db } from './mongo';

async function queryUsers(
  joins: JoinDefinition[],
  conditions: RuleCondition[],
  limit?: number,
) {
  const pipeline = buildAggregationPipeline({ joins, conditions, limit });
  return db.collection('users').aggregate(pipeline).toArray();
}
```

The pipeline for `joins = [{ from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' }]` and one condition `{ field: 'subscription.plan', operator: 'eq', value: 'pro' }` would be:

```json
[
  { "$lookup": { "from": "subscriptions", "localField": "_id", "foreignField": "userId", "as": "subscription" } },
  { "$unwind": { "path": "$subscription", "preserveNullAndEmptyArrays": true } },
  { "$match": { "$and": [{ "subscription.plan": "pro" }] } }
]
```

---

## Collection API Endpoints

The engine mounts two read-only endpoints automatically when collections are registered.

### GET /collections

Returns a summary of all registered collections including join metadata.

```json
{
  "collections": [
    {
      "name": "users",
      "label": "Users",
      "identifierField": "email",
      "fieldCount": 6,
      "joinCount": 1,
      "joins": [
        { "alias": "subscription", "from": "subscriptions", "label": "Subscriptions" }
      ]
    }
  ]
}
```

### GET /collections/:name/fields?joins=subscription

Returns the flattened field list for a collection, optionally including fields from joined collections. The `joins` query parameter is a comma-separated list of join aliases to include.

```
GET /collections/users/fields?joins=subscription
```

Response includes:

- `fields` — all flattened fields (nested objects/arrays expanded to dot-notation paths)
- `typeOperators` — the full `TYPE_OPERATORS` map, so the UI can render the correct operator options per field type
- `identifierField` — passed through for UI use

Pass multiple aliases as a comma-separated value: `?joins=subscription,account`.

---

## Collections Are Optional

If no collections are registered, the engine operates in schema-free mode:

- Condition `field` values are accepted as free-text without any existence or type check
- Operator validation is skipped
- The variable picker in the UI shows no suggestions — admins type field paths manually
- The collection API endpoints return empty results rather than errors

# Collection Schemas

Register your MongoDB collection schemas so the admin UI can show real field names in dropdowns, filter operators by type, and offer a variable picker for templates. This is entirely optional — when not configured, everything falls back to free-text inputs.

## Quick Start

```typescript
const engine = createEmailRuleEngine({
  // ...db, redis, adapters...
  collections: [
    {
      name: 'users',
      label: 'Users',
      identifierField: 'email',
      fields: [
        { name: 'name', type: 'string', label: 'Full Name' },
        { name: 'email', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'isActive', type: 'boolean' },
        { name: 'createdAt', type: 'date' },
        { name: 'role', type: 'string', enumValues: ['customer', 'provider', 'admin'] },
        {
          name: 'address',
          type: 'object',
          fields: [
            { name: 'city', type: 'string' },
            { name: 'state', type: 'string' },
            { name: 'zip', type: 'string' },
          ],
        },
        {
          name: 'orders',
          type: 'array',
          fields: [
            { name: 'amount', type: 'number' },
            { name: 'date', type: 'date' },
            { name: 'status', type: 'string', enumValues: ['pending', 'completed', 'cancelled'] },
          ],
        },
      ],
    },
  ],
});
```

## What Happens

### In the Rule Editor UI

- A **Collection** dropdown appears in the targeting section
- Selecting a collection replaces free-text field inputs with **dropdowns** showing actual field paths (`address.city`, `orders[].amount`)
- **Operators auto-filter by type** — boolean fields only show `eq`/`neq`, number fields include `gt`/`lt`, etc.
- **Value inputs adapt** — enum fields become dropdowns, booleans become toggles, dates become date pickers

### In the Template Editor UI

- **"Insert Variable"** buttons appear next to subject, body, and text fields
- Clicking opens a picker showing fields grouped by collection
- Clicking a field inserts `{{collectionName.fieldPath}}` (e.g. `{{users.email}}`) and auto-adds it to the variables list

### In the Backend

- When saving a rule with a collection selected, conditions are **validated** against the schema — unknown fields and incompatible operators are rejected
- During rule execution, `queryUsers` receives the collection schema as an optional third argument so your adapter can use it for smarter queries

## Types

### CollectionSchema

```typescript
interface CollectionSchema {
  name: string;              // collection identifier (e.g., 'users')
  label?: string;            // display name (e.g., 'Users')
  description?: string;      // tooltip text
  identifierField?: string;  // which field maps to recipient email
  fields: FieldDefinition[];
  joins?: JoinDefinition[];
}
```

### FieldDefinition

```typescript
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';

interface FieldDefinition {
  name: string;              // field name (e.g., 'city')
  type: FieldType;
  label?: string;            // display label (e.g., 'City')
  description?: string;
  enumValues?: string[];     // constrains value input to a dropdown
  fields?: FieldDefinition[]; // children for 'object' and 'array' types
}
```

### JoinDefinition

Model relationships between collections. Joined fields appear in the field picker prefixed with the `as` alias.

```typescript
interface JoinDefinition {
  from: string;        // source collection name
  localField: string;  // field on this collection
  foreignField: string; // field on the joined collection
  as: string;          // alias prefix for joined fields
}
```

### FlattenedField

The API returns fields in flattened form for easy consumption:

```typescript
interface FlattenedField {
  path: string;          // e.g., 'address.city', 'orders[].amount'
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}
```

## Type-Aware Operators

Each field type restricts which operators are valid:

| Type | Operators |
|------|-----------|
| `string` | `eq`, `neq`, `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `number` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists` |
| `boolean` | `eq`, `neq`, `exists`, `not_exists` |
| `date` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists` |
| `objectId` | `eq`, `neq`, `in`, `not_in`, `exists`, `not_exists` |
| `array` | `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `object` | `exists`, `not_exists` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/collections` | List all registered collections (name, label, field count) |
| `GET` | `/collections/:name/fields` | Get flattened fields for a collection (includes joined fields and type-operator mapping) |

## Joins Example

```typescript
collections: [
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
      { name: 'plan', type: 'string', enumValues: ['free', 'pro', 'enterprise'] },
      { name: 'expiresAt', type: 'date' },
      { name: 'isActive', type: 'boolean' },
    ],
  },
],
```

In the UI, the `users` collection will show fields like `subscription.plan`, `subscription.expiresAt`, `subscription.isActive` alongside the user's own fields.

## Adapter Context

When a rule has a collection selected, `queryUsers` receives the schema as a third argument:

```typescript
queryUsers: async (target, limit, context?) => {
  if (context?.collectionSchema) {
    // Use the schema to build smarter queries
    // e.g., auto-cast date strings, validate field paths
  }
  return User.find(/* ... */).limit(limit).lean();
}
```

Existing adapters that don't use the third argument continue to work unchanged.

## Validation

When a rule targets a specific collection, the backend validates conditions on create/update:

- **Field existence** — condition field paths must exist in the collection schema
- **Operator compatibility** — the operator must be valid for the field's type

Rules without a collection set skip validation entirely — no breaking changes to existing rules.

## Exported Utilities

```typescript
import {
  flattenFields,          // (fields: FieldDefinition[], prefix?) => FlattenedField[]
  validateConditions,     // (conditions, collectionName, collections) => ConditionValidationError[]
  TYPE_OPERATORS,         // Record<FieldType, string[]>
  FIELD_TYPE,             // { String: 'string', Number: 'number', ... }
} from '@astralibx/email-rule-engine';
```

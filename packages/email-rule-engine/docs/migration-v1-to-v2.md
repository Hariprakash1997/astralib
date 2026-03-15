# Migration from v1 to v2

## Breaking Changes in v2.0.0

### 1. Enums replaced with `as const` objects

```typescript
// v1
enum TemplateCategory { Onboarding = 'onboarding', ... }
import { TemplateCategory } from '@astralibx/email-rule-engine';

// v2
const TEMPLATE_CATEGORY = { Onboarding: 'onboarding', ... } as const;
type TemplateCategory = (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];
```

Update imports: use `TEMPLATE_CATEGORY.Onboarding` instead of `TemplateCategory.Onboarding`. String literal values (`'onboarding'`) continue to work unchanged in all contexts.

### 2. Zod config validation

Config is now validated with Zod at startup. Invalid configs throw `ConfigValidationError` with detailed field-level messages instead of silently using defaults or failing at runtime.

```typescript
// This now throws immediately with a clear error message
createEmailRuleEngine({ db: { connection: null } });
// ConfigValidationError: Invalid EmailRuleEngineConfig:
//   db.connection: Expected object, received null
```

### 3. `selectAgent` signature extended

```typescript
// v1
selectAgent: (identifierId: string) => Promise<AgentSelection | null>

// v2 -- added optional context parameter
selectAgent: (identifierId: string, context?: { ruleId: string; templateId: string }) => Promise<AgentSelection | null>
```

Existing v1 implementations work without changes since the context parameter is optional.

### 4. `onSend` hook status expanded

```typescript
// v1
status: 'sent' | 'error'

// v2
status: 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled'
```

If your hook handler only checks for `'sent'` and `'error'`, it will continue to work. The new statuses provide more granular tracking.

### 5. `categories` config option added

A new optional `categories` config field allows restricting valid template categories at the Mongoose schema level, similar to how `platforms` and `audiences` work.

### 6. `subject`/`body` replaced with `subjects[]`/`bodies[]` on templates

Templates now use arrays for subjects and bodies to support A/B variant testing. Single-element arrays work identically to the old singular fields.

```typescript
// v1
{ subject: 'Hello {{user.name}}', body: '<mj-text>Welcome!</mj-text>' }

// v2
{ subjects: ['Hello {{user.name}}'], bodies: ['<mj-text>Welcome!</mj-text>'] }
```

### 7. `target.mode` is now required

Rules must specify `target.mode` as either `'query'` (condition-based targeting) or `'list'` (explicit email list). Existing rules using condition-based targeting need `mode: 'query'` added to their `target` object.

```typescript
// v1
{ target: { role: 'customer', platform: 'web', conditions: [...] } }

// v2
{ target: { mode: 'query', role: 'customer', platform: 'web', conditions: [...] } }
```

### 8. `AgentSelection` now requires `email` and `metadata` fields

The `selectAgent` adapter must now return `{ accountId, email, metadata }` instead of just `{ accountId }`. These fields are used for sender identification and are available in the `beforeSend` hook.

```typescript
// v1
return { accountId: account._id.toString() };

// v2
return { accountId: account._id.toString(), email: account.email, metadata: account.metadata || {} };
```

### 9. `runAllRules()` returns `{ runId: string }` instead of void

The runner methods now return a `runId` that can be used to track progress or cancel a run.

```typescript
// v1
await engine.runner.runAllRules('cron');

// v2
const { runId } = await engine.runner.runAllRules('cron');
```

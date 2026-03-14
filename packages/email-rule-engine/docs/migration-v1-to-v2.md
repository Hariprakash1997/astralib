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

# Exported Types

All types can be imported from `@astralibx/email-rule-engine`:

```ts
import type {
  EmailTemplate, CreateEmailTemplateInput, UpdateEmailTemplateInput,
  EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput,
  RuleCondition, RuleTarget, QueryTarget, ListTarget, RuleRunStats,
  EmailRuleSend, PerRuleStats, EmailRuleRunLog,
  EmailThrottleConfig, UpdateEmailThrottleConfigInput,
  EmailRuleEngineConfig, SendEmailParams, AgentSelection,
  RecipientIdentifier, BeforeSendParams, BeforeSendResult,
  LogAdapter, RenderResult, CompiledTemplate,
  EmailRuleEngine, EmailAttachment,
  // Constants (value + type)
  TemplateCategory, TemplateAudience, RuleOperator,
  EmailType, RunTrigger, ThrottleWindow, EmailSendStatus,
  TargetMode, RunLogStatus,
} from '@astralibx/email-rule-engine';

import {
  TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR,
  EMAIL_TYPE, RUN_TRIGGER, THROTTLE_WINDOW, EMAIL_SEND_STATUS,
  // Error classes
  AlxEmailError, ConfigValidationError, TemplateNotFoundError,
  TemplateSyntaxError, RuleNotFoundError, RuleTemplateIncompatibleError,
  LockAcquisitionError, DuplicateSlugError,
  // Services & utilities
  TemplateService, RuleService, RuleRunnerService,
  TemplateRenderService, RedisLock,
  // Config validator
  validateConfig,
  // Factory
  createEmailRuleEngine,
} from '@astralibx/email-rule-engine';
```

---

## Template Types

| Type | Description |
|------|-------------|
| `EmailTemplate` | Full template document. Key fields: `slug`, `subjects: string[]`, `bodies: string[]`, `preheaders?: string[]`, `fields?: Record<string, string>`, `variables: string[]`, `category`, `audience`, `platform`, `isActive`, `version`. |
| `CreateEmailTemplateInput` | Input for creating a template. Required: `name`, `slug`, `category`, `audience`, `platform`, `subjects`, `bodies`. Optional: `description`, `textBody`, `preheaders`, `fields`, `variables`. |
| `UpdateEmailTemplateInput` | Partial input for updating a template. All fields optional including `isActive`. |

## Rule Types

| Type | Description |
|------|-------------|
| `EmailRule` | Full rule document. Key fields: `target: RuleTarget`, `templateId`, `sendOnce`, `cooldownDays?`, `autoApprove`, `maxPerRun?`, `validFrom?`, `validTill?`, `bypassThrottle`, `emailType`, `totalSent`, `lastRunStats?`. |
| `CreateEmailRuleInput` | Input for creating a rule. Required: `name`, `target`, `templateId`. All scheduling/throttle fields optional with sensible defaults. |
| `UpdateEmailRuleInput` | Partial input for updating a rule. All fields optional including `isActive`. |
| `RuleTarget` | Union type: `QueryTarget \| ListTarget`. |
| `QueryTarget` | Query-based targeting. Fields: `mode: 'query'`, `role: string`, `platform: string`, `conditions: RuleCondition[]`. |
| `ListTarget` | List-based targeting. Fields: `mode: 'list'`, `identifiers: string[]`. |
| `RuleCondition` | Single filter condition. Fields: `field: string`, `operator: RuleOperator`, `value: unknown`. |
| `RuleRunStats` | Aggregated stats for a run. Fields: `matched`, `sent`, `skipped`, `skippedByThrottle`, `errorCount` (all `number`). |
| `PerRuleStats` | Extends `RuleRunStats` with `ruleId: string` and `ruleName: string`. |
| `EmailRuleSend` | Send-log record. Key fields: `ruleId`, `userId`, `emailIdentifierId?`, `messageId?`, `sentAt`, `status?`, `accountId?`, `subject?`, `failureReason?`. |
| `EmailRuleRunLog` | Run-log document. Fields: `runAt`, `triggeredBy: RunTrigger`, `duration`, `rulesProcessed`, `totalStats: RuleRunStats`, `perRuleStats: PerRuleStats[]`. |

## Config & Adapter Types

| Type | Description |
|------|-------------|
| `EmailRuleEngineConfig` | Top-level config passed to `createEmailRuleEngine()`. See adapter signatures below. |
| `SendEmailParams` | Params passed to the `sendEmail` adapter. Fields: `identifierId`, `contactId`, `accountId`, `subject`, `htmlBody`, `textBody`, `ruleId`, `autoApprove`, `attachments?`. |
| `EmailAttachment` | Attachment reference. Fields: `filename: string`, `url: string`, `contentType: string`. Used in templates and `SendEmailParams`. |
| `AgentSelection` | Return type of the `selectAgent` adapter. Fields: `accountId: string`, `email: string`, `metadata: Record<string, unknown>`. |
| `RecipientIdentifier` | Return type of the `findIdentifier` adapter. Fields: `id: string`, `contactId: string`. |
| `BeforeSendParams` | Params passed to the `beforeSend` hook. Fields: `htmlBody`, `textBody`, `subject`, `account: { id, email, metadata }`, `user: { id, email, name }`. |
| `BeforeSendResult` | Return type of the `beforeSend` hook. Fields: `htmlBody: string`, `textBody: string`, `subject: string`. |
| `LogAdapter` | Logger interface (re-exported from `@astralibx/core`). |
| `EmailRuleEngine` | Return type of `createEmailRuleEngine()`. Fields: `routes: Router`, `runner: RuleRunnerService`, `templateService: TemplateService`, `ruleService: RuleService`, `models`. |

### Required Adapter Signatures

```ts
adapters: {
  queryUsers: (target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>;
  resolveData: (user: Record<string, unknown>) => Record<string, unknown>;
  sendEmail: (params: SendEmailParams) => Promise<void>;
  selectAgent: (
    identifierId: string,
    context?: { ruleId: string; templateId: string }
  ) => Promise<AgentSelection | null>;
  findIdentifier: (email: string) => Promise<RecipientIdentifier | null>;
  // Optional
  sendTestEmail?: (to: string, subject: string, html: string, text: string, attachments?: EmailAttachment[]) => Promise<void>;
}
```

### Optional Hook Signatures

```ts
hooks?: {
  onRunStart?: (info: { rulesCount: number; triggeredBy: string }) => void;
  onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number }) => void;
  onSend?: (info: {
    ruleId: string; ruleName: string; email: string;
    status: 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled';
  }) => void;
  onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats }) => void;
  onRunComplete?: (info: {
    duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[];
  }) => void;
  beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
}
```

## Throttle Types

| Type | Description |
|------|-------------|
| `EmailThrottleConfig` | Throttle config document. Fields: `maxPerUserPerDay`, `maxPerUserPerWeek`, `minGapDays` (all `number`), `throttleWindow: ThrottleWindow`. |
| `UpdateEmailThrottleConfigInput` | Partial update input. Optional fields: `maxPerUserPerDay`, `maxPerUserPerWeek`, `minGapDays`. |

## Render Types

| Type | Description |
|------|-------------|
| `RenderResult` | Output of template rendering. Fields: `html: string`, `text: string`, `subject: string`. |
| `CompiledTemplate` | Compiled Handlebars template. Fields: `subjectFn`, `bodyFn`, `textBodyFn?` (all `HandlebarsTemplateDelegate`). |

## Constants

Each constant is an object whose values form the corresponding union type.

### `TEMPLATE_CATEGORY`

| Key | Value |
|-----|-------|
| `Onboarding` | `'onboarding'` |
| `Engagement` | `'engagement'` |
| `Transactional` | `'transactional'` |
| `ReEngagement` | `'re-engagement'` |
| `Announcement` | `'announcement'` |

Type: `TemplateCategory = 'onboarding' | 'engagement' | 'transactional' | 're-engagement' | 'announcement'`

Note: These are the default values. The `category` field on templates accepts `string` — custom values are validated at runtime via the `categories` config array.

### `TEMPLATE_AUDIENCE`

| Key | Value |
|-----|-------|
| `Customer` | `'customer'` |
| `Provider` | `'provider'` |
| `All` | `'all'` |

Type: `TemplateAudience = 'customer' | 'provider' | 'all'`

Note: These are the default values. The `audience` and `role` fields accept `string` — custom values (e.g., `'client'`, `'therapist'`) are validated at runtime via the `audiences` config array.

### `RULE_OPERATOR`

| Key | Value |
|-----|-------|
| `Eq` | `'eq'` |
| `Neq` | `'neq'` |
| `Gt` | `'gt'` |
| `Gte` | `'gte'` |
| `Lt` | `'lt'` |
| `Lte` | `'lte'` |
| `Exists` | `'exists'` |
| `NotExists` | `'not_exists'` |
| `In` | `'in'` |
| `NotIn` | `'not_in'` |
| `Contains` | `'contains'` |

Type: `RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'not_exists' | 'in' | 'not_in' | 'contains'`

### `EMAIL_TYPE`

| Key | Value |
|-----|-------|
| `Automated` | `'automated'` |
| `Transactional` | `'transactional'` |

Type: `EmailType = 'automated' | 'transactional'`

### `RUN_TRIGGER`

| Key | Value |
|-----|-------|
| `Cron` | `'cron'` |
| `Manual` | `'manual'` |

Type: `RunTrigger = 'cron' | 'manual'`

### `THROTTLE_WINDOW`

| Key | Value |
|-----|-------|
| `Rolling` | `'rolling'` |

Type: `ThrottleWindow = 'rolling'`

### `EMAIL_SEND_STATUS`

| Key | Value |
|-----|-------|
| `Sent` | `'sent'` |
| `Error` | `'error'` |
| `Skipped` | `'skipped'` |
| `Invalid` | `'invalid'` |
| `Throttled` | `'throttled'` |

Type: `EmailSendStatus = 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled'`

## Error Classes

All extend `AlxEmailError` (which extends `AlxError` from `@astralibx/core`).

| Class | Code | Constructor | Description |
|-------|------|-------------|-------------|
| `AlxEmailError` | *(custom)* | `(message: string, code: string)` | Base error for the email rule engine. |
| `ConfigValidationError` | `CONFIG_VALIDATION` | `(message: string, field: string)` | Invalid engine configuration. Exposes `field`. |
| `TemplateNotFoundError` | `TEMPLATE_NOT_FOUND` | `(templateId: string)` | Template lookup failed. Exposes `templateId`. |
| `TemplateSyntaxError` | `TEMPLATE_SYNTAX` | `(message: string, errors: string[])` | Handlebars/MJML compilation error. Exposes `errors[]`. |
| `RuleNotFoundError` | `RULE_NOT_FOUND` | `(ruleId: string)` | Rule lookup failed. Exposes `ruleId`. |
| `RuleTemplateIncompatibleError` | `RULE_TEMPLATE_INCOMPATIBLE` | `(reason: string)` | Rule/template audience or platform mismatch. Exposes `reason`. |
| `LockAcquisitionError` | `LOCK_ACQUISITION` | `()` | Another run is already in progress. |
| `DuplicateSlugError` | `DUPLICATE_SLUG` | `(slug: string)` | Template slug uniqueness violation. Exposes `slug`. |

## Mongoose Schema Types

These are useful if you need direct model access (e.g., custom queries).

| Type | Description |
|------|-------------|
| `IEmailTemplate` | Mongoose document interface for templates. |
| `EmailTemplateDocument` | Hydrated Mongoose document type. |
| `EmailTemplateModel` | Mongoose model type with statics. |
| `IEmailRule` | Mongoose document interface for rules. |
| `EmailRuleDocument` | Hydrated Mongoose document type. |
| `EmailRuleModel` | Mongoose model type with statics. |
| `IEmailRuleSend` | Mongoose document interface for send logs. |
| `EmailRuleSendDocument` | Hydrated Mongoose document type. |
| `EmailRuleSendModel` | Mongoose model type with statics. |
| `IEmailRuleRunLog` | Mongoose document interface for run logs. |
| `EmailRuleRunLogDocument` | Hydrated Mongoose document type. |
| `EmailRuleRunLogModel` | Mongoose model type with statics. |
| `IEmailThrottleConfig` | Mongoose document interface for throttle config. |
| `EmailThrottleConfigDocument` | Hydrated Mongoose document type. |
| `EmailThrottleConfigModel` | Mongoose model type with statics. |

Schema factory functions: `createEmailTemplateSchema()`, `createEmailRuleSchema()`, `createEmailRuleSendSchema()`, `createEmailRuleRunLogSchema()`, `createEmailThrottleConfigSchema()`.

## Services & Utilities

| Export | Description |
|--------|-------------|
| `createEmailRuleEngine(config)` | Factory function. Returns `EmailRuleEngine`. |
| `validateConfig(config)` | Validates `EmailRuleEngineConfig`, throws `ConfigValidationError` on failure. |
| `TemplateService` | CRUD operations for templates. |
| `RuleService` | CRUD operations for rules. |
| `RuleRunnerService` | Executes rule runs. Methods: `run()`, `getRunStatus()`, `cancelRun()`. |
| `TemplateRenderService` | Compiles and renders Handlebars + MJML templates. |
| `RedisLock` | Distributed lock utility using Redis. Re-exported from `@astralibx/core`. |

# Constants

All constants use `as const` objects with derived TypeScript types.

## Exported Constants

```typescript
import {
  TEMPLATE_CATEGORY,
  // { Onboarding: 'onboarding', Engagement: 'engagement', Transactional: 'transactional',
  //   ReEngagement: 're-engagement', Announcement: 'announcement' }

  TEMPLATE_AUDIENCE,
  // { Customer: 'customer', Provider: 'provider', All: 'all' }

  RULE_OPERATOR,
  // { Eq: 'eq', Neq: 'neq', Gt: 'gt', Gte: 'gte', Lt: 'lt', Lte: 'lte',
  //   Exists: 'exists', NotExists: 'not_exists', In: 'in', NotIn: 'not_in', Contains: 'contains' }

  EMAIL_TYPE,
  // { Automated: 'automated', Transactional: 'transactional' }

  RUN_TRIGGER,
  // { Cron: 'cron', Manual: 'manual' }

  THROTTLE_WINDOW,
  // { Rolling: 'rolling' }

  EMAIL_SEND_STATUS,
  // { Sent: 'sent', Error: 'error', Skipped: 'skipped', Invalid: 'invalid', Throttled: 'throttled' }

  TARGET_MODE,
  // { Query: 'query', List: 'list' }

  RUN_LOG_STATUS,
  // { Completed: 'completed', Cancelled: 'cancelled', Failed: 'failed' }
} from '@astralibx/email-rule-engine';
```

## Derived Types

Each constant has a corresponding union type derived from its values:

```typescript
import type {
  TemplateCategory,     // 'onboarding' | 'engagement' | 'transactional' | 're-engagement' | 'announcement'
  TemplateAudience,     // 'customer' | 'provider' | 'all'
  RuleOperator,         // 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'not_exists' | 'in' | 'not_in' | 'contains'
  EmailType,            // 'automated' | 'transactional'
  RunTrigger,           // 'cron' | 'manual'
  EmailSendStatus,      // 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled'
  TargetMode,           // 'query' | 'list'
  RunLogStatus,         // 'completed' | 'cancelled' | 'failed'
} from '@astralibx/email-rule-engine';
```

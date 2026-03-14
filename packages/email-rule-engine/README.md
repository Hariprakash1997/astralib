# @astralibx/email-rule-engine

Rule-based email automation engine with MJML + Handlebars templates, per-user throttling, and Redis distributed locking.

## What It Does

- **Templates**: MJML + Handlebars email templates with CRUD, validation, preview, and variable extraction
- **Rules**: Condition-based rules that target users and send templated emails
- **Throttling**: Per-user daily/weekly limits with configurable minimum gap between emails
- **Distributed Locking**: Redis-based locks prevent concurrent rule runs
- **Run History**: Detailed logging of every rule execution with per-rule stats
- **Draft Workflow**: Supports draft → approve → send pipeline via adapter

## Prerequisites

| Dependency | Version | Why |
|------------|---------|-----|
| Node.js | >= 18 | Runtime |
| MongoDB | >= 5.0 | Data storage |
| Redis | >= 6.0 | Distributed locking |

### Peer Dependencies

These must be installed in your project:

```bash
npm install express mongoose ioredis handlebars mjml html-to-text
```

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18 or ^5.0 | HTTP routes |
| `mongoose` | ^7.0 or ^8.0 | MongoDB ODM |
| `ioredis` | ^5.0 | Redis client |
| `handlebars` | ^4.7 | Template variables |
| `mjml` | ^4.0 | Responsive email HTML |
| `html-to-text` | ^9.0 | Plain text fallback |

## Installation

```bash
npm install @astralibx/email-rule-engine
```

## How It Works

The engine handles the **generic plumbing** — templates, rules, throttling, locking, REST API routes, and run history. Your project provides the **specific logic** through 5 adapter functions.

```
┌─────────────────────────────────────────────────────────┐
│                  YOUR APPLICATION                        │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  queryUsers   │  │  resolveData  │  │  sendEmail    │  │
│  │  (find who    │  │  (map user to │  │  (deliver or  │  │
│  │   to email)   │  │   template    │  │   save draft) │  │
│  │              │  │   variables)  │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴───────┐  ┌──────┴───────┐                    │
│  │ selectAgent   │  │findIdentifier│                    │
│  │ (pick sender) │  │ (map email   │                    │
│  │              │  │  to contact)  │                    │
│  └──────┬───────┘  └──────┬───────┘                    │
└─────────┼─────────────────┼────────────────────────────┘
          │                 │
┌─────────▼─────────────────▼────────────────────────────┐
│           @astralibx/email-rule-engine                   │
│                                                          │
│  Templates ─► Rules ─► Runner ─► Throttle ─► Lock       │
│  MJML/HBS     CRUD     Execute    Per-user    Redis      │
│  Render       Match    Adapters   Limits     Prevent     │
│                                              Duplicates  │
│                                                          │
│  REST API: /templates, /rules, /runner, /settings        │
│  MongoDB:  5 collections auto-created                    │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### Step 1: Create Adapters

These are the 5 functions that connect the engine to YOUR data and infrastructure.

```typescript
// adapters.ts
import { SendEmailParams } from '@astralibx/email-rule-engine';

// 1. Find users matching rule conditions — YOUR query logic
async function queryUsers(target: any, limit: number) {
  // `target` contains: { role, platform, conditions[] }
  // Build your own query based on these conditions
  return db.collection('users')
    .find({ role: target.role, platform: target.platform })
    .limit(limit)
    .toArray();
}

// 2. Transform a user record into template variables
// These variables become available in your Handlebars templates
function resolveData(user: Record<string, unknown>) {
  return {
    user: {
      name: user.name,
      email: user.email,
    },
    platform: {
      name: 'My App',
      domain: 'myapp.com',
      supportEmail: 'help@myapp.com',
    },
  };
}

// 3. Deliver the email — save as draft, send directly, or queue
async function sendEmail(params: SendEmailParams) {
  // params contains:
  //   identifierId  - your internal email contact ID
  //   contactId     - your internal contact ID
  //   accountId     - selected sender account ID
  //   subject       - rendered subject line
  //   htmlBody      - rendered HTML (from MJML)
  //   textBody      - rendered plain text
  //   ruleId        - which rule triggered this
  //   autoApprove   - whether to send immediately or queue for review
  await myEmailService.send({
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
  });
}

// 4. Select a sending account — return null to skip this recipient
async function selectAgent(identifierId: string) {
  const account = await myAccounts.findBestAvailable();
  return account ? { accountId: account.id } : null;
}

// 5. Map an email address to your contact/identifier system
async function findIdentifier(email: string) {
  const contact = await myContacts.findByEmail(email);
  return contact
    ? { id: contact._id.toString(), contactId: contact.contactId.toString() }
    : null;
}

export const adapters = {
  queryUsers,
  resolveData,
  sendEmail,
  selectAgent,
  findIdentifier,
};
```

### Step 2: Initialize the Engine

```typescript
// email-engine-setup.ts
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { adapters } from './adapters';

const dbConnection = mongoose.createConnection('mongodb://localhost/myapp');
const redis = new Redis();

const engine = createEmailRuleEngine({
  // MongoDB connection — engine creates 5 collections on this connection
  db: {
    connection: dbConnection,
    collectionPrefix: '',  // optional: prefix collection names (e.g., 'myapp_')
  },

  // Redis — used for distributed locking only
  redis: {
    connection: redis,
    keyPrefix: 'myapp:',  // optional: prefix Redis keys
  },

  // Custom enum values for your domain
  // These control what values are allowed in template/rule schemas
  platforms: ['web', 'mobile', 'both'],        // your platform identifiers
  audiences: ['customer', 'provider', 'all'],   // your user role identifiers

  // Your 5 adapter functions
  adapters,

  // Optional: logger (must have info/warn/error methods)
  logger: console,

  // Optional: tuning
  options: {
    lockTTLMs: 30 * 60 * 1000,  // lock timeout (default: 30 min)
    defaultMaxPerRun: 500,       // max users per rule execution (default: 500)
  },
});

export { engine };
```

### Step 3: Mount Routes

```typescript
// app.ts
import express from 'express';
import { engine } from './email-engine-setup';

const app = express();
app.use(express.json());

// Mount all email rule engine routes under a prefix
app.use('/api/email-rules', engine.routes);

app.listen(3000);
```

### Step 4: Schedule Rule Execution

```typescript
import cron from 'node-cron';
import { engine } from './email-engine-setup';

// Run all active rules every day at 9 AM
cron.schedule('0 9 * * *', () => {
  engine.runner.runAllRules();
});
```

## What You Get Back

`createEmailRuleEngine()` returns:

```typescript
{
  routes: Router;              // Express router — mount with app.use()
  runner: RuleRunnerService;   // Call runner.runAllRules() from cron
  templateService: TemplateService;  // Direct access if needed
  ruleService: RuleService;          // Direct access if needed
  models: {
    EmailTemplate,    // Mongoose models if you need direct DB access
    EmailRule,
    EmailRuleSend,
    EmailRuleRunLog,
    EmailThrottleConfig,
  };
}
```

## API Routes

Once mounted, these endpoints are available:

### Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List all templates (filterable by `category`, `audience`, `platform`) |
| POST | `/templates` | Create new template |
| GET | `/templates/:id` | Get template by ID |
| PUT | `/templates/:id` | Update template |
| DELETE | `/templates/:id` | Delete template |
| PATCH | `/templates/:id/toggle` | Toggle active/inactive |
| POST | `/templates/:id/preview` | Render preview with sample data |
| POST | `/templates/:id/test-email` | Send test email (requires `sendTestEmail` adapter) |
| POST | `/templates/validate` | Validate MJML + Handlebars syntax |
| POST | `/templates/preview` | Preview raw template without saving |

### Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rules` | List all rules (with populated template info) |
| POST | `/rules` | Create new rule |
| GET | `/rules/:id` | Get rule by ID |
| PATCH | `/rules/:id` | Update rule |
| DELETE | `/rules/:id` | Delete (or disable if has send history) |
| PATCH | `/rules/:id/toggle` | Toggle active/inactive |
| POST | `/rules/:id/dry-run` | Count matching users without sending |
| GET | `/rules/run-history` | Get execution history |

### Runner

| Method | Path | Description |
|--------|------|-------------|
| POST | `/runner` | Trigger manual rule run (fire-and-forget) |
| GET | `/runner/status` | Get latest run result |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/throttle` | Get throttle configuration |
| PATCH | `/settings/throttle` | Update throttle limits |

## Config Reference

### `EmailRuleEngineConfig`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `db.connection` | `mongoose.Connection` | Yes | — | Mongoose connection for engine collections |
| `db.collectionPrefix` | `string` | No | `''` | Prefix for collection names (e.g., `'myapp_'`) |
| `redis.connection` | `Redis` | Yes | — | ioredis instance for distributed locking |
| `redis.keyPrefix` | `string` | No | `''` | Prefix for Redis keys (e.g., `'myapp:'`) |
| `platforms` | `string[]` | No | `['web', 'mobile', 'both']` | Valid platform values for schema enum validation |
| `audiences` | `string[]` | No | `['customer', 'provider', 'all']` | Valid audience/role values for schema enum validation |
| `adapters` | `object` | Yes | — | Your 5 project-specific callbacks (see below) |
| `logger` | `LogAdapter` | No | silent | Object with `info`, `warn`, `error` methods |
| `options.lockTTLMs` | `number` | No | `1800000` | Lock timeout in ms (30 min) |
| `options.defaultMaxPerRun` | `number` | No | `500` | Max users processed per rule execution |

### Adapters

| Adapter | Signature | Required | Description |
|---------|-----------|----------|-------------|
| `queryUsers` | `(target, limit) => Promise<Record[]>` | Yes | Find users matching rule target conditions. `target` has `role`, `platform`, `conditions[]` |
| `resolveData` | `(user) => Record` | Yes | Transform a user record into Handlebars template variables |
| `sendEmail` | `(params: SendEmailParams) => Promise<void>` | Yes | Deliver the email (send, queue, or save as draft) |
| `selectAgent` | `(identifierId) => Promise<{accountId} \| null>` | Yes | Pick a sending account. Return `null` to skip this recipient |
| `findIdentifier` | `(email) => Promise<{id, contactId} \| null>` | Yes | Map email address to your contact system. Return `null` to skip |
| `sendTestEmail` | `(to, subject, html, text) => Promise<void>` | No | Send test email for template preview |

### `SendEmailParams`

```typescript
{
  identifierId: string;   // Your internal email contact ID
  contactId: string;      // Your internal contact ID
  accountId: string;      // Selected sender account ID
  subject: string;        // Rendered subject line
  htmlBody: string;       // Rendered HTML from MJML template
  textBody: string;       // Rendered plain text
  ruleId: string;         // Rule that triggered this send
  autoApprove: boolean;   // true = send now, false = save as draft for review
}
```

## Template System

Templates use [MJML](https://mjml.io/) for responsive email HTML and [Handlebars](https://handlebarsjs.com/) for dynamic variables.

### Writing a Template

**Subject** (Handlebars only):
```
Welcome to {{platform.name}}, {{user.name}}!
```

**Body** (MJML + Handlebars):
```html
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Hi {{user.name}},
          Welcome to {{platform.name}}!
          {{#if subscription}}
            Your {{subscription.planName}} plan includes {{subscription.sessions}} sessions.
          {{/if}}
        </mj-text>
        <mj-button href="{{platform.bookingLink}}">Book Now</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

The variables available in templates depend on what your `resolveData` adapter returns.

### Built-in Handlebars Helpers

| Helper | Usage | Output |
|--------|-------|--------|
| `currency` | `{{currency 1500}}` | `₹1,500` |
| `formatDate` | `{{formatDate date}}` | `13 Mar 2026` |
| `capitalize` | `{{capitalize "hello"}}` | `Hello` |
| `lowercase` | `{{lowercase "HELLO"}}` | `hello` |
| `uppercase` | `{{uppercase "hello"}}` | `HELLO` |
| `join` | `{{join items ", "}}` | `a, b, c` |
| `pluralize` | `{{pluralize count "item" "items"}}` | `items` |
| `eq/neq/gt/lt/gte/lte` | `{{#if (eq a b)}}` | Comparison |
| `not` | `{{#if (not val)}}` | Negation |

## Rule Execution Flow

When `engine.runner.runAllRules()` is called:

```
1. Acquire Redis lock (prevents concurrent runs)
2. Load throttle config (daily/weekly limits, min gap)
3. Load all active rules (sorted by priority)
4. For each rule:
   a. Load linked template
   b. Call YOUR queryUsers(target, limit) adapter
   c. For each matched user:
      - Check send history (sendOnce, resendAfterDays)
      - Call YOUR findIdentifier(email) adapter
      - Check throttle limits (daily, weekly, min gap)
      - Call YOUR selectAgent(identifierId) adapter
      - Call YOUR resolveData(user) adapter
      - Render template (MJML → HTML, Handlebars → variables)
      - Call YOUR sendEmail(params) adapter
      - Log send for deduplication
   d. Update rule stats (totalSent, lastRunAt)
5. Save run log with per-rule statistics
6. Release Redis lock
```

## Collections Created

The engine creates these MongoDB collections (prefixed if `db.collectionPrefix` is set):

| Collection | Purpose | Auto-cleanup |
|------------|---------|--------------|
| `email_templates` | MJML + Handlebars templates | — |
| `email_rules` | Automation rules with conditions and targeting | — |
| `email_rule_sends` | Per-user send tracking for deduplication | — |
| `email_rule_run_logs` | Execution history with per-rule stats | 90 days TTL |
| `email_throttle_config` | Throttle settings (singleton document) | — |

## Throttle Configuration

Default throttle settings (configurable via `PATCH /settings/throttle`):

```json
{
  "maxPerUserPerDay": 2,
  "maxPerUserPerWeek": 5,
  "minGapDays": 1,
  "window": "rolling"
}
```

Rules with `bypassThrottle: true` or `emailType: 'transactional'` skip throttle checks.

## TypeScript Exports

The package exports everything you might need:

```typescript
// Factory
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';

// Types
import type {
  EmailRuleEngineConfig,
  SendEmailParams,
  AgentSelection,
  RecipientIdentifier,
  LogAdapter,
  EmailRule,
  EmailTemplate,
  RuleTarget,
  RuleCondition,
  RuleRunStats,
  PerRuleStats,
  CreateEmailRuleInput,
  UpdateEmailRuleInput,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from '@astralibx/email-rule-engine';

// Enums
import {
  TemplateAudience,
  TemplateCategory,
  RuleOperator,
  EmailType,
  RunTrigger,
} from '@astralibx/email-rule-engine';

// Services (for advanced usage)
import {
  TemplateRenderService,
  TemplateService,
  RuleService,
  RuleRunnerService,
  RedisLock,
} from '@astralibx/email-rule-engine';
```

## License

MIT

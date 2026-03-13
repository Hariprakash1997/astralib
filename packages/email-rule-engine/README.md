# @astralib/email-rule-engine

Rule-based email automation engine with MJML + Handlebars templates, per-user throttling, and Redis distributed locking.

## What It Does

- **Templates**: MJML + Handlebars email templates with CRUD, validation, preview, and variable extraction
- **Rules**: Condition-based rules that target users and send templated emails
- **Throttling**: Per-user daily/weekly limits with configurable minimum gap between emails
- **Distributed Locking**: Redis-based locks prevent concurrent rule runs
- **Run History**: Detailed logging of every rule execution with per-rule stats
- **Draft Workflow**: Supports draft → approve → send pipeline via adapter

## Quick Start

```bash
npm install @astralib/email-rule-engine
```

```typescript
import { createEmailRuleEngine } from '@astralib/email-rule-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';

const dbConnection = mongoose.createConnection('mongodb://localhost/myapp');
const redis = new Redis();

const engine = createEmailRuleEngine({
  db: { connection: dbConnection },
  redis: { connection: redis, keyPrefix: 'myapp:' },

  // Your platform values (used for enum validation in schemas)
  platforms: ['web', 'mobile', 'both'],

  adapters: {
    // Find users matching rule conditions — YOUR query logic
    queryUsers: async (target, limit) => {
      return db.collection('users')
        .find({ role: target.role })
        .limit(limit)
        .toArray();
    },

    // Transform user record into template variables
    resolveData: (user) => ({
      recipient: { name: user.name, email: user.email },
      platform: { name: 'My App', domain: 'myapp.com' }
    }),

    // Deliver the email (save as draft, send directly, queue — your choice)
    sendEmail: async (params) => {
      await myEmailService.send({
        to: params.identifierId,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody
      });
    },

    // Select a sending account (return null to skip recipient)
    selectAgent: async (identifierId) => {
      const account = await myAccounts.findBest();
      return account ? { accountId: account.id } : null;
    },

    // Map email address to your identifier system
    findIdentifier: async (email) => {
      const id = await myIdentifiers.findByEmail(email);
      return id ? { id: id._id, contactId: id.contactId } : null;
    },

    // Optional: send test emails
    sendTestEmail: async (to, subject, html, text) => {
      await mySmtp.send({ to, subject, html, text });
    }
  },

  logger: console,

  options: {
    lockTTLMs: 30 * 60 * 1000,  // 30 min lock timeout
    defaultMaxPerRun: 500        // max users per rule execution
  }
});

// Mount Express routes
app.use('/api/email-rules', engine.routes);

// Run rules via cron
cron.schedule('0 9 * * *', () => engine.runner.runAllRules());
```

## API Routes

Once mounted, the engine exposes these endpoints:

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List all templates (filterable by category, audience, platform) |
| POST | `/templates` | Create new template |
| GET | `/templates/:id` | Get template by ID |
| PUT | `/templates/:id` | Update template |
| DELETE | `/templates/:id` | Delete template |
| PATCH | `/templates/:id/toggle` | Toggle active/inactive |
| POST | `/templates/:id/preview` | Render preview with sample data |
| POST | `/templates/:id/test-email` | Send test email |
| POST | `/templates/validate` | Validate MJML + Handlebars syntax |
| POST | `/templates/preview` | Preview raw template (without saving) |

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `db.connection` | `mongoose.Connection` | Yes | Mongoose connection for rule engine collections |
| `db.collectionPrefix` | `string` | No | Prefix for collection names (e.g., `'myapp_'`) |
| `redis.connection` | `Redis` | Yes | ioredis instance for distributed locking |
| `redis.keyPrefix` | `string` | No | Prefix for Redis keys (e.g., `'myapp:'`) |
| `platforms` | `string[]` | No | Valid platform values for schema validation |
| `adapters` | object | Yes | Project-specific callbacks (see below) |
| `logger` | `LogAdapter` | No | Logger with info/warn/error methods |
| `options.lockTTLMs` | `number` | No | Lock timeout in ms (default: 30 min) |
| `options.defaultMaxPerRun` | `number` | No | Default user limit per rule (default: 500) |

### Adapters

| Adapter | Signature | Description |
|---------|-----------|-------------|
| `queryUsers` | `(target, limit) => Promise<Record[]>` | Find users matching rule conditions |
| `resolveData` | `(user) => Record` | Map user to template variables |
| `sendEmail` | `(params) => Promise<void>` | Deliver or draft the email |
| `selectAgent` | `(identifierId) => Promise<{accountId} \| null>` | Pick sending account |
| `findIdentifier` | `(email) => Promise<{id, contactId} \| null>` | Map email to identifier |
| `sendTestEmail` | `(to, subject, html, text) => Promise<void>` | Optional: send test emails |

## Handlebars Helpers

Built-in template helpers available in all templates:

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

## Collections Created

The engine creates these MongoDB collections (prefixed if configured):

| Collection | Purpose | TTL |
|------------|---------|-----|
| `email_templates` | MJML + Handlebars templates | - |
| `email_rules` | Automation rules with conditions | - |
| `email_rule_sends` | Per-user send tracking (dedup) | - |
| `email_rule_run_logs` | Execution history | 90 days |
| `email_throttle_config` | Throttle settings (singleton) | - |

## License

MIT

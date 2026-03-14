# @astralibx/email-rule-engine

[![npm version](https://img.shields.io/npm/v/@astralibx/email-rule-engine.svg)](https://www.npmjs.com/package/@astralibx/email-rule-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Rule-based email automation engine for Node.js. Define targeting rules with conditions, design responsive emails with MJML + Handlebars templates, and let the engine handle per-user throttling, send deduplication, distributed locking, and delivery scheduling. Ships with Express REST routes for admin UIs and a programmatic API for direct service access.

## Install

```bash
npm install @astralibx/email-rule-engine
```

**Peer dependencies:**

| Peer Dependency | Version |
|-----------------|---------|
| `express` | `^4.18.0 \|\| ^5.0.0` |
| `mongoose` | `^7.0.0 \|\| ^8.0.0` |
| `ioredis` | `^5.0.0` |
| `handlebars` | `^4.7.0` |
| `mjml` | `^4.0.0` |
| `html-to-text` | `^9.0.0` |

```bash
npm install express mongoose ioredis handlebars mjml html-to-text
```

## Quick Start

```typescript
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';

const app = express();
app.use(express.json());

const dbConnection = mongoose.createConnection('mongodb://localhost/myapp');
const redis = new Redis();

const engine = createEmailRuleEngine({
  db: { connection: dbConnection },
  redis: { connection: redis },
  adapters: {
    queryUsers: async (target, limit) => {
      return User.find({ role: target.role, platform: target.platform }).limit(limit).lean();
    },
    resolveData: (user) => ({
      user: { name: user.name, email: user.email },
      platform: { name: 'MyApp', domain: 'myapp.com' },
    }),
    sendEmail: async (params) => {
      await transporter.sendMail({
        to: params.identifierId,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody,
      });
    },
    selectAgent: async () => ({ accountId: 'default' }),
    findIdentifier: async (email) => {
      const contact = await Contact.findOne({ email });
      return contact ? { id: contact._id.toString(), contactId: contact._id.toString() } : null;
    },
  },
});

// Mount REST routes
app.use('/api/email-rules', engine.routes);

// Trigger a run programmatically (e.g., from a cron job)
// await engine.runner.runAllRules('cron');

app.listen(3000);
```

The factory returns an `EmailRuleEngine` instance with:

- `routes` -- Express Router with all CRUD and runner endpoints
- `runner` -- `RuleRunnerService` for triggering runs programmatically
- `templateService` -- `TemplateService` for CRUD and preview
- `ruleService` -- `RuleService` for CRUD and dry runs
- `models` -- Direct Mongoose model access (`EmailTemplate`, `EmailRule`, `EmailRuleSend`, `EmailRuleRunLog`, `EmailThrottleConfig`)

## Configuration

The `createEmailRuleEngine(config)` factory accepts an `EmailRuleEngineConfig` object validated at startup with Zod.

| Section | Required | Description |
|---------|----------|-------------|
| `db` | Yes | Mongoose connection and optional collection prefix |
| `redis` | Yes | ioredis connection for distributed locking |
| `adapters` | Yes | 5 required + 1 optional function bridging your app to the engine |
| `platforms` | No | Valid platform values for schema validation |
| `audiences` | No | Valid audience/role values for schema validation |
| `categories` | No | Valid template categories for schema validation |
| `options` | No | Lock TTL, max per run, send window, delays |
| `hooks` | No | Callbacks at key execution points |
| `logger` | No | Logger with `info`, `warn`, `error` methods |

See [docs/configuration.md](docs/configuration.md) for the full reference with examples.

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration](docs/configuration.md) | Full config reference -- db, redis, adapters, platforms, options, hooks, logger |
| [Adapters](docs/adapters.md) | All 6 adapters with type signatures and example implementations |
| [Templates](docs/templates.md) | Creating templates, MJML + Handlebars syntax, built-in helpers |
| [Rules](docs/rules.md) | Targeting conditions, operators, sendOnce/resend, dry runs |
| [Throttling](docs/throttling.md) | Per-user limits, global caps, bypass rules, tracking |
| [API Routes](docs/api-routes.md) | All REST endpoints with curl examples |
| [Programmatic API](docs/programmatic-api.md) | Using services directly -- runner, templateService, ruleService |
| [Execution Flow](docs/execution-flow.md) | Step-by-step runner flow and error behavior |
| [Error Handling](docs/error-handling.md) | All error classes with codes and when thrown |
| [Constants](docs/constants.md) | All exported constants and derived types |
| [Migration v1 to v2](docs/migration-v1-to-v2.md) | Breaking changes from v1 |

## License

MIT

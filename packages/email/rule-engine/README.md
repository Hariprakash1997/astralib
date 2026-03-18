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
| `@astralibx/core` | `^1.2.0` |
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
    selectAgent: async () => ({ accountId: 'default', email: 'noreply@myapp.com', metadata: {} }),
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
- `scheduler` -- `SchedulerService` for cron-based scheduled rule execution
- `templateService` -- `TemplateService` for CRUD, preview, and cloning (`POST /templates/:id/clone`, `POST /templates/:id/preview-with-data`)
- `ruleService` -- `RuleService` for CRUD, dry runs, and cloning (`POST /rules/:id/clone`)
- `models` -- Direct Mongoose model access (`EmailTemplate`, `EmailRule`, `EmailRuleSend`, `EmailRuleRunLog`, `EmailThrottleConfig`)

The `routes` router includes `GET /sends` for querying individual send log records and `schedule` field support on rules for cron-based execution.

## Configuration

The `createEmailRuleEngine(config)` factory accepts an `EmailRuleEngineConfig` object validated at startup with Zod.

| Section | Required | Description |
|---------|----------|-------------|
| `db` | Yes | Mongoose connection and optional collection prefix |
| `redis` | Yes | ioredis connection for distributed locking |
| `adapters` | Yes | 5 required + 1 optional function bridging your app to the engine |
| `collections` | No | MongoDB collection schemas for field dropdowns, type-aware operators, and validation |
| `platforms` | No | Valid platform values for schema validation |
| `audiences` | No | Valid audience/role values for schema validation |
| `categories` | No | Valid template categories for schema validation |
| `options` | No | Lock TTL, max per run, send window, delays |
| `hooks` | No | Callbacks at key execution points |
| `logger` | No | Logger with `info`, `warn`, `error` methods |

See [docs/configuration.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/configuration.md) for the full reference with examples.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/configuration.md) — Set up database, Redis, and options
2. [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/adapters.md) — Implement the 6 required adapter functions
3. [Templates](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/templates.md) — Create email templates with MJML + Handlebars
4. [Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/rules.md) — Define targeting rules with conditions or explicit lists
5. [Execution Flow](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/execution-flow.md) — Understand how the runner processes rules
6. [Throttling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/throttling.md) — Configure per-user send limits

7. [Collections](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/collections.md) — Register collection schemas for field dropdowns and type-aware validation

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/api-routes.md) | [Programmatic API](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/programmatic-api.md) | [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/types.md) | [Constants](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/constants.md) | [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/error-handling.md)

### Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, run locks, cancel flags, and progress keys will collide between projects.

```typescript
const engine = createEmailRuleEngine({
  redis: {
    connection: redis,
    keyPrefix: 'myproject:', // REQUIRED if sharing Redis
  },
  // ...
});
```

| Default | Risk |
|---------|------|
| `''` (empty) | Two projects share global keys like `email-rule-runner:lock` and `run:{id}:cancel` — Project A can cancel Project B's runs |

**Always set a unique prefix** like `projectname:` when sharing Redis.

> **Important:** Configure throttle settings before running rules. Default limits (1/day, 2/week) may be too restrictive. See [Throttling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/throttling.md).

## License

MIT

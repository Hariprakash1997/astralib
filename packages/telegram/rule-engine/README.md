# @astralibx/telegram-rule-engine

[![npm version](https://img.shields.io/npm/v/@astralibx/telegram-rule-engine.svg)](https://www.npmjs.com/package/@astralibx/telegram-rule-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Rule-based Telegram message automation engine for Node.js. Define targeting rules with conditions, compose messages with Handlebars templates and media attachments, and let the engine handle per-user throttling, send deduplication, distributed locking, and delivery scheduling. Ships with Express REST routes for admin UIs and a programmatic API for direct service access.

## Install

```bash
npm install @astralibx/telegram-rule-engine
```

**Peer dependencies:**

| Peer Dependency | Version |
|-----------------|---------|
| `express` | `^4.18.0 \|\| ^5.0.0` |
| `mongoose` | `^7.0.0 \|\| ^8.0.0` |
| `ioredis` | `^5.0.0` |

```bash
npm install express mongoose ioredis
```

## Quick Start

```typescript
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createTelegramRuleEngine } from '@astralibx/telegram-rule-engine';

const app = express();
app.use(express.json());

const dbConnection = mongoose.createConnection('mongodb://localhost/myapp');
const redis = new Redis();

const engine = createTelegramRuleEngine({
  db: { connection: dbConnection },
  redis: { connection: redis },
  adapters: {
    queryUsers: async (target, limit) => {
      return User.find(target.conditions).limit(limit).lean();
    },
    resolveData: (user) => ({
      user: { name: user.name },
      platform: { name: 'MyApp' },
    }),
    sendMessage: async (params) => {
      await telegramClient.sendMessage(params.identifierId, params.message, params.media);
    },
    selectAccount: async () => ({ accountId: 'default', phone: '+919876543210', metadata: {} }),
    findIdentifier: async (phoneOrUsername) => {
      const contact = await Contact.findOne({ phone: phoneOrUsername });
      return contact ? { id: contact._id.toString(), contactId: contact._id.toString() } : null;
    },
  },
});

// Mount REST routes
app.use('/api/telegram-rules', engine.routes);

// Trigger a run programmatically (e.g., from a cron job)
// engine.runner.trigger('cron');

app.listen(3000);
```

The factory returns a `TelegramRuleEngine` instance with:

- `routes` -- Express Router with all CRUD, runner, analytics, and settings endpoints
- `runner` -- `RuleRunnerService` for triggering runs programmatically
- `templateService` -- `TemplateService` for CRUD and preview
- `ruleService` -- `RuleService` for CRUD and dry runs
- `models` -- Direct Mongoose model access (`TelegramTemplate`, `TelegramRule`, `TelegramSendLog`, `TelegramRunLog`, `TelegramErrorLog`, `TelegramThrottleConfig`)

## Configuration

The `createTelegramRuleEngine(config)` factory accepts a `TelegramRuleEngineConfig` object validated at startup with Zod.

| Section | Required | Description |
|---------|----------|-------------|
| `db` | Yes | Mongoose connection and optional collection prefix |
| `redis` | Yes | ioredis connection for distributed locking |
| `adapters` | Yes | 5 required functions bridging your app to the engine |
| `platforms` | No | Valid platform values for schema validation |
| `audiences` | No | Valid audience/role values for schema validation |
| `categories` | No | Valid template categories for schema validation |
| `options` | No | Lock TTL, max per run, send window, delays, human-like timing |
| `hooks` | No | Callbacks at key execution points |
| `logger` | No | Logger with `info`, `warn`, `error` methods |

See [docs/configuration.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/configuration.md) for the full reference with examples.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/configuration.md) -- Set up database, Redis, adapters, and options
2. [Templates](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/templates.md) -- Create message templates with Handlebars and media
3. [Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/rules.md) -- Define targeting rules with conditions or explicit lists

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/api-routes.md) | [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/types.md)

### Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, run locks, cancel flags, and progress keys will collide between projects.

```typescript
const engine = createTelegramRuleEngine({
  redis: {
    connection: redis,
    keyPrefix: 'myproject:', // REQUIRED if sharing Redis
  },
  // ...
});
```

| Default | Risk |
|---------|------|
| `''` (empty) | Two projects share global keys like `tg-rule-engine:lock` and `run:{id}:cancel` -- Project A can cancel Project B's runs |

**Always set a unique prefix** like `projectname:` when sharing Redis.

> **Important:** Configure throttle settings before running rules. Default limits (1/day, 2/week, 3 day gap) may be too restrictive. See the throttle settings API in [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/docs/api-routes.md#settings-throttle).

## License

MIT

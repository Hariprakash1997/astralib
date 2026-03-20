# @astralibx/rule-engine

Platform-agnostic rule engine for targeting, template rendering, throttling, and send orchestration across any channel.

## Features

- Factory function returns `routes`, `services`, and `models` in a single call
- Adapter-based dependency injection — your app controls user queries, data resolution, and delivery
- Handlebars templates with multi-variant subjects and bodies (A/B rotation)
- Templates own their data source via `collectionName` and `joins`
- Per-user throttling with daily/weekly caps, cooldown, and deduplication via Redis
- Distributed run locking to prevent overlapping scheduler executions
- `query` targeting (conditions on user fields) and `list` targeting (explicit identifiers)
- Cron scheduling per rule with timezone support
- Full lifecycle hooks: `onRunStart`, `onRuleStart`, `onSend`, `beforeSend`, `onRunComplete`
- Platform wrappers (`@astralibx/email-rule-engine`, `@astralibx/telegram-rule-engine`) add rendering on top

## Architecture

```
Consumer App
     │
     ▼
createRuleEngine(config)
     │
     ├─── routes    →  Express Router (mount anywhere)
     ├─── services  →  { template, rule, runner }
     └─── models    →  { Template, Rule, SendLog, RunLog, ErrorLog, ThrottleConfig }

config.adapters
     ├─── queryUsers(target, limit, ctx)     →  fetch matching users from your DB
     ├─── resolveData(user)                  →  map user to Handlebars context
     ├─── send(params)                       →  deliver the rendered message
     ├─── selectAgent(identifierId, ctx)     →  pick a sending account
     └─── findIdentifier(contactValue)       →  resolve contact to RecipientIdentifier

config.collections   →  CollectionSchema[] describing joins available to templates
config.platforms     →  string[] used for enum validation on templates and rules
config.options       →  sendWindow, throttle defaults, jitter, delay between sends
config.hooks         →  lifecycle callbacks (no library internals modified)
```

## Design Principles

- **Factory pattern** — `createRuleEngine(config)` returns everything; no global singletons or static state.
- **Adapter-based DI** — five adapter functions decouple the engine from your user model, data layer, and transport.
- **Templates own their data source** — each template declares `collectionName` and `joins`; the engine resolves data automatically at run time.
- **Shared collections with platform field** — one MongoDB connection serves all platforms; `platform` on every document namespaces the data.
- **Zero business logic** — the engine handles infrastructure (throttling, locking, scheduling, logging); adapters define what gets sent to whom.
- **Production-safe defaults** — send windows, jitter, per-run caps, and Redis locking are on by default to prevent runaway sends.

## Quick Start

```typescript
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createRuleEngine } from '@astralibx/rule-engine';

const app = express();
app.use(express.json());

const db = mongoose.createConnection('mongodb://localhost:27017/myapp');
const redis = new Redis();

const engine = createRuleEngine({
  db: { connection: db, collectionPrefix: 'myapp_' },
  redis: { connection: redis, keyPrefix: 'myapp:re:' },

  platforms: ['email', 'telegram'],
  audiences: ['users', 'admins'],
  categories: ['onboarding', 'marketing'],

  adapters: {
    queryUsers: async (target, limit, ctx) => {
      // Use target.mode === 'query' for condition-based or 'list' for explicit ids
      return db.collection('users').find({}).limit(limit).toArray();
    },
    resolveData: (user) => ({
      user: { name: user.name, email: user.email },
      platform: { name: 'MyApp' },
    }),
    send: async (params) => {
      // params: { identifierId, contactId, accountId, subject, body, ruleId, autoApprove }
      await myTransport.send(params);
    },
    selectAgent: async (identifierId, ctx) => {
      const account = await myAccountPool.getBest();
      if (!account) return null;
      return { accountId: account.id, contactValue: account.address, metadata: {} };
    },
    findIdentifier: async (contactValue) => {
      const rec = await db.collection('identifiers').findOne({ value: contactValue });
      return rec ? { id: rec._id.toString(), contactId: rec.contactId } : null;
    },
  },

  collections: [
    {
      name: 'orders',
      collectionName: 'myapp_orders',
      label: 'Orders',
      fields: [{ name: 'status', type: 'string' }, { name: 'total', type: 'number' }],
    },
  ],

  hooks: {
    onSend: (info) => console.log(`Sent to ${info.contactValue} — rule: ${info.ruleName}`),
  },
});

app.use('/api/rule-engine', engine.routes);
app.listen(3000);
```

## API Routes

All routes are mounted under the prefix you choose (e.g. `/api/rule-engine`).

| Resource | Routes |
|----------|--------|
| **Templates** | `GET /templates` · `POST /templates` · `POST /templates/validate` · `POST /templates/preview` · `GET /:id` · `PUT /:id` · `DELETE /:id` · `PATCH /:id/toggle` · `POST /:id/preview` · `POST /:id/preview-with-data` · `POST /:id/test-send` · `POST /:id/clone` |
| **Rules** | `GET /rules` · `POST /rules` · `POST /rules/preview-conditions` · `GET /:id` · `PATCH /:id` · `DELETE /:id` · `POST /:id/toggle` · `POST /:id/dry-run` · `POST /:id/clone` |
| **Runner** | `POST /runner` · `GET /runner/status` · `GET /runner/status/:runId` · `POST /runner/cancel/:runId` · `GET /runner/logs` |
| **Sends** | `GET /sends` |
| **Collections** | `GET /collections` · `GET /collections/:name/fields` |
| **Settings** | `GET /throttle` · `PUT /throttle` |

## Platform Wrappers

`@astralibx/email-rule-engine` and `@astralibx/telegram-rule-engine` are thin wrappers around this package. They pre-wire platform-specific rendering (MJML + Handlebars for email, Markdown for Telegram) and re-export `createRuleEngine` as `createEmailRuleEngine` / `createTelegramRuleEngine`. Use this core package directly when building a custom channel.

## Getting Started

- [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/quick-start-tutorial.md) — end-to-end walkthrough from install to first send
- [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md) — contract for each of the five adapter functions
- [Collections and Joins](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/collections-and-joins.md) — expose MongoDB collections as data sources for templates
- [Templates and Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/templates-and-rules.md) — authoring templates, conditions, scheduling, and throttle overrides
- [Throttling and Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/throttling-and-hooks.md) — per-user caps, send windows, jitter, and lifecycle hooks
- [Glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/glossary.md) — terms, constants, ID types, and common gotchas
- [Changelog](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/CHANGELOG.md)

## License

MIT

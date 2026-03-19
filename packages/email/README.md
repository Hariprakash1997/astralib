# @astralibx/email-*

[![npm](https://img.shields.io/npm/v/@astralibx/email-account-manager.svg?label=account-manager)](https://www.npmjs.com/package/@astralibx/email-account-manager)
[![npm](https://img.shields.io/npm/v/@astralibx/email-rule-engine.svg?label=rule-engine)](https://www.npmjs.com/package/@astralibx/email-rule-engine)
[![npm](https://img.shields.io/npm/v/@astralibx/email-analytics.svg?label=analytics)](https://www.npmjs.com/package/@astralibx/email-analytics)
[![npm](https://img.shields.io/npm/v/@astralibx/email-ui.svg?label=ui)](https://www.npmjs.com/package/@astralibx/email-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Production-ready email automation ecosystem for Node.js -- account management, rule-based campaigns, analytics, and an admin UI.

## Packages

| Package | npm | Description | Peer Dependencies |
|---------|-----|-------------|-------------------|
| [`@astralibx/email-account-manager`](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/account-manager/README.md) | [npm](https://www.npmjs.com/package/@astralibx/email-account-manager) | Multi-account email infrastructure with Gmail + SES support, BullMQ queues, health tracking, warmup, and approval workflows | `express`, `mongoose`, `ioredis`, `bullmq`, `nodemailer` |
| [`@astralibx/email-rule-engine`](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/README.md) | [npm](https://www.npmjs.com/package/@astralibx/email-rule-engine) | Thin wrapper over `@astralibx/rule-engine` — adds MJML rendering and email-specific Handlebars helpers (`currency`, `formatDate`) | `express`, `mongoose`, `ioredis` |
| [`@astralibx/email-analytics`](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/README.md) | [npm](https://www.npmjs.com/package/@astralibx/email-analytics) | Event recording, timezone-aware aggregation, time-series, and query API for email metrics | `express`, `mongoose` |
| [`@astralibx/email-ui`](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/README.md) | [npm](https://www.npmjs.com/package/@astralibx/email-ui) | Lit Web Components for managing accounts, rules, templates, and analytics dashboards | `lit` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Express App                        │
├──────────────────┬──────────────────┬───────────────────────┤
│  account-manager │   rule-engine    │      analytics        │
│  SMTP accounts,  │  MJML + email    │  Event recording,     │
│  warmup, health, │  helpers (thin   │  aggregation,         │
│  queues, bounces │  wrapper)        │  time-series queries  │
├──────────────────┼──────────────────┴───────────────────────┤
│                  │  @astralibx/rule-engine (core)           │
│                  │  Templates, rules, throttle, hooks, API  │
├──────────────────┴──────────────────────────────────────────┤
│                     @astralibx/core                         │
│           Base errors, types, validation, RedisLock         │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────┴───────────────────────────────┐
│                      email-ui                               │
│  Lit Web Components consuming the REST APIs above           │
│  Configured via AlxConfig.setup({ accountManagerApi,        │
│    ruleEngineApi, analyticsApi, authToken, theme })          │
└─────────────────────────────────────────────────────────────┘
```

- **account-manager** -- Sending infrastructure. Manages SMTP accounts (Gmail, SES), warmup schedules, health scoring, capacity rotation, BullMQ queues, draft approval, bounce detection, and unsubscribe handling.
- **rule-engine** -- Campaign orchestration. Thin wrapper over `@astralibx/rule-engine` (core) that adds MJML rendering and email-specific helpers. Core rule engine logic (templates, rules, conditions, throttling, hooks, API routes) lives in `@astralibx/rule-engine`.
- **analytics** -- Event tracking. Records send/open/click/bounce events, aggregates into daily/weekly/monthly stats, and exposes time-series and breakdown queries.
- **ui** -- Admin dashboard. Lit Web Components that talk to the three backend REST APIs for account, rule, template, and analytics management.

## Design Principles

- **Factory pattern** -- Each backend package exports a single factory: `createEmailAccountManager`, `createEmailRuleEngine`, `createEmailAnalytics`. One call returns routes + services.
- **Adapter-based DI** -- The rule engine accepts 5 adapter functions (`queryUsers`, `resolveData`, `sendEmail`, `selectAgent`, `findIdentifier`) so your app controls user queries, data resolution, and sending.
- **Database-agnostic** -- All packages accept a Mongoose `Connection` instance. No global `mongoose.connect()`.
- **Multi-tenancy** -- `collectionPrefix` on the `db` config namespaces all MongoDB collections.
- **Hooks** -- Lifecycle callbacks (`onSend`, `onBounce`, `onHealthChange`, etc.) for side effects without modifying library internals.
- **Zero business logic** -- Packages handle infrastructure; your adapters define targeting, data mapping, and delivery.

## Consumer Integration

Wire all three backend packages together in a single Express app:

```typescript
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createEmailAccountManager } from '@astralibx/email-account-manager';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import { createEmailAnalytics } from '@astralibx/email-analytics';

const app = express();
app.use(express.json());

const db = mongoose.createConnection('mongodb://localhost:27017/myapp');
const redis = new Redis();

// 1. Account Manager -- SMTP accounts, queues, webhooks
const eam = createEmailAccountManager({
  db: { connection: db },
  redis: { connection: redis },
  hooks: { /* onSend, onBounce, onHealthChange */ },
});

// 2. Rule Engine -- templates, rules, targeting, sends
const engine = createEmailRuleEngine({
  db: { connection: db },
  redis: { connection: redis },
  adapters: {
    queryUsers: async (target, limit) => { /* query your user DB */ },
    resolveData: (user) => ({ user: { name: user.name }, platform: { name: 'MyApp' } }),
    sendEmail: async (params) => { await eam.smtp.send(params); },
    selectAgent: async () => {
      const account = await eam.capacity.getBestAccount();
      if (!account) return null;
      return { accountId: account._id.toString(), email: account.email, metadata: account.metadata || {} };
    },
    findIdentifier: async (email) => { /* lookup contact */ },
  },
});

// 3. Analytics -- event recording, aggregation, queries
const analytics = createEmailAnalytics({
  db: { connection: db },
});

// Mount routes
app.use('/api/email-accounts', eam.routes);
app.use('/webhooks/ses', eam.webhookRoutes.ses);
app.use('/unsubscribe', eam.unsubscribeRoutes);
app.use('/api/email-rules', engine.routes);
app.use('/api/analytics', analytics.routes);

app.listen(3000);
```

## Getting Started

**New here?** Start with the [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/docs/quick-start-tutorial.md) -- 11 steps from zero to your first campaign, with curl commands.

**Confused by a term?** See the [Glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/docs/glossary.md) -- all ID types, concepts, constants, and gotchas.

**Package docs:**

1. [`@astralibx/email-account-manager` README](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/account-manager/README.md) -- Set up SMTP accounts and sending infrastructure
2. [`@astralibx/email-rule-engine` README](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/README.md) -- Define templates, rules, and adapters
3. [`@astralibx/email-analytics` README](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/README.md) -- Record and query email events
4. [`@astralibx/email-ui` README](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/README.md) -- Add the admin dashboard components

## License

MIT

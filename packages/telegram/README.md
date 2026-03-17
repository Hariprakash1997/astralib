# @astralibx/telegram-*

Production-grade Telegram messaging infrastructure for Node.js — multi-account management, campaign orchestration, real-time inbox, customizable bots, and admin UI components.

## Packages

| Package | Description | Peer Dependencies |
|---------|-------------|-------------------|
| [account-manager](https://github.com/Hariprakash1997/astralib/tree/main/packages/telegram/account-manager) | TDLib client account lifecycle — connect/disconnect, health tracking, warmup phases, quarantine, daily capacity | express, mongoose, telegram |
| [rule-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/telegram/rule-engine) | Campaign orchestration — templates with Handlebars, rule-based targeting (query/list modes), throttling, Redis-based progress tracking | express, mongoose, ioredis |
| [inbox](https://github.com/Hariprakash1997/astralib/tree/main/packages/telegram/inbox) | Real-time message listener, conversation management, history sync, media processing, typing indicators | express, mongoose, telegram |
| [bot](https://github.com/Hariprakash1997/astralib/tree/main/packages/telegram/bot) | Customizable bot factory — command registration, keyboard builder, inline queries, user tracking | express, mongoose, node-telegram-bot-api |
| [ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/telegram/ui) | 12 Lit Web Components — accounts, templates, rules, inbox, bot stats, analytics dashboard | lit |

## Architecture

```
@astralibx/core  (shared errors, types, LogAdapter)
     |
     +-- telegram/account-manager   (TDLib client connections, health, warmup)
     |        |
     |        +-- telegram/inbox    (message listener on connected clients)
     |
     +-- telegram/rule-engine       (campaign orchestration via adapters)
     |
     +-- telegram/bot               (Bot API framework, independent)
     |
     +-- telegram/ui                (browser components, no server deps)
```

- **account-manager** manages TDLib client connections and account health
- **rule-engine** uses adapters — never touches TDLib directly. Consumer controls *how* messages are sent
- **inbox** depends on account-manager for connected clients to listen on
- **bot** is fully independent — uses Bot API, not client API
- **ui** is browser-only — Lit Web Components that talk to the backend packages via REST

## Design Principles

**Adapter-based DI** — Consumer provides `queryUsers`, `resolveData`, `sendMessage`, `selectAccount`, `findIdentifier`. The library orchestrates *when* and *what*, consumer controls *how*.

**Factory pattern** — Each package exposes a `createTelegram*()` factory that validates config, creates Mongoose models, wires services, and returns Express routes + programmatic API.

**Zero business logic** — No hardcoded commands, templates, or workflows. Every behavior is configurable by the consumer.

**Database-agnostic** — Consumer passes a Mongoose connection. Schemas support `collectionPrefix` for multi-tenancy.

**Production-safe** — Built-in safety features: account warmup, health scoring, quarantine on rate limits, throttling per user, distributed locking, human-like delays. These are defaults, not optional — safety cannot be bypassed.

## Quick Start

```bash
npm install @astralibx/telegram-account-manager
npm install @astralibx/telegram-rule-engine
npm install @astralibx/telegram-inbox
npm install @astralibx/telegram-bot
npm install @astralibx/telegram-ui
```

Each package has its own README with detailed setup:

1. [account-manager/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/README.md) — Start here
2. [rule-engine/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/rule-engine/README.md) — Campaign sending
3. [inbox/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/README.md) — Real-time messaging
4. [bot/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/README.md) — Bot framework
5. [ui/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/ui/README.md) — Admin dashboard

## Consumer Integration Example

```ts
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createTelegramAccountManager } from '@astralibx/telegram-account-manager';
import { createTelegramRuleEngine } from '@astralibx/telegram-rule-engine';
import { createTelegramInbox } from '@astralibx/telegram-inbox';

const connection = mongoose.createConnection('mongodb://...');
const redis = new Redis();

// 1. Account Manager — manages TDLib connections
const accountManager = createTelegramAccountManager({
  db: { connection },
  credentials: { apiId: 12345, apiHash: 'abc123' },
});

// 2. Rule Engine — campaign orchestration (adapter-based)
const ruleEngine = createTelegramRuleEngine({
  db: { connection },
  redis: { connection: redis },
  adapters: {
    queryUsers: async (target, limit) => { /* your DB query */ },
    resolveData: (user) => ({ name: user.name, city: user.city }),
    sendMessage: async (params) => {
      const client = accountManager.getClient(params.accountId);
      await client.sendMessage(params.target, { message: params.message });
    },
    selectAccount: async () => { /* pick best account */ },
    findIdentifier: async (phone) => { /* lookup contact */ },
  },
});

// 3. Inbox — real-time messaging
const inbox = createTelegramInbox({
  accountManager,
  db: { connection },
  hooks: { onNewMessage: (msg) => console.log('New message:', msg.content) },
});

// Mount routes
app.use('/api/telegram-accounts', accountManager.routes);
app.use('/api/telegram-rules', ruleEngine.routes);
app.use('/api/telegram-inbox', inbox.routes);
```

## License

MIT

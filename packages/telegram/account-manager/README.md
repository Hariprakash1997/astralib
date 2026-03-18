# @astralibx/telegram-account-manager

A production-ready, multi-account Telegram infrastructure library for Node.js. Manages multiple TDLib client sessions with automatic health tracking, account warmup, quarantine management, capacity-based rotation, daily stats, and Telegram identifier tracking. Plug it into any Express app with a single factory call.

> **Getting started?** See the [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/quick-start-tutorial.md) for a step-by-step walkthrough, [Integration Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/integration-guide.md) for multi-package setup, or the [Glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/glossary.md) for ID terminology.

## Install

```bash
npm install @astralibx/telegram-account-manager
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |
| `telegram` | Yes (GramJS) |

```bash
npm install express mongoose telegram
```

## Quick Start

```ts
import express from 'express';
import mongoose from 'mongoose';
import { createTelegramAccountManager } from '@astralibx/telegram-account-manager';

const app = express();
app.use(express.json());

const db = await mongoose.createConnection('mongodb://localhost:27017/myapp');

const tam = createTelegramAccountManager({
  db: { connection: db },
  credentials: {
    apiId: 12345678,
    apiHash: 'your-api-hash',
  },
});

// Admin API (protect with your own auth middleware)
app.use('/api/telegram', tam.routes);

// 1. Generate session (or use existing one)
const { phoneCodeHash } = await tam.sessions.requestCode('+919876543210');
const { session } = await tam.sessions.verifyCode('+919876543210', '12345', phoneCodeHash);

// 2. Create account
const account = await tam.models.TelegramAccount.create({
  phone: '+919876543210', name: 'Main Account', session, tags: ['outreach'],
  // ... other required fields
});

// 3. Connect
await tam.connection.connect(account._id.toString());

// Get connected clients
const clients = tam.getConnectedAccounts();
console.log(clients); // [{ accountId, phone, name, isConnected }]

// Graceful shutdown
process.on('SIGTERM', () => tam.destroy());

app.listen(3000);
```

## Features

- **Multi-account management** -- TDLib session management with credential storage, status tracking, and connection lifecycle. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/configuration.md)
- **Health tracking** -- Automatic scoring with flood wait detection and consecutive error tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/types.md)
- **Auto-quarantine** -- Accounts triggering PEER_FLOOD or USER_RESTRICTED are quarantined with configurable duration and automatic release. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/configuration.md#optionsquarantine)
- **Account warmup** -- Phased volume ramp-up with configurable schedules (4-phase default). [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/configuration.md#optionswarmup)
- **Daily capacity tracking** -- Per-account daily limit enforcement with usage percentage tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md)
- **Telegram identifier management** -- Track Telegram user IDs, usernames, and contact mappings with status lifecycle. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md#identifier-routes)
- **Session generation** -- Two-step phone auth flow (request code, verify OTP, handle 2FA) to produce session strings for new accounts. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md#session-routes)
- **Account rotation** -- Rotate between accounts using round-robin, least-used, or highest-health strategies via `AccountRotator`. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/types.md#exported-service-classes)
- **Idle timeout** -- Automatically disconnect accounts that have been idle (no sends) for a configurable duration. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/configuration.md#optionsidletimeoutms)
- **Account tags** -- Tag accounts for categorization and filtering (e.g., by purpose, region, or priority). Filter accounts by tag via the REST API.
- **Direct message sending** -- Low-level `sendMessage()` on connected accounts, usable by inbox and other consumers. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md#send-message)
- **Express routes out of the box** -- 25 REST endpoints for accounts, identifiers, and sessions. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md)
- **Adapter-based DI** -- Database-agnostic via Mongoose connection injection, logger adapter, lifecycle hooks.
- **Error classification** -- Critical errors (ban), quarantine errors (flood), skip errors (privacy), and recoverable errors (network) are handled automatically.

## Architecture

The library exposes a single Express router from a factory call:

| Router | Purpose | Access |
|--------|---------|--------|
| `tam.routes` | Admin API -- accounts, identifiers, capacity, health | Protected (add your auth middleware) |

All services are also available programmatically via the returned `tam` object.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/configuration.md) -- Set up database, credentials, options, and hooks
2. [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/api-routes.md) -- 25 REST endpoints for accounts, identifiers, and sessions
3. [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/account-manager/docs/types.md) -- All importable types, constants, errors, and service classes

> **Important:** When `autoAdvance: true` (the default), the library automatically calls `advanceAllAccounts()` every 24 hours via an internal `setInterval` -- no cron job needed. When `autoAdvance: false`, you must call `warmup.advanceDay(accountId)` manually for each account.

## License

MIT

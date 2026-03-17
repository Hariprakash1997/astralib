# @astralibx/telegram-account-manager

A production-ready, multi-account Telegram infrastructure library for Node.js. Manages multiple TDLib client sessions with automatic health tracking, account warmup, quarantine management, capacity-based rotation, daily stats, and Telegram identifier tracking. Plug it into any Express app with a single factory call.

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

// Create an account with a session string
await tam.connection.connect('account-id');

// Get connected clients
const clients = tam.getConnectedAccounts();
console.log(clients); // [{ accountId, phone, name, isConnected }]

// Graceful shutdown
process.on('SIGTERM', () => tam.destroy());

app.listen(3000);
```

## Features

- **Multi-account management** -- TDLib session management with credential storage, status tracking, and connection lifecycle. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/configuration.md)
- **Health tracking** -- Automatic scoring with flood wait detection and consecutive error tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/types.md)
- **Auto-quarantine** -- Accounts triggering PEER_FLOOD or USER_RESTRICTED are quarantined with configurable duration and automatic release. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/configuration.md#optionsquarantine)
- **Account warmup** -- Phased volume ramp-up with configurable schedules (4-phase default). [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/configuration.md#optionswarmup)
- **Daily capacity tracking** -- Per-account daily limit enforcement with usage percentage tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/api-routes.md)
- **Telegram identifier management** -- Track Telegram user IDs, usernames, and contact mappings with status lifecycle. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/api-routes.md#identifier-routes)
- **Express routes out of the box** -- 20 REST endpoints for accounts and identifiers. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/api-routes.md)
- **Adapter-based DI** -- Database-agnostic via Mongoose connection injection, logger adapter, lifecycle hooks.
- **Error classification** -- Critical errors (ban), quarantine errors (flood), skip errors (privacy), and recoverable errors (network) are handled automatically.

## Architecture

The library exposes a single Express router from a factory call:

| Router | Purpose | Access |
|--------|---------|--------|
| `tam.routes` | Admin API -- accounts, identifiers, capacity, health | Protected (add your auth middleware) |

All services are also available programmatically via the returned `tam` object.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/configuration.md) -- Set up database, credentials, options, and hooks
2. [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/api-routes.md) -- 20 REST endpoints for accounts and identifiers
3. [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram-account-manager/docs/types.md) -- All importable types, constants, errors, and service classes

> **Important:** The warmup system requires calling `warmup.advanceDay(accountId)` daily via cron job. Without this, accounts stay in warmup indefinitely.

## License

MIT

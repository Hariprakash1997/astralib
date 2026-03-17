# @astralibx/telegram-inbox

Real-time Telegram inbox infrastructure for Node.js. Listens for incoming messages via GramJS, stores conversations and message history in MongoDB, supports media downloads with pluggable upload adapters, session tracking, history sync, and typing indicators. Builds on top of `@astralibx/telegram-account-manager` and mounts as a single Express router.

## Install

```bash
npm install @astralibx/telegram-inbox
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |
| `telegram` | Yes (GramJS) |
| `@astralibx/telegram-account-manager` | Yes |

```bash
npm install express mongoose telegram @astralibx/telegram-account-manager
```

## Quick Start

```ts
import express from 'express';
import mongoose from 'mongoose';
import { createTelegramAccountManager } from '@astralibx/telegram-account-manager';
import { createTelegramInbox } from '@astralibx/telegram-inbox';

const app = express();
app.use(express.json());

const db = await mongoose.createConnection('mongodb://localhost:27017/myapp');

const tam = createTelegramAccountManager({
  db: { connection: db },
  credentials: { apiId: 12345678, apiHash: 'your-api-hash' },
});

const inbox = createTelegramInbox({
  accountManager: tam,
  db: { connection: db },
  media: {
    uploadAdapter: async (buffer, filename, mimeType) => {
      // Library downloads media from Telegram, you store it
      const url = await myStorage.upload(buffer, filename, mimeType);
      return { url, mimeType, fileSize: buffer.length };
    },
    maxFileSizeMb: 50,
  },
  hooks: {
    onNewMessage: (msg) => console.log('New message:', msg.content),
  },
});

// Mount routes (protect with your own auth middleware)
app.use('/api/telegram/accounts', tam.routes);
app.use('/api/telegram/inbox', inbox.routes);

// Listen for real-time events
inbox.events.on('inbox:new_message', (msg) => {
  // Push to WebSocket, SSE, etc.
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await inbox.destroy();
  await tam.destroy();
});

app.listen(3000);
```

## Features

- **Real-time message listening** -- Auto-attaches to all connected TDLib clients and captures inbound/outbound messages. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/configuration.md)
- **Conversation aggregation** -- Groups messages by conversation with last message, unread counts, and pagination. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/api-routes.md#conversation-routes)
- **History sync** -- Pull historical messages from Telegram for any chat on demand. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/api-routes.md#sync-history)
- **Media processing** -- Downloads media from Telegram, delegates storage to your `uploadAdapter` callback. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/configuration.md#media)
- **Session tracking** -- Track account-to-contact conversation sessions with pause/resume/close lifecycle. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/api-routes.md#session-routes)
- **Event gateway** -- EventEmitter-based gateway for `new_message`, `typing`, and `message_read` events. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/types.md#exported-service-classes)
- **Typing indicators** -- Broadcast typing status to Telegram chats. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/configuration.md#optionstypingtimeoutms)
- **Express routes out of the box** -- 11 REST endpoints for conversations and sessions. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/api-routes.md)

## Architecture

The library exposes a single Express router from a factory call:

| Router | Purpose | Access |
|--------|---------|--------|
| `inbox.routes` | Inbox API -- conversations, messages, sessions | Protected (add your auth middleware) |

All services are also available programmatically via the returned `inbox` object.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/configuration.md) -- Set up accountManager, database, media adapter, options, and hooks
2. [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/api-routes.md) -- 11 REST endpoints for conversations and sessions
3. [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/inbox/docs/types.md) -- All importable types, constants, errors, and service classes

> **Important:** This package requires a configured `@astralibx/telegram-account-manager` instance. Set up the account manager first, then pass it into the inbox factory.

## License

MIT

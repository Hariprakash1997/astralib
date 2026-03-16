# @astralibx/email-account-manager

A production-ready, multi-account email infrastructure library for Node.js. Manages multiple SMTP accounts (Gmail, AWS SES) with automatic health tracking, account warmup, capacity-based rotation, BullMQ job queues, draft approval workflows, IMAP bounce detection, SES webhook processing, and built-in unsubscribe handling. Plug it into any Express app with three routers and a single factory call.

## Install

```bash
npm install @astralibx/email-account-manager
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |
| `ioredis` | Yes |
| `bullmq` | Yes |
| `nodemailer` | Yes |
| `imapflow` | Optional (IMAP bounce checking) |

```bash
npm install express mongoose ioredis bullmq nodemailer
# Optional: npm install imapflow
```

## Quick Start

```ts
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createEmailAccountManager } from '@astralibx/email-account-manager';

const app = express();
app.use(express.json());

const db = await mongoose.createConnection('mongodb://localhost:27017/myapp');
const redis = new Redis();

const eam = createEmailAccountManager({
  db: { connection: db },
  redis: { connection: redis },
});

// Admin API (protect with your own auth middleware)
app.use('/api/email', eam.routes);

// SES webhook endpoint (public, signature-verified)
app.use('/webhooks/ses', eam.webhookRoutes.ses);

// Unsubscribe pages (public)
app.use('/unsubscribe', eam.unsubscribeRoutes);

// Create an account with metadata
await eam.accounts.create({
  email: 'outreach@yourdomain.com',
  senderName: 'Your Company',
  provider: 'gmail',
  smtp: { host: 'smtp.gmail.com', port: 587, user: 'outreach@yourdomain.com', pass: 'app-password' },
  metadata: { sender_names: ['Sales', 'Support'], contact_number: '+1-555-0100' },
});

// Send an email programmatically
const result = await eam.smtp.send({
  to: 'recipient@example.com',
  subject: 'Hello',
  html: '<h1>Welcome!</h1>',
});

console.log(result); // { success: true, messageId: '...' }

app.listen(3000);
```

## Features

- **Multi-account management** -- Gmail and AWS SES providers with credential storage, status tracking, and freeform metadata. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/account-management.md)
- **Health tracking** -- Automatic scoring (+1/-5/-10) with auto-disable on threshold breach. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/health-tracking.md)
- **Account warmup** -- Phased volume ramp-up with configurable schedules stored per-account. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/warmup-system.md)
- **Capacity-based rotation** -- Health-weighted account selection with daily limit enforcement. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/capacity-selection.md)
- **Reliable sending** -- BullMQ queues with retries, dev mode redirect, and per-account SMTP. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/email-sending.md)
- **Draft approval workflow** -- Create, review, approve/reject, bulk operations, send window spread. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/draft-approval.md)
- **Unsubscribe handling** -- HMAC tokens, styled confirmation page, RFC 8058 one-click support. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/unsubscribe.md)
- **SES webhooks** -- SNS signature verification, bounce/complaint/delivery/open/click processing. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/ses-webhooks.md)
- **IMAP bounce detection** -- Gmail IMAP polling with bounce classification. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/imap-bounce-checking.md)
- **Global settings** -- Runtime-adjustable config stored in MongoDB with in-memory caching. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/global-settings.md)
- **Error classes** -- Typed errors with codes for every failure scenario. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/error-handling.md)

## Architecture

The library exposes three Express routers from a single factory call:

| Router | Purpose | Access |
|--------|---------|--------|
| `eam.routes` | Admin API -- accounts, drafts, settings, queues | Protected (add your auth middleware) |
| `eam.webhookRoutes.ses` | SES/SNS event receiver | Public (SNS signature verified) |
| `eam.unsubscribeRoutes` | Unsubscribe confirmation pages | Public |

All services are also available programmatically via the returned `eam` object. See [Programmatic API](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/programmatic-api.md).

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/configuration.md) — Set up database, Redis, queues, and hooks
2. [Account Management](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/account-management.md) — Create and manage email accounts (see [default values](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/account-management.md#default-values))
3. [Warmup System](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/warmup-system.md) — Gradually increase sending volume (**requires daily `advanceDay()` cron**)
4. [Health Tracking](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/health-tracking.md) — Monitor account health and auto-disable unhealthy accounts
5. [Email Sending](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/email-sending.md) — Send emails via SMTP with queue-based processing
6. [Global Settings](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/global-settings.md) — Configure timezone, dev mode, approval workflow

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/api-routes.md) | [Programmatic API](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/programmatic-api.md) | [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/types.md) | [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/error-handling.md)

Advanced: [Capacity Selection](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/capacity-selection.md) | [Draft Approval](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/draft-approval.md) | [IMAP Bounce Checking](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/imap-bounce-checking.md) | [SES Webhooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/ses-webhooks.md) | [Unsubscribe](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/unsubscribe.md)

> **Important:** The warmup system requires calling `advanceDay()` daily via cron job. Without this, accounts stay in warmup indefinitely.

### Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, BullMQ queues will collide — Project A's worker could process Project B's emails.

```typescript
const eam = createEmailAccountManager({
  redis: {
    connection: redis,
    keyPrefix: 'myproject-eam:', // REQUIRED if sharing Redis
  },
  // ...
});
```

| Default | Risk |
|---------|------|
| `'eam:'` | Two projects using defaults share the same `eam:email-send` and `eam:email-approved` queues |

**Always set a unique prefix** like `projectname-eam:` or `projectname:`.

## Security Notes

**Credential storage**: SMTP and IMAP passwords (`smtp.pass`, `imap.pass`) are stored as plaintext in MongoDB. You should encrypt these values at the application layer before passing them to this library, and decrypt them after retrieval. A built-in encryption layer is planned for a future version.

## License

MIT

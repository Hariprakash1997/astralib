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

- **Multi-account management** -- Gmail and AWS SES providers with credential storage and status tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/account-management.md)
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

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/configuration.md) | Full config reference -- db, redis, ses, unsubscribe, options, hooks, logger |
| [Account Management](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/account-management.md) | Adding accounts, providers (Gmail/SES), status lifecycle |
| [Health Tracking](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/health-tracking.md) | Scoring rules, auto-disable triggers, thresholds |
| [Warmup System](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/warmup-system.md) | Phases, daily limits, progression, DB-driven schedules |
| [Capacity Selection](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/capacity-selection.md) | Best account selection, rotation algorithm |
| [Email Sending](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/email-sending.md) | SMTP service, BullMQ queues, dev mode redirect |
| [Draft & Approval](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/draft-approval.md) | Creating drafts, approval workflow, bulk operations, send window |
| [Unsubscribe](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/unsubscribe.md) | HMAC tokens, confirmation page, one-click, RFC 8058 |
| [SES Webhooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/ses-webhooks.md) | SNS setup, signature verification, event processing |
| [IMAP Bounce Checking](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/imap-bounce-checking.md) | Gmail IMAP polling, bounce classification |
| [Global Settings](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/global-settings.md) | Runtime settings, sections, caching, defaults |
| [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/api-routes.md) | All 3 routers with endpoint tables |
| [Programmatic API](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/programmatic-api.md) | Using services directly via the EmailAccountManager interface |
| [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-account-manager/docs/error-handling.md) | All error classes with codes |

## Security Notes

**Credential storage**: SMTP and IMAP passwords (`smtp.pass`, `imap.pass`) are stored as plaintext in MongoDB. You should encrypt these values at the application layer before passing them to this library, and decrypt them after retrieval. A built-in encryption layer is planned for a future version.

## License

MIT

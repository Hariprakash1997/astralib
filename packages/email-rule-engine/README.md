# @astralibx/email-rule-engine

Rule-based email automation engine with MJML + Handlebars templates, per-user throttling, and Redis distributed locking.

## Install

```bash
npm install @astralibx/email-rule-engine
```

## Quick Start

```typescript
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';

const engine = createEmailRuleEngine({
  db: { connection: mongoose.createConnection('mongodb://localhost/myapp') },
  redis: { connection: new Redis() },
  adapters: {
    queryUsers: async (target, limit) => db.collection('users').find({ role: target.role }).limit(limit).toArray(),
    resolveData: (user) => ({ user: { name: user.name, email: user.email }, platform: { name: 'MyApp' } }),
    sendEmail: async (params) => transporter.sendMail({ to: params.identifierId, subject: params.subject, html: params.htmlBody }),
    selectAgent: async () => ({ accountId: 'default' }),
    findIdentifier: async (email) => { const c = await Contacts.findOne({ email }); return c ? { id: c._id.toString(), contactId: c._id.toString() } : null; },
  },
});

app.use('/api/email-rules', engine.routes);
```

## Features & Documentation

| Feature | Description | Docs |
|---------|-------------|------|
| Adapters | Connect to your data, delivery, and accounts | [adapters.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/adapters.md) |
| Templates | MJML + Handlebars responsive email templates | [templates.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/templates.md) |
| Rules | Condition-based targeting and automation | [rules.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/rules.md) |
| Throttling | Per-user daily/weekly rate limits | [throttling.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/throttling.md) |
| Send Window | Time-based execution control | [send-window.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/send-window.md) |
| Delivery Delays | Natural send spread with jitter | [delivery-delays.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/delivery-delays.md) |
| Progress Hooks | Live execution tracking callbacks | [progress-hooks.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/progress-hooks.md) |
| SMTP Pooling | Efficient email delivery patterns | [smtp-pooling.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/smtp-pooling.md) |
| Account Rotation | Multi-account sending with quotas | [account-rotation.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/account-rotation.md) |
| Email Validation | MX checks and domain validation | [email-validation.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/email-validation.md) |
| Execution Flow | How the runner processes rules | [execution-flow.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/execution-flow.md) |
| API Routes | REST endpoint reference | [api-routes.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/api-routes.md) |
| Config Reference | Full configuration options | [config-reference.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/email-rule-engine/docs/config-reference.md) |

## Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | >= 18 | Runtime |
| MongoDB | >= 5.0 | Data storage (5 collections auto-created) |
| Redis | >= 6.0 | Distributed locking |

### Peer Dependencies

```bash
npm install express mongoose ioredis handlebars mjml html-to-text
```

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18 or ^5.0 | HTTP routes |
| `mongoose` | ^7.0 or ^8.0 | MongoDB ODM |
| `ioredis` | ^5.0 | Redis client |
| `handlebars` | ^4.7 | Template variables |
| `mjml` | ^4.0 | Responsive email HTML |
| `html-to-text` | ^9.0 | Plain text fallback |

## License

MIT

# @astralibx/email-rule-engine

Email automation wrapper over `@astralibx/rule-engine`

[![npm version](https://img.shields.io/npm/v/@astralibx/email-rule-engine.svg)](https://www.npmjs.com/package/@astralibx/email-rule-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What This Package Does

`@astralibx/email-rule-engine` is a thin wrapper over [`@astralibx/rule-engine`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/README.md). It adds MJML rendering and email-specific Handlebars helpers (`currency`, `formatDate`) on top of the core rule engine, adapting the generic `send` adapter into an email-aware `sendEmail` adapter that receives rendered `htmlBody` and `textBody` instead of raw template output.

## What It Adds Over Core

- MJML to HTML conversion — body content is auto-wrapped in a full MJML structure and compiled to cross-client HTML
- HTML to plain text conversion — a `textBody` is automatically generated from rendered HTML via `html-to-text`
- `currency` Handlebars helper — formats numbers as INR (e.g. `₹1,234`)
- `formatDate` Handlebars helper — formats dates in en-IN locale (e.g. `19 Mar 2026`)
- `sendEmail` adapter mapping — converts the core's generic `send` adapter to an email-specific signature with `htmlBody`, `textBody`, and `subject`

## Quick Start

```typescript
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';

const engine = createEmailRuleEngine({
  db: { connection },
  redis: { connection: redis },
  adapters: {
    queryUsers: async (target, limit) => {
      return User.find({ role: target.role }).limit(limit).lean();
    },
    resolveData: (user) => ({
      user: { name: user.name, email: user.email },
      platform: { name: 'MyApp', domain: 'myapp.com' },
    }),
    sendEmail: async (params) => {
      await transporter.sendMail({
        to: params.identifierId,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody,
      });
    },
    selectAgent: async () => ({ accountId: 'default', contactValue: 'noreply@myapp.com', metadata: {} }),
    findIdentifier: async (email) => {
      const contact = await Contact.findOne({ email });
      return contact ? { id: contact._id.toString(), contactId: contact._id.toString() } : null;
    },
  },
});

app.use('/api/email-rules', engine.routes);
```

### Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, set a unique `keyPrefix` per project. Without this, run locks and cancel flags will collide between projects.

```typescript
const engine = createEmailRuleEngine({
  redis: { connection: redis, keyPrefix: 'myproject:' },
  // ...
});
```

## Configuration

See [`docs/configuration.md`](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/docs/configuration.md) for the `EmailRuleEngineConfig` interface and how `sendEmail` maps to the core's generic `send`.

## Core Documentation

For templates, rules, conditions, collections, joins, throttling, hooks, and the full API reference, see the core documentation:

- [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/quick-start-tutorial.md)
- [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md)
- [Collections & Joins](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/collections-and-joins.md)
- [Templates & Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/templates-and-rules.md)
- [Throttling & Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/throttling-and-hooks.md)
- [Glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/glossary.md)
- [Changelog](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/rule-engine/CHANGELOG.md)

## License

MIT

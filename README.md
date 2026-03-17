# Astralib -- Multi-Channel Automation Toolkit

[![CI](https://github.com/Hariprakash1997/astralib/actions/workflows/ci.yml/badge.svg)](https://github.com/Hariprakash1997/astralib/actions/workflows/ci.yml)
[![core](https://img.shields.io/npm/v/@astralibx/core.svg?label=core)](https://www.npmjs.com/package/@astralibx/core)
[![email](https://img.shields.io/npm/v/@astralibx/email-rule-engine.svg?label=email)](https://www.npmjs.com/package/@astralibx/email-rule-engine)
[![telegram](https://img.shields.io/npm/v/@astralibx/telegram-rule-engine.svg?label=telegram)](https://www.npmjs.com/package/@astralibx/telegram-rule-engine)
[![chat](https://img.shields.io/npm/v/@astralibx/chat-engine.svg?label=chat)](https://www.npmjs.com/package/@astralibx/chat-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Astralib is a collection of Node.js packages for building multi-channel outreach and communication systems. It provides production-ready infrastructure for email campaigns, Telegram automation, and live chat -- account management, rule-based messaging, analytics, and admin dashboards. Each channel is independent: install only what you need.

[Packages](#packages) . [Getting Started](#getting-started) . [Development](#development) . [Deployment](https://github.com/Hariprakash1997/astralib/blob/main/DEPLOYMENT.md)

---

## Packages

### Core

| Package | Description |
|---------|-------------|
| [`@astralibx/core`](https://www.npmjs.com/package/@astralibx/core) | Shared foundation -- base errors, types, validation helpers, and RedisLock |

### [Email](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/README.md)

Production-ready email automation -- account management with Gmail + SES, rule-based campaigns with MJML templates, event analytics, and Lit Web Components for admin dashboards.

| Package | Description |
|---------|-------------|
| [`@astralibx/email-account-manager`](https://www.npmjs.com/package/@astralibx/email-account-manager) | Multi-account SMTP infrastructure with warmup, health tracking, BullMQ queues, and bounce detection |
| [`@astralibx/email-rule-engine`](https://www.npmjs.com/package/@astralibx/email-rule-engine) | Rule-based email automation with MJML + Handlebars templates, throttling, and distributed locking |
| [`@astralibx/email-analytics`](https://www.npmjs.com/package/@astralibx/email-analytics) | Event recording, timezone-aware aggregation, and query API for email metrics |
| [`@astralibx/email-ui`](https://www.npmjs.com/package/@astralibx/email-ui) | Lit Web Components for managing accounts, rules, templates, and analytics |

### [Telegram](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/README.md)

Telegram automation -- bot management, account orchestration with TDLib, rule-based messaging, inbox handling, and admin UI.

| Package | Description |
|---------|-------------|
| [`@astralibx/telegram-account-manager`](https://www.npmjs.com/package/@astralibx/telegram-account-manager) | Account lifecycle management with TDLib sessions, health tracking, warmup, quarantine, and daily stats |
| [`@astralibx/telegram-rule-engine`](https://www.npmjs.com/package/@astralibx/telegram-rule-engine) | Rule-based message automation with Handlebars templates, throttling, and distributed locking |
| [`@astralibx/telegram-inbox`](https://www.npmjs.com/package/@astralibx/telegram-inbox) | Real-time message listener with conversations, history sync, media processing, and session tracking |
| [`@astralibx/telegram-bot`](https://www.npmjs.com/package/@astralibx/telegram-bot) | Bot factory with command registration, keyboard builder, webhook/polling, and user tracking |
| [`@astralibx/telegram-ui`](https://www.npmjs.com/package/@astralibx/telegram-ui) | Lit Web Components for the Telegram admin dashboard |

### Chat

Real-time live chat -- Socket.IO gateway, AI-powered responses, embeddable visitor widget, and admin dashboard components.

| Package | Description |
|---------|-------------|
| [`@astralibx/chat-types`](https://www.npmjs.com/package/@astralibx/chat-types) | Shared TypeScript types, enums, and event contracts for the chat ecosystem |
| [`@astralibx/chat-engine`](https://www.npmjs.com/package/@astralibx/chat-engine) | Chat engine with Socket.IO gateway, session lifecycle, message routing, agent management, and Redis caching |
| [`@astralibx/chat-ai`](https://www.npmjs.com/package/@astralibx/chat-ai) | Optional AI layer -- memory management, prompt templates, knowledge base, and AI call orchestration |
| [`@astralibx/chat-widget`](https://www.npmjs.com/package/@astralibx/chat-widget) | Embeddable visitor-facing chat widget built with Lit |
| [`@astralibx/chat-ui`](https://www.npmjs.com/package/@astralibx/chat-ui) | Lit Web Components for the chat admin dashboard |

## Getting Started

Each package is standalone. Install what you need:

```bash
npm install @astralibx/email-rule-engine
npm install @astralibx/telegram-bot
npm install @astralibx/chat-engine
```

All backend packages require **MongoDB** and **Redis**. See each package's README for configuration details.

## Development

Monorepo powered by [Turborepo](https://turbo.build/) with [Changesets](https://github.com/changesets/changesets) for version management.

```bash
npm install          # install dependencies
npm run build        # build all packages
npm run test         # test all packages
```

See [DEPLOYMENT.md](https://github.com/Hariprakash1997/astralib/blob/main/DEPLOYMENT.md) for publishing workflows.

## License

MIT

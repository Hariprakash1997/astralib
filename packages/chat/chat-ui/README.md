# @astralibx/chat-ui

[![npm version](https://img.shields.io/npm/v/@astralibx/chat-ui.svg)](https://www.npmjs.com/package/@astralibx/chat-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Lit Web Components for the chat admin dashboard. Provides session management, agent management, real-time agent chat interface, memory/prompt/knowledge CRUD, FAQ/flow configuration, analytics, and settings. Drop a single `<alx-chat-dashboard>` tag into any HTML page or use individual components.

**GitHub**: https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-ui

## Install

```bash
npm install @astralibx/chat-ui
# Optional: npm install socket.io-client
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `lit` | Yes |
| `socket.io-client` | Optional (needed for agent dashboard) |

## Quick Start

```typescript
import { AlxChatConfig } from '@astralibx/chat-ui';

AlxChatConfig.setup({
  chatEngineApi: '/api/chat',
  chatAiApi: '/api/chat-ai',
  socketUrl: 'wss://chat.example.com',
  agentNamespace: '/agent',
  authToken: 'Bearer ...',
  theme: 'dark',
});

import '@astralibx/chat-ui';
```

```html
<alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
```

Or use individual components:

```html
<alx-chat-session-list></alx-chat-session-list>
<alx-chat-agent-dashboard></alx-chat-agent-dashboard>
```

## Individual Component Usage

Use standalone components instead of the full dashboard:

```html
<!-- Just the session list -->
<alx-chat-session-list></alx-chat-session-list>

<!-- Memory management -->
<alx-chat-memory-list></alx-chat-memory-list>

<!-- Agent chat dashboard (needs socket.io-client) -->
<alx-chat-agent-dashboard></alx-chat-agent-dashboard>
```

## All Components

| Tag | Description |
|-----|-------------|
| `alx-chat-dashboard` | Full dashboard with hash-based tab routing |
| `alx-chat-session-list` | Paginated session list with filters |
| `alx-chat-session-messages` | Message thread viewer with cursor pagination |
| `alx-chat-session-detail` | Session metadata and visitor info panel |
| `alx-chat-agent-list` | Agent table with status and actions |
| `alx-chat-agent-form` | Create/edit agent drawer |
| `alx-chat-agent-dashboard` | Real-time agent chat interface (Socket.IO) |
| `alx-chat-memory-list` | Memory entries with filters and bulk actions |
| `alx-chat-memory-form` | Create/edit memory drawer |
| `alx-chat-prompt-list` | Prompt template list |
| `alx-chat-prompt-editor` | Visual prompt section editor |
| `alx-chat-knowledge-list` | Knowledge base CRUD |
| `alx-chat-knowledge-form` | Create/edit knowledge drawer |
| `alx-chat-faq-editor` | FAQ management with reordering |
| `alx-chat-flow-editor` | Pre-chat flow configurator |
| `alx-chat-canned-response-list` | Canned response CRUD |
| `alx-chat-stats` | Dashboard statistics cards (auto-refresh) |
| `alx-chat-feedback-stats` | Rating distribution and average |
| `alx-chat-offline-messages` | Offline message inbox |
| `alx-chat-settings` | Global chat settings |

## Features

- **Session management** -- Paginated session list, message thread viewer with cursor pagination, session metadata panel. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#sessions)
- **Agent management** -- Agent table with status tracking, create/edit drawer, real-time agent chat via Socket.IO. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#agents)
- **Memory and knowledge** -- Memory entries with filters and bulk actions, knowledge base CRUD with drawer forms. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#memory)
- **Prompt editing** -- Prompt template list and visual section editor. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#prompts)
- **Content management** -- FAQ editor with reordering, pre-chat flow configurator, canned response CRUD. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#content)
- **Analytics** -- Statistics cards with auto-refresh, feedback rating distribution, offline message inbox. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#analytics)
- **Global settings** -- Chat settings panel. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md#settings)
- **Theming** -- Full CSS custom property system with `--alx-*` prefix, density modes, and shared style exports. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/theming.md)
- **API client** -- Built-in HTTP client with auth injection, timeout, error handling, and auth error events. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/api-client.md)

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/configuration.md) -- Setup, config options, peer dependencies
2. [Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/components.md) -- All 20 components with tags and descriptions
3. [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/theming.md) -- CSS custom properties, density modes, shared style exports
4. [API Client](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/docs/api-client.md) -- HttpClient, error handling, auth events, exported types

## License

MIT

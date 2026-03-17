# @astralibx/chat-ui

Lit Web Components for the chat admin dashboard. Provides session management, agent management, real-time agent chat interface, memory/prompt/knowledge CRUD, FAQ/flow configuration, analytics, and settings.

**GitHub**: https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-ui

## Installation

```bash
npm install @astralibx/chat-ui
# socket.io-client is an optional peer dep (needed for agent dashboard)
npm install socket.io-client
```

## Setup

Call `AlxChatConfig.setup()` before importing any components:

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

// Then import/use components
import '@astralibx/chat-ui';
```

## Components

| Component | Tag | Description |
|---|---|---|
| `AlxChatDashboard` | `alx-chat-dashboard` | Full dashboard with hash-based tab routing |
| `AlxChatSessionList` | `alx-chat-session-list` | Paginated session list with filters |
| `AlxChatSessionMessages` | `alx-chat-session-messages` | Message thread viewer with cursor pagination |
| `AlxChatSessionDetail` | `alx-chat-session-detail` | Session metadata and visitor info panel |
| `AlxChatAgentList` | `alx-chat-agent-list` | Agent table with status and actions |
| `AlxChatAgentForm` | `alx-chat-agent-form` | Create/edit agent drawer |
| `AlxChatAgentDashboard` | `alx-chat-agent-dashboard` | Real-time agent chat interface (Socket.IO) |
| `AlxChatMemoryList` | `alx-chat-memory-list` | Memory entries with filters and bulk actions |
| `AlxChatMemoryForm` | `alx-chat-memory-form` | Create/edit memory drawer |
| `AlxChatPromptList` | `alx-chat-prompt-list` | Prompt template list |
| `AlxChatPromptEditor` | `alx-chat-prompt-editor` | Visual prompt section editor |
| `AlxChatKnowledgeList` | `alx-chat-knowledge-list` | Knowledge base CRUD |
| `AlxChatKnowledgeForm` | `alx-chat-knowledge-form` | Create/edit knowledge drawer |
| `AlxChatFaqEditor` | `alx-chat-faq-editor` | FAQ management with reordering |
| `AlxChatFlowEditor` | `alx-chat-flow-editor` | Pre-chat flow configurator |
| `AlxChatCannedResponseList` | `alx-chat-canned-response-list` | Canned response CRUD |
| `AlxChatStats` | `alx-chat-stats` | Dashboard statistics cards (auto-refresh) |
| `AlxChatFeedbackStats` | `alx-chat-feedback-stats` | Rating distribution and average |
| `AlxChatOfflineMessages` | `alx-chat-offline-messages` | Offline message inbox |
| `AlxChatSettings` | `alx-chat-settings` | Global chat settings |

## Quick Start

Use the full dashboard:

```html
<alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
```

Or use individual components:

```html
<alx-chat-session-list></alx-chat-session-list>
<alx-chat-agent-dashboard></alx-chat-agent-dashboard>
```

## Theming

All components use CSS custom properties with `--alx-*` prefix. Override on the host or a parent element:

```css
alx-chat-dashboard {
  --alx-primary: #8b5cf6;
  --alx-bg: #0a0a0f;
  --alx-surface: #12141a;
}
```

## License

MIT

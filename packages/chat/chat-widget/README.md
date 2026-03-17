# @astralibx/chat-widget

[![npm version](https://img.shields.io/npm/v/@astralibx/chat-widget.svg)](https://www.npmjs.com/package/@astralibx/chat-widget)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Embeddable visitor-facing chat widget built with [Lit](https://lit.dev/) Web Components. Framework-agnostic -- works in React, Vue, Angular, or vanilla HTML. Includes a configurable pre-chat funnel (welcome, FAQ, guided questions, form, agent selector), offline handling, post-chat feedback, theming, and real-time events.

## Install

```bash
npm install @astralibx/chat-widget
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `socket.io-client` | Yes (`^4.0.0`) |

```bash
npm install socket.io-client
```

## Quick Start

### HTML

```html
<script type="module">
  import '@astralibx/chat-widget';
</script>

<alx-chat-widget
  socket-url="https://chat.example.com"
  channel="website"
  theme="dark"
  position="bottom-right"
></alx-chat-widget>
```

### Programmatic

```ts
import { AlxChatWidget } from '@astralibx/chat-widget';

const widget = document.querySelector('alx-chat-widget') as AlxChatWidget;
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  theme: 'dark',
  position: 'bottom-right',
  user: { userId: '123', name: 'John', email: 'john@example.com' },
  branding: { primaryColor: '#D4AF37', companyName: 'Acme', logoUrl: '/logo.png' },
  features: { soundNotifications: true, typingIndicator: true, readReceipts: true },
});
```

## Pre-Chat Flow

```ts
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  preChatFlow: {
    enabled: true,
    skipToChat: true,
    completionAction: 'chat',
    steps: [
      { type: 'welcome', title: 'Hi there!', subtitle: 'How can we help?', showOnlineStatus: true },
      {
        type: 'faq',
        searchEnabled: true,
        categories: [{ key: 'billing', label: 'Billing' }, { key: 'technical', label: 'Technical' }],
        items: [
          { question: 'How do I reset my password?', answer: 'Go to Settings > Security > Reset Password.', category: 'technical' },
          { question: 'What payment methods do you accept?', answer: 'Visa, Mastercard, PayPal.', category: 'billing' },
        ],
        showChatPrompt: true,
      },
      {
        type: 'guided',
        mode: 'sequential',
        questions: [
          { key: 'topic', text: 'What do you need help with?', options: [
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical Issue' },
            { value: 'other', label: 'Something Else', skipToStep: 'chat' },
          ]},
        ],
      },
      { type: 'form', title: 'Quick info', fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
      ]},
    ],
  },
});
```

## FAQ-Only Mode

Use the widget as a standalone help center without live chat:

```ts
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  features: { liveChatEnabled: false },
  preChatFlow: {
    enabled: true,
    completionAction: 'close',
    skipToChat: false,
    steps: [
      { type: 'welcome', title: 'Help Center' },
      { type: 'faq', items: [...], showChatPrompt: false },
    ],
  },
});
```

## Events

Track widget interactions with CustomEvents:

```ts
const widget = document.querySelector('alx-chat-widget');
widget.addEventListener('chat:session-started', (e) => {
  analytics.track('chat_started', e.detail);
});
widget.addEventListener('chat:faq-viewed', (e) => {
  analytics.track('faq_viewed', { question: e.detail.question });
});
```

## Features

- **Configurable pre-chat flow** -- Welcome screen, FAQ, guided questions, contact form, and agent selector steps in any order. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/pre-chat-flow.md)
- **FAQ-only mode** -- Use the widget as a standalone help center without live chat. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/pre-chat-flow.md#faq-only-mode-no-live-chat)
- **Theming** -- Dark and light themes with full CSS custom property override support. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/theming.md)
- **Offline handling** -- Configurable offline form, message, or auto-hide behavior. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/configuration.md#offline-configuration)
- **Post-chat feedback** -- Rating or survey collection after chat ends. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/configuration.md#post-chat-configuration)
- **Real-time events** -- CustomEvents for widget open/close, messages, sessions, FAQ interactions, escalation, and feedback. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/events.md)
- **Public API** -- Programmatic methods for configuration, escalation, and offline control. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/api-methods.md)
- **Branding** -- Custom primary color, company name, and logo via config. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/theming.md#branding-shortcut)

## Documentation

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/configuration.md) -- All config options: socket, theme, user, branding, features, offline, post-chat
2. [Pre-Chat Flow](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/pre-chat-flow.md) -- Step types, routing logic, FAQ-only mode
3. [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/theming.md) -- CSS custom properties reference and built-in themes
4. [Events](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/events.md) -- CustomEvent reference with detail payloads
5. [API Methods](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/api-methods.md) -- Public methods: `configure()`, `escalate()`, `showOffline()`

## License

MIT

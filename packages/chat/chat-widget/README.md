# @astralibx/chat-widget

Embeddable visitor-facing chat widget built with [Lit](https://lit.dev/) Web Components. Framework-agnostic -- works in React, Vue, Angular, or vanilla HTML.

**Repository**: [github.com/Hariprakash1997/astralib](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-widget)

## Installation

```bash
npm install @astralibx/chat-widget
```

**Peer dependency**: `socket.io-client@^4.0.0`

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

### Programmatic Configuration

```ts
import { AlxChatWidget } from '@astralibx/chat-widget';

const widget = document.querySelector('alx-chat-widget') as AlxChatWidget;
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  theme: 'dark',
  position: 'bottom-right',
  user: { userId: '123', name: 'John', email: 'john@example.com' },
  translations: { welcomeTitle: 'Chat With Us' },
  branding: {
    primaryColor: '#D4AF37',
    companyName: 'Acme',
    logoUrl: '/logo.png',
  },
  features: {
    soundNotifications: true,
    desktopNotifications: false,
    typingIndicator: true,
    readReceipts: true,
  },
});
```

## Pre-Chat Flow

The widget includes a configurable pre-chat funnel. Steps are optional and order is configurable.

```ts
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  preChatFlow: {
    enabled: true,
    skipToChat: true,
    completionAction: 'chat',
    steps: [
      {
        type: 'welcome',
        title: 'Hi there!',
        subtitle: 'How can we help you today?',
        showOnlineStatus: true,
      },
      {
        type: 'faq',
        searchEnabled: true,
        feedbackEnabled: true,
        categories: [
          { key: 'billing', label: 'Billing', icon: '💳' },
          { key: 'technical', label: 'Technical', icon: '🔧' },
        ],
        items: [
          { question: 'How do I reset my password?', answer: 'Go to Settings > Security...', category: 'technical' },
        ],
      },
      {
        type: 'guided',
        mode: 'sequential',
        questions: [
          {
            key: 'topic',
            text: 'What do you need help with?',
            options: [
              { value: 'billing', label: 'Billing', nextQuestion: 'billing_type' },
              { value: 'technical', label: 'Technical', skipToStep: 'chat' },
            ],
          },
        ],
      },
      {
        type: 'form',
        title: 'Quick info before we connect you',
        fields: [
          { key: 'name', label: 'Your Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
        ],
      },
      {
        type: 'agent-selector',
        title: 'Choose who to talk to',
        showAvailability: true,
        autoAssign: true,
      },
    ],
  },
});
```

### FAQ-Only Mode (no live chat)

```ts
widget.configure({
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

## Theming

The widget uses CSS custom properties prefixed with `--alx-chat-*`. Override them on the host element or via the `branding.primaryColor` config.

Built-in themes: `dark` (default), `light`. Set via the `theme` attribute or config.

| Property | Description |
|---|---|
| `--alx-chat-primary` | Primary accent color |
| `--alx-chat-primary-hover` | Primary hover color |
| `--alx-chat-primary-text` | Text on primary background |
| `--alx-chat-bg` | Widget background |
| `--alx-chat-surface` | Surface/card background |
| `--alx-chat-text` | Primary text color |
| `--alx-chat-text-muted` | Secondary text color |
| `--alx-chat-border` | Border color |
| `--alx-chat-radius` | Border radius |
| `--alx-chat-font` | Font family |
| `--alx-chat-font-size` | Base font size |

## Events

Listen for CustomEvents on the widget element:

```ts
widget.addEventListener('chat:widget-opened', () => {});
widget.addEventListener('chat:widget-closed', () => {});
widget.addEventListener('chat:session-started', (e) => { e.detail.sessionId; });
widget.addEventListener('chat:message-sent', (e) => { e.detail.message; });
widget.addEventListener('chat:message-received', (e) => { e.detail.message; });
widget.addEventListener('chat:prechat-completed', (e) => { e.detail.preferences; });
widget.addEventListener('chat:faq-viewed', (e) => { e.detail.question; });
widget.addEventListener('chat:faq-feedback', (e) => { e.detail.question; e.detail.helpful; });
widget.addEventListener('chat:escalated', (e) => { e.detail.reason; });
widget.addEventListener('chat:session-ended', (e) => { e.detail.sessionId; });
widget.addEventListener('chat:feedback-submitted', (e) => { e.detail; });
widget.addEventListener('chat:offline-message', (e) => { e.detail; });
```

## Public Methods

```ts
widget.configure(config);     // Set configuration
widget.escalate(reason?);     // Escalate to human agent
widget.showOffline();          // Show offline view
```

## Offline & Post-Chat

```ts
widget.configure({
  offline: {
    mode: 'form',                // 'form' | 'message' | 'hide'
    offlineTitle: 'We are offline',
    offlineMessage: 'Leave us a message',
    formFields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
  postChat: {
    enabled: true,
    type: 'rating',              // 'rating' | 'survey'
    ratingQuestion: 'How was your experience?',
    thankYouMessage: 'Thank you for your feedback!',
  },
});
```

## License

MIT

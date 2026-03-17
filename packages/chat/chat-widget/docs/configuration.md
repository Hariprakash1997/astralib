# Configuration

The widget can be configured via HTML attributes or the programmatic `configure()` method.

## HTML Attributes

```html
<alx-chat-widget
  socket-url="https://chat.example.com"
  channel="website"
  theme="dark"
  position="bottom-right"
></alx-chat-widget>
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `socket-url` | `string` | WebSocket server URL (required) |
| `channel` | `string` | Channel identifier for the chat session |
| `theme` | `'dark' \| 'light'` | Built-in theme. Default: `dark` |
| `position` | `'bottom-right' \| 'bottom-left'` | Widget position on the page |

## Programmatic Configuration

Use `configure()` for full control over all options:

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

### Config Object Reference

| Key | Type | Description |
|-----|------|-------------|
| `socketUrl` | `string` | WebSocket server URL (required) |
| `channel` | `string` | Channel identifier |
| `theme` | `'dark' \| 'light'` | Built-in theme |
| `position` | `'bottom-right' \| 'bottom-left'` | Widget position |
| `user` | `object` | Pre-identified user info |
| `user.userId` | `string` | User ID |
| `user.name` | `string` | Display name |
| `user.email` | `string` | Email address |
| `translations` | `object` | UI string overrides |
| `translations.welcomeTitle` | `string` | Welcome screen title |
| `branding` | `object` | Visual branding options |
| `branding.primaryColor` | `string` | Primary accent color (CSS color value) |
| `branding.companyName` | `string` | Company name shown in the widget |
| `branding.logoUrl` | `string` | URL to company logo image |
| `features` | `object` | Feature toggles |
| `features.soundNotifications` | `boolean` | Enable sound on new messages |
| `features.desktopNotifications` | `boolean` | Enable browser desktop notifications |
| `features.typingIndicator` | `boolean` | Show typing indicator |
| `features.readReceipts` | `boolean` | Show read receipts |

### Offline Configuration

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
});
```

| Key | Type | Description |
|-----|------|-------------|
| `offline.mode` | `'form' \| 'message' \| 'hide'` | Behavior when agents are offline |
| `offline.offlineTitle` | `string` | Title shown in offline state |
| `offline.offlineMessage` | `string` | Message shown in offline state |
| `offline.formFields` | `array` | Form fields for the offline contact form |

### Post-Chat Configuration

```ts
widget.configure({
  postChat: {
    enabled: true,
    type: 'rating',              // 'rating' | 'survey'
    ratingQuestion: 'How was your experience?',
    thankYouMessage: 'Thank you for your feedback!',
  },
});
```

| Key | Type | Description |
|-----|------|-------------|
| `postChat.enabled` | `boolean` | Enable post-chat feedback |
| `postChat.type` | `'rating' \| 'survey'` | Feedback type |
| `postChat.ratingQuestion` | `string` | Question shown for rating |
| `postChat.thankYouMessage` | `string` | Message shown after submission |

# Public API Methods

The `<alx-chat-widget>` element exposes public methods for programmatic control.

## Getting a Reference

```ts
import { AlxChatWidget } from '@astralibx/chat-widget';

const widget = document.querySelector('alx-chat-widget') as AlxChatWidget;
```

## Methods

### `configure(config)`

Set the widget configuration. Can be called at any time to update settings.

```ts
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

See [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/configuration.md) for the full config object reference.

### `escalate(reason?)`

Escalate the current chat session to a human agent. Optionally provide a reason string.

```ts
widget.escalate();
widget.escalate('Customer requested supervisor');
```

Fires the `chat:escalated` event with `{ reason }` in the detail.

### `showOffline()`

Manually switch the widget to its offline view. Useful when you detect agent unavailability from your own backend.

```ts
widget.showOffline();
```

The offline view behavior is controlled by the `offline` configuration. See [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/configuration.md#offline-configuration).

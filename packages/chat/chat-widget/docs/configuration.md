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
| `theme` | `'dark' \| 'light' \| 'auto'` | Built-in theme. `'auto'` detects OS preference via `prefers-color-scheme` and switches automatically. Default: `dark` |
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
| `theme` | `'dark' \| 'light' \| 'auto'` | Built-in theme. `'auto'` follows OS preference |
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
| `features.maxReconnectAttempts` | `number` | Max socket reconnection attempts before giving up. Default: `10` |

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

### Styles Override

Override any `--alx-chat-*` CSS custom property directly via the config object. Properties are applied to the host element.

```ts
widget.configure({
  styles: {
    '--alx-chat-primary': '#e11d48',
    '--alx-chat-radius': '20px',
    '--alx-chat-font': '"Poppins", sans-serif',
    '--alx-chat-bg': '#0a0a0a',
  },
});
```

See [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/docs/theming.md) for all available CSS custom properties.

## Conversation Starters

The welcome step supports clickable conversation starters -- quick-action chips shown below the CTA button.

```ts
widget.configure({
  preChatFlow: {
    enabled: true,
    steps: [
      {
        type: 'welcome',
        title: 'Hi there!',
        subtitle: 'How can we help?',
        starters: [
          'How do I reset my password?',
          'What are your business hours?',
          'I need billing help',
          'Track my order',
        ],
      },
    ],
  },
});
```

- Maximum 4 starters are shown (additional entries are ignored).
- Clicking a starter sends its text as the first visitor message and opens the chat view.
- Dispatches the `chat:starter-selected` event with `{ text: string }` in the detail.

## Message Status Indicators

Visitor messages display a visual status lifecycle inside the bubble:

| Status | Visual | Description |
|--------|--------|-------------|
| Sending | Spinning circle animation | Message is in transit |
| Sent | Single checkmark | Server acknowledged receipt |
| Delivered | Double checkmark (second slides in) | Agent's client received the message |
| Read | Double checkmark turns blue | Agent opened/read the message |
| Failed | Red X icon + "Retry" button | Send failed. Clicking "Retry" re-sends the message and dispatches `message-retry` |

Status transitions animate smoothly using spring easing. The second checkmark slides in from the left when transitioning from Sent to Delivered.

## Launcher Preview Tooltip

When the widget is closed and there are unread messages, a tooltip preview appears next to the launcher button:

- Appears after **3 seconds** of an unread message arriving.
- Shows the sender avatar (or initial), sender name, and a truncated message preview (max 180px).
- Auto-dismisses after **8 seconds**.
- Clicking the tooltip opens the widget and clears the notification.
- A small close button allows dismissal without opening the widget.

The tooltip is driven by properties on the launcher component (`lastMessageSender`, `lastMessageText`, `lastMessageAvatar`) which are set programmatically by the root widget when new agent messages arrive.

## Attachment Button

The chat input supports an optional attachment button:

```html
<alx-chat-input show-attach></alx-chat-input>
```

When the `show-attach` attribute is present, a "+" button appears to the left of the text input. Clicking it dispatches the `attach-click` event. The consumer is responsible for handling file selection and upload via their own adapter.

Only show the attachment button when your backend supports file uploads (i.e., the `uploadFile` capability is available).

## Message Grouping

Consecutive messages from the same sender within 2 minutes are visually grouped (iMessage-style):

| Position | Avatar | Name | Border Radius |
|----------|--------|------|---------------|
| Solo (single message) | Shown | Shown | Full rounded with tail |
| First in group | Shown | Shown | Full rounded top, connected bottom |
| Middle | Hidden (spacer) | Hidden | Connected top and bottom |
| Last in group | Hidden (spacer) | Hidden | Connected top, full rounded bottom with tail |

Date separators appear between messages sent on different calendar days, showing "Today", "Yesterday", or a formatted date string.

## Accessibility

The widget follows WAI-ARIA best practices:

- **ARIA roles**: `complementary` on the widget container, `log` on the message list, `button` on interactive controls, `textbox` on the input.
- **Keyboard navigation**: All interactive elements are reachable via Tab. Enter/Space activates buttons. Enter sends a message; Shift+Enter inserts a newline.
- **Screen readers**: The message container uses `aria-live="polite"` so new messages are announced automatically.
- **Reduced motion**: When `prefers-reduced-motion: reduce` is active, all spring animations and transitions are disabled (duration set to near-zero).
- **RTL support**: Set `dir="rtl"` or `dir="auto"` (default) to enable right-to-left layout. Auto-detection uses the `locale` config or `navigator.language` to determine direction. All margins and alignment use CSS logical properties for correct RTL behavior.

## Cross-Device Session Handoff

Sessions are identified by `visitorId` stored in localStorage. For cross-device continuity:

1. Identify the visitor using `chat:identify` with a userId
2. When the visitor connects from another device with the same userId, the existing session is resumed

Anonymous visitors (no `chat:identify` call) cannot transfer sessions between devices.

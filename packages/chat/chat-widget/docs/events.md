# Events

The widget dispatches `CustomEvent` instances on the `<alx-chat-widget>` element. Listen with `addEventListener`:

```ts
const widget = document.querySelector('alx-chat-widget');

widget.addEventListener('chat:message-sent', (e) => {
  console.log(e.detail.message);
});
```

## Event Reference

| Event | Detail Properties | Description |
|-------|-------------------|-------------|
| `chat:widget-opened` | -- | Widget was opened by the visitor |
| `chat:widget-closed` | -- | Widget was closed by the visitor |
| `chat:session-started` | `sessionId` | A new chat session was created |
| `chat:message-sent` | `message` | Visitor sent a message |
| `chat:message-received` | `message` | Agent message was received |
| `chat:prechat-completed` | `preferences` | Visitor completed the pre-chat flow |
| `chat:faq-viewed` | `question` | Visitor viewed an FAQ answer |
| `chat:faq-feedback` | `question`, `helpful` | Visitor submitted FAQ feedback |
| `chat:escalated` | `reason` | Chat was escalated to a human agent |
| `chat:session-ended` | `sessionId` | Chat session ended |
| `chat:feedback-submitted` | (full detail object) | Post-chat feedback was submitted |
| `chat:offline-message` | (full detail object) | Visitor submitted an offline contact form |
| `chat:starter-selected` | `text` | Visitor clicked a conversation starter chip |
| `chat:connection-failed` | -- | Reconnection gave up after `maxReconnectAttempts` |
| `message-retry` | `messageId` | Visitor clicked "Retry" on a failed message (internal, bubbles from `<alx-chat-bubble>`) |

## Usage Example

```ts
const widget = document.querySelector('alx-chat-widget') as AlxChatWidget;

widget.addEventListener('chat:widget-opened', () => {
  analytics.track('chat_opened');
});

widget.addEventListener('chat:session-started', (e) => {
  console.log('Session:', e.detail.sessionId);
});

widget.addEventListener('chat:message-sent', (e) => {
  console.log('Visitor said:', e.detail.message);
});

widget.addEventListener('chat:message-received', (e) => {
  console.log('Agent said:', e.detail.message);
});

widget.addEventListener('chat:prechat-completed', (e) => {
  console.log('Pre-chat preferences:', e.detail.preferences);
});

widget.addEventListener('chat:faq-viewed', (e) => {
  console.log('FAQ viewed:', e.detail.question);
});

widget.addEventListener('chat:faq-feedback', (e) => {
  console.log('FAQ feedback:', e.detail.question, 'helpful:', e.detail.helpful);
});

widget.addEventListener('chat:escalated', (e) => {
  console.log('Escalated:', e.detail.reason);
});

widget.addEventListener('chat:session-ended', (e) => {
  console.log('Session ended:', e.detail.sessionId);
});

widget.addEventListener('chat:feedback-submitted', (e) => {
  console.log('Feedback:', e.detail);
});

widget.addEventListener('chat:offline-message', (e) => {
  console.log('Offline message:', e.detail);
});

widget.addEventListener('chat:starter-selected', (e) => {
  console.log('Starter selected:', e.detail.text);
});

widget.addEventListener('chat:connection-failed', () => {
  console.log('Connection failed after max retries');
});

widget.addEventListener('message-retry', (e) => {
  console.log('Retrying message:', e.detail.messageId);
});
```

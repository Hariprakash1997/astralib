# Configuration Reference

The `createTelegramInbox()` factory accepts a single `TelegramInboxConfig` object. This page documents every field.

## Full Config Example

```ts
import type { TelegramInboxConfig } from '@astralibx/telegram-inbox';

const config: TelegramInboxConfig = {
  // --- Required ---
  accountManager: tam,                   // TelegramAccountManager instance

  db: {
    connection: mongooseConnection,      // Mongoose Connection instance
    collectionPrefix: 'myapp_',          // Optional prefix for all collection names
  },

  // --- Optional ---
  media: {
    uploadAdapter: async (buffer, filename, mimeType) => {
      // The library downloads the file from Telegram into a Buffer.
      // Your adapter stores it (S3, GCS, local disk, etc.) and returns a URL.
      const url = await myStorage.upload(buffer, filename, mimeType);
      return { url, mimeType, fileSize: buffer.length };
    },
    maxFileSizeMb: 50,                   // Max file size to download (default: 50)
  },

  options: {
    historySyncLimit: 100,               // Max messages per chat on sync (default: 100)
    autoAttachOnConnect: true,           // Auto-attach listeners on init (default: true)
    typingTimeoutMs: 5000,               // Typing indicator timeout (default: 5000)
  },

  logger: {
    info: (msg, meta) => {},
    warn: (msg, meta) => {},
    error: (msg, meta) => {},
  },

  hooks: {
    onNewMessage: (message) => {},
    onMessageRead: ({ messageId, chatId, readAt }) => {},
    onTyping: ({ chatId, userId, accountId }) => {},
  },
};
```

## Section Details

### `accountManager` (required)

A `TelegramAccountManager` instance created by `createTelegramAccountManager()` from `@astralibx/telegram-account-manager`. The inbox uses it to access TDLib clients, get connected accounts, and send messages.

### `db` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | A Mongoose connection instance |
| `collectionPrefix` | `string` | `''` | Prefix prepended to all MongoDB collection names |

Collections created: `telegram_messages`, `telegram_conversation_sessions` (prefixed if configured).

### `media`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `uploadAdapter` | `(buffer, filename, mimeType) => Promise<MediaUploadResult>` | `undefined` | Callback to store downloaded media |
| `maxFileSizeMb` | `number` | `50` | Maximum file size to download from Telegram (MB) |

#### Upload Adapter Pattern

The library handles downloading media from Telegram. Your adapter handles storage:

1. The inbox listener detects an incoming message with media (photo, video, document, etc.)
2. The library downloads the file from Telegram via GramJS into a `Buffer`
3. Your `uploadAdapter` receives the `Buffer`, `filename`, and `mimeType`
4. Your adapter stores the file (S3, GCS, local disk, etc.) and returns a `MediaUploadResult`
5. The returned `url` is saved on the message document as `mediaUrl`

```ts
interface MediaUploadResult {
  url: string;
  mimeType?: string;
  fileSize?: number;
}
```

If no `uploadAdapter` is provided, media messages are stored without `mediaUrl`.

### `options`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `historySyncLimit` | `number` | `100` | Maximum messages to pull per chat during history sync |
| `autoAttachOnConnect` | `boolean` | `true` | Automatically attach message listeners to all connected accounts on init |
| `typingTimeoutMs` | `number` | `5000` | Typing indicator timeout in milliseconds |

### `logger` (optional)

Provide an object with `info`, `warn`, and `error` methods. Each receives `(message: string, meta?: Record<string, unknown>)`. If omitted, logging is silent. Re-exported as `LogAdapter` from `@astralibx/core`.

### `hooks`

All hooks are optional. They fire after the corresponding event is processed.

| Hook | Fires when | Payload |
|------|------------|---------|
| `onNewMessage` | A new message is received or sent | `InboxMessage` -- `{ conversationId, messageId, senderId, senderType, direction, contentType, content, mediaUrl?, mediaType?, createdAt }` |
| `onMessageRead` | `conversationService.markAsRead()` completes | `{ messageId: string, chatId: string, readAt: Date }` -- `messageId` is the specific message ID or `'all'` if marking all messages |
| `onTyping` | A typing event is detected | `{ chatId: string, userId: string, accountId: string }` |

The `conversationId` used throughout the system is the raw Telegram chat ID (e.g. `"123456789"`). When creating sessions via the API, pass the chat ID as `conversationId` to ensure consistency with the message listener.

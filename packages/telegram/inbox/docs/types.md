# Exported Types

All types can be imported from `@astralibx/telegram-inbox`:

```ts
import type {
  TelegramInboxConfig,
  InboxMessage,
  ContentType,
  // ... etc.
} from '@astralibx/telegram-inbox';
```

---

## Config Types

**`TelegramInboxConfig`** -- Main configuration passed to `createTelegramInbox()`.
- `accountManager: TelegramAccountManager` -- Account manager instance
- `db.connection: Connection` -- Mongoose connection
- `db.collectionPrefix?: string` -- Prefix for collection names
- `media?.uploadAdapter` -- Media upload callback
- `media?.maxFileSizeMb` -- Max download size (default: 50)
- `options?.historySyncLimit` -- Max messages per sync (default: 100)
- `options?.autoAttachOnConnect` -- Auto-attach listeners (default: true)
- `options?.typingTimeoutMs` -- Typing timeout (default: 5000)
- `logger?: LogAdapter` -- Logger adapter
- `hooks?` -- Event hooks (see [Configuration](./configuration.md#hooks))

**`LogAdapter`** -- Logger interface (re-exported from `@astralibx/core`).
- `info(msg: string, meta?: any): void`
- `warn(msg: string, meta?: any): void`
- `error(msg: string, meta?: any): void`

**`MediaUploadResult`** -- Return value from `uploadAdapter`.
- `url: string` -- Stored file URL
- `mimeType?: string`
- `fileSize?: number`

**`InboxMessage`** -- Normalized message passed to hooks and events.
- `conversationId: string`, `messageId: string`
- `senderId: string`, `senderType: SenderType`
- `direction: MessageDirection`, `contentType: ContentType`
- `content: string`, `mediaUrl?: string`, `mediaType?: string`
- `accountId: string` -- The account that received or sent this message
- `createdAt: Date`

---

## Message Types

**`CreateMessageInput`** -- Input for creating a message document.
- `conversationId: string`, `messageId: string`, `senderId: string`
- `senderType: SenderType`, `direction: MessageDirection`, `contentType: ContentType`
- `content: string`, `mediaType?: string`, `mediaUrl?: string`

**`MessageFilters`** -- Filters for querying messages.
- `conversationId?: string`, `direction?: MessageDirection`
- `contentType?: ContentType`, `startDate?: Date`, `endDate?: Date`

---

## Session Types

**`CreateSessionInput`** -- Input for creating a conversation session.
- `accountId: string`, `contactId: string`, `identifierId?: string`

**`SessionFilters`** -- Filters for querying sessions.
- `accountId?: string`, `contactId?: string`, `status?: SessionStatus`

---

## Union Types

```ts
import type { ContentType, MessageDirection, SenderType, SessionStatus } from '@astralibx/telegram-inbox';
```

| Type | Values |
|------|--------|
| `ContentType` | `'text'`, `'photo'`, `'video'`, `'voice'`, `'audio'`, `'document'`, `'sticker'`, `'location'`, `'contact'` |
| `MessageDirection` | `'inbound'`, `'outbound'` |
| `SenderType` | `'account'`, `'user'` |
| `SessionStatus` | `'active'`, `'paused'`, `'closed'` |

---

## Service Types

**`Dialog`** -- Returned by `DialogLoaderService.loadDialogs()`.
- `chatId: string`, `title: string`
- `type: 'user' | 'group' | 'channel'`
- `unreadCount: number`
- `lastMessage?: { text: string; date: Date }`

**`ConversationListItem`** -- Returned by `ConversationService.list()`.
- `conversationId: string`
- `lastMessage: { content, contentType, direction, createdAt }`
- `messageCount: number`, `unreadCount: number`

**`ConversationFilters`** -- Filters for listing conversations.
- `direction?: 'inbound' | 'outbound'`, `contentType?: string`
- `startDate?: Date`, `endDate?: Date`

**`SyncResult`** -- Returned by `HistorySyncService.syncChat()`.
- `success: boolean`, `messagesImported: number`
- `oldestMessageId?: number`, `hasMore: boolean`, `error?: string`

**`TypingEvent`** -- Emitted on `inbox:typing`.
- `chatId: string`, `userId: string`

**`MessageReadEvent`** -- Emitted on `inbox:message_read`.
- `chatId: string`, `messageId: string`

---

## Constants

All constants are exported as `const` arrays with corresponding union types.

```ts
import {
  CONTENT_TYPES,
  MESSAGE_DIRECTIONS,
  SENDER_TYPES,
  SESSION_STATUSES,
  DEFAULT_HISTORY_SYNC_LIMIT,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_TYPING_TIMEOUT_MS,
} from '@astralibx/telegram-inbox';
```

| Constant | Value | Description |
|----------|-------|-------------|
| `CONTENT_TYPES` | `['text', 'photo', 'video', ...]` | All supported content types |
| `MESSAGE_DIRECTIONS` | `['inbound', 'outbound']` | Message direction values |
| `SENDER_TYPES` | `['account', 'user']` | Sender type values |
| `SESSION_STATUSES` | `['active', 'paused', 'closed']` | Session status values |
| `DEFAULT_HISTORY_SYNC_LIMIT` | `100` | Default max messages per sync |
| `DEFAULT_MAX_FILE_SIZE_MB` | `50` | Default max file download size |
| `DEFAULT_TYPING_TIMEOUT_MS` | `5000` | Default typing indicator timeout |

---

## Error Classes

All errors extend `AlxTelegramInboxError` (which extends `AlxError` from `@astralibx/core`).

```ts
import { ConversationNotFoundError, MediaUploadError } from '@astralibx/telegram-inbox';
```

| Class | Code | Key Properties |
|-------|------|----------------|
| `AlxTelegramInboxError` | *(custom)* | `message`, `code` |
| `ConfigValidationError` | `CONFIG_VALIDATION` | `field` |
| `ConversationNotFoundError` | `CONVERSATION_NOT_FOUND` | `conversationId` |
| `MessageNotFoundError` | `MESSAGE_NOT_FOUND` | `messageId` |
| `MediaUploadError` | `MEDIA_UPLOAD_ERROR` | `filename`, `originalError` |
| `SyncError` | `SYNC_ERROR` | `accountId`, `originalError` |

---

## Mongoose Schema Types

```ts
import {
  createTelegramMessageSchema,
  createTelegramConversationSessionSchema,
} from '@astralibx/telegram-inbox';
```

| Interface | Document Type | Model Type | Schema Factory |
|-----------|---------------|------------|----------------|
| `ITelegramMessage` | `TelegramMessageDocument` | `TelegramMessageModel` | `createTelegramMessageSchema()` -- includes `accountId: string` field |
| `ITelegramConversationSession` | `TelegramConversationSessionDocument` | `TelegramConversationSessionModel` | `createTelegramConversationSessionSchema()` |

Each schema factory accepts an optional `prefix?: string` argument for collection naming.

---

## Exported Service Classes

Instances are available on the `TelegramInbox` object returned by `createTelegramInbox()`.

```ts
import type { ConversationService, SessionService } from '@astralibx/telegram-inbox';
```

| Class | Access via | Purpose |
|-------|-----------|---------|
| `DialogLoaderService` | `.dialogs` | Load dialogs from Telegram for a connected account |
| `MessageListenerService` | `.listener` | Attach/detach message listeners on TDLib clients |
| `ConversationService` | `.conversations` | List conversations, get messages, mark as read, search |
| `HistorySyncService` | `.history` | Pull historical messages from Telegram |
| `MessageService` | `.messages` | Send messages via TDLib |
| `SessionService` | `.sessions` | Conversation session CRUD and lifecycle |
| `TypingBroadcasterService` | `.typing` | Broadcast typing indicators |
| `InboxEventGateway` | `.events` | EventEmitter for `inbox:new_message`, `inbox:typing`, `inbox:message_read` |

---

## `TelegramInbox` Interface

Returned by `createTelegramInbox()`:

```ts
interface TelegramInbox {
  routes: Router;                        // Express router with all endpoints

  listener: MessageListenerService;
  conversations: ConversationService;
  history: HistorySyncService;
  messages: MessageService;
  sessions: SessionService;
  typing: TypingBroadcasterService;
  dialogs: DialogLoaderService;
  events: InboxEventGateway;

  models: {
    TelegramMessage: TelegramMessageModel;
    TelegramConversationSession: TelegramConversationSessionModel;
  };

  destroy(): Promise<void>;              // Graceful shutdown
}
```

---

## Route Dependencies

**`TelegramInboxRouteDeps`** -- Dependency object for `createRoutes()` (advanced usage for custom route setup).
- `conversationController: ReturnType<typeof createConversationController>`
- `sessionController: ReturnType<typeof createSessionController>`
- `logger?: LogAdapter`

---

## `validateConfig`

```ts
import { validateConfig } from '@astralibx/telegram-inbox';

validateConfig(config); // throws ConfigValidationError if invalid
```

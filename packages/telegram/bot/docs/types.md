# Exported Types

All types can be imported from `@astralibx/telegram-bot`:

```ts
import type {
  TelegramBotConfig,
  CommandDef,
  CallbackDef,
  InlineQueryDef,
  MiddlewareFn,
  BotInstance,
  WebhookConfig,
} from '@astralibx/telegram-bot';
```

---

## Config Types

**`TelegramBotConfig`** -- Main configuration passed to `createTelegramBot()`.
- `token: string` -- Bot token from BotFather
- `mode: 'polling' | 'webhook'` -- Operation mode
- `webhook?: WebhookConfig` -- Webhook settings (required when mode is `'webhook'`)
- `db.connection: Connection` -- Mongoose connection
- `db.collectionPrefix?: string` -- Prefix for collection names
- `commands?: CommandDef[]` -- Bot commands
- `callbacks?: CallbackDef[]` -- Callback query handlers
- `inlineQueries?: InlineQueryDef[]` -- Inline query handlers
- `middleware?: MiddlewareFn[]` -- Message middleware chain
- `logger?: LogAdapter` -- Logger adapter
- `hooks?` -- Lifecycle event hooks (see [Configuration](./configuration.md#hooks))

**`WebhookConfig`** -- Webhook mode settings.
- `domain: string` -- Public HTTPS domain
- `path?: string` -- Webhook endpoint path (default: `/telegram/webhook`)
- `port?: number` -- Webhook server port (default: `8443`)
- `secretToken?: string` -- Secret token for verification

**`CommandDef`** -- Bot command definition.
- `command: string` -- Command name (without `/`)
- `description: string` -- Command description
- `handler: (msg: Message, bot: BotInstance) => void | Promise<void>` -- Handler function

**`CallbackDef`** -- Callback query handler definition.
- `pattern: RegExp` -- Pattern to match `callback_data`
- `handler: (query: CallbackQuery, bot: BotInstance) => void | Promise<void>` -- Handler function

**`InlineQueryDef`** -- Inline query handler definition.
- `pattern: RegExp` -- Pattern to match query text
- `handler: (query: InlineQuery, bot: BotInstance) => void | Promise<void>` -- Handler function

**`MiddlewareFn`** -- Middleware function signature.
- `(msg: Message, next: () => Promise<void>) => void | Promise<void>`

**`BotInstance`** -- Bot instance passed to handlers.
- `sendMessage(chatId, text, options?)` -- Send text message
- `sendPhoto(chatId, photo, options?)` -- Send photo
- `sendDocument(chatId, doc, options?)` -- Send document
- `answerCallbackQuery(callbackQueryId, options?)` -- Answer callback query
- `answerInlineQuery(inlineQueryId, results, options?)` -- Answer inline query
- `keyboards: KeyboardBuilder` -- Keyboard builder instance
- `raw: TelegramBot` -- Raw `node-telegram-bot-api` instance

**`LogAdapter`** -- Logger interface (re-exported from `@astralibx/core`).
- `info(msg: string, meta?: any): void`
- `warn(msg: string, meta?: any): void`
- `error(msg: string, meta?: any): void`

### Config Hooks

Available hooks on `TelegramBotConfig.hooks`:

| Hook | Payload |
|------|---------|
| `onUserStart` | `{ userId, firstName, username?, chatId }` |
| `onUserBlocked` | `{ userId, chatId }` |
| `onCommand` | `{ command, userId, chatId }` |
| `onError` | `{ error, context }` |

---

## Constants

All constants are exported as `const` objects.

```ts
import { CONTACT_STATUS, BOT_MODE, DEFAULT_WEBHOOK_PATH } from '@astralibx/telegram-bot';
```

**`CONTACT_STATUS`**
```ts
{ Active: 'active', Blocked: 'blocked', Stopped: 'stopped' }
```

**`BOT_MODE`**
```ts
{ Polling: 'polling', Webhook: 'webhook' }
```

**`DEFAULT_WEBHOOK_PATH`** -- `'/telegram/webhook'`

---

## Error Classes

All errors extend `Error`.

```ts
import { BotNotRunningError, BotAlreadyRunningError, ConfigValidationError, CommandNotFoundError } from '@astralibx/telegram-bot';
```

| Class | Message / Key Properties |
|-------|-------------------------|
| `BotNotRunningError` | `'Bot is not running. Call start() first.'` |
| `BotAlreadyRunningError` | `'Bot is already running. Call stop() first.'` |
| `ConfigValidationError` | `message`, `field` |
| `CommandNotFoundError` | `'Command not found: {name}'` |

---

## Mongoose Schema Types

```ts
import {
  createTelegramBotContactSchema,
  type TelegramBotContactDocument,
  type TelegramBotContactModel,
  type BotInteraction,
} from '@astralibx/telegram-bot';
```

**`BotInteraction`** -- Interaction record for a specific bot.
- `botUsername: string`, `botId: string`
- `status: 'active' | 'blocked' | 'stopped'`
- `interactionCount: number`
- `firstInteractionAt: Date`, `lastInteractionAt: Date`
- `blockedAt?: Date`, `blockReason?: string`

**`TelegramBotContactDocument`** -- Mongoose document for a tracked user.
- `telegramUserId: string`
- `firstName: string`, `lastName?: string`, `username?: string`, `languageCode?: string`
- `interactions: BotInteraction[]`
- `createdAt: Date`, `updatedAt: Date`

Schema factory: `createTelegramBotContactSchema(options?)` accepts `{ collectionName?: string }`.

---

## Exported Service Classes

Instances are available on the object returned by `createTelegramBot()`.

```ts
import { BotService, UserTrackerService } from '@astralibx/telegram-bot';
```

| Class | Access via | Purpose |
|-------|-----------|---------|
| `BotService` | Internal | Bot lifecycle, command registration, message sending |
| `UserTrackerService` | `.tracker` | User interaction tracking and statistics |

### `UserTrackerService`

| Method | Returns | Description |
|--------|---------|-------------|
| `trackInteraction(user, botUsername, botId)` | `Promise<TrackingResult>` | Track a user interaction (upsert) |
| `getUser(telegramUserId)` | `Promise<Document \| null>` | Get user by Telegram ID |
| `getAllUsers(filters?, pagination?)` | `Promise<{ users, total }>` | List users with filters and pagination |
| `getUserCount(botUsername?)` | `Promise<number>` | Count total users |
| `getActiveUsers(botUsername?)` | `Promise<number>` | Count active users |
| `markBlocked(telegramUserId, botUsername, reason?)` | `Promise<boolean>` | Mark user as blocked |
| `isBlocked(telegramUserId, botUsername)` | `Promise<boolean>` | Check if user is blocked |
| `getStats(botUsername)` | `Promise<Stats>` | Get aggregated statistics |

### `KeyboardBuilder`

| Method | Returns | Description |
|--------|---------|-------------|
| `inline(buttons)` | `InlineKeyboardMarkup` | Create inline keyboard |
| `reply(buttons, options?)` | `ReplyKeyboardMarkup` | Create reply keyboard |
| `remove(selective?)` | `ReplyKeyboardRemove` | Remove keyboard |

---

## `TelegramBot` Interface

Returned by `createTelegramBot()`:

```ts
interface TelegramBot {
  routes: Router;                            // Express router with admin endpoints
  start(): Promise<void>;                    // Start the bot
  stop(): Promise<void>;                     // Stop the bot
  registerCommand(cmd: CommandDef): void;    // Register command at runtime
  removeCommand(name: string): void;         // Remove a command
  tracker: UserTrackerService;               // User tracking service
  keyboards: KeyboardBuilder;                // Keyboard builder
  sendMessage(chatId, text, options?): Promise<Message>;  // Send message
  getBotInfo(): { username, id } | null;     // Get bot info
  isRunning(): boolean;                      // Check if bot is running
  models: {
    TelegramBotContact: TelegramBotContactModel;
  };
}
```

---

## Route Dependencies

**`TelegramBotRouteDeps`** -- Dependency object for `createRoutes()` (advanced usage for custom route setup).
- `botController: ReturnType<typeof createBotController>`
- `logger?: LogAdapter`

---

## `validateConfig`

```ts
import { validateConfig } from '@astralibx/telegram-bot';

validateConfig(config); // throws ConfigValidationError if invalid
```

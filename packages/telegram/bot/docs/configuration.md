# Configuration Reference

The `createTelegramBot()` factory accepts a single `TelegramBotConfig` object. This page documents every field.

## Full Config Example

```ts
import type { TelegramBotConfig } from '@astralibx/telegram-bot';

const config: TelegramBotConfig = {
  // --- Required ---
  token: 'your-bot-token-from-botfather',
  mode: 'polling',                           // 'polling' or 'webhook'

  db: {
    connection: mongooseConnection,           // Mongoose Connection instance
    collectionPrefix: 'myapp_',              // Optional prefix for collection names
  },

  // --- Required for webhook mode ---
  webhook: {
    domain: 'https://example.com',           // Public domain for webhook URL
    path: '/telegram/webhook',               // Webhook path (default: /telegram/webhook)
    port: 8443,                              // Webhook server port (default: 8443)
    secretToken: 'optional-secret',          // Webhook secret token
  },

  // --- Optional ---
  commands: [
    {
      command: 'start',
      description: 'Start the bot',
      handler: async (msg, bot) => {
        await bot.sendMessage(msg.chat.id, 'Welcome!');
      },
    },
  ],

  callbacks: [
    {
      pattern: /btn_.*/,
      handler: async (query, bot) => {
        await bot.answerCallbackQuery(query.id, { text: 'Clicked!' });
      },
    },
  ],

  inlineQueries: [
    {
      pattern: /.*/,
      handler: async (query, bot) => {
        await bot.answerInlineQuery(query.id, []);
      },
    },
  ],

  middleware: [
    async (msg, next) => {
      console.log('Message from:', msg.from?.id);
      await next();
    },
  ],

  logger: {
    info: (msg, meta) => {},
    warn: (msg, meta) => {},
    error: (msg, meta) => {},
  },

  hooks: {
    onUserStart: ({ userId, firstName, username, chatId }) => {},
    onUserBlocked: ({ userId, chatId }) => {},
    onCommand: ({ command, userId, chatId }) => {},
    onError: ({ error, context }) => {},
  },
};
```

## Section Details

### `token` (required)

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | Bot token from [@BotFather](https://t.me/botfather) |

### `mode` (required)

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `'polling' \| 'webhook'` | Bot operation mode |

### `webhook` (required when mode is `'webhook'`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `domain` | `string` | -- | Public domain (must be a valid URL) |
| `path` | `string` | `'/telegram/webhook'` | Webhook endpoint path |
| `port` | `number` | `8443` | Webhook server port |
| `secretToken` | `string` | -- | Optional secret token for webhook verification |

### `db` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | A Mongoose connection instance |
| `collectionPrefix` | `string` | `''` | Prefix prepended to collection names |

### `commands`

Array of `CommandDef` objects. Each defines a bot command that responds to `/command` messages.

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | Command name (without `/`) |
| `description` | `string` | Description shown in Telegram's command menu |
| `handler` | `(msg, bot) => void \| Promise<void>` | Handler function receiving the message and bot instance |

Commands can also be registered at runtime via `bot.registerCommand(cmd)`.

### `callbacks`

Array of `CallbackDef` objects. Each handles inline keyboard callback queries matched by pattern.

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `RegExp` | Regular expression to match `callback_data` |
| `handler` | `(query, bot) => void \| Promise<void>` | Handler function receiving the callback query and bot instance |

### `inlineQueries`

Array of `InlineQueryDef` objects. Each handles inline queries matched by pattern.

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `RegExp` | Regular expression to match the inline query text |
| `handler` | `(query, bot) => void \| Promise<void>` | Handler function receiving the inline query and bot instance |

### `middleware`

Array of `MiddlewareFn` functions. Middleware runs sequentially before command handlers. Each middleware must call `next()` to pass control to the next middleware or the command handler.

```ts
middleware: [
  async (msg, next) => {
    // Check authorization
    if (isAuthorized(msg.from?.id)) {
      await next(); // Continue to command handler
    }
    // Not calling next() blocks the command
  },
  async (msg, next) => {
    // Log all messages
    console.log('Received:', msg.text);
    await next();
  },
],
```

If a middleware throws an error, the chain is aborted and the command handler does not execute.

### `logger` (optional)

Provide an object with `info`, `warn`, and `error` methods. Each receives `(message: string, meta?: Record<string, unknown>)`. If omitted, logging is silent. Re-exported as `LogAdapter` from `@astralibx/core`.

### `hooks`

All hooks are optional. They fire after the corresponding event is processed.

| Hook | Payload | When |
|------|---------|------|
| `onUserStart` | `{ userId, firstName, username?, chatId }` | First interaction from a new user |
| `onUserBlocked` | `{ userId, chatId }` | User marked as blocked |
| `onCommand` | `{ command, userId, chatId }` | Any command is executed |
| `onError` | `{ error, context }` | Error in command/callback/inline handler |

## Webhook vs Polling

| Feature | Polling | Webhook |
|---------|---------|---------|
| Setup | No server needed | Requires public HTTPS domain |
| Latency | Slightly higher | Near-instant |
| Resource usage | Continuous polling | Event-driven |
| Firewall | Works behind NAT | Needs open port |
| Best for | Development, small bots | Production, high-traffic bots |

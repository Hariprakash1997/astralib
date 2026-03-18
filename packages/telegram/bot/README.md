# @astralibx/telegram-bot

A customizable Telegram bot factory with command registration, keyboard builder, webhook/polling support, user tracking, and Express admin routes. Create a fully functional bot with a single factory call.

> **Getting started?** See the [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/quick-start-tutorial.md) for a step-by-step walkthrough, [Integration Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/integration-guide.md) for multi-package setup, or the [Glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/docs/glossary.md) for ID terminology.

## Install

```bash
npm install @astralibx/telegram-bot
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |
| `node-telegram-bot-api` | Yes |

```bash
npm install express mongoose node-telegram-bot-api
```

## Quick Start

```ts
import express from 'express';
import mongoose from 'mongoose';
import { createTelegramBot } from '@astralibx/telegram-bot';

const app = express();
app.use(express.json());

const db = await mongoose.createConnection('mongodb://localhost:27017/myapp');

const bot = createTelegramBot({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  mode: 'polling',
  db: { connection: db },
  commands: [
    {
      command: 'start',
      description: 'Start the bot',
      handler: async (msg, bot) => {
        await bot.sendMessage(msg.chat.id, `Welcome, ${msg.from?.first_name}!`);
      },
    },
    {
      command: 'help',
      description: 'Show help',
      handler: async (msg, bot) => {
        await bot.sendMessage(msg.chat.id, 'Available commands: /start, /help');
      },
    },
  ],
  callbacks: [
    {
      pattern: /btn_.*/,
      handler: async (query, bot) => {
        await bot.answerCallbackQuery(query.id, { text: 'Button clicked!' });
      },
    },
  ],
  hooks: {
    onUserStart: ({ firstName }) => console.log(`New user: ${firstName}`),
    onError: ({ error, context }) => console.error(`Error in ${context}:`, error.message),
  },
});

// Admin routes (protect with your own auth middleware)
app.use('/api/bot', bot.routes);

// Start the bot
await bot.start();

// Graceful shutdown
process.on('SIGTERM', () => bot.stop());

app.listen(3000);
```

## Runtime Command Registration

```ts
bot.registerCommand({
  command: 'status',
  description: 'Show bot status',
  handler: async (msg, instance) => {
    const info = bot.getBotInfo();
    await instance.sendMessage(msg.chat.id, `Bot: ${info?.username}, Running: ${bot.isRunning()}`);
  },
});

bot.removeCommand('status');
```

## Keyboard Builder

```ts
const kb = bot.keyboards;

// Inline keyboard
const inline = kb.inline([
  [{ text: 'Yes', callback_data: 'confirm_yes' }, { text: 'No', callback_data: 'confirm_no' }],
]);
await bot.sendMessage(chatId, 'Confirm?', { reply_markup: inline });

// Reply keyboard
const reply = kb.reply([['Option A', 'Option B'], ['Option C']], { oneTimeKeyboard: true });
await bot.sendMessage(chatId, 'Choose:', { reply_markup: reply });

// Remove keyboard
const remove = kb.remove();
await bot.sendMessage(chatId, 'Keyboard removed.', { reply_markup: remove });
```

## Features

- **Polling and webhook modes** -- Choose between long-polling or webhook with automatic setup. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md)
- **Command registration** -- Define commands at creation or register them at runtime. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md#commands)
- **Callback and inline query handlers** -- Pattern-matched handlers for interactive elements. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md#callbacks)
- **Keyboard builder** -- Fluent API for inline, reply, and remove keyboards. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/types.md#keyboardbuilder)
- **Middleware chain** -- Intercept messages before command handlers execute. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md#middleware)
- **User tracking** -- Automatic contact tracking with interaction history per bot. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/types.md#usertrackerservice)
- **Admin API routes** -- 4 REST endpoints for bot status, stats, and user management. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/api-routes.md)
- **Lifecycle hooks** -- React to new users, blocked users, commands, and errors. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md#hooks)
- **Account Manager Bridge** -- Optional integration with `@astralibx/telegram-account-manager` for sending messages via TDLib clients. [Details](#account-manager-bridge)

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/configuration.md) -- Token, mode, database, commands, callbacks, middleware, hooks
2. [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/api-routes.md) -- 4 admin REST endpoints for status, stats, and users
3. [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/types.md) -- All importable types, constants, errors, and service classes

## Account Manager Bridge

Optional utility for integrating with `@astralibx/telegram-account-manager`. Allows bot commands to send messages via TDLib clients.

```typescript
import { createAccountManagerBridge } from '@astralibx/telegram-bot';
import { createTelegramAccountManager } from '@astralibx/telegram-account-manager';

const tam = createTelegramAccountManager(config);
const bridge = createAccountManagerBridge(tam);

// In a bot command handler:
commands: [{
  command: 'send',
  description: 'Send via TDLib',
  handler: async (msg, bot) => {
    await bridge.sendViaTDLib('account-id', msg.chat.id.toString(), 'Hello from TDLib!');
  },
}]
```

See [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/bot/docs/types.md#account-manager-bridge) for the `AccountManagerBridge` and `AccountManagerLike` interfaces.

## License

MIT

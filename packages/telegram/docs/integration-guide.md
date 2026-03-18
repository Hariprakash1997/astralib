# Telegram Library - Cross-Package Integration Guide

How the 4 telegram packages work together, with real setup code you can copy.

> **New here?** Start with the [Quick Start Tutorial](./quick-start-tutorial.md) for a step-by-step curl walkthrough, or the [Glossary](./glossary.md) if ID terms like `contactId` vs `chatId` are confusing.

## 1. Architecture Overview

| Package | Role | npm |
|---------|------|-----|
| **account-manager** | Manages TDLib user-account clients: connect/disconnect, health tracking, warmup, capacity limits, quarantine, session generation, account rotation. | `@astralibx/telegram-account-manager` |
| **inbox** | Real-time message listening, conversation history, typing indicators, dialog loading. Depends on account-manager for TDLib clients. | `@astralibx/telegram-inbox` |
| **rule-engine** | Campaign-style outbound messaging: templates, rules, throttling, send logs, run tracking. Uses adapter functions - no hard dependency on account-manager. | `@astralibx/telegram-rule-engine` |
| **bot** | Standard Telegram Bot API wrapper (polling or webhook): commands, callbacks, inline queries, contact tracking. Fully independent. | `@astralibx/telegram-bot` |

### Dependency Graph

```
rule-engine (adapters) ──uses──> account-manager
inbox ──────────────────depends──> account-manager
bot (bridge, optional) ──uses──> account-manager
```

- **inbox** takes the full `TelegramAccountManager` instance as a required config field.
- **rule-engine** is decoupled via adapter functions (`selectAccount`, `sendMessage`, etc.) - you wire account-manager into these yourself.
- **bot** is standalone, but the optional `createAccountManagerBridge` lets it send messages through TDLib user accounts.

## 2. Full Setup Example

```typescript
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createTelegramAccountManager } from '@astralibx/telegram-account-manager';
import { createTelegramInbox } from '@astralibx/telegram-inbox';
import { createTelegramRuleEngine } from '@astralibx/telegram-rule-engine';
import { createTelegramBot } from '@astralibx/telegram-bot';

const app = express();
app.use(express.json());

const conn = mongoose.createConnection('mongodb://localhost/telegram');
const redis = new Redis();

// ── 1. Account Manager (foundation - manages TDLib clients) ──────────

const tam = createTelegramAccountManager({
  db: { connection: conn },
  credentials: {
    apiId: 12345,
    apiHash: 'your-api-hash',
  },
  options: {
    idleTimeoutMs: 600_000,               // disconnect idle clients after 10 min
    warmup: { autoAdvance: true },        // auto-advance warmup phases
    healthCheckIntervalMs: 60_000,        // health check every 60s
    quarantine: {
      monitorIntervalMs: 300_000,         // check quarantine every 5 min
      defaultDurationMs: 3_600_000,       // quarantine lasts 1 hour
    },
  },
  hooks: {
    onAccountQuarantined: (info) => console.warn(`Quarantined: ${info.phone} - ${info.reason}`),
    onHealthChange: (info) => console.log(`Health: ${info.phone} ${info.oldScore} -> ${info.newScore}`),
  },
});

// ── 2. Inbox (depends on account-manager for TDLib clients) ──────────

const inbox = createTelegramInbox({
  accountManager: tam,                    // <-- pass the tam instance directly
  db: { connection: conn },
  options: {
    historySyncLimit: 50,                 // sync last 50 messages per chat
    autoAttachOnConnect: true,            // auto-listen on all connected accounts
    typingTimeoutMs: 5000,
  },
  hooks: {
    onNewMessage: (msg) => {
      console.log(`[${msg.direction}] ${msg.content}`);
    },
    onNewContact: (info) => {
      console.log(`New contact: ${info.firstName} (@${info.username})`);
    },
  },
});

// ── 3. Rule Engine (adapter-based, no hard dependency) ───────────────

const engine = createTelegramRuleEngine({
  db: { connection: conn },
  redis: { connection: redis },
  adapters: {
    // Query your user database for rule targets
    queryUsers: async (target, limit) => {
      // target has { type, value } - e.g. { type: 'query', value: { status: 'active' } }
      // Return array of user objects
      return [];
    },

    // Extract template variables from a user object
    resolveData: (user) => ({
      name: (user as any).name,
      company: (user as any).company,
    }),

    // Look up a recipient identifier (phone -> contactId mapping)
    findIdentifier: async (phoneOrUsername) => {
      const doc = await tam.identifiers.findByValue(phoneOrUsername);
      if (!doc) return null;
      return { id: doc._id.toString(), contactId: doc.contactId };
    },

    // Send a message through account-manager
    sendMessage: async (params) => {
      await tam.sendMessage(params.accountId, params.contactId, params.message);
    },

    // Select which account sends the message (see Section 3 for details)
    selectAccount: async (identifierId, context) => {
      const best = await tam.rotator.selectAccount('highest-health');
      if (!best) return null;
      const health = await tam.health.getHealth(best.accountId);
      return {
        accountId: best.accountId,
        phone: best.phone,
        metadata: {},
        healthScore: health?.healthScore,
      };
    },
  },
  options: {
    useRedisThrottle: true,               // required for multi-instance deployments
    delayBetweenSendsMs: 3000,
    jitterMs: 1500,
    maxConsecutiveFailures: 5,
    sendWindow: {
      startHour: 9,
      endHour: 21,
      timezone: 'Asia/Kolkata',
    },
  },
  hooks: {
    onSend: (info) => {
      if (info.status === 'error') {
        console.error(`Send failed for rule ${info.ruleName}: ${info.failureReason}`);
      }
    },
    onRunComplete: (info) => {
      console.log(`Run done in ${info.duration}ms - sent: ${info.totalStats.sent}, failed: ${info.totalStats.failed}`);
    },
  },
});

// ── 4. Bot (independent, optional) ───────────────────────────────────

const bot = createTelegramBot({
  token: process.env.BOT_TOKEN!,
  mode: 'polling',
  db: { connection: conn },
  commands: [
    {
      command: 'start',
      description: 'Start the bot',
      handler: async (msg, botInstance) => {
        await botInstance.sendMessage(msg.chat.id, `Hello ${msg.from?.first_name}!`);
      },
    },
  ],
  hooks: {
    onUserStart: (info) => console.log(`Bot user: ${info.firstName} (${info.userId})`),
  },
});

// ── Mount routes ─────────────────────────────────────────────────────

app.use('/api/accounts', tam.routes);
app.use('/api/inbox', inbox.routes);
app.use('/api/rules', engine.routes);
app.use('/api/bot', bot.routes);

// ── Start ────────────────────────────────────────────────────────────

app.listen(3000, async () => {
  await bot.start();      // bot needs explicit start
  console.log('Server running on :3000');
});
```

## 3. Wiring AccountRotator into Rule Engine

The rule engine's `selectAccount` adapter is where you plug in account rotation. The `AccountRotator` supports 3 strategies:

| Strategy | Picks account by | Best for |
|----------|-----------------|----------|
| `highest-health` | Highest health score with remaining capacity | Safety - avoids risky accounts |
| `round-robin` | Cycles through available accounts sequentially | Even distribution across accounts |
| `least-used` | Lowest `usagePercent` today | Capacity optimization |

### Strategy Examples

```typescript
// ── highest-health (default, safest) ─────────────────────────────────

selectAccount: async (identifierId, context) => {
  const best = await tam.rotator.selectAccount('highest-health');
  if (!best) return null;
  const health = await tam.health.getHealth(best.accountId);
  return {
    accountId: best.accountId,
    phone: best.phone,
    metadata: {},
    healthScore: health?.healthScore,
  };
},

// ── round-robin (even distribution) ──────────────────────────────────

selectAccount: async (identifierId, context) => {
  const best = await tam.rotator.selectAccount('round-robin');
  if (!best) return null;
  return {
    accountId: best.accountId,
    phone: best.phone,
    metadata: {},
    healthScore: undefined, // round-robin doesn't factor health
  };
},

// ── least-used (maximize capacity) ───────────────────────────────────

selectAccount: async (identifierId, context) => {
  const best = await tam.rotator.selectAccount('least-used');
  if (!best) return null;
  return {
    accountId: best.accountId,
    phone: best.phone,
    metadata: { usagePercent: best.usagePercent },
  };
},
```

### Filtering by Tags

Filter accounts before rotation by querying the model directly:

```typescript
selectAccount: async (identifierId, context) => {
  // Only use accounts tagged for this campaign's audience
  const taggedAccounts = await tam.models.TelegramAccount.find({
    tags: { $in: ['outreach', 'campaign-v2'] },
    status: 'active',
  }).select('_id').lean();

  const taggedIds = new Set(taggedAccounts.map((a) => a._id.toString()));

  // Get capacity for all accounts, then filter
  const { accounts } = await tam.capacity.getAllCapacity();
  const eligible = accounts.filter((a) => a.remaining > 0 && taggedIds.has(a.accountId));

  if (eligible.length === 0) return null;

  // Sort by remaining capacity (least-used logic, manual)
  eligible.sort((a, b) => a.usagePercent - b.usagePercent);
  const selected = eligible[0];

  return {
    accountId: selected.accountId,
    phone: selected.phone,
    metadata: { tags: ['outreach'] },
  };
},
```

### Context-Aware Selection

The `selectAccount` adapter receives `context` with `ruleId` and `templateId`, so you can route specific rules to specific accounts:

```typescript
selectAccount: async (identifierId, context) => {
  const strategy = context?.ruleId === 'high-priority-rule'
    ? 'highest-health'
    : 'round-robin';
  const best = await tam.rotator.selectAccount(strategy);
  if (!best) return null;
  return {
    accountId: best.accountId,
    phone: best.phone,
    metadata: {},
  };
},
```

## 4. Using Bot Bridge with Account Manager

The bot package includes `createAccountManagerBridge` - a thin adapter that lets bot commands send messages through TDLib user accounts (not the Bot API). This is useful when you need to send messages as a user account from within a bot command.

```typescript
import { createTelegramBot, createAccountManagerBridge } from '@astralibx/telegram-bot';

const bot = createTelegramBot({
  token: process.env.BOT_TOKEN!,
  mode: 'polling',
  db: { connection: conn },
});

// Create bridge (uses structural typing - no hard import of account-manager)
const bridge = createAccountManagerBridge(tam);

// Use in bot commands
bot.registerCommand({
  command: 'send_as_user',
  description: 'Send a message via a user account',
  handler: async (msg, botInstance) => {
    const accounts = bridge.getConnectedAccounts();
    if (accounts.length === 0) {
      await botInstance.sendMessage(msg.chat.id, 'No user accounts connected.');
      return;
    }

    const account = accounts[0];

    // Check account health before sending
    const health = await bridge.getAccountHealth(account.accountId);
    if (health && health.score < 50) {
      await botInstance.sendMessage(msg.chat.id, `Account ${account.phone} health too low (${health.score}).`);
      return;
    }

    // Send via TDLib (user account), not Bot API
    const result = await bridge.sendViaTDLib(account.accountId, 'target-chat-id', 'Hello from TDLib!');
    await botInstance.sendMessage(msg.chat.id, `Sent via ${account.phone}, messageId: ${result.messageId}`);
  },
});
```

### Bridge Interface

```typescript
interface AccountManagerBridge {
  sendViaTDLib(accountId: string, chatId: string, text: string): Promise<{ messageId: string }>;
  getConnectedAccounts(): { accountId: string; phone: string; name: string; isConnected: boolean }[];
  getAccountHealth(accountId: string): Promise<{ score: number; status: string } | null>;
}
```

The bridge uses structural typing (`AccountManagerLike`), so the bot package has zero import-time dependency on `@astralibx/telegram-account-manager`. You pass the `tam` instance at runtime, and it duck-types the methods it needs.

## 5. Lifecycle and Shutdown

Shutdown order matters because of inter-package dependencies.

```typescript
async function shutdown() {
  // 1. Stop bot first (no more inbound bot commands)
  await bot.stop();

  // 2. Destroy rule engine (stops any active runs, releases Redis locks)
  await engine.destroy();

  // 3. Destroy inbox (detaches message listeners from TDLib clients)
  await inbox.destroy();

  // 4. Destroy account manager last (disconnects all TDLib clients)
  //    Must be after inbox.destroy() because inbox listeners need active clients
  await tam.destroy();

  // 5. Close shared resources
  await redis.quit();
  await conn.close();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Why This Order

1. **Bot** has no dependencies on other packages - safe to stop anytime.
2. **Rule engine** may have active campaign runs. `destroy()` cancels running jobs and releases Redis locks. Must happen before account-manager disconnects clients.
3. **Inbox** has message listeners attached to TDLib clients. `destroy()` calls `detachAll()` which needs the clients to still be connected. If you destroy account-manager first, detach will fail silently.
4. **Account manager** calls `disconnectAll()` on its TDLib clients, stops health/quarantine/warmup monitors, and destroys session generator. Everything that depends on TDLib clients must be cleaned up before this.

## 6. Common Patterns

### Auto-Create Identifiers from Inbox Contacts

When inbox detects a new contact, create an identifier in account-manager so the rule engine can target them:

```typescript
const inbox = createTelegramInbox({
  accountManager: tam,
  db: { connection: conn },
  hooks: {
    onNewContact: async (info) => {
      // Create or update identifier for this contact
      const identifier = await tam.identifiers.upsert({
        value: info.username || info.telegramUserId,
        contactId: info.chatId,
        metadata: {
          firstName: info.firstName,
          lastName: info.lastName,
          username: info.username,
          source: 'inbox-auto',
          discoveredVia: info.accountId,
        },
      });
      console.log(`Identifier created: ${identifier._id}`);
    },
  },
});
```

Now the rule engine's `findIdentifier` adapter can look up these auto-created identifiers to send campaign messages to contacts discovered through inbox.

### Forward Inbound Messages to Bot

Route specific inbox messages to a bot channel for agent notifications:

```typescript
const AGENT_CHAT_ID = process.env.AGENT_CHAT_ID!; // Telegram group/channel ID

const inbox = createTelegramInbox({
  accountManager: tam,
  db: { connection: conn },
  hooks: {
    onNewMessage: async (msg) => {
      if (msg.direction !== 'inbound') return;

      // Forward to bot notification channel
      const text = [
        `New message from ${msg.senderId}`,
        `Account: ${msg.accountId}`,
        `Content: ${msg.content.slice(0, 200)}`,
      ].join('\n');

      await bot.sendMessage(AGENT_CHAT_ID, text);
    },
  },
});
```

### Use Rule-Engine Campaigns with Inbox Message Tracking

Track outbound campaign messages in inbox so agents see the full conversation:

```typescript
const engine = createTelegramRuleEngine({
  db: { connection: conn },
  redis: { connection: redis },
  adapters: {
    sendMessage: async (params) => {
      // Send through account-manager
      const result = await tam.sendMessage(params.accountId, params.contactId, params.message);

      // Also store in inbox message collection so it appears in conversation history
      await inbox.models.TelegramMessage.create({
        accountId: params.accountId,
        conversationId: params.contactId,
        messageId: result.messageId,
        senderId: params.accountId,
        senderType: 'account',
        direction: 'outbound',
        contentType: 'text',
        content: params.message,
        createdAt: new Date(),
        metadata: {
          source: 'rule-engine',
          ruleId: params.ruleId,
          templateId: params.templateId,
        },
      });
    },
    // ... other adapters
  },
  // ... rest of config
});
```

This way, when an agent views a conversation in the inbox UI, they see both inbound messages from the contact and outbound campaign messages sent by the rule engine.

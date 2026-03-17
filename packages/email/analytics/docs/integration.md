# Integration

Wire `@astralibx/email-analytics` with `@astralibx/email-account-manager` and `@astralibx/email-rule-engine` to automatically record events as emails are sent.

## Setup

```typescript
import mongoose from 'mongoose';
import express from 'express';
import { createEmailAnalytics } from '@astralibx/email-analytics';
import { createEmailAccountManager } from '@astralibx/email-account-manager';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';

const conn = mongoose.createConnection('mongodb://localhost:27017/myapp');

const analytics = createEmailAnalytics({
  db: { connection: conn },
  options: { eventTTLDays: 90, timezone: 'Asia/Kolkata' },
});

const accountManager = createEmailAccountManager({
  db: { connection: conn },
  // hooks are configured here -- see "Wiring Account Manager Hooks" below
});

const ruleEngine = createEmailRuleEngine({
  db: { connection: conn },
  // hooks are configured here -- see "Wiring Rule Engine Hooks" below
});
```

## Wiring Rule Engine Hooks

Record events using the `hooks` config when creating the rule engine:

```typescript
const ruleEngine = createEmailRuleEngine({
  db: { connection: conn },
  hooks: {
    onSend: async ({ ruleId, ruleName, email, status }) => {
      await analytics.events.record({
        type: status === 'sent' ? 'sent' : 'failed',
        accountId: '...', // from your send context
        recipientEmail: email,
        ruleId,
      });
    },
  },
});
```

The `onSend` hook is called for every send attempt with a `status` of `'sent'`, `'error'`, `'skipped'`, `'invalid'`, or `'throttled'`. Other available hooks: `onRunStart`, `onRuleStart`, `onRuleComplete`, `onRunComplete`, `beforeSend`.

## Wiring Account Manager Hooks

Track delivery and bounce events using the `hooks` config when creating the account manager:

```typescript
const accountManager = createEmailAccountManager({
  db: { connection: conn },
  hooks: {
    onDelivery: async ({ accountId, email }) => {
      await analytics.events.record({
        type: 'delivered',
        accountId,
        recipientEmail: email,
      });
    },
    onBounce: async ({ accountId, email, bounceType }) => {
      await analytics.events.record({
        type: 'bounced',
        accountId,
        recipientEmail: email,
        metadata: { bounceType },
      });
    },
  },
});
```

## Batch Recording from Webhooks

When processing webhook batches (e.g., SES/SendGrid event payloads), use `recordBatch()`:

```typescript
app.post('/webhooks/ses', async (req, res) => {
  const notifications = req.body.Records || [];

  const events = notifications.map((n) => ({
    type: mapSesEventType(n.eventType),
    accountId: resolveAccountId(n),
    recipientEmail: n.mail.destination[0],
    metadata: { messageId: n.mail.messageId },
  }));

  await analytics.events.recordBatch(events);
  res.sendStatus(200);
});
```

## Scheduling Daily Aggregation

Set up a cron job to aggregate the previous day's events each night:

```typescript
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    await analytics.aggregator.aggregateDaily(yesterday);
    console.log('Daily aggregation complete');
  } catch (err) {
    console.error('Aggregation failed:', err);
  }
});
```

## Mounting Routes

Add analytics endpoints alongside your other routes:

```typescript
const app = express();
app.use(express.json());

app.use('/api/analytics', analytics.routes);
app.use('/api/accounts', accountManager.routes);
app.use('/api/rules', ruleEngine.routes);

app.listen(3000);
```

## Full Example

```typescript
import mongoose from 'mongoose';
import express from 'express';
import cron from 'node-cron';
import { createEmailAnalytics } from '@astralibx/email-analytics';
import { createEmailAccountManager } from '@astralibx/email-account-manager';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';

const conn = mongoose.createConnection(process.env.MONGO_URI!);
const app = express();
app.use(express.json());

const analytics = createEmailAnalytics({
  db: { connection: conn, collectionPrefix: 'crm_' },
  options: { eventTTLDays: 180, timezone: 'Asia/Kolkata' },
});

const accountManager = createEmailAccountManager({
  db: { connection: conn },
  hooks: {
    onDelivery: async ({ accountId, email }) => {
      await analytics.events.record({ type: 'delivered', accountId, recipientEmail: email });
    },
    onBounce: async ({ accountId, email, bounceType }) => {
      await analytics.events.record({ type: 'bounced', accountId, recipientEmail: email, metadata: { bounceType } });
    },
  },
});
const ruleEngine = createEmailRuleEngine({
  db: { connection: conn },
  hooks: {
    onSend: async ({ ruleId, email, status }) => {
      await analytics.events.record({
        type: status === 'sent' ? 'sent' : 'failed',
        accountId: '...', // from your send context
        recipientEmail: email,
        ruleId,
      });
    },
  },
});

// Mount routes
app.use('/api/analytics', analytics.routes);

// Schedule nightly aggregation
cron.schedule('0 2 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await analytics.aggregator.aggregateDaily(yesterday);
});

app.listen(3000);
```

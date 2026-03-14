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
});

const ruleEngine = createEmailRuleEngine({
  db: { connection: conn },
});
```

## Wiring Rule Engine Hooks

Record events based on rule engine execution results:

```typescript
ruleEngine.on('emailSent', async (detail) => {
  await analytics.events.record({
    type: 'sent',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    templateId: detail.templateId,
    recipientEmail: detail.recipientEmail,
    identifierId: detail.identifierId,
  });
});

ruleEngine.on('emailDelivered', async (detail) => {
  await analytics.events.record({
    type: 'delivered',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    recipientEmail: detail.recipientEmail,
  });
});

ruleEngine.on('emailBounced', async (detail) => {
  await analytics.events.record({
    type: 'bounced',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    recipientEmail: detail.recipientEmail,
    metadata: { bounceType: detail.bounceType, reason: detail.reason },
  });
});

ruleEngine.on('emailFailed', async (detail) => {
  await analytics.events.record({
    type: 'failed',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    recipientEmail: detail.recipientEmail,
    metadata: { error: detail.error },
  });
});
```

## Wiring Account Manager Hooks

Track delivery and complaint events from email provider webhooks:

```typescript
accountManager.on('delivered', async (detail) => {
  await analytics.events.record({
    type: 'delivered',
    accountId: detail.accountId,
    recipientEmail: detail.recipientEmail,
  });
});

accountManager.on('bounced', async (detail) => {
  await analytics.events.record({
    type: 'bounced',
    accountId: detail.accountId,
    recipientEmail: detail.recipientEmail,
    metadata: { bounceType: detail.bounceType },
  });
});

accountManager.on('complained', async (detail) => {
  await analytics.events.record({
    type: 'complained',
    accountId: detail.accountId,
    recipientEmail: detail.recipientEmail,
  });
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

const accountManager = createEmailAccountManager({ db: { connection: conn } });
const ruleEngine = createEmailRuleEngine({ db: { connection: conn } });

// Wire hooks
ruleEngine.on('emailSent', (d) =>
  analytics.events.record({
    type: 'sent',
    accountId: d.accountId,
    ruleId: d.ruleId,
    templateId: d.templateId,
    recipientEmail: d.recipientEmail,
  }),
);

ruleEngine.on('emailFailed', (d) =>
  analytics.events.record({
    type: 'failed',
    accountId: d.accountId,
    ruleId: d.ruleId,
    recipientEmail: d.recipientEmail,
    metadata: { error: d.error },
  }),
);

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

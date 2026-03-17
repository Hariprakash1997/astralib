# Programmatic API

The `createEmailAccountManager()` factory returns an `EmailAccountManager` object with direct access to all services. Use these when you need to interact with the library from your application code rather than through REST endpoints.

## Full Interface

```ts
const eam = createEmailAccountManager(config);

// --- Express Routers ---
eam.routes              // Express Router -- admin API
eam.webhookRoutes.ses   // Express Router -- SES webhooks
eam.unsubscribeRoutes   // Express Router -- unsubscribe pages

// --- Services ---
eam.accounts            // { model, create, findById, update, remove }
eam.smtp                // SmtpService -- send(), testConnection(), executeSend()
eam.capacity            // CapacityManager -- getBestAccount(), getAccountCapacity(), getAllCapacity()
eam.health              // HealthTracker -- recordSuccess(), recordError(), recordBounce(), getHealth()
eam.warmup              // WarmupManager -- startWarmup(), advanceDay(), advanceAllAccounts(), completeWarmup(), getStatus()
eam.approval            // ApprovalService -- createDraft(), approve(), reject(), bulkApprove()
eam.unsubscribe         // UnsubscribeService -- generateUrl(), handleUnsubscribe()
eam.identifiers         // IdentifierService -- findOrCreate(), findById(), markBounced(), markUnsubscribed(), merge()
eam.imap                // ImapBounceChecker -- start(), stop(), checkNow(), checkAccount()
eam.queues              // QueueService -- enqueueSend(), getStats(), pause(), resume(), close()
eam.settings            // SettingsService -- get(), update(), updateSection(), invalidateCache()
```

## Service Details

### `eam.accounts`

```ts
const account = await eam.accounts.create({ /* ... */ });
const account = await eam.accounts.findById(accountId);
await eam.accounts.update(accountId, { senderName: 'New Name' });
await eam.accounts.remove(accountId);
```

### `eam.smtp`

```ts
const result = await eam.smtp.send({ to, subject, html });
const test = await eam.smtp.testConnection(accountId);
```

### `eam.capacity`

```ts
const best = await eam.capacity.getBestAccount();
const cap = await eam.capacity.getAccountCapacity(accountId);
const { accounts, totalRemaining } = await eam.capacity.getAllCapacity();
```

### `eam.health`

```ts
await eam.health.recordSuccess(accountId);
await eam.health.recordError(accountId);
await eam.health.recordBounce(accountId);
const health = await eam.health.getHealth(accountId);
const all = await eam.health.getAllHealth();
```

### `eam.warmup`

```ts
await eam.warmup.startWarmup(accountId);
await eam.warmup.advanceDay(accountId);
await eam.warmup.completeWarmup(accountId);
await eam.warmup.resetWarmup(accountId);
const status = await eam.warmup.getStatus(accountId);
const delay = await eam.warmup.getRecommendedDelay(accountId);

// Advance all warmup-enabled accounts (call daily via cron)
const { advanced, errors } = await eam.warmup.advanceAllAccounts();
```

### `eam.approval`

```ts
const draft = await eam.approval.createDraft({ to, subject, htmlBody, accountId });
await eam.approval.approve(draftId);
await eam.approval.reject(draftId, 'reason');
await eam.approval.sendNow(draftId);
await eam.approval.updateContent(draftId, { subject, htmlBody });
await eam.approval.bulkApprove([id1, id2]);
await eam.approval.bulkReject([id3, id4], 'reason');
const { items, total } = await eam.approval.getDrafts({ status: 'pending' }, 1, 50);
const counts = await eam.approval.countByStatus();
```

### `eam.unsubscribe`

```ts
const url = eam.unsubscribe.generateUrl(email, accountId);
const valid = eam.unsubscribe.verifyToken(email, token);
const result = await eam.unsubscribe.handleUnsubscribe(email, token);
```

### `eam.identifiers`

```ts
const id = await eam.identifiers.findOrCreate(email);
const id = await eam.identifiers.findById(identifierId);
await eam.identifiers.markBounced(email, bounceType);
await eam.identifiers.markUnsubscribed(email);
await eam.identifiers.merge(sourceEmail, targetEmail);
```

### `eam.imap`

```ts
await eam.imap.start();
eam.imap.stop();
await eam.imap.checkNow();
const { bouncesFound } = await eam.imap.checkAccount(accountId);
```

### `eam.queues`

```ts
await eam.queues.enqueueSend(sendParams);
const stats = await eam.queues.getStats();
await eam.queues.pause('send');
await eam.queues.resume('send');
await eam.queues.close();
```

### `eam.settings`

```ts
const settings = await eam.settings.get();
await eam.settings.update({ timezone: 'America/New_York' });
await eam.settings.updateSection('devMode', { enabled: true, testEmails: ['dev@test.com'] });
eam.settings.invalidateCache();
```

## Related

- [Configuration](./configuration.md) -- factory config reference
- [API Routes](./api-routes.md) -- REST endpoint equivalent

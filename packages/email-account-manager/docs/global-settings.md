# Global Settings

Runtime-adjustable settings stored in MongoDB. Changes take effect immediately (cached in memory, invalidated on update).

## Reading and Updating

```ts
// Read current settings
const settings = await eam.settings.get();

// Update entire settings object
await eam.settings.update({
  timezone: 'America/New_York',
  devMode: { enabled: true, testEmails: ['dev@example.com'] },
});

// Update a single section
await eam.settings.updateSection('approval', {
  enabled: true,
  defaultMode: 'manual',
  sendWindow: { timezone: 'America/New_York', startHour: 9, endHour: 21 },
  spreadStrategy: 'even',
  maxSpreadMinutes: 120,
});

// Invalidate cache (force re-read from DB)
eam.settings.invalidateCache();
```

## Caching

Settings are cached in memory after the first read. The cache is automatically invalidated when you call `update()` or `updateSection()`. Use `invalidateCache()` if settings were changed externally (e.g., direct DB update).

## Settings Sections

| Section | Key Fields | Defaults |
|---------|-----------|----------|
| `timezone` | Timezone string | `'UTC'` |
| `devMode` | `enabled`, `testEmails[]` | disabled, `[]` |
| `imap` | `enabled`, `pollIntervalMs`, `searchSince`, `bounceSenders[]` | disabled, 300000ms, `'last_check'` |
| `ses` | `configurationSet`, `trackOpens`, `trackClicks` | opens+clicks on |
| `approval` | `enabled`, `defaultMode`, `autoApproveDelayMs`, `sendWindow`, `spreadStrategy`, `maxSpreadMinutes` | disabled, manual, 9-21 UTC |
| `unsubscribePage` | `companyName`, `logoUrl`, `accentColor` | empty |
| `queues` | `sendConcurrency`, `sendAttempts`, `sendBackoffMs`, `approvalConcurrency`, `approvalAttempts`, `approvalBackoffMs` | 3/3/5000, 1/3/10000 |

### timezone

```ts
await eam.settings.updateSection('timezone', 'America/New_York');
```

### devMode

When enabled, all outgoing emails are redirected to the `testEmails` addresses in round-robin. The original recipient is logged but never contacted.

```ts
await eam.settings.updateSection('devMode', {
  enabled: true,
  testEmails: ['dev@example.com', 'qa@example.com'],
});
```

### imap

Controls IMAP bounce checking. See [IMAP Bounce Checking](./imap-bounce-checking.md).

### ses

Controls SES-specific behavior.

```ts
await eam.settings.updateSection('ses', {
  configurationSet: 'my-config-set',
  trackOpens: true,
  trackClicks: true,
});
```

### approval

Controls the draft approval workflow. See [Draft & Approval](./draft-approval.md).

### unsubscribePage

Branding for the built-in unsubscribe confirmation page.

```ts
await eam.settings.updateSection('unsubscribePage', {
  companyName: 'Your Company',
  logoUrl: 'https://yourdomain.com/logo.png',
  accentColor: '#4F46E5',
});
```

### queues

Controls BullMQ queue behavior at runtime.

```ts
await eam.settings.updateSection('queues', {
  sendConcurrency: 5,
  sendAttempts: 5,
  sendBackoffMs: 10000,
  approvalConcurrency: 2,
  approvalAttempts: 3,
  approvalBackoffMs: 15000,
});
```

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get all settings |
| `PUT` | `/settings` | Update all settings |
| `PATCH` | `/settings/timezone` | Update timezone |
| `PATCH` | `/settings/dev-mode` | Update dev mode |
| `PATCH` | `/settings/imap` | Update IMAP settings |
| `PATCH` | `/settings/approval` | Update approval settings |
| `PATCH` | `/settings/queues` | Update queue settings |
| `PATCH` | `/settings/ses` | Update SES settings |

## Related

- [Configuration](./configuration.md) -- factory-level config (static)
- [API Routes](./api-routes.md) -- all REST endpoints

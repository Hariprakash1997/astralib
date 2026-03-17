# IMAP Bounce Checking

For Gmail accounts, the library polls IMAP inboxes to detect bounce-back messages from `mailer-daemon@googlemail.com`.

## How It Works

1. On startup, if `imap.enabled` is true in Global Settings, polling starts automatically
2. At each interval, all Gmail accounts with IMAP config are checked
3. Messages from configured bounce senders are fetched and parsed
4. Bounce recipients are extracted from `Original-Recipient`, `Final-Recipient`, or delivery failure text
5. Bounces are classified (hard, soft, inbox full, invalid email) and recorded

## Prerequisites

- The `imapflow` package must be installed (it is an optional peer dependency)
- Gmail accounts must have IMAP credentials configured

## Bounce Classification

| Pattern | Type |
|---------|------|
| "inbox full", "mailbox full" | `inbox_full` |
| "address not found", "user unknown", "does not exist" | `invalid_email` |
| Everything else | `soft` |

## IMAP Settings (via Global Settings)

```ts
await eam.settings.updateSection('imap', {
  enabled: true,
  pollIntervalMs: 300000,                          // 5 minutes
  searchSince: 'last_24h',                         // 'last_check' | 'last_24h' | 'last_7d'
  bounceSenders: ['mailer-daemon@googlemail.com'],  // Senders to scan for
});
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable IMAP polling |
| `pollIntervalMs` | `number` | `300000` | Poll interval in milliseconds (5 min) |
| `searchSince` | `string` | `'last_check'` | How far back to search: `'last_check'`, `'last_24h'`, or `'last_7d'` |
| `bounceSenders` | `string[]` | `['mailer-daemon@googlemail.com']` | Email addresses to scan for bounce messages |

## Auto-Start

By default, IMAP polling starts automatically when the manager is created (if `imap.enabled` is true in Global Settings). To disable auto-start, set `options.imap.autoStart` to `false` in the factory config:

```ts
const eam = createEmailAccountManager({
  // ...
  options: {
    imap: {
      autoStart: false, // Don't start IMAP polling on creation
    },
  },
});

// Start manually later
await eam.imap.start();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `options.imap.autoStart` | `boolean` | `true` | Auto-start IMAP polling on manager creation |

## Programmatic Control

```ts
// Manual bounce check for a specific account
const { bouncesFound } = await eam.imap.checkAccount(accountId);

// Check all accounts now
await eam.imap.checkNow();

// Start/stop polling
await eam.imap.start();
eam.imap.stop();
```

## Related

- [Health Tracking](./health-tracking.md) -- how detected bounces affect health scores
- [Account Management](./account-management.md) -- configuring IMAP credentials
- [Global Settings](./global-settings.md) -- IMAP settings section

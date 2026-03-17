# Email Sending

## Via SmtpService

```ts
// Auto-select the best account
const result = await eam.smtp.send({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Content here</p>',
  text: 'Content here',        // Optional plain text
  metadata: { campaignId: 'abc' },
});
// { success: true, messageId: 'job-id' }

// Use a specific account
const result = await eam.smtp.send({
  accountId: '507f1f77bcf86cd799439011',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Content</p>',
});

// Test SMTP connection
const test = await eam.smtp.testConnection(accountId);
// { success: true } or { success: false, error: 'Auth failed' }
```

When `approval.enabled` is true in Global Settings, `smtp.send()` creates a draft instead of sending immediately. See [Draft & Approval](./draft-approval.md).

## BullMQ Queues

Emails are not sent inline -- they are enqueued via BullMQ for reliable delivery with retries:

- **Send queue** (`email-send`): Processes `SmtpSendParams` jobs
- **Approval queue** (`email-approved`): Processes approved drafts

Queue settings (concurrency, retry attempts, backoff) are configured via [Global Settings](./global-settings.md) and adjustable at runtime.

```ts
// Get queue statistics
const stats = await eam.queues.getStats();
// {
//   send: { waiting, active, completed, failed, delayed },
//   approval: { ... }
// }

// Pause/resume queues
await eam.queues.pause('send');
await eam.queues.resume('send');

// Graceful shutdown
await eam.queues.close();
```

## Dev Mode

When `devMode.enabled` is true in [Global Settings](./global-settings.md), all emails are redirected to `devMode.testEmails` addresses in a round-robin fashion. The original recipient is logged but never contacted.

```ts
// Enable dev mode via settings
await eam.settings.updateSection('devMode', {
  enabled: true,
  testEmails: ['dev@example.com', 'qa@example.com'],
});
```

## Related

- [Draft & Approval](./draft-approval.md) -- approval workflow that intercepts sends
- [Capacity Selection](./capacity-selection.md) -- how the best account is chosen
- [Global Settings](./global-settings.md) -- queue and dev mode configuration
- [Error Handling](./error-handling.md) -- send-related error classes

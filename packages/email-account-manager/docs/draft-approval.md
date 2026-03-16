# Draft & Approval System

When `approval.enabled` is true in Global Settings, calls to `smtp.send()` are intercepted and drafts are created instead. Emails only go out after explicit approval.

## Creating Drafts

```ts
const draft = await eam.approval.createDraft({
  to: 'user@example.com',
  subject: 'Welcome aboard',
  htmlBody: '<h1>Welcome!</h1>',
  textBody: 'Welcome!',
  accountId: '507f1f77bcf86cd799439011',
  scheduledAt: new Date('2025-01-15T10:00:00Z'),  // Optional
  metadata: { source: 'onboarding' },
});
```

## Approval Workflow

```ts
// Approve a single draft
await eam.approval.approve(draftId);

// Reject with reason
await eam.approval.reject(draftId, 'Tone needs revision');

// Send immediately (bypass scheduling)
await eam.approval.sendNow(draftId);

// Edit content before approving
await eam.approval.updateContent(draftId, {
  subject: 'Updated subject',
  htmlBody: '<h1>Updated</h1>',
});
```

## Bulk Operations

```ts
await eam.approval.bulkApprove([draftId1, draftId2, draftId3]);
await eam.approval.bulkReject([draftId4, draftId5], 'Campaign cancelled');
```

## Querying Drafts

```ts
const { items, total } = await eam.approval.getDrafts({ status: 'pending' }, 1, 50);

const counts = await eam.approval.countByStatus();
// { pending: 12, approved: 45, rejected: 3, sent: 120, failed: 1 }
```

## Draft Status Lifecycle

```
pending --> approved --> sent
   |            |
   v            v
rejected     failed
```

| Status | Description |
|--------|-------------|
| `pending` | Awaiting approval or rejection |
| `approved` | Approved and queued for sending |
| `rejected` | Rejected by admin, will not be sent |
| `sent` | Successfully sent |
| `failed` | Send attempted but failed |

## Send Window & Spread

Approved emails are scheduled within a configurable send window to appear more natural:

- **sendWindow**: Only send between `startHour` and `endHour` in the configured timezone
- **spreadStrategy**: `'random'` (random delays) or `'even'` (evenly spaced)
- **maxSpreadMinutes**: Maximum spread duration for bulk approvals

```ts
await eam.settings.updateSection('approval', {
  enabled: true,
  defaultMode: 'manual',
  sendWindow: { timezone: 'America/New_York', startHour: 9, endHour: 21 },
  spreadStrategy: 'even',
  maxSpreadMinutes: 120,
});
```

## Hooks & Lifecycle

**`onSend` and approved drafts:** When a draft is approved via `approve()`, the email is sent asynchronously through the queue. The `onSend` hook fires after the email is successfully sent, not at the time of approval. The sequence is: `approve()` → `onDraftApproved` hook → queue processes → email sent → `onSend` hook.

## Related

- [Email Sending](./email-sending.md) -- how sends are processed after approval
- [Global Settings](./global-settings.md) -- approval section configuration
- [API Routes](./api-routes.md) -- draft REST endpoints

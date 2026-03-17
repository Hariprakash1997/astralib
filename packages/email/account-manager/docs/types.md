# Exported Types

All types can be imported from `@astralibx/email-account-manager`:

```ts
import type {
  EmailAccount,
  CreateEmailAccountInput,
  EmailAccountManagerConfig,
  // ... etc.
} from '@astralibx/email-account-manager';
```

---

## Account Types

**`EmailAccount`** -- Full email account document shape.
- `_id: string` -- Document ID
- `email: string` -- Email address
- `senderName: string` -- Display name for outgoing mail
- `provider: AccountProvider` -- `'gmail'` or `'ses'`
- `status: AccountStatus` -- `'active'`, `'disabled'`, `'quota_exceeded'`, `'error'`, `'warmup'`
- `smtp: SmtpConfig` -- SMTP connection details
- `imap?: ImapConfig` -- IMAP connection details (optional)
- `ses?: SesConfig` -- SES configuration (optional)
- `limits: AccountLimits` -- Send limits
- `health: AccountHealthData` -- Health score and thresholds
- `warmup: AccountWarmupData` -- Warmup state and schedule
- `metadata?: Record<string, unknown>` -- Arbitrary user metadata
- `totalEmailsSent: number`
- `lastSuccessfulSendAt?: Date`
- `createdAt: Date`, `updatedAt: Date`

**`CreateEmailAccountInput`** -- Input for creating an account.
- `email`, `senderName`, `provider`, `smtp` (required)
- `imap?`, `ses?`, `limits?`, `warmup?`, `metadata?`, `health?` (optional)

**`UpdateEmailAccountInput`** -- Partial input for updating an account. All fields optional.

**`SmtpConfig`** -- SMTP connection details.
- `host: string`, `port: number`, `user: string`, `pass: string`

**`ImapConfig`** -- IMAP connection details.
- `host: string`, `port: number`, `user: string`, `pass: string`

**`SesConfig`** -- AWS SES configuration.
- `region: string`, `configurationSet?: string`

**`AccountLimits`** -- Account send limits.
- `dailyMax: number`

**`HealthThresholds`** -- Thresholds that trigger auto-disable.
- `minScore: number`, `maxBounceRate: number`, `maxConsecutiveErrors: number`

**`AccountHealthData`** -- Health tracking data embedded in an account.
- `score: number`, `consecutiveErrors: number`, `bounceCount: number`, `thresholds: HealthThresholds`

**`AccountWarmupData`** -- Warmup state embedded in an account.
- `enabled: boolean`, `startedAt?: Date`, `completedAt?: Date`, `currentDay: number`, `schedule: WarmupPhase[]`

**`AccountCapacity`** -- Snapshot of an account's daily send capacity.
- `accountId`, `email`, `provider`, `dailyMax`, `sentToday`, `remaining`, `usagePercent`

**`AccountHealth`** -- Snapshot of an account's health.
- `accountId`, `email`, `score`, `consecutiveErrors`, `bounceCount`, `thresholds`, `status`

---

## Identifier Types

**`EmailIdentifier`** -- A tracked recipient email address.
- `_id: string`
- `email: string`
- `status: IdentifierStatus` -- `'active'`, `'bounced'`, `'unsubscribed'`, `'blocked'`, `'invalid'`
- `sentCount: number`, `bounceCount: number`
- `lastSentAt?: Date`, `lastBouncedAt?: Date`
- `bounceType?: BounceType`
- `unsubscribedAt?: Date`
- `metadata?: Record<string, unknown>`
- `createdAt: Date`, `updatedAt: Date`

**`CreateIdentifierInput`** -- Input for creating an identifier.
- `email: string` (required), `status?: IdentifierStatus`, `metadata?`

**`UpdateIdentifierInput`** -- Input for updating an identifier.
- `status?: IdentifierStatus`, `bounceType?: BounceType`, `metadata?`

---

## Draft Types

**`EmailDraft`** -- An email draft pending approval/sending.
- `_id: string`
- `to: string`, `subject: string`, `htmlBody: string`, `textBody?: string`
- `accountId: string`
- `status: DraftStatus` -- `'pending'`, `'approved'`, `'rejected'`, `'queued'`, `'sent'`, `'failed'`
- `approvedAt?: Date`, `rejectedAt?: Date`, `rejectionReason?: string`
- `sentAt?: Date`, `scheduledAt?: Date`, `failureReason?: string`
- `metadata?: Record<string, unknown>`
- `createdAt: Date`, `updatedAt: Date`

**`CreateDraftInput`** -- Input for creating a draft.
- `to`, `subject`, `htmlBody`, `accountId` (required)
- `textBody?`, `scheduledAt?`, `metadata?` (optional)

---

## Config Types

**`EmailAccountManagerConfig`** -- Main configuration passed to `createEmailAccountManager()`.
- `db.connection: Connection` -- Mongoose connection
- `db.collectionPrefix?: string` -- Prefix for collection names
- `redis.connection: Redis` -- ioredis instance
- `redis.keyPrefix?: string` -- Prefix for Redis keys
- `logger?: LogAdapter` -- Logger adapter
- `options?.warmup` -- Default warmup schedule
- `options?.healthDefaults` -- Default health thresholds
- `options?.imap` -- IMAP options (`autoStart?: boolean`)
- `options?.ses` -- SES webhook options (enabled, validateSignature, allowedTopicArns)
- `options?.unsubscribe` -- Unsubscribe link options (builtin or custom generateUrl)
- `options?.queues` -- Queue naming overrides
- `hooks?` -- Lifecycle event hooks (see below)

**`LogAdapter`** -- Logger interface (re-exported from `@astralibx/core`).
- `info(msg: string, meta?: any): void`
- `warn(msg: string, meta?: any): void`
- `error(msg: string, meta?: any): void`

**`WarmupPhase`** -- A single phase in a warmup schedule.
- `days: [number, number]` -- Day range (e.g., `[1, 3]`)
- `dailyLimit: number` -- Max emails per day during this phase
- `delayMinMs: number`, `delayMaxMs: number` -- Random delay range between sends

### Config Hooks

Available hooks on `EmailAccountManagerConfig.hooks`:

| Hook | Payload |
|------|---------|
| `onAccountDisabled` | `{ accountId, reason }` |
| `onWarmupComplete` | `{ accountId, email }` |
| `onHealthDegraded` | `{ accountId, healthScore }` |
| `onSend` | `{ accountId, email, messageId? }` |
| `onSendError` | `{ accountId, email, error }` |
| `onBounce` | `{ accountId, email, bounceType, provider }` |
| `onUnsubscribe` | `{ email, accountId? }` |
| `onDelivery` | `{ accountId, email }` |
| `onComplaint` | `{ accountId, email }` |
| `onOpen` | `{ accountId, email, timestamp }` |
| `onClick` | `{ accountId, email, link }` |
| `onDraftCreated` | `{ draftId, to, subject }` |
| `onDraftApproved` | `{ draftId, to, scheduledAt? }` |
| `onDraftRejected` | `{ draftId, to, reason? }` |

---

## Settings Types

**`GlobalSettings`** -- Global settings document.
- `_id: 'global'`
- `timezone: string`
- `devMode: DevModeSettings`
- `imap: ImapSettings`
- `ses: SesSettings`
- `approval: ApprovalSettings`
- `unsubscribePage: UnsubscribePageSettings`
- `queues: QueueSettings`
- `updatedAt: Date`

**`UpdateGlobalSettingsInput`** -- `Partial<Omit<GlobalSettings, '_id' | 'updatedAt'>>`

**`DevModeSettings`** -- Dev/test mode configuration.
- `enabled: boolean`, `testEmails: string[]`

**`ImapSettings`** -- IMAP bounce checking configuration.
- `enabled: boolean`, `pollIntervalMs: number`
- `searchSince: 'last_check' | 'last_24h' | 'last_7d'`
- `bounceSenders: string[]`

**`SesSettings`** -- SES tracking settings.
- `configurationSet?: string`, `trackOpens: boolean`, `trackClicks: boolean`

**`ApprovalSettings`** -- Draft approval workflow settings.
- `enabled: boolean`, `defaultMode: 'manual' | 'auto'`, `autoApproveDelayMs: number`
- `sendWindow: ApprovalSendWindow`, `spreadStrategy: 'random' | 'even'`, `maxSpreadMinutes: number`

**`ApprovalSendWindow`** -- Time window for sending approved drafts.
- `timezone: string`, `startHour: number`, `endHour: number`

**`UnsubscribePageSettings`** -- Unsubscribe page branding.
- `companyName: string`, `logoUrl?: string`, `accentColor?: string`

**`QueueSettings`** -- BullMQ queue tuning.
- `sendConcurrency: number`, `sendAttempts: number`, `sendBackoffMs: number`
- `approvalConcurrency: number`, `approvalAttempts: number`, `approvalBackoffMs: number`

---

## Event Types (SES Webhooks)

**`EmailEvent`** -- Normalized email event.
- `type: EmailEventType`, `accountId`, `email`, `provider`, `bounceType?`, `link?`, `timestamp`, `metadata?`

**`SnsMessage`** -- Raw SNS message envelope.
- `Type`, `MessageId`, `TopicArn`, `Message`, `Timestamp`, `Signature`, `SigningCertURL`, etc.

**`SesNotification`** -- Parsed SES notification payload.
- `notificationType: SesNotificationType`, `mail: SesMailPayload`
- `bounce?: SesBounce`, `complaint?: SesComplaint`, `delivery?: SesDelivery`, `open?: SesOpen`, `click?: SesClick`

**`SesMailPayload`** -- Mail metadata from SES.
- `messageId`, `timestamp`, `source`, `destination`, `headers?`, `commonHeaders?`

**`SesBounce`** -- Bounce details.
- `bounceType: SesBounceType`, `bounceSubType`, `bouncedRecipients: SesBounceRecipient[]`, `timestamp`

**`SesBounceRecipient`** -- `{ emailAddress, action?, status?, diagnosticCode? }`

**`SesComplaint`** -- Complaint details.
- `complainedRecipients: SesComplaintRecipient[]`, `complaintFeedbackType?: SesComplaintType`, `timestamp`

**`SesComplaintRecipient`** -- `{ emailAddress }`

**`SesDelivery`** -- Delivery confirmation.
- `timestamp`, `processingTimeMillis`, `recipients`, `smtpResponse`

**`SesOpen`** -- Open tracking event. `{ ipAddress, timestamp, userAgent }`

**`SesClick`** -- Click tracking event. `{ ipAddress, timestamp, userAgent, link, linkTags? }`

---

## Service Types

**`SmtpSendParams`** -- Parameters for `SmtpService.send()`.
- `accountId?: string` -- Specific account to use (auto-selects if omitted)
- `to: string`, `subject: string`, `html: string`, `text?: string`
- `metadata?: Record<string, unknown>`

**`SmtpSendResult`** -- Result from `SmtpService.send()`.
- `success: boolean`, `messageId?: string`, `error?: string`, `draftId?: string`

**`WarmupStatus`** -- Warmup status snapshot for an account.
- `accountId`, `email`, `enabled`, `currentDay`, `startedAt?`, `completedAt?`
- `currentPhase: WarmupPhase | null`, `dailyLimit`, `delayRange: { min, max }`

**`QueueStats`** -- Queue metrics snapshot.
- `waiting`, `active`, `completed`, `failed`, `delayed` (all `number`)

**`SendJobData`** -- Data shape for send queue jobs.
- `accountId`, `to`, `subject`, `html`, `text` (all `string`)

**`ApprovalJobData`** -- Data shape for approval queue jobs.
- `draftId: string`, `scheduledAt?: string`

**`WebhookProcessResult`** -- Result from SES webhook processing.
- `processed: boolean`, `type?: string`, `error?: string`

---

## Mongoose Schema Types

These are lower-level types for direct Mongoose model access:

```ts
import {
  createEmailAccountSchema,
  createEmailIdentifierSchema,
  createEmailDailyStatsSchema,
  createEmailDraftSchema,
  createGlobalSettingsSchema,
} from '@astralibx/email-account-manager';
```

| Interface | Document Type | Model Type | Schema Factory |
|-----------|---------------|------------|----------------|
| `IEmailAccount` | `EmailAccountDocument` | `EmailAccountModel` | `createEmailAccountSchema()` |
| `IEmailIdentifier` | `EmailIdentifierDocument` | `EmailIdentifierModel` | `createEmailIdentifierSchema()` |
| `IEmailDailyStats` | `EmailDailyStatsDocument` | `EmailDailyStatsModel` | `createEmailDailyStatsSchema()` |
| `IEmailDraft` | `EmailDraftDocument` | `EmailDraftModel` | `createEmailDraftSchema()` |
| `IGlobalSettings` | `GlobalSettingsDocument` | `GlobalSettingsModel` | `createGlobalSettingsSchema()` |

Each schema factory accepts an optional `{ collectionName?: string }` options object.

**Static methods on models:**

- `EmailAccountModel` -- `findActive()`, `findByProvider(provider)`, `findByEmail(email)`, `getBestAvailable()`
- `EmailIdentifierModel` -- `findOrCreate(email)`, `markBounced(email, bounceType)`, `markUnsubscribed(email)`, `incrementSentCount(email)`, `findByEmail(email)`
- `EmailDailyStatsModel` -- `incrementStat(accountId, field, count?, date?)`, `getForAccount(accountId, days?)`, `getForDate(date)`
- `EmailDraftModel` -- `findPending(limit?)`, `findByStatus(status, limit?)`, `countByStatus()`
- `GlobalSettingsModel` -- `getSettings()`, `updateSettings(partial)`

---

## Constants

All constants are exported as `const` objects with corresponding union types.

```ts
import { ACCOUNT_PROVIDER, ACCOUNT_STATUS, IDENTIFIER_STATUS } from '@astralibx/email-account-manager';
```

**`ACCOUNT_PROVIDER`** / `AccountProvider`
```ts
{ Gmail: 'gmail', Ses: 'ses' }
```

**`ACCOUNT_STATUS`** / `AccountStatus`
```ts
{ Active: 'active', Disabled: 'disabled', QuotaExceeded: 'quota_exceeded', Error: 'error', Warmup: 'warmup' }
```

**`IDENTIFIER_STATUS`** / `IdentifierStatus`
```ts
{ Active: 'active', Bounced: 'bounced', Unsubscribed: 'unsubscribed', Blocked: 'blocked', Invalid: 'invalid' }
```

**`BOUNCE_TYPE`** / `BounceType`
```ts
{ Hard: 'hard', Soft: 'soft', InboxFull: 'inbox_full', InvalidEmail: 'invalid_email' }
```

**`DRAFT_STATUS`** / `DraftStatus`
```ts
{ Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Queued: 'queued', Sent: 'sent', Failed: 'failed' }
```

**`EMAIL_EVENT_TYPE`** / `EmailEventType`
```ts
{ Sent: 'sent', Failed: 'failed', Delivered: 'delivered', Bounced: 'bounced', Complained: 'complained', Opened: 'opened', Clicked: 'clicked', Unsubscribed: 'unsubscribed' }
```

**`SES_BOUNCE_TYPE`** / `SesBounceType`
```ts
{ Permanent: 'Permanent', Transient: 'Transient', Undetermined: 'Undetermined' }
```

**`SES_COMPLAINT_TYPE`** / `SesComplaintType`
```ts
{ Abuse: 'abuse', AuthFailure: 'auth-failure', Fraud: 'fraud', NotSpam: 'not-spam', Other: 'other', Virus: 'virus' }
```

**`SNS_MESSAGE_TYPE`** / `SnsMessageType`
```ts
{ Notification: 'Notification', SubscriptionConfirmation: 'SubscriptionConfirmation', UnsubscribeConfirmation: 'UnsubscribeConfirmation' }
```

**`SES_NOTIFICATION_TYPE`** / `SesNotificationType`
```ts
{ Bounce: 'Bounce', Complaint: 'Complaint', Delivery: 'Delivery', Send: 'Send', Open: 'Open', Click: 'Click' }
```

---

## Error Classes

All errors extend `AlxAccountError` (which extends `AlxError` from `@astralibx/core`).

```ts
import { NoAvailableAccountError, QuotaExceededError } from '@astralibx/email-account-manager';
```

| Class | Code | Key Properties |
|-------|------|----------------|
| `AlxAccountError` | *(custom)* | `message`, `code` |
| `ConfigValidationError` | `CONFIG_VALIDATION` | `field` |
| `AccountDisabledError` | `ACCOUNT_DISABLED` | `accountId`, `reason` |
| `NoAvailableAccountError` | `NO_AVAILABLE_ACCOUNT` | -- |
| `SmtpConnectionError` | `SMTP_CONNECTION` | `accountId`, `originalError` |
| `InvalidTokenError` | `INVALID_TOKEN` | `tokenType` |
| `QuotaExceededError` | `QUOTA_EXCEEDED` | `accountId`, `dailyMax`, `currentSent` |
| `SnsSignatureError` | `SNS_SIGNATURE_INVALID` | -- |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | `accountId` |
| `DraftNotFoundError` | `DRAFT_NOT_FOUND` | `draftId` |

---

## Exported Service Classes

These classes are exported for type annotations. Instances are available on the `EmailAccountManager` object returned by `createEmailAccountManager()`.

```ts
import type { SmtpService, CapacityManager } from '@astralibx/email-account-manager';
```

| Class | Access via | Purpose |
|-------|-----------|---------|
| `SettingsService` | `.settings` | Global settings CRUD |
| `IdentifierService` | `.identifiers` | Email identifier tracking |
| `HealthTracker` | `.health` | Account health scoring |
| `WarmupManager` | `.warmup` | Warmup schedule management |
| `CapacityManager` | `.capacity` | Daily send capacity tracking |
| `SmtpService` | `.smtp` | Email sending |
| `UnsubscribeService` | `.unsubscribe` | Unsubscribe link handling |
| `QueueService` | `.queues` | BullMQ queue management |
| `ApprovalService` | `.approval` | Draft approval workflow |
| `ImapBounceChecker` | `.imap` | IMAP-based bounce detection |
| `SesWebhookHandler` | -- | SES webhook processing (used internally by routes) |

---

## `EmailAccountManager` Interface

Returned by `createEmailAccountManager()`:

```ts
interface EmailAccountManager {
  routes: Router;                    // Admin API routes
  webhookRoutes: { ses: Router };    // SES webhook routes
  unsubscribeRoutes: Router;         // Unsubscribe page routes

  accounts: {                        // Direct account model access
    model: any;
    create(data: any): Promise<any>;
    findById(id: string): Promise<any>;
    update(id: string, data: any): Promise<any>;
    remove(id: string): Promise<any>;
  };

  capacity: CapacityManager;
  health: HealthTracker;
  warmup: WarmupManager;
  smtp: SmtpService;
  imap: ImapBounceChecker;
  approval: ApprovalService;
  unsubscribe: UnsubscribeService;
  identifiers: IdentifierService;
  queues: QueueService;
  settings: SettingsService;

  destroy(): Promise<void>;          // Graceful shutdown
}
```

---

## `validateConfig`

```ts
import { validateConfig } from '@astralibx/email-account-manager';

validateConfig(config); // throws ConfigValidationError if invalid
```

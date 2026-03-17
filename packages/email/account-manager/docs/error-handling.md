# Error Handling

All errors extend `AlxAccountError` (which extends `AlxError` from `@astralibx/core`). Each error has a unique `code` for programmatic identification.

## Error Classes

| Error Class | Code | When |
|------------|------|------|
| `ConfigValidationError` | `CONFIG_VALIDATION` | Invalid config passed to factory |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | Account ID does not exist |
| `AccountDisabledError` | `ACCOUNT_DISABLED` | Attempted operation on disabled account |
| `NoAvailableAccountError` | `NO_AVAILABLE_ACCOUNT` | No accounts with remaining capacity |
| `SmtpConnectionError` | `SMTP_CONNECTION` | SMTP connection/auth failure |
| `QuotaExceededError` | `QUOTA_EXCEEDED` | Account daily send limit reached |
| `InvalidTokenError` | `INVALID_TOKEN` | Expired or tampered unsubscribe token |
| `SnsSignatureError` | `SNS_SIGNATURE_INVALID` | SNS message failed signature verification |
| `DraftNotFoundError` | `DRAFT_NOT_FOUND` | Draft ID does not exist |

## Usage

```ts
import {
  NoAvailableAccountError,
  QuotaExceededError,
  SmtpConnectionError,
  AccountDisabledError,
  InvalidTokenError,
  ConfigValidationError,
  SnsSignatureError,
  DraftNotFoundError,
  AccountNotFoundError,
} from '@astralibx/email-account-manager';

try {
  await eam.smtp.send({ to, subject, html });
} catch (err) {
  if (err instanceof NoAvailableAccountError) {
    // All accounts exhausted for today -- wait or add more accounts
  }
  if (err instanceof QuotaExceededError) {
    // Specific account hit its daily limit
  }
  if (err instanceof SmtpConnectionError) {
    // SMTP auth or connection failure
    console.error(`Account ${err.accountId} failed:`, err.originalError);
  }
  if (err instanceof AccountDisabledError) {
    // Tried to use a disabled account
  }
}
```

## Error Properties

All errors inherit from `AlxAccountError`:

- `code` -- string error code (e.g., `'ACCOUNT_NOT_FOUND'`)
- `message` -- human-readable error message
- `accountId` -- (where applicable) the account that caused the error
- `originalError` -- (where applicable) the underlying error

## Related

- [Email Sending](./email-sending.md) -- common send-related errors
- [SES Webhooks](./ses-webhooks.md) -- `SnsSignatureError`
- [Unsubscribe](./unsubscribe.md) -- `InvalidTokenError`

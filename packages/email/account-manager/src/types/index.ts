export {
  ACCOUNT_PROVIDER, ACCOUNT_STATUS, IDENTIFIER_STATUS, BOUNCE_TYPE,
  DRAFT_STATUS, EMAIL_EVENT_TYPE, SES_BOUNCE_TYPE, SES_COMPLAINT_TYPE,
  SNS_MESSAGE_TYPE, SES_NOTIFICATION_TYPE,
  type AccountProvider, type AccountStatus, type IdentifierStatus, type BounceType,
  type DraftStatus, type EmailEventType, type SesBounceType, type SesComplaintType,
  type SnsMessageType, type SesNotificationType,
} from '../constants';

export type {
  EmailAccountManagerConfig, LogAdapter, WarmupPhase,
} from './config.types';

export type {
  EmailAccount, CreateEmailAccountInput, UpdateEmailAccountInput,
  SmtpConfig, ImapConfig, SesConfig, HealthThresholds,
  AccountHealthData, AccountWarmupData, AccountLimits,
  AccountCapacity, AccountHealth,
} from './account.types';

export type {
  EmailIdentifier, CreateIdentifierInput, UpdateIdentifierInput,
} from './identifier.types';

export type {
  EmailDraft, CreateDraftInput,
} from './draft.types';

export type {
  GlobalSettings, UpdateGlobalSettingsInput,
  DevModeSettings, ImapSettings, SesSettings,
  ApprovalSettings, ApprovalSendWindow,
  UnsubscribePageSettings, QueueSettings,
} from './settings.types';

export type {
  EmailEvent, SnsMessage, SesNotification,
  SesBounce, SesComplaint, SesDelivery, SesOpen, SesClick,
  SesMailPayload, SesBounceRecipient, SesComplaintRecipient,
} from './event.types';

export {
  AlxAccountError, ConfigValidationError, AccountDisabledError,
  NoAvailableAccountError, SmtpConnectionError, InvalidTokenError,
  QuotaExceededError, SnsSignatureError, AccountNotFoundError,
  DraftNotFoundError,
} from '../errors';

export { validateConfig } from '../validation/config.schema';

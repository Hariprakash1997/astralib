export {
  ACCOUNT_STATUS, IDENTIFIER_STATUS,
  type AccountStatus, type IdentifierStatus, type RotationStrategy,
} from '../constants';

export type {
  TelegramAccountManagerConfig, LogAdapter, WarmupPhase,
} from './config.types';

export type {
  CreateTelegramAccountInput, UpdateTelegramAccountInput,
  AccountCapacity, AccountHealth, ConnectedAccount,
} from './account.types';

export type {
  CreateTelegramIdentifierInput, UpdateTelegramIdentifierInput,
} from './identifier.types';

export {
  AlxTelegramAccountError, ConfigValidationError, ConnectionError,
  AccountNotFoundError, AccountBannedError, QuarantineError,
  normalizeErrorCode,
} from '../errors';

export { validateConfig } from '../validation/config.schema';

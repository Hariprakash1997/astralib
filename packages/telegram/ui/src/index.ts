export { AlxTelegramConfig } from './config.js';
export type { AlxTelegramConfigOptions } from './config.js';

export { alxBaseStyles, alxDarkTheme, alxLightTheme } from './styles/theme.js';
export {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxToolbarStyles,
  alxToggleStyles,
  alxProgressBarStyles,
  alxTooltipStyles,
} from './styles/shared.js';

export {
  HttpClient,
  HttpClientError,
  TelegramAccountAPI,
  TelegramRuleAPI,
  TelegramInboxAPI,
  TelegramBotAPI,
} from './api/index.js';
export type { PaginationParams, ApiResponse, PaginatedResponse } from './api/index.js';

export { safeRegister } from './utils/safe-register.js';
export {
  iconEdit,
  iconDelete,
  iconClose,
  iconClone,
  iconPlus,
  iconRefresh,
  iconConnect,
  iconDisconnect,
  iconSync,
  iconSearch,
  iconSend,
  iconFilter,
  iconChevronLeft,
  iconChevronRight,
  iconCheck,
  iconWarning,
  iconPlay,
  iconPause,
} from './utils/icons.js';

export {
  AlxTgAccountList,
  AlxTgAccountForm,
} from './components/account/index.js';

export {
  AlxTgTemplateList,
  AlxTgTemplateEditor,
  AlxTgRuleList,
  AlxTgRuleEditor,
  AlxTgRunHistory,
  AlxTgThrottleSettings,
} from './components/rules/index.js';

export { AlxTgInbox } from './components/inbox/index.js';

export { AlxTgBotStats } from './components/bot/index.js';

export { AlxTgAnalytics } from './components/analytics/index.js';

export { AlxTgDrawer, AlxTelegramDashboard } from './components/shared/index.js';

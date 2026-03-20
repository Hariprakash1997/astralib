export { AlxConfig } from './config.js';
export type { AlxConfigOptions } from './config.js';

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
  AccountAPI,
  RuleAPI,
  AnalyticsAPI,
} from './api/index.js';
export type { PaginationParams, ApiResponse, PaginatedResponse } from './api/index.js';

export {
  AlxAccountList,
  AlxAccountForm,
  AlxAccountHealth,
  AlxAccountWarmup,
  AlxAccountCapacity,
  AlxSmtpTester,
  AlxBounceStatus,
  AlxApprovalQueue,
  AlxGlobalSettings,
  AlxMetadataEditor,
} from './components/account/index.js';

// Re-export shared rule engine components
export {
  AlxTemplateList,
  AlxTemplateEditor,
  AlxRuleList,
  AlxRuleEditor,
  AlxRunHistory,
  AlxThrottleSettings,
  AlxSendLog,
  AlxDrawer,
} from '@astralibx/rule-engine-ui';

// Email-specific components
export { AlxEmailBodyEditor } from './components/email/index.js';

export {
  AlxAnalyticsOverview,
  AlxAnalyticsTimeline,
  AlxAnalyticsAccounts,
  AlxAnalyticsRules,
  AlxAnalyticsEngagement,
  AlxAnalyticsChannels,
  AlxAnalyticsVariants,
} from './components/analytics/index.js';

export { AlxEmailDashboard } from './components/shared/index.js';

// Re-export shared types
export type { TemplateData, RuleData, Condition } from '@astralibx/rule-engine-ui';
export type { Settings } from './components/account/alx-global-settings.types.js';

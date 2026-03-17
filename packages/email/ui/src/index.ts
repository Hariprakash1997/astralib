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

export {
  AlxTemplateList,
  AlxTemplateEditor,
  AlxRuleList,
  AlxRuleEditor,
  AlxRunHistory,
  AlxThrottleSettings,
  AlxGuidePanel,
  AlxSendLog,
} from './components/rules/index.js';

export {
  AlxAnalyticsOverview,
  AlxAnalyticsTimeline,
  AlxAnalyticsAccounts,
  AlxAnalyticsRules,
  AlxAnalyticsEngagement,
  AlxAnalyticsChannels,
  AlxAnalyticsVariants,
} from './components/analytics/index.js';

export { AlxDrawer, AlxEmailDashboard } from './components/shared/index.js';

export type { TemplateData } from './components/rules/alx-template-editor.types.js';
export type { RuleData, Condition } from './components/rules/alx-rule-editor.types.js';
export type { Settings } from './components/account/alx-global-settings.types.js';

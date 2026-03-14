export { AlxConfig } from './config.js';
export type { AlxConfigOptions } from './config.js';

export { alxBaseStyles, alxDarkTheme, alxLightTheme } from './styles/theme.js';
export {
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
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
} from './components/account/index.js';

export {
  AlxTemplateList,
  AlxTemplateEditor,
  AlxRuleList,
  AlxRuleEditor,
  AlxRunHistory,
  AlxThrottleSettings,
  AlxGuidePanel,
} from './components/rules/index.js';

export {
  AlxAnalyticsOverview,
  AlxAnalyticsTimeline,
  AlxAnalyticsAccounts,
  AlxAnalyticsRules,
  AlxAnalyticsEngagement,
} from './components/analytics/index.js';

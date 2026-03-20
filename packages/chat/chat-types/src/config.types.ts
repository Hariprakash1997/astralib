import { PreChatFlowConfig, FormField } from './flow.types';
import { ChatUserInfo } from './session.types';

export interface ChatWidgetConfig {
  socketUrl: string;
  channel: string;
  theme?: 'light' | 'dark' | 'auto';
  position?: 'bottom-right' | 'bottom-left';
  locale?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  translations?: Partial<ChatTranslations>;
  preChatFlow?: PreChatFlowConfig;
  features?: ChatWidgetFeatures;
  branding?: ChatBranding;
  user?: ChatUserInfo;
  offline?: OfflineConfig;
  postChat?: PostChatConfig;
  fileSharing?: WidgetFileSharingConfig;
  businessHours?: WidgetBusinessHoursConfig;
  ratingConfig?: WidgetRatingConfig;
  configEndpoint?: string;
  metadata?: Record<string, unknown>;
  styles?: Record<string, string>;
}

export interface ChatWidgetFeatures {
  soundNotifications?: boolean;
  desktopNotifications?: boolean;
  typingIndicator?: boolean;
  readReceipts?: boolean;
  autoOpen?: boolean;
  autoOpenDelayMs?: number;
  liveChatEnabled?: boolean;
  maxReconnectAttempts?: number;
}

export interface ChatBranding {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  companyName?: string;
  logoUrl?: string;
  buttonIcon?: string;
  buttonShape?: 'circle' | 'rounded' | 'square';
  customCss?: string;
  showPoweredBy?: boolean;
}

export interface OfflineConfig {
  mode: 'form' | 'message' | 'hide';
  formFields?: FormField[];
  offlineMessage?: string;
  offlineTitle?: string;
}

export interface PostChatConfig {
  enabled: boolean;
  type: 'rating' | 'survey';
  ratingQuestion?: string;
  surveyFields?: FormField[];
  thankYouMessage?: string;
}

export interface WidgetFileSharingConfig {
  enabled: boolean;
  maxFileSizeMb?: number;
  allowedTypes?: string[];
}

export interface WidgetBusinessHoursSchedule {
  day: number;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface WidgetBusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  schedule: WidgetBusinessHoursSchedule[];
  holidayDates?: string[];
  outsideHoursMessage?: string;
  outsideHoursBehavior?: 'offline-message' | 'faq-only' | 'hide-widget';
}

export interface WidgetRatingConfig {
  enabled: boolean;
  ratingType: 'thumbs' | 'stars' | 'emoji';
  followUpOptions?: Record<string, string[]>;
}

export type { FormField, FormFieldValidation } from './flow.types';

export interface ChatTranslations {
  welcomeTitle: string;
  welcomeSubtitle: string;
  inputPlaceholder: string;
  sendButton: string;
  endChatButton: string;
  [key: string]: string;
}

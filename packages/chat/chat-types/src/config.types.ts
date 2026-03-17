import { PreChatFlowConfig, FormField } from './flow.types';
import { ChatUserInfo } from './session.types';

export interface ChatWidgetConfig {
  socketUrl: string;
  channel: string;
  theme?: 'light' | 'dark';
  position?: 'bottom-right' | 'bottom-left';
  locale?: string;
  translations?: Partial<ChatTranslations>;
  preChatFlow?: PreChatFlowConfig;
  features?: ChatWidgetFeatures;
  branding?: ChatBranding;
  user?: ChatUserInfo;
  offline?: OfflineConfig;
  postChat?: PostChatConfig;
  configEndpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatWidgetFeatures {
  soundNotifications?: boolean;
  desktopNotifications?: boolean;
  typingIndicator?: boolean;
  readReceipts?: boolean;
  autoOpen?: boolean;
  autoOpenDelayMs?: number;
  liveChatEnabled?: boolean;
}

export interface ChatBranding {
  primaryColor?: string;
  companyName?: string;
  logoUrl?: string;
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

export type { FormField, FormFieldValidation } from './flow.types';

export interface ChatTranslations {
  welcomeTitle: string;
  welcomeSubtitle: string;
  inputPlaceholder: string;
  sendButton: string;
  endChatButton: string;
  [key: string]: string;
}

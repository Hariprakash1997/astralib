// Error Codes
export const ERROR_CODE = {
  AuthFailed: 'AUTH_FAILED',
  NoSession: 'NO_SESSION',
  InvalidData: 'INVALID_DATA',
  InvalidUrl: 'INVALID_URL',
  InvalidRating: 'INVALID_RATING',
  AgentUnavailable: 'AGENT_UNAVAILABLE',
  CapacityFull: 'CAPACITY_FULL',
  AiDisabled: 'AI_DISABLED',
  EscalationFailed: 'ESCALATION_FAILED',
  FixedModeSwitch: 'FIXED_MODE_SWITCH',
  ManagerNotAllowed: 'MANAGER_NOT_ALLOWED',
  InternalError: 'INTERNAL_ERROR',
  FileSharingDisabled: 'FILE_SHARING_DISABLED',
  FileStorageNotConfigured: 'FILE_STORAGE_NOT_CONFIGURED',
  FileTooLarge: 'FILE_TOO_LARGE',
  FileTypeNotAllowed: 'FILE_TYPE_NOT_ALLOWED',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

// Training Quality
export const TRAINING_QUALITY = {
  Good: 'good',
  Bad: 'bad',
  NeedsReview: 'needs_review',
} as const;

export type TrainingQuality = (typeof TRAINING_QUALITY)[keyof typeof TRAINING_QUALITY];

// Agent Mode Override
export const MODE_OVERRIDE = {
  AI: 'ai',
  Manual: 'manual',
} as const;

export type ModeOverride = (typeof MODE_OVERRIDE)[keyof typeof MODE_OVERRIDE];

// Global AI Mode (two-layer control)
export const AI_MODE = {
  Manual: 'manual',       // all agents forced manual
  AI: 'ai',               // all agents forced AI
  AgentWise: 'agent-wise', // defer to per-agent modeOverride
} as const;

export type AiMode = (typeof AI_MODE)[keyof typeof AI_MODE];
export const AI_MODE_VALUES = Object.values(AI_MODE);

// Agent Visibility
export const AGENT_VISIBILITY = {
  Public: 'public',
  Internal: 'internal',
} as const;

export type AgentVisibility = (typeof AGENT_VISIBILITY)[keyof typeof AGENT_VISIBILITY];

// Internal Event Names (not socket events - those are in chat-types)
export const INTERNAL_EVENT = {
  ChatError: 'chat:error',
  AgentError: 'agent:error',
  AgentSessionEvent: 'agent:session_event',
} as const;

// Pending Message Type
export const PENDING_TYPE = {
  MessagePending: 'message_pending',
} as const;

// System Messages
export const SYSTEM_MESSAGE = {
  SenderName: 'System',
  VisitorReconnected: 'Visitor reconnected',
  EscalatedToHuman: 'Escalated to human agent',
  AgentEscalated: 'Chat escalated',
  AgentLeft: 'Agent left the chat',
  AutoClosed: 'This chat was closed due to inactivity',
  ConversationResolved: 'Conversation has been resolved',
  HandedBackToAi: 'Conversation handed back to AI',
} as const;

// System Message Functions (for messages that need dynamic interpolation)
export const SYSTEM_MESSAGE_FN = {
  agentJoined: (name: string) => `${name} joined the conversation`,
  agentTookOver: (name: string) => `${name} took over the conversation`,
  conversationTransferred: (name: string) => `Conversation transferred to ${name}`,
  visitorRequestedHuman: (reason?: string) => reason ? `Visitor requested human agent: ${reason}` : 'Visitor requested human agent',
} as const;

// Agent Defaults
export const AGENT_DEFAULTS = {
  MaxConcurrentChats: 5,
} as const;

// Auto-Close Defaults
export const AUTO_CLOSE = {
  DefaultMinutes: 30,
  MinMinutes: 1,
  MaxMinutes: 1440,
} as const;

// Agent Activity Tracking
export const AGENT_ACTIVITY = {
  DefaultAutoAwayMinutes: 15,
  MinAutoAwayMinutes: 1,
  MaxAutoAwayMinutes: 480,
  CheckIntervalMs: 60_000, // Check for idle agents every 60 seconds
} as const;

// Widget Config Defaults
export const WIDGET_DEFAULT = {
  Position: 'bottom-right',
  Theme: 'light',
} as const;

// Business Hours — Outside Hours Behavior
export const OUTSIDE_HOURS_BEHAVIOR = {
  OfflineMessage: 'offline-message',
  FaqOnly: 'faq-only',
  HideWidget: 'hide-widget',
} as const;

export type OutsideHoursBehavior = (typeof OUTSIDE_HOURS_BEHAVIOR)[keyof typeof OUTSIDE_HOURS_BEHAVIOR];
export const OUTSIDE_HOURS_BEHAVIOR_VALUES = Object.values(OUTSIDE_HOURS_BEHAVIOR);

// Business Hours — Default schedule (Mon–Fri 09:00–18:00)
export const DEFAULT_BUSINESS_SCHEDULE = [
  { day: 0, open: '09:00', close: '18:00', isOpen: false },
  { day: 1, open: '09:00', close: '18:00', isOpen: true },
  { day: 2, open: '09:00', close: '18:00', isOpen: true },
  { day: 3, open: '09:00', close: '18:00', isOpen: true },
  { day: 4, open: '09:00', close: '18:00', isOpen: true },
  { day: 5, open: '09:00', close: '18:00', isOpen: true },
  { day: 6, open: '09:00', close: '18:00', isOpen: false },
];

// Chat Mode
export const CHAT_MODE = {
  Switchable: 'switchable',
  Fixed: 'fixed',
} as const;

export type ChatMode = (typeof CHAT_MODE)[keyof typeof CHAT_MODE];
export const CHAT_MODE_VALUES = Object.values(CHAT_MODE);

// Agent Hierarchy Levels
export const AGENT_LEVEL = {
  L1: 1,
  L2: 2,
  L3: 3,
} as const;

// Default — but levels are configurable, not limited to 3

// User Event Types (inline event tracking)
export const USER_EVENT_TYPE = {
  PageView: 'page_view',
  WidgetOpened: 'widget_opened',
  WidgetMinimized: 'widget_minimized',
  TypingStarted: 'typing_started',
  MessageSent: 'message_sent',
  Disconnected: 'disconnected',
  Reconnected: 'reconnected',
  Custom: 'custom',
} as const;

export type UserEventType = (typeof USER_EVENT_TYPE)[keyof typeof USER_EVENT_TYPE];

// File Sharing Defaults
export const FILE_SHARING_DEFAULTS = {
  Enabled: false,
  MaxFileSizeMb: 5,
  AllowedTypes: ['image/*', 'application/pdf'],
} as const;

// Rating Type
export const RATING_TYPE = {
  Thumbs: 'thumbs',
  Stars: 'stars',
  Emoji: 'emoji',
} as const;

export type RatingType = (typeof RATING_TYPE)[keyof typeof RATING_TYPE];
export const RATING_TYPE_VALUES = Object.values(RATING_TYPE);

// Webhook Events
export const WEBHOOK_EVENT = {
  ChatStarted: 'chat.started',
  ChatEnded: 'chat.ended',
  ChatEscalated: 'chat.escalated',
  MessageSent: 'message.sent',
  MessageReceived: 'message.received',
  AgentAssigned: 'agent.assigned',
  AgentTransferred: 'agent.transferred',
  RatingSubmitted: 'rating.submitted',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENT)[keyof typeof WEBHOOK_EVENT];
export const WEBHOOK_EVENT_VALUES = Object.values(WEBHOOK_EVENT);

// Error Messages (for gateway socket emit calls)
export const ERROR_MESSAGE = {
  AuthFailed: 'Authentication failed',
  NoActiveSession: 'No active session',
  InvalidMetadata: 'Invalid metadata',
  InvalidDataFormat: 'Invalid data format',
  FileContentInvalidUrl: 'File content must be a valid URL',
  FileSharingDisabled: 'File sharing is disabled',
  RatingTypeRequired: 'ratingType is required for two-step rating',
  RatingValueRequired: 'ratingValue is required',
  RatingThumbsRange: 'ratingValue must be 0 or 1 for thumbs',
  RatingStarsRange: 'ratingValue must be 1-5 for stars/emoji',
  RatingLegacyRange: 'Rating must be an integer from 1 to 5',
  FixedModeSwitch: 'Cannot switch agents in fixed chat mode while the assigned agent is active',
  AgentNotAvailable: 'Agent not available',
  CapacityFull: 'Maximum concurrent chats reached',
  ManagerMessageNotAllowed: 'Managers can only send messages to chats assigned or escalated to them',
  AiModeDisabled: 'AI mode is not enabled (global or agent-level setting)',
  ManagerWatchOnly: 'Only managers can watch chats',
} as const;

export const TRAINING_QUALITY_VALUES = Object.values(TRAINING_QUALITY);
export const MODE_OVERRIDE_VALUES = Object.values(MODE_OVERRIDE);
export const AGENT_VISIBILITY_VALUES = Object.values(AGENT_VISIBILITY);

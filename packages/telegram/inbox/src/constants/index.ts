export const CONTENT_TYPES = ['text', 'photo', 'video', 'voice', 'audio', 'document', 'sticker', 'location', 'contact'] as const;
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export const SENDER_TYPES = ['account', 'user'] as const;
export const SESSION_STATUSES = ['active', 'paused', 'closed'] as const;
export const DEFAULT_HISTORY_SYNC_LIMIT = 100;
export const DEFAULT_MAX_FILE_SIZE_MB = 50;
export const DEFAULT_TYPING_TIMEOUT_MS = 5000;

export const CONTENT_TYPES = ['text', 'photo', 'video', 'voice', 'audio', 'document', 'sticker', 'location', 'contact'] as const;
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export const SENDER_TYPES = ['account', 'user'] as const;
export const SESSION_STATUSES = ['active', 'paused', 'closed'] as const;

// Named constants for individual values
export const DIRECTION_INBOUND = MESSAGE_DIRECTIONS[0]; // 'inbound'
export const DIRECTION_OUTBOUND = MESSAGE_DIRECTIONS[1]; // 'outbound'
export const SENDER_ACCOUNT = SENDER_TYPES[0]; // 'account'
export const SENDER_USER = SENDER_TYPES[1]; // 'user'
export const STATUS_ACTIVE = SESSION_STATUSES[0]; // 'active'
export const STATUS_PAUSED = SESSION_STATUSES[1]; // 'paused'
export const STATUS_CLOSED = SESSION_STATUSES[2]; // 'closed'
export const CONTENT_TEXT = CONTENT_TYPES[0]; // 'text'
export const CONTENT_PHOTO = CONTENT_TYPES[1]; // 'photo'
export const CONTENT_VIDEO = CONTENT_TYPES[2]; // 'video'
export const CONTENT_VOICE = CONTENT_TYPES[3]; // 'voice'
export const CONTENT_AUDIO = CONTENT_TYPES[4]; // 'audio'
export const CONTENT_DOCUMENT = CONTENT_TYPES[5]; // 'document'
export const CONTENT_STICKER = CONTENT_TYPES[6]; // 'sticker'
export const CONTENT_LOCATION = CONTENT_TYPES[7]; // 'location'
export const CONTENT_CONTACT = CONTENT_TYPES[8]; // 'contact'

export const DIALOG_TYPE_USER = 'user' as const;
export const DIALOG_TYPE_GROUP = 'group' as const;
export const DIALOG_TYPE_CHANNEL = 'channel' as const;

export const DEFAULT_HISTORY_SYNC_LIMIT = 100;
export const DEFAULT_MAX_FILE_SIZE_MB = 50;
export const DEFAULT_TYPING_TIMEOUT_MS = 5000;
export const MAX_SEEN_CONTACTS_CACHE = 10000;
export const MAX_PAGE_LIMIT = 200;

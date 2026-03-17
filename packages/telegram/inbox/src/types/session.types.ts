import type { SessionStatus } from './config.types';

export interface CreateSessionInput {
  accountId: string;
  contactId: string;
  conversationId: string;
  identifierId?: string;
}

export interface SessionFilters {
  accountId?: string;
  contactId?: string;
  status?: SessionStatus;
}

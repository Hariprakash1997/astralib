import type { IdentifierStatus } from '../constants';

export interface CreateTelegramIdentifierInput {
  contactId: string;
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UpdateTelegramIdentifierInput {
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: IdentifierStatus;
  lastActiveAt?: Date;
}

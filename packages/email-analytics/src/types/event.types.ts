import type { IEmailEvent } from '../schemas/email-event.schema';
import type { EventType } from '../constants';

export type EmailEvent = IEmailEvent;

export interface CreateEventInput {
  type: EventType;
  accountId: string;
  ruleId?: string;
  templateId?: string;
  recipientEmail: string;
  identifierId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

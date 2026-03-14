import type { DraftStatus } from '../constants';

export interface EmailDraft {
  _id: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  accountId: string;
  status: DraftStatus;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  sentAt?: Date;
  scheduledAt?: Date;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftInput {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  accountId: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

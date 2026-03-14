import type { IdentifierStatus, BounceType } from '../constants';

export interface EmailIdentifier {
  _id: string;
  email: string;
  status: IdentifierStatus;
  sentCount: number;
  bounceCount: number;
  lastSentAt?: Date;
  lastBouncedAt?: Date;
  bounceType?: BounceType;
  unsubscribedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIdentifierInput {
  email: string;
  status?: IdentifierStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateIdentifierInput {
  status?: IdentifierStatus;
  bounceType?: BounceType;
  metadata?: Record<string, unknown>;
}

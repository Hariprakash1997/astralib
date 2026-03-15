import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';

export type { LogAdapter };

export interface WarmupPhase {
  days: [number, number];
  dailyLimit: number;
  delayMinMs: number;
  delayMaxMs: number;
}

export interface EmailAccountManagerConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  redis: {
    connection: Redis;
    keyPrefix?: string;
  };

  logger?: LogAdapter;

  options?: {
    warmup?: {
      defaultSchedule: WarmupPhase[];
    };

    healthDefaults?: {
      minScore?: number;
      maxBounceRate?: number;
      maxConsecutiveErrors?: number;
    };

    imap?: {
      autoStart?: boolean;
    };

    ses?: {
      enabled: boolean;
      validateSignature?: boolean;
      allowedTopicArns?: string[];
    };

    unsubscribe?: {
      builtin?: {
        enabled: boolean;
        secret: string;
        baseUrl: string;
        tokenExpiryDays?: number;
      };
      generateUrl?: (email: string, accountId: string) => string;
    };

    queues?: {
      sendQueueName?: string;
      approvalQueueName?: string;
    };
  };

  hooks?: {
    onAccountDisabled?: (info: { accountId: string; reason: string }) => void;
    onWarmupComplete?: (info: { accountId: string; email: string }) => void;
    onHealthDegraded?: (info: { accountId: string; healthScore: number }) => void;

    onSend?: (info: { accountId: string; email: string; messageId?: string }) => void;
    onSendError?: (info: { accountId: string; email: string; error: string }) => void;
    onBounce?: (info: { accountId: string; email: string; bounceType: string; provider: string }) => void;
    onUnsubscribe?: (info: { email: string; accountId?: string }) => void;

    onDelivery?: (info: { accountId: string; email: string }) => void;
    onComplaint?: (info: { accountId: string; email: string }) => void;
    onOpen?: (info: { accountId: string; email: string; timestamp: Date }) => void;
    onClick?: (info: { accountId: string; email: string; link: string }) => void;

    onDraftCreated?: (info: { draftId: string; to: string; subject: string }) => void;
    onDraftApproved?: (info: { draftId: string; to: string; scheduledAt?: Date }) => void;
    onDraftRejected?: (info: { draftId: string; to: string; reason?: string }) => void;
  };
}

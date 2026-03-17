import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';

export type { LogAdapter };

export interface WarmupPhase {
  days: [number, number];
  dailyLimit: number;
  delayMinMs: number;
  delayMaxMs: number;
}

export interface TelegramAccountManagerConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  credentials: {
    apiId: number;
    apiHash: string;
  };

  options?: {
    maxAccounts?: number;
    connectionTimeoutMs?: number;
    healthCheckIntervalMs?: number;
    autoReconnect?: boolean;
    reconnectMaxRetries?: number;
    warmup?: {
      enabled?: boolean;
      defaultSchedule?: WarmupPhase[];
    };
    quarantine?: {
      monitorIntervalMs?: number;
      defaultDurationMs?: number;
    };
  };

  logger?: LogAdapter;

  hooks?: {
    onAccountConnected?: (info: { accountId: string; phone: string }) => void;
    onAccountDisconnected?: (info: { accountId: string; phone: string; reason: string }) => void;
    onAccountQuarantined?: (info: { accountId: string; phone: string; reason: string; until: Date }) => void;
    onAccountReleased?: (info: { accountId: string; phone: string }) => void;
    onAccountBanned?: (info: { accountId: string; phone: string; errorCode: string }) => void;
    onHealthChange?: (info: { accountId: string; phone: string; oldScore: number; newScore: number }) => void;
    onWarmupComplete?: (info: { accountId: string; phone: string }) => void;
  };
}

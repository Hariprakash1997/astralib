import type { AccountProvider, AccountStatus } from '../constants';
import type { WarmupPhase } from './config.types';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SesConfig {
  region: string;
  configurationSet?: string;
}

export interface HealthThresholds {
  minScore: number;
  maxBounceRate: number;
  maxConsecutiveErrors: number;
}

export interface AccountHealthData {
  score: number;
  consecutiveErrors: number;
  bounceCount: number;
  thresholds: HealthThresholds;
}

export interface AccountWarmupData {
  enabled: boolean;
  startedAt?: Date;
  completedAt?: Date;
  currentDay: number;
  schedule: WarmupPhase[];
}

export interface AccountLimits {
  dailyMax: number;
}

export interface EmailAccount {
  _id: string;
  email: string;
  senderName: string;
  provider: AccountProvider;
  status: AccountStatus;

  smtp: SmtpConfig;
  imap?: ImapConfig;
  ses?: SesConfig;

  limits: AccountLimits;
  health: AccountHealthData;
  warmup: AccountWarmupData;

  totalEmailsSent: number;
  lastSuccessfulSendAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailAccountInput {
  email: string;
  senderName: string;
  provider: AccountProvider;
  smtp: SmtpConfig;
  imap?: ImapConfig;
  ses?: SesConfig;
  limits?: Partial<AccountLimits>;
  warmup?: {
    schedule?: WarmupPhase[];
  };
  health?: {
    thresholds?: Partial<HealthThresholds>;
  };
}

export interface UpdateEmailAccountInput {
  senderName?: string;
  status?: AccountStatus;
  smtp?: Partial<SmtpConfig>;
  imap?: Partial<ImapConfig>;
  ses?: Partial<SesConfig>;
  limits?: Partial<AccountLimits>;
  warmup?: Partial<AccountWarmupData>;
  health?: {
    thresholds?: Partial<HealthThresholds>;
  };
}

export interface AccountCapacity {
  accountId: string;
  email: string;
  provider: AccountProvider;
  dailyMax: number;
  sentToday: number;
  remaining: number;
  usagePercent: number;
}

export interface AccountHealth {
  accountId: string;
  email: string;
  score: number;
  consecutiveErrors: number;
  bounceCount: number;
  thresholds: HealthThresholds;
  status: AccountStatus;
}

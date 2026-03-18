import type { AccountStatus } from '../constants';

export interface CreateTelegramAccountInput {
  phone: string;
  name: string;
  session: string;
  tags?: string[];
}

export interface UpdateTelegramAccountInput {
  name?: string;
  session?: string;
  currentDailyLimit?: number;
  currentDelayMin?: number;
  currentDelayMax?: number;
  tags?: string[];
}

export interface AccountCapacity {
  accountId: string;
  phone: string;
  dailyMax: number;
  sentToday: number;
  remaining: number;
  usagePercent: number;
  status: AccountStatus;
}

export interface AccountHealth {
  accountId: string;
  phone: string;
  healthScore: number;
  consecutiveErrors: number;
  floodWaitCount: number;
  status: AccountStatus;
  lastSuccessfulSendAt: Date | null;
}

export interface ConnectedAccount {
  accountId: string;
  phone: string;
  name: string;
  isConnected: boolean;
}

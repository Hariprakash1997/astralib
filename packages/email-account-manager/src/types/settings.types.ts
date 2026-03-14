export interface DevModeSettings {
  enabled: boolean;
  testEmails: string[];
}

export interface ImapSettings {
  enabled: boolean;
  pollIntervalMs: number;
  searchSince: 'last_check' | 'last_24h' | 'last_7d';
  bounceSenders: string[];
}

export interface SesSettings {
  configurationSet?: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface ApprovalSendWindow {
  timezone: string;
  startHour: number;
  endHour: number;
}

export interface ApprovalSettings {
  enabled: boolean;
  defaultMode: 'manual' | 'auto';
  autoApproveDelayMs: number;
  sendWindow: ApprovalSendWindow;
  spreadStrategy: 'random' | 'even';
  maxSpreadMinutes: number;
}

export interface UnsubscribePageSettings {
  companyName: string;
  logoUrl?: string;
  accentColor?: string;
}

export interface QueueSettings {
  sendConcurrency: number;
  sendAttempts: number;
  sendBackoffMs: number;
  approvalConcurrency: number;
  approvalAttempts: number;
  approvalBackoffMs: number;
}

export interface GlobalSettings {
  _id: 'global';
  timezone: string;
  devMode: DevModeSettings;
  imap: ImapSettings;
  ses: SesSettings;
  approval: ApprovalSettings;
  unsubscribePage: UnsubscribePageSettings;
  queues: QueueSettings;
  updatedAt: Date;
}

export type UpdateGlobalSettingsInput = Partial<Omit<GlobalSettings, '_id' | 'updatedAt'>>;

export interface Settings {
  timezone?: string;
  devMode?: boolean;
  imap?: {
    enabled?: boolean;
    pollIntervalMinutes?: number;
  };
  approval?: {
    enabled?: boolean;
    autoApproveAfterMinutes?: number;
  };
  queue?: {
    concurrency?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
  };
}

export interface RunProgress {
  rulesTotal: number;
  rulesCompleted: number;
  sent: number;
  failed: number;
  skipped: number;
  invalid: number;
}

export type RunStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface RunStatusResponse {
  runId: string;
  status: RunStatus;
  currentRule: string;
  progress: RunProgress;
  startedAt: string;
  elapsed: number;
}

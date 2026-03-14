export interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface BaseDbConfig {
  connection: unknown;
  collectionPrefix?: string;
}

export interface BaseRedisConfig {
  connection: unknown;
  keyPrefix?: string;
}

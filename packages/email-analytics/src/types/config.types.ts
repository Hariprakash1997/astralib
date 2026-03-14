import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { AggregationInterval } from '../constants';

export interface EmailAnalyticsConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };
  logger?: LogAdapter;
  options?: {
    eventTTLDays?: number;
    timezone?: string;
    aggregationSchedule?: AggregationInterval[];
  };
}

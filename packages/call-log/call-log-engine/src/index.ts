import { z } from 'zod';
import { noopLogger } from '@astralibx/core';
import type { Router } from 'express';
import type { Model } from 'mongoose';
import type { CallLogEngineConfig, ResolvedOptions } from '@astralibx/call-log-types';
import { DEFAULT_OPTIONS } from '@astralibx/call-log-types';
import {
  createPipelineModel,
  type IPipelineDocument,
} from './schemas/pipeline.schema.js';
import {
  createCallLogModel,
  type ICallLogDocument,
} from './schemas/call-log.schema.js';
import {
  createCallLogSettingsModel,
  type ICallLogSettingsDocument,
} from './schemas/call-log-settings.schema.js';
import { SettingsService } from './services/settings.service.js';
import { PipelineService } from './services/pipeline.service.js';
import { TimelineService } from './services/timeline.service.js';
import { CallLogService } from './services/call-log.service.js';
import { AnalyticsService } from './services/analytics.service.js';
import { ExportService } from './services/export.service.js';
import { createRoutes } from './routes/index.js';
import { FollowUpWorker } from './workers/follow-up.worker.js';

// ── Zod validation schema ─────────────────────────────────────────────────────

const CallLogEngineConfigSchema = z.object({
  db: z.object({
    connection: z.unknown(),
    collectionPrefix: z.string().optional(),
  }),
  logger: z
    .object({
      info: z.function(),
      warn: z.function(),
      error: z.function(),
      debug: z.function(),
    })
    .optional(),
  agents: z
    .object({
      collectionName: z.string().optional(),
      resolveAgent: z.function().optional(),
    })
    .optional()
    .default({}),
  adapters: z.object({
    lookupContact: z.function(),
    addContact: z.function().optional(),
    authenticateAgent: z.function(),
  }),
  hooks: z
    .object({
      onCallCreated: z.function().optional(),
      onStageChanged: z.function().optional(),
      onCallClosed: z.function().optional(),
      onCallAssigned: z.function().optional(),
      onFollowUpDue: z.function().optional(),
      onMetric: z.function().optional(),
    })
    .optional(),
  options: z
    .object({
      maxTimelineEntries: z.number().int().positive().optional(),
      followUpCheckIntervalMs: z.number().int().positive().optional(),
    })
    .optional(),
});

// ── Return type ───────────────────────────────────────────────────────────────

export interface CallLogEngine {
  pipelines: PipelineService;
  callLogs: CallLogService;
  timeline: TimelineService;
  analytics: AnalyticsService;
  settings: SettingsService;
  export: ExportService;
  routes: Router;
  models: {
    Pipeline: Model<IPipelineDocument>;
    CallLog: Model<ICallLogDocument>;
    CallLogSettings: Model<ICallLogSettingsDocument>;
  };
  destroy: () => Promise<void>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createCallLogEngine(config: CallLogEngineConfig): CallLogEngine {
  // 1. Validate config with Zod
  const parseResult = CallLogEngineConfigSchema.safeParse(config);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid CallLogEngineConfig: ${issues}`);
  }

  // 2. Resolve options
  const resolvedOptions: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...config.options,
  };

  // 3. Set up logger
  const logger = config.logger ?? noopLogger;

  // 4. Register models
  const conn = config.db.connection as import('mongoose').Connection;
  const prefix = config.db.collectionPrefix;

  const Pipeline = createPipelineModel(conn, prefix);
  const CallLog = createCallLogModel(conn, prefix);
  const CallLogSettings = createCallLogSettingsModel(conn, prefix);

  // 5. Create services
  const settingsService = new SettingsService(CallLogSettings, logger);

  const pipelineService = new PipelineService(Pipeline, CallLog, logger);

  const timelineService = new TimelineService(CallLog, logger, resolvedOptions);

  const callLogService = new CallLogService(
    CallLog,
    Pipeline,
    timelineService,
    logger,
    config.hooks ?? {},
    resolvedOptions,
  );

  const analyticsService = new AnalyticsService(CallLog, Pipeline, logger, config.agents?.resolveAgent);

  const exportService = new ExportService(CallLog, analyticsService, logger);

  // 6. Create routes
  const routes = createRoutes(
    {
      pipelines: pipelineService,
      callLogs: callLogService,
      timeline: timelineService,
      analytics: analyticsService,
      settings: settingsService,
      export: exportService,
    },
    {
      authenticateRequest: config.adapters.authenticateAgent
        ? async (req) => {
            const expressReq = req as unknown as { headers: Record<string, string | undefined> };
            const authHeader = expressReq.headers?.['authorization'];
            const token = authHeader?.startsWith('Bearer ')
              ? authHeader.slice(7)
              : authHeader;
            if (!token) return null;
            return config.adapters.authenticateAgent(token);
          }
        : undefined,
      logger,
    },
  );

  // 7. Start FollowUpWorker
  const followUpWorker = new FollowUpWorker({
    CallLog,
    hooks: { onFollowUpDue: config.hooks?.onFollowUpDue },
    logger,
    options: resolvedOptions,
  });

  followUpWorker.start();

  // 8. Return engine object
  async function destroy(): Promise<void> {
    followUpWorker.stop();
    logger.info('CallLogEngine destroyed');
  }

  return {
    pipelines: pipelineService,
    callLogs: callLogService,
    timeline: timelineService,
    analytics: analyticsService,
    settings: settingsService,
    export: exportService,
    routes,
    models: { Pipeline, CallLog, CallLogSettings },
    destroy,
  };
}

// ── Barrel re-exports ─────────────────────────────────────────────────────────

export * from './constants/index.js';
export * from './errors/index.js';
export * from './schemas/pipeline.schema.js';
export * from './schemas/call-log.schema.js';
export * from './schemas/call-log-settings.schema.js';
export * from './validation/pipeline.validator.js';
export { SettingsService } from './services/settings.service.js';
export { PipelineService } from './services/pipeline.service.js';
export { TimelineService } from './services/timeline.service.js';
export { CallLogService } from './services/call-log.service.js';
export { AnalyticsService } from './services/analytics.service.js';
export { ExportService } from './services/export.service.js';
export { FollowUpWorker } from './workers/follow-up.worker.js';
export { createRoutes } from './routes/index.js';
export type { CallLogEngineConfig, ResolvedOptions } from '@astralibx/call-log-types';
export { DEFAULT_OPTIONS } from '@astralibx/call-log-types';

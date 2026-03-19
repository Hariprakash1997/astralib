import { Request, Response } from 'express';
import { RUN_TRIGGER } from '../constants';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { RunLogModel } from '../schemas/run-log.schema';
import type { LogAdapter } from '../types/config.types';
import { getParam, noopLogger } from '@astralibx/core';
import { asyncHandler } from '../utils/helpers';

export function createRunnerController(
  runnerService: RuleRunnerService,
  RunLog: RunLogModel,
  logger?: LogAdapter
) {
  const _log = logger || noopLogger;

  const triggerManualRun = asyncHandler(async (_req: Request, res: Response) => {
    const { runId } = runnerService.trigger(RUN_TRIGGER.Manual);
    res.json({ success: true, data: { message: 'Rule run triggered', runId } });
  });

  const getLatestRun = asyncHandler(async (_req: Request, res: Response) => {
    const latestRun = await RunLog.findOne().sort({ runAt: -1 });
    res.json({ success: true, data: { latestRun } });
  });

  const getStatusByRunId = asyncHandler(async (req: Request, res: Response) => {
    const status = await runnerService.getStatus(getParam(req, 'runId'));
    if (!status) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }
    res.json({ success: true, data: status });
  });

  const cancelRun = asyncHandler(async (req: Request, res: Response) => {
    const result = await runnerService.cancel(getParam(req, 'runId'));
    if (!result.ok) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }
    res.json({ success: true, data: { message: 'Cancel requested' } });
  });

  return { triggerManualRun, getLatestRun, getStatusByRunId, cancelRun };
}

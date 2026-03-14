import { Request, Response } from 'express';
import { RUN_TRIGGER } from '../constants';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { LogAdapter } from '../types/config.types';
import { getParam } from '../utils/express-helpers';

const defaultLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

export function createRunnerController(
  runnerService: RuleRunnerService,
  EmailRuleRunLog: EmailRuleRunLogModel,
  logger?: LogAdapter
) {
  const log = logger || defaultLogger;

  async function triggerManualRun(_req: Request, res: Response) {
    const { runId } = runnerService.trigger(RUN_TRIGGER.Manual);
    res.json({ success: true, data: { message: 'Rule run triggered', runId } });
  }

  async function getLatestRun(_req: Request, res: Response) {
    try {
      const latestRun = await EmailRuleRunLog.findOne().sort({ runAt: -1 });
      res.json({ success: true, data: { latestRun } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function getStatusByRunId(req: Request, res: Response) {
    try {
      const status = await runnerService.getStatus(getParam(req, 'runId'));
      if (!status) {
        res.status(404).json({ success: false, error: 'Run not found' });
        return;
      }
      res.json({ success: true, data: status });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function cancelRun(req: Request, res: Response) {
    try {
      const result = await runnerService.cancel(getParam(req, 'runId'));
      if (!result.ok) {
        res.status(404).json({ success: false, error: 'Run not found' });
        return;
      }
      res.json({ success: true, data: { message: 'Cancel requested' } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { triggerManualRun, getLatestRun, getStatusByRunId, cancelRun };
}

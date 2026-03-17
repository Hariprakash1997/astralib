import { Request, Response } from 'express';
import type { LogAdapter } from '../types/config.types';
import { getParam } from '../utils/express-helpers';

const noopLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface RunnerServiceLike {
  trigger(triggeredBy?: string): { runId: string };
  getStatus(runId: string): Promise<any>;
  cancel(runId: string): Promise<{ ok: boolean }>;
}

export function createRunnerController(
  runnerService: RunnerServiceLike,
  logger?: LogAdapter
) {
  const log = logger || noopLogger;

  async function trigger(req: Request, res: Response) {
    try {
      const { triggeredBy } = req.body;
      const { runId } = runnerService.trigger(triggeredBy || 'manual');
      log.info(`Telegram rule run triggered: ${runId}`);
      res.json({ success: true, data: { message: 'Rule run triggered', runId } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Failed to trigger rule run: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  async function getStatus(req: Request, res: Response) {
    try {
      const status = await runnerService.getStatus(getParam(req, 'runId'));
      if (!status) {
        return res.status(404).json({ success: false, error: 'Run not found' });
      }
      res.json({ success: true, data: status });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function cancel(req: Request, res: Response) {
    try {
      const result = await runnerService.cancel(getParam(req, 'runId'));
      if (!result.ok) {
        return res.status(404).json({ success: false, error: 'Run not found or already completed' });
      }
      res.json({ success: true, data: { message: 'Cancel requested' } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { trigger, getStatus, cancel };
}

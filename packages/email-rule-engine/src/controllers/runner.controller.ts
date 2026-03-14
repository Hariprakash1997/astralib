import { Request, Response } from 'express';
import { RUN_TRIGGER } from '../constants';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';

export function createRunnerController(runnerService: RuleRunnerService, EmailRuleRunLog: EmailRuleRunLogModel) {

  async function triggerManualRun(_req: Request, res: Response) {
    runnerService.runAllRules(RUN_TRIGGER.Manual).catch(() => {});
    res.json({ success: true, data: { message: 'Rule run triggered' } });
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

  return { triggerManualRun, getLatestRun };
}

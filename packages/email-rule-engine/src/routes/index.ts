import { Router } from 'express';
import { createTemplateController } from '../controllers/template.controller';
import { createRuleController } from '../controllers/rule.controller';
import { createRunnerController } from '../controllers/runner.controller';
import { createSettingsController } from '../controllers/settings.controller';
import { createSendLogController } from '../controllers/send-log.controller';
import type { TemplateService } from '../services/template.service';
import type { RuleService } from '../services/rule.service';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { EmailRuleSendModel } from '../schemas/rule-send.schema';
import type { EmailThrottleConfigModel } from '../schemas/throttle-config.schema';
import type { LogAdapter } from '../types/config.types';

export interface RoutesDeps {
  templateService: TemplateService;
  ruleService: RuleService;
  runnerService: RuleRunnerService;
  EmailRuleRunLog: EmailRuleRunLogModel;
  EmailRuleSend: EmailRuleSendModel;
  EmailThrottleConfig: EmailThrottleConfigModel;
  platformValues?: string[];
  categoryValues?: string[];
  audienceValues?: string[];
  logger?: LogAdapter;
}

export function createRoutes(deps: RoutesDeps): Router {
  const router = Router();

  const templateCtrl = createTemplateController(deps.templateService, {
    platforms: deps.platformValues,
    categories: deps.categoryValues,
    audiences: deps.audienceValues,
  });
  const ruleCtrl = createRuleController(deps.ruleService, {
    platforms: deps.platformValues,
    audiences: deps.audienceValues,
  });
  const runnerCtrl = createRunnerController(deps.runnerService, deps.EmailRuleRunLog, deps.logger);
  const settingsCtrl = createSettingsController(deps.EmailThrottleConfig);
  const sendLogCtrl = createSendLogController(deps.EmailRuleSend);

  const templateRouter = Router();
  templateRouter.get('/', templateCtrl.list);
  templateRouter.post('/', templateCtrl.create);
  templateRouter.post('/validate', templateCtrl.validate);
  templateRouter.post('/preview', templateCtrl.previewRaw);
  templateRouter.get('/:id', templateCtrl.getById);
  templateRouter.put('/:id', templateCtrl.update);
  templateRouter.delete('/:id', templateCtrl.remove);
  templateRouter.patch('/:id/toggle', templateCtrl.toggleActive);
  templateRouter.post('/:id/preview', templateCtrl.preview);
  templateRouter.post('/:id/test-email', templateCtrl.sendTestEmail);
  templateRouter.post('/:id/preview-with-data', templateCtrl.previewWithRecipient);
  templateRouter.post('/:id/clone', templateCtrl.clone);

  const ruleRouter = Router();
  ruleRouter.get('/', ruleCtrl.list);
  ruleRouter.post('/', ruleCtrl.create);
  ruleRouter.get('/:id', ruleCtrl.getById);
  ruleRouter.patch('/:id', ruleCtrl.update);
  ruleRouter.delete('/:id', ruleCtrl.remove);
  ruleRouter.post('/:id/toggle', ruleCtrl.toggleActive);
  ruleRouter.post('/:id/dry-run', ruleCtrl.dryRun);
  ruleRouter.post('/:id/clone', ruleCtrl.clone);

  const runnerRouter = Router();
  runnerRouter.post('/', runnerCtrl.triggerManualRun);
  runnerRouter.get('/status', runnerCtrl.getLatestRun);
  runnerRouter.get('/status/:runId', runnerCtrl.getStatusByRunId);
  runnerRouter.post('/cancel/:runId', runnerCtrl.cancelRun);
  runnerRouter.get('/logs', ruleCtrl.runHistory);

  const sendLogRouter = Router();
  sendLogRouter.get('/', sendLogCtrl.list);

  router.use('/templates', templateRouter);
  router.use('/rules', ruleRouter);
  router.use('/runner', runnerRouter);
  router.use('/sends', sendLogRouter);
  router.get('/throttle', settingsCtrl.getThrottleConfig);
  router.put('/throttle', settingsCtrl.updateThrottleConfig);

  return router;
}

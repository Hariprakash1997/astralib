import { Router } from 'express';
import { createTemplateController } from '../controllers/template.controller';
import { createRuleController } from '../controllers/rule.controller';
import { createRunnerController } from '../controllers/runner.controller';
import { createSettingsController } from '../controllers/settings.controller';
import type { TemplateService } from '../services/template.service';
import type { RuleService } from '../services/rule.service';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { EmailThrottleConfigModel } from '../schemas/throttle-config.schema';

export interface RoutesDeps {
  templateService: TemplateService;
  ruleService: RuleService;
  runnerService: RuleRunnerService;
  EmailRuleRunLog: EmailRuleRunLogModel;
  EmailThrottleConfig: EmailThrottleConfigModel;
  platformValues?: string[];
  categoryValues?: string[];
  audienceValues?: string[];
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
  const runnerCtrl = createRunnerController(deps.runnerService, deps.EmailRuleRunLog);
  const settingsCtrl = createSettingsController(deps.EmailThrottleConfig);

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

  const ruleRouter = Router();
  ruleRouter.get('/', ruleCtrl.list);
  ruleRouter.post('/', ruleCtrl.create);
  ruleRouter.get('/run-history', ruleCtrl.runHistory);
  ruleRouter.get('/:id', ruleCtrl.getById);
  ruleRouter.patch('/:id', ruleCtrl.update);
  ruleRouter.delete('/:id', ruleCtrl.remove);
  ruleRouter.patch('/:id/toggle', ruleCtrl.toggleActive);
  ruleRouter.post('/:id/dry-run', ruleCtrl.dryRun);

  const runnerRouter = Router();
  runnerRouter.post('/', runnerCtrl.triggerManualRun);
  runnerRouter.get('/status', runnerCtrl.getLatestRun);

  const settingsRouter = Router();
  settingsRouter.get('/throttle', settingsCtrl.getThrottleConfig);
  settingsRouter.patch('/throttle', settingsCtrl.updateThrottleConfig);

  router.use('/templates', templateRouter);
  router.use('/rules', ruleRouter);
  router.use('/runner', runnerRouter);
  router.use('/settings', settingsRouter);

  return router;
}

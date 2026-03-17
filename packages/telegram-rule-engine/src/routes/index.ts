import { Router } from 'express';
import { createTemplateController } from '../controllers/template.controller';
import { createRuleController } from '../controllers/rule.controller';
import { createRunnerController } from '../controllers/runner.controller';
import { createSettingsController } from '../controllers/settings.controller';
import { createAnalyticsController } from '../controllers/analytics.controller';
import type { TelegramSendLogModel } from '../schemas/send-log.schema';
import type { TelegramErrorLogModel } from '../schemas/error-log.schema';
import type { TelegramRunLogModel } from '../schemas/run-log.schema';
import type { TelegramThrottleConfigModel } from '../schemas/throttle-config.schema';
import type { TemplateServiceLike } from '../controllers/template.controller';
import type { RuleServiceLike } from '../controllers/rule.controller';
import type { RunnerServiceLike } from '../controllers/runner.controller';
import type { LogAdapter } from '../types/config.types';

export interface RoutesDeps {
  templateService: TemplateServiceLike;
  ruleService: RuleServiceLike;
  runnerService: RunnerServiceLike;
  TelegramSendLog: TelegramSendLogModel;
  TelegramErrorLog: TelegramErrorLogModel;
  TelegramRunLog: TelegramRunLogModel;
  TelegramThrottleConfig: TelegramThrottleConfigModel;
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
  const runnerCtrl = createRunnerController(deps.runnerService, deps.logger);
  const settingsCtrl = createSettingsController(deps.TelegramThrottleConfig);
  const analyticsCtrl = createAnalyticsController(
    deps.TelegramSendLog,
    deps.TelegramErrorLog,
    deps.TelegramRunLog,
    deps.logger
  );

  // Template routes
  const templateRouter = Router();
  templateRouter.get('/', templateCtrl.list);
  templateRouter.post('/', templateCtrl.create);
  templateRouter.get('/:id', templateCtrl.getById);
  templateRouter.put('/:id', templateCtrl.update);
  templateRouter.delete('/:id', templateCtrl.remove);
  templateRouter.post('/:id/preview', templateCtrl.preview);

  // Rule routes
  const ruleRouter = Router();
  ruleRouter.get('/', ruleCtrl.list);
  ruleRouter.post('/', ruleCtrl.create);
  ruleRouter.get('/:id', ruleCtrl.getById);
  ruleRouter.put('/:id', ruleCtrl.update);
  ruleRouter.delete('/:id', ruleCtrl.remove);
  ruleRouter.post('/:id/activate', ruleCtrl.activate);
  ruleRouter.post('/:id/deactivate', ruleCtrl.deactivate);
  ruleRouter.post('/:id/dry-run', ruleCtrl.dryRun);

  // Runner routes
  const runnerRouter = Router();
  runnerRouter.post('/trigger', runnerCtrl.trigger);
  runnerRouter.get('/status/:runId', runnerCtrl.getStatus);
  runnerRouter.post('/cancel/:runId', runnerCtrl.cancel);

  // Analytics routes
  const analyticsRouter = Router();
  analyticsRouter.get('/send-logs', analyticsCtrl.sendLogs);
  analyticsRouter.get('/error-logs', analyticsCtrl.errorLogs);
  analyticsRouter.get('/run-logs', analyticsCtrl.runLogs);
  analyticsRouter.get('/stats', analyticsCtrl.stats);

  // Settings (throttle) — mounted directly on root
  router.get('/settings/throttle', settingsCtrl.getThrottleConfig);
  router.put('/settings/throttle', settingsCtrl.updateThrottleConfig);

  // Mount sub-routers
  router.use('/templates', templateRouter);
  router.use('/rules', ruleRouter);
  router.use('/runner', runnerRouter);
  router.use('/analytics', analyticsRouter);

  return router;
}

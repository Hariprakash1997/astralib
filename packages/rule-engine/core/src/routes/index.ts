import { Router } from 'express';
import { createTemplateController } from '../controllers/template.controller';
import { createRuleController } from '../controllers/rule.controller';
import { createRunnerController } from '../controllers/runner.controller';
import { createSettingsController } from '../controllers/settings.controller';
import { createSendLogController } from '../controllers/send-log.controller';
import { createCollectionController } from '../controllers/collection.controller';
import type { TemplateService } from '../services/template.service';
import type { RuleService } from '../services/rule.service';
import type { RuleRunnerService } from '../services/rule-runner.service';
import type { RunLogModel } from '../schemas/run-log.schema';
import type { SendLogModel } from '../schemas/send-log.schema';
import type { ThrottleConfigModel } from '../schemas/throttle-config.schema';
import type { LogAdapter } from '../types/config.types';
import type { CollectionSchema } from '../types/collection.types';

export interface RoutesDeps {
  templateService: TemplateService;
  ruleService: RuleService;
  runnerService: RuleRunnerService;
  RunLog: RunLogModel;
  SendLog: SendLogModel;
  ThrottleConfig: ThrottleConfigModel;
  platformValues?: string[];
  categoryValues?: string[];
  audienceValues?: string[];
  logger?: LogAdapter;
  collections?: CollectionSchema[];
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
  const runnerCtrl = createRunnerController(deps.runnerService, deps.RunLog, deps.logger);
  const settingsCtrl = createSettingsController(deps.ThrottleConfig);
  const sendLogCtrl = createSendLogController(deps.SendLog);
  const collectionCtrl = createCollectionController(deps.collections || []);

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
  templateRouter.post('/:id/test-send', templateCtrl.sendTest);
  templateRouter.post('/:id/preview-with-data', templateCtrl.previewWithRecipient);
  templateRouter.post('/:id/clone', templateCtrl.clone);

  const ruleRouter = Router();
  ruleRouter.get('/', ruleCtrl.list);
  ruleRouter.post('/', ruleCtrl.create);
  ruleRouter.post('/preview-conditions', ruleCtrl.previewConditions);
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

  const collectionRouter = Router();
  collectionRouter.get('/', collectionCtrl.list);
  collectionRouter.get('/:name/fields', collectionCtrl.getFields);

  router.use('/templates', templateRouter);
  router.use('/rules', ruleRouter);
  router.use('/runner', runnerRouter);
  router.use('/sends', sendLogRouter);
  router.use('/collections', collectionRouter);
  router.get('/throttle', settingsCtrl.getThrottleConfig);
  router.put('/throttle', settingsCtrl.updateThrottleConfig);

  return router;
}

import { Router } from 'express';
import type { createAnalyticsController } from '../controllers/analytics.controller';

type AnalyticsController = ReturnType<typeof createAnalyticsController>;

export function createAnalyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();

  router.get('/overview', controller.getOverview);
  router.get('/timeline', controller.getTimeline);
  router.get('/accounts', controller.getAccountStats);
  router.get('/rules', controller.getRuleStats);
  router.get('/templates', controller.getTemplateStats);
  router.get('/channels', controller.getChannelStats);
  router.post('/track', controller.trackEvent);
  router.post('/aggregate', controller.triggerAggregation);

  return router;
}

import { Router } from 'express';
import type { createAccountController } from '../controllers/account.controller';
import type { createIdentifierController } from '../controllers/identifier.controller';
import type { createApprovalController } from '../controllers/approval.controller';
import type { createSettingsController } from '../controllers/settings.controller';
import type { QueueService } from '../services/queue.service';

interface AdminRoutesDeps {
  accountController: ReturnType<typeof createAccountController>;
  identifierController: ReturnType<typeof createIdentifierController>;
  approvalController: ReturnType<typeof createApprovalController>;
  settingsController: ReturnType<typeof createSettingsController>;
  queueService: QueueService;
}

export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  const {
    accountController,
    identifierController,
    approvalController,
    settingsController,
    queueService,
  } = deps;

  // --- Account routes ---
  router.get('/accounts', accountController.list);
  router.post('/accounts', accountController.create);
  router.get('/accounts/capacity', accountController.getCapacity);
  router.get('/accounts/health', accountController.getHealth);
  router.get('/accounts/warmup', accountController.getWarmupStatus);
  router.patch('/accounts/bulk-update', accountController.bulkUpdate);
  router.get('/accounts/:id', accountController.getById);
  router.put('/accounts/:id', accountController.update);
  router.delete('/accounts/:id', accountController.remove);
  router.post('/accounts/:id/test', accountController.testConnection);
  router.post('/accounts/:id/check-bounces', accountController.checkBounces);
  router.get('/accounts/:id/warmup', accountController.getWarmup);
  router.put('/accounts/:id/warmup/schedule', accountController.updateWarmupSchedule);
  router.post('/accounts/:id/warmup/start', accountController.startWarmup);
  router.post('/accounts/:id/warmup/complete', accountController.completeWarmup);
  router.post('/accounts/:id/warmup/reset', accountController.resetWarmup);
  router.put('/accounts/:id/health/thresholds', accountController.updateHealthThresholds);

  // --- Identifier routes ---
  router.get('/identifiers', identifierController.list);
  router.get('/identifiers/:email', identifierController.getByEmail);
  router.patch('/identifiers/:email/status', identifierController.updateStatus);
  router.post('/identifiers/merge', identifierController.merge);

  // --- Approval/Draft routes ---
  router.get('/drafts', approvalController.getDrafts);
  router.get('/drafts/count', approvalController.countByStatus);
  router.post('/drafts/bulk-approve', approvalController.bulkApprove);
  router.post('/drafts/bulk-reject', approvalController.bulkReject);
  router.get('/drafts/:id', approvalController.getDraftById);
  router.patch('/drafts/:id/approve', approvalController.approve);
  router.patch('/drafts/:id/reject', approvalController.reject);
  router.post('/drafts/:id/send-now', approvalController.sendNow);
  router.patch('/drafts/:id/content', approvalController.updateContent);

  // --- Settings routes ---
  router.get('/settings', settingsController.getSettings);
  router.put('/settings', settingsController.updateSettings);
  router.patch('/settings/timezone', settingsController.updateTimezone);
  router.patch('/settings/dev-mode', settingsController.updateDevMode);
  router.patch('/settings/imap', settingsController.updateImap);
  router.patch('/settings/approval', settingsController.updateApproval);
  router.patch('/settings/queues', settingsController.updateQueues);
  router.patch('/settings/ses', settingsController.updateSes);

  // --- Queue stats ---
  router.get('/queues/stats', async (_req, res) => {
    try {
      const stats = await queueService.getStats();
      res.json({ success: true, data: stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

import { Router } from 'express';
import type { createAccountController } from '../controllers/account.controller';
import type { createIdentifierController } from '../controllers/identifier.controller';
import type { createSessionController } from '../controllers/session.controller';
import type { LogAdapter } from '../types/config.types';

export interface TelegramAccountManagerRouteDeps {
  accountController: ReturnType<typeof createAccountController>;
  identifierController: ReturnType<typeof createIdentifierController>;
  sessionController: ReturnType<typeof createSessionController>;
  logger?: LogAdapter;
}

export function createRoutes(deps: TelegramAccountManagerRouteDeps): Router {
  const router = Router();
  const { accountController, identifierController, sessionController } = deps;

  // --- Account routes ---
  // Static routes BEFORE parameterized routes
  router.post('/accounts/connect-all', accountController.connectAll);
  router.post('/accounts/disconnect-all', accountController.disconnectAll);
  router.get('/accounts/capacity', accountController.getAllCapacity);
  router.get('/accounts/health', accountController.getAllHealth);

  router.get('/accounts', accountController.list);
  router.post('/accounts', accountController.create);
  router.get('/accounts/:id', accountController.getById);
  router.get('/accounts/:id/capacity', accountController.getCapacity);
  router.get('/accounts/:id/health', accountController.getHealth);
  router.put('/accounts/:id', accountController.update);
  router.delete('/accounts/:id', accountController.remove);
  router.post('/accounts/:id/connect', accountController.connect);
  router.post('/accounts/:id/disconnect', accountController.disconnect);
  router.post('/accounts/:id/reconnect', accountController.reconnect);
  router.post('/accounts/:id/quarantine', accountController.quarantine);
  router.post('/accounts/:id/release', accountController.release);
  router.post('/accounts/:id/send', accountController.sendMessage);

  // --- Session routes ---
  router.post('/sessions/request-code', sessionController.requestCode);
  router.post('/sessions/verify-code', sessionController.verifyCode);

  // --- Identifier routes ---
  router.get('/identifiers', identifierController.list);
  router.post('/identifiers', identifierController.create);
  router.get('/identifiers/:id', identifierController.getById);
  router.put('/identifiers/:id', identifierController.update);
  router.put('/identifiers/:id/status', identifierController.updateStatus);
  router.delete('/identifiers/:id', identifierController.remove);

  return router;
}

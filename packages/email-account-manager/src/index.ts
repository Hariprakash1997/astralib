import type { Router } from 'express';
import type { EmailAccountManagerConfig, LogAdapter } from './types/config.types';
import { validateConfig } from './validation/config.schema';
import { createEmailAccountSchema, type EmailAccountModel } from './schemas/email-account.schema';
import { createEmailDailyStatsSchema, type EmailDailyStatsModel } from './schemas/email-daily-stats.schema';
import { createEmailIdentifierSchema, type EmailIdentifierModel } from './schemas/email-identifier.schema';
import { createEmailDraftSchema, type EmailDraftModel } from './schemas/email-draft.schema';
import { createGlobalSettingsSchema, type GlobalSettingsModel } from './schemas/global-settings.schema';
import { SettingsService } from './services/settings.service';
import { IdentifierService } from './services/identifier.service';
import { HealthTracker } from './services/health-tracker';
import { WarmupManager } from './services/warmup-manager';
import { CapacityManager } from './services/capacity-manager';
import { UnsubscribeService } from './services/unsubscribe.service';
import { QueueService } from './services/queue.service';
import { SmtpService } from './services/smtp.service';
import { ApprovalService } from './services/approval.service';
import { ImapBounceChecker } from './services/imap-bounce-checker';
import { SesWebhookHandler } from './services/ses-webhook-handler';
import { createSendProcessor } from './queues/send.queue';
import { createApprovalProcessor } from './queues/approval.queue';
import { createAccountController } from './controllers/account.controller';
import { createIdentifierController } from './controllers/identifier.controller';
import { createApprovalController } from './controllers/approval.controller';
import { createSettingsController } from './controllers/settings.controller';
import { createUnsubscribeController } from './controllers/unsubscribe.controller';
import { createAdminRoutes } from './routes';
import { createSesWebhookRoutes } from './routes/ses-webhook.routes';
import { createUnsubscribeRoutes } from './routes/unsubscribe.routes';

export interface EmailAccountManager {
  routes: Router;
  webhookRoutes: { ses: Router };
  unsubscribeRoutes: Router;

  accounts: {
    model: any;
    create: (data: any) => Promise<any>;
    findById: (id: string) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    remove: (id: string) => Promise<any>;
  };
  capacity: CapacityManager;
  health: HealthTracker;
  warmup: WarmupManager;
  smtp: SmtpService;
  imap: ImapBounceChecker;
  approval: ApprovalService;
  unsubscribe: UnsubscribeService;
  identifiers: IdentifierService;
  queues: QueueService;
  settings: SettingsService;

  destroy(): Promise<void>;
}

const noopLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createEmailAccountManager(
  config: EmailAccountManagerConfig,
): EmailAccountManager {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const hooks = config.hooks;

  const EmailAccount = conn.model<any>(
    `${prefix}EmailAccount`,
    createEmailAccountSchema(),
  ) as EmailAccountModel;

  const EmailDailyStats = conn.model<any>(
    `${prefix}EmailDailyStats`,
    createEmailDailyStatsSchema(),
  ) as EmailDailyStatsModel;

  const EmailIdentifier = conn.model<any>(
    `${prefix}EmailIdentifier`,
    createEmailIdentifierSchema(),
  ) as EmailIdentifierModel;

  const EmailDraft = conn.model<any>(
    `${prefix}EmailDraft`,
    createEmailDraftSchema(),
  ) as EmailDraftModel;

  const GlobalSettings = conn.model<any>(
    `${prefix}GlobalSettings`,
    createGlobalSettingsSchema(),
  ) as GlobalSettingsModel;

  const settingsService = new SettingsService(GlobalSettings, logger);

  const identifierService = new IdentifierService(EmailIdentifier, logger, hooks);

  const healthTracker = new HealthTracker(
    EmailAccount,
    EmailDailyStats,
    settingsService,
    logger,
    hooks,
  );

  const warmupManager = new WarmupManager(EmailAccount, config, logger, hooks);

  const capacityManager = new CapacityManager(
    EmailAccount,
    EmailDailyStats,
    warmupManager,
    settingsService,
    logger,
  );

  const unsubscribeService = new UnsubscribeService(EmailIdentifier, config, logger, hooks);

  const queueService = new QueueService(
    config.redis.connection,
    config,
    settingsService,
    logger,
  );

  const smtpService = new SmtpService(
    EmailAccount,
    capacityManager,
    healthTracker,
    identifierService,
    unsubscribeService,
    queueService,
    settingsService,
    config,
    logger,
    hooks,
  );

  const approvalService = new ApprovalService(
    EmailDraft,
    queueService,
    settingsService,
    logger,
    hooks,
  );

  const imapBounceChecker = new ImapBounceChecker(
    EmailAccount,
    healthTracker,
    identifierService,
    settingsService,
    logger,
    hooks,
  );

  const sesWebhookHandler = new SesWebhookHandler(
    healthTracker,
    identifierService,
    EmailAccount,
    config,
    logger,
    hooks,
  );

  const sendProcessor = createSendProcessor(smtpService, logger);
  const approvalProcessor = createApprovalProcessor(
    EmailDraft,
    smtpService,
    queueService,
    logger,
  );

  queueService.init({ sendProcessor, approvalProcessor }).catch((err) => {
    logger.error('Failed to initialize queues', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });

  if (config.options?.imap?.autoStart !== false) {
    imapBounceChecker.start().catch((err) => {
      logger.error('Failed to start IMAP bounce checker', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  }

  const accountController = createAccountController(
    EmailAccount,
    capacityManager,
    healthTracker,
    warmupManager,
    smtpService,
    imapBounceChecker,
    config,
  );

  const identifierController = createIdentifierController(identifierService);
  const approvalController = createApprovalController(approvalService);
  const settingsController = createSettingsController(settingsService);
  const unsubscribeController = createUnsubscribeController(unsubscribeService);

  const routes = createAdminRoutes({
    accountController,
    identifierController,
    approvalController,
    settingsController,
    queueService,
  });

  const sesWebhookRouter = createSesWebhookRoutes(sesWebhookHandler);
  const unsubscribeRouter = createUnsubscribeRoutes(unsubscribeController);

  const accounts = {
    model: EmailAccount,
    create: (data: any) => EmailAccount.create(data),
    findById: (id: string) => EmailAccount.findById(id),
    update: (id: string, data: any) =>
      EmailAccount.findByIdAndUpdate(id, { $set: data }, { new: true }),
    remove: (id: string) => EmailAccount.findByIdAndDelete(id),
  };

  async function destroy(): Promise<void> {
    imapBounceChecker.stop();
    smtpService.closeAll();
    await queueService.close();
    logger.info('EmailAccountManager destroyed');
  }

  return {
    routes,
    webhookRoutes: { ses: sesWebhookRouter },
    unsubscribeRoutes: unsubscribeRouter,
    accounts,
    capacity: capacityManager,
    health: healthTracker,
    warmup: warmupManager,
    smtp: smtpService,
    imap: imapBounceChecker,
    approval: approvalService,
    unsubscribe: unsubscribeService,
    identifiers: identifierService,
    queues: queueService,
    settings: settingsService,
    destroy,
  };
}

export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.schema';
export * from './schemas';
export { SettingsService } from './services/settings.service';
export { IdentifierService } from './services/identifier.service';
export { HealthTracker } from './services/health-tracker';
export { WarmupManager, type WarmupStatus } from './services/warmup-manager';
export { CapacityManager } from './services/capacity-manager';
export { SmtpService, type SmtpSendParams, type SmtpSendResult } from './services/smtp.service';
export { UnsubscribeService } from './services/unsubscribe.service';
export { QueueService, type QueueStats, type SendJobData, type ApprovalJobData } from './services/queue.service';
export { ApprovalService } from './services/approval.service';
export { ImapBounceChecker } from './services/imap-bounce-checker';
export { SesWebhookHandler, type WebhookProcessResult } from './services/ses-webhook-handler';

import type { Router } from 'express';
import type { TelegramClient } from 'telegram';
import type { TelegramAccountManagerConfig, LogAdapter } from './types/config.types';
import type { ConnectedAccount } from './types/account.types';
import { validateConfig } from './validation/config.schema';
import { createTelegramAccountSchema, type TelegramAccountModel } from './schemas/telegram-account.schema';
import { createTelegramDailyStatsSchema, type TelegramDailyStatsModel } from './schemas/telegram-daily-stats.schema';
import { createTelegramIdentifierSchema, type TelegramIdentifierModel } from './schemas/telegram-identifier.schema';
import { ConnectionService } from './services/connection.service';
import { HealthTracker } from './services/health-tracker';
import { WarmupManager } from './services/warmup-manager';
import { CapacityManager } from './services/capacity-manager';
import { IdentifierService } from './services/identifier.service';
import { QuarantineService } from './services/quarantine.service';
import { createAccountController } from './controllers/account.controller';
import { createIdentifierController } from './controllers/identifier.controller';
import { createRoutes } from './routes';

export interface TelegramAccountManager {
  routes: Router;
  connection: ConnectionService;
  health: HealthTracker;
  warmup: WarmupManager;
  capacity: CapacityManager;
  identifiers: IdentifierService;
  quarantine: QuarantineService;
  models: {
    TelegramAccount: TelegramAccountModel;
    TelegramDailyStats: TelegramDailyStatsModel;
    TelegramIdentifier: TelegramIdentifierModel;
  };
  getClient(accountId: string): TelegramClient | null;
  getConnectedAccounts(): ConnectedAccount[];
  destroy(): Promise<void>;
}

const noopLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createTelegramAccountManager(
  config: TelegramAccountManagerConfig,
): TelegramAccountManager {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const hooks = config.hooks;

  // 1. Create models
  const TelegramAccount = conn.model<any>(
    `${prefix}TelegramAccount`,
    createTelegramAccountSchema(prefix ? { collectionName: `${prefix}telegram_accounts` } : undefined),
  ) as TelegramAccountModel;

  const TelegramDailyStats = conn.model<any>(
    `${prefix}TelegramDailyStats`,
    createTelegramDailyStatsSchema(prefix ? { collectionName: `${prefix}telegram_daily_stats` } : undefined),
  ) as TelegramDailyStatsModel;

  const TelegramIdentifier = conn.model<any>(
    `${prefix}TelegramIdentifier`,
    createTelegramIdentifierSchema(prefix ? { collectionName: `${prefix}telegram_identifiers` } : undefined),
  ) as TelegramIdentifierModel;

  // 2. Create services (dependency order)
  const connectionService = new ConnectionService(TelegramAccount, config, hooks);
  const warmupManager = new WarmupManager(TelegramAccount, config, hooks);
  const quarantineService = new QuarantineService(TelegramAccount, connectionService, config, hooks);
  const healthTracker = new HealthTracker(TelegramAccount, TelegramDailyStats, config, hooks, quarantineService);
  const capacityManager = new CapacityManager(TelegramAccount, TelegramDailyStats, warmupManager, config);
  const identifierService = new IdentifierService(TelegramIdentifier, config);

  // 3. Auto-start monitors
  healthTracker.startMonitor();
  quarantineService.startMonitor();

  // 4. Create controllers
  const accountController = createAccountController(
    TelegramAccount,
    TelegramDailyStats,
    connectionService,
    config,
    logger,
    capacityManager,
    quarantineService,
    healthTracker,
  );

  const identifierController = createIdentifierController(TelegramIdentifier, logger);

  // 5. Create routes
  const routes = createRoutes({ accountController, identifierController, logger });

  // 6. Return manager interface
  async function destroy(): Promise<void> {
    healthTracker.stopMonitor();
    quarantineService.stopMonitor();
    await connectionService.disconnectAll();
    logger.info('TelegramAccountManager destroyed');
  }

  return {
    routes,
    connection: connectionService,
    health: healthTracker,
    warmup: warmupManager,
    capacity: capacityManager,
    identifiers: identifierService,
    quarantine: quarantineService,
    models: { TelegramAccount, TelegramDailyStats, TelegramIdentifier },
    getClient: (id) => connectionService.getClient(id),
    getConnectedAccounts: () => connectionService.getConnectedAccounts(),
    destroy,
  };
}

export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.schema';
export * from './schemas';
export { ConnectionService } from './services/connection.service';
export { HealthTracker } from './services/health-tracker';
export { WarmupManager, type WarmupStatus } from './services/warmup-manager';
export { CapacityManager } from './services/capacity-manager';
export { IdentifierService } from './services/identifier.service';
export { QuarantineService } from './services/quarantine.service';
export { createAccountController } from './controllers/account.controller';
export { createIdentifierController } from './controllers/identifier.controller';
export { createRoutes, type TelegramAccountManagerRouteDeps } from './routes';

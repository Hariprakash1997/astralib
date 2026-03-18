import type { Router } from 'express';
import type TelegramBotApi from 'node-telegram-bot-api';
import { noopLogger } from '@astralibx/core';
import type { TelegramBotConfig, LogAdapter, CommandDef, BotInstance } from './types/config.types';
import { validateConfig } from './validation/config.schema';
import { createTelegramBotContactSchema, type TelegramBotContactModel } from './schemas/telegram-bot-contact.schema';
import { BotService } from './services/bot.service';
import { UserTrackerService } from './services/user-tracker.service';
import { KeyboardBuilder } from './utils/keyboard-builder';
import { createBotController } from './controllers/bot.controller';
import { createRoutes } from './routes';

export interface TelegramBot {
  routes: Router;
  start(): Promise<void>;
  stop(): Promise<void>;
  registerCommand(cmd: CommandDef): void;
  removeCommand(name: string): void;
  tracker: UserTrackerService;
  keyboards: KeyboardBuilder;
  sendMessage(chatId: number | string, text: string, options?: TelegramBotApi.SendMessageOptions): Promise<TelegramBotApi.Message>;
  getBotInfo(): { username: string; id: number } | null;
  isRunning(): boolean;
  models: {
    TelegramBotContact: TelegramBotContactModel;
  };
}

export function createTelegramBot(config: TelegramBotConfig): TelegramBot {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const hooks = config.hooks;

  // 1. Create models
  // conn.model<any> is a standard Mongoose pattern for dynamic model registration
  const modelName = `${prefix}TelegramBotContact`;
  const TelegramBotContact = (conn.models[modelName] || conn.model<any>(
    modelName,
    createTelegramBotContactSchema(prefix ? { collectionName: `${prefix}telegram_bot_contacts` } : undefined),
  )) as TelegramBotContactModel;

  // 2. Create services
  const userTracker = new UserTrackerService(TelegramBotContact, hooks, logger);
  const botService = new BotService(config, TelegramBotContact, userTracker, logger);

  // 3. Create controllers + routes
  const botController = createBotController(botService, userTracker, logger);
  const routes = createRoutes({ botController, logger });

  // 4. Return interface
  // NOTE: bot is NOT auto-started — consumer calls bot.start()
  return {
    routes,
    start: () => botService.start(),
    stop: () => botService.stop(),
    registerCommand: (cmd) => botService.registerCommand(cmd),
    removeCommand: (name) => botService.removeCommand(name),
    tracker: userTracker,
    keyboards: botService.getKeyboards(),
    sendMessage: (chatId, text, options) => botService.sendMessage(chatId, text, options),
    getBotInfo: () => botService.getBotInfo(),
    isRunning: () => botService.isRunning(),
    models: { TelegramBotContact },
  };
}

export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.schema';
export * from './schemas';
export { BotService } from './services/bot.service';
export { UserTrackerService, type TrackingResult, type UserFilters, type Pagination } from './services/user-tracker.service';
export { KeyboardBuilder } from './utils/keyboard-builder';
export { createBotController } from './controllers/bot.controller';
export { createRoutes, type TelegramBotRouteDeps } from './routes';
export { createAccountManagerBridge, type AccountManagerBridge, type AccountManagerLike } from './utils/account-manager-bridge';
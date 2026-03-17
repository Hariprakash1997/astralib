import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type TelegramBot from 'node-telegram-bot-api';

export type { LogAdapter };

export interface CommandDef {
  command: string;
  description: string;
  handler: (msg: TelegramBot.Message, bot: BotInstance) => Promise<void> | void;
}

export interface CallbackDef {
  pattern: RegExp;
  handler: (query: TelegramBot.CallbackQuery, bot: BotInstance) => Promise<void> | void;
}

export interface InlineQueryDef {
  pattern: RegExp;
  handler: (query: TelegramBot.InlineQuery, bot: BotInstance) => Promise<void> | void;
}

export interface MiddlewareFn {
  (msg: TelegramBot.Message, next: () => Promise<void>): Promise<void> | void;
}

export interface BotInstance {
  sendMessage(chatId: number | string, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message>;
  sendPhoto(chatId: number | string, photo: string | Buffer, options?: TelegramBot.SendPhotoOptions): Promise<TelegramBot.Message>;
  sendDocument(chatId: number | string, doc: string | Buffer, options?: TelegramBot.SendDocumentOptions): Promise<TelegramBot.Message>;
  answerCallbackQuery(callbackQueryId: string, options?: TelegramBot.AnswerCallbackQueryOptions): Promise<boolean>;
  answerInlineQuery(inlineQueryId: string, results: TelegramBot.InlineQueryResult[], options?: TelegramBot.AnswerInlineQueryOptions): Promise<boolean>;
  keyboards: KeyboardBuilder;
  raw: TelegramBot;
}

export interface WebhookConfig {
  domain: string;
  path?: string;
  port?: number;
  secretToken?: string;
}

export interface TelegramBotConfig {
  token: string;
  mode: 'polling' | 'webhook';
  webhook?: WebhookConfig;
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };
  commands?: CommandDef[];
  callbacks?: CallbackDef[];
  inlineQueries?: InlineQueryDef[];
  middleware?: MiddlewareFn[];
  logger?: LogAdapter;
  hooks?: {
    onUserStart?: (info: { userId: string; firstName: string; username?: string; chatId: number }) => void;
    onUserBlocked?: (info: { userId: string; chatId: number }) => void;
    onCommand?: (info: { command: string; userId: string; chatId: number }) => void;
    onError?: (info: { error: Error; context: string }) => void;
  };
}

// Forward reference — KeyboardBuilder is defined in utils but referenced in types
import type { KeyboardBuilder } from '../utils/keyboard-builder';
export type { KeyboardBuilder };

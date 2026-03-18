import TelegramBotApi from 'node-telegram-bot-api';
import { noopLogger } from '@astralibx/core';
import type {
  LogAdapter,
  TelegramBotConfig,
  CommandDef,
  CallbackDef,
  InlineQueryDef,
  MiddlewareFn,
  BotInstance,
} from '../types/config.types';
import type { TelegramBotContactModel } from '../schemas/telegram-bot-contact.schema';
import { KeyboardBuilder } from '../utils/keyboard-builder';
import { UserTrackerService } from './user-tracker.service';
import { BotAlreadyRunningError, BotNotRunningError, CommandNotFoundError } from '../errors';
import { DEFAULT_WEBHOOK_PATH, DEFAULT_WEBHOOK_PORT } from '../constants';

export class BotService {
  private bot: TelegramBotApi | null = null;
  private running = false;
  private botInfo: { username: string; id: number } | null = null;
  private startedAt: Date | null = null;
  private commands: CommandDef[];
  private callbacks: CallbackDef[];
  private inlineQueries: InlineQueryDef[];
  private middlewares: MiddlewareFn[];
  private keyboards: KeyboardBuilder;
  private logger: LogAdapter;

  constructor(
    private config: TelegramBotConfig,
    private TelegramBotContact: TelegramBotContactModel,
    private userTracker: UserTrackerService,
    logger?: LogAdapter,
  ) {
    this.commands = [...(config.commands || [])];
    this.callbacks = [...(config.callbacks || [])];
    this.inlineQueries = [...(config.inlineQueries || [])];
    this.middlewares = [...(config.middleware || [])];
    this.keyboards = new KeyboardBuilder();
    this.logger = logger || noopLogger;
  }

  async start(): Promise<void> {
    if (this.running) throw new BotAlreadyRunningError();

    const botOptions: TelegramBotApi.ConstructorOptions = {};

    if (this.config.mode === 'polling') {
      botOptions.polling = true;
    } else {
      botOptions.webHook = {
        port: this.config.webhook?.port || DEFAULT_WEBHOOK_PORT,
      };
    }

    this.bot = new TelegramBotApi(this.config.token, botOptions);

    // Set webhook URL if in webhook mode
    if (this.config.mode === 'webhook' && this.config.webhook) {
      const webhookPath = this.config.webhook.path || DEFAULT_WEBHOOK_PATH;
      const webhookUrl = `${this.config.webhook.domain}${webhookPath}`;
      // node-telegram-bot-api types don't include secret_token yet
      await this.bot.setWebHook(webhookUrl, {
        secret_token: this.config.webhook.secretToken,
      } as any);
      this.logger.info('Webhook set', { url: webhookUrl });
    }

    // Register command handlers
    this.registerCommandHandlers();

    // Register callback handler
    this.registerCallbackHandler();

    // Register inline query handler
    this.registerInlineQueryHandler();

    // Set up error handlers
    this.setupErrorHandlers();

    // Verify connection
    try {
      const me = await this.bot.getMe();
      this.botInfo = {
        username: me.username ? `@${me.username}` : 'unknown',
        id: me.id,
      };
      this.logger.info('Bot started', { username: this.botInfo.username, id: this.botInfo.id, mode: this.config.mode });
    } catch (err) {
      // Cleanup on failure
      if (this.config.mode === 'polling') {
        this.bot.stopPolling();
      } else {
        await this.bot.deleteWebHook();
      }
      this.bot = null;
      throw err;
    }

    this.running = true;
    this.startedAt = new Date();
  }

  async stop(): Promise<void> {
    if (!this.running || !this.bot) throw new BotNotRunningError();

    if (this.config.mode === 'polling') {
      this.bot.stopPolling();
    } else {
      await this.bot.deleteWebHook();
    }

    this.bot.removeAllListeners();
    this.logger.info('Bot stopped', { username: this.botInfo?.username });
    this.running = false;
    this.bot = null;
    this.startedAt = null;
  }

  getBotInfo(): { username: string; id: number } | null {
    return this.botInfo;
  }

  isRunning(): boolean {
    return this.running;
  }

  getUptime(): number {
    if (!this.startedAt) return 0;
    return Date.now() - this.startedAt.getTime();
  }

  getBotInstance(): BotInstance {
    if (!this.bot) throw new BotNotRunningError();

    const bot = this.bot;
    const keyboards = this.keyboards;

    return {
      sendMessage: (chatId, text, options) => bot.sendMessage(chatId, text, options),
      // node-telegram-bot-api types expect Stream | Buffer | string, but our interface narrows to Buffer | string
      sendPhoto: (chatId, photo, options) => bot.sendPhoto(chatId, photo as any, options),
      // node-telegram-bot-api types expect Stream | Buffer | string, but our interface narrows to Buffer | string
      sendDocument: (chatId, doc, options) => bot.sendDocument(chatId, doc as any, options),
      answerCallbackQuery: (id, options) => bot.answerCallbackQuery(id, options),
      answerInlineQuery: (id, results, options) => bot.answerInlineQuery(id, results, options),
      keyboards,
      raw: bot,
    };
  }

  async sendMessage(chatId: number | string, text: string, options?: TelegramBotApi.SendMessageOptions): Promise<TelegramBotApi.Message> {
    if (!this.bot) throw new BotNotRunningError();
    return this.bot.sendMessage(chatId, text, options);
  }

  registerCommand(cmd: CommandDef): void {
    // Remove existing command with same name
    this.commands = this.commands.filter((c) => c.command !== cmd.command);
    this.commands.push(cmd);

    // Register handler on bot if running
    if (this.bot) {
      // Remove old handler for this command pattern to prevent duplicate listeners
      const pattern = new RegExp(`^/${cmd.command}(?:@\\S+)?(?:\\s|$)`);
      // removeTextListener is a real method on node-telegram-bot-api (not in @types)
      (this.bot as any).removeTextListener(pattern);
      this.registerSingleCommand(cmd);
    }

    this.logger.info('Command registered', { command: cmd.command });
  }

  removeCommand(name: string): void {
    const existed = this.commands.some((c) => c.command === name);
    if (!existed) throw new CommandNotFoundError(name);

    this.commands = this.commands.filter((c) => c.command !== name);
    this.logger.info('Command removed', { command: name });
  }

  getKeyboards(): KeyboardBuilder {
    return this.keyboards;
  }

  // --- Private helpers ---

  private registerCommandHandlers(): void {
    for (const cmd of this.commands) {
      this.registerSingleCommand(cmd);
    }
  }

  private registerSingleCommand(cmd: CommandDef): void {
    if (!this.bot) return;

    const pattern = new RegExp(`^/${cmd.command}(?:@\\S+)?(?:\\s|$)`);

    this.bot.onText(pattern, async (msg) => {
      // Run middleware chain
      const shouldContinue = await this.runMiddlewareChain(msg);
      if (!shouldContinue) return;

      // Track user interaction
      if (msg.from && this.botInfo) {
        try {
          await this.userTracker.trackInteraction(msg.from, this.botInfo.username, this.botInfo.id.toString(), msg.chat.id);
        } catch (err) {
          this.logger.error('Failed to track interaction', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Fire onCommand hook
      try {
        this.config.hooks?.onCommand?.({
          command: cmd.command,
          userId: msg.from?.id.toString() || '',
          chatId: msg.chat.id,
        });
      } catch (e) {
        this.logger.error('Hook onCommand error', { error: e instanceof Error ? e.message : String(e) });
      }

      // Call actual handler
      try {
        await cmd.handler(msg, this.getBotInstance());
      } catch (err) {
        this.logger.error('Command handler error', {
          command: cmd.command,
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          this.config.hooks?.onError?.({
            error: err instanceof Error ? err : new Error(String(err)),
            context: `command:${cmd.command}`,
          });
        } catch (_) {}
      }
    });
  }

  private registerCallbackHandler(): void {
    if (!this.bot || this.callbacks.length === 0) return;

    this.bot.on('callback_query', async (query) => {
      if (!query.data) return;

      // Track interaction from callback
      if (query.from && this.botInfo) {
        try {
          await this.userTracker.trackInteraction(query.from, this.botInfo.username, this.botInfo.id.toString(), query.message?.chat.id ?? query.from.id);
        } catch (err) {
          this.logger.error('Failed to track interaction', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Find matching callback handler
      const matched = this.callbacks.find((cb) => cb.pattern.test(query.data!));
      if (!matched) return;

      try {
        await matched.handler(query, this.getBotInstance());
      } catch (err) {
        this.logger.error('Callback handler error', {
          data: query.data,
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          this.config.hooks?.onError?.({
            error: err instanceof Error ? err : new Error(String(err)),
            context: `callback:${query.data}`,
          });
        } catch (_) {}
      }
    });
  }

  private registerInlineQueryHandler(): void {
    if (!this.bot || this.inlineQueries.length === 0) return;

    this.bot.on('inline_query', async (query) => {
      // Track interaction from inline query
      if (query.from && this.botInfo) {
        try {
          await this.userTracker.trackInteraction(query.from, this.botInfo.username, this.botInfo.id.toString(), query.from.id);
        } catch (err) {
          this.logger.error('Failed to track interaction', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Find matching inline query handler
      const matched = this.inlineQueries.find((iq) => iq.pattern.test(query.query));
      if (!matched) return;

      try {
        await matched.handler(query, this.getBotInstance());
      } catch (err) {
        this.logger.error('Inline query handler error', {
          query: query.query,
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          this.config.hooks?.onError?.({
            error: err instanceof Error ? err : new Error(String(err)),
            context: `inline_query:${query.query}`,
          });
        } catch (_) {}
      }
    });
  }

  private setupErrorHandlers(): void {
    if (!this.bot) return;

    this.bot.on('polling_error', (err) => {
      this.logger.error('Polling error', { error: err instanceof Error ? err.message : String(err) });
      try {
        this.config.hooks?.onError?.({
          error: err instanceof Error ? err : new Error(String(err)),
          context: 'polling_error',
        });
      } catch (_) {}
    });

    this.bot.on('webhook_error', (err) => {
      this.logger.error('Webhook error', { error: err instanceof Error ? err.message : String(err) });
      try {
        this.config.hooks?.onError?.({
          error: err instanceof Error ? err : new Error(String(err)),
          context: 'webhook_error',
        });
      } catch (_) {}
    });
  }

  private async runMiddlewareChain(msg: TelegramBotApi.Message): Promise<boolean> {
    if (this.middlewares.length === 0) return true;

    let index = 0;
    let completed = false;

    const createNext = (currentIndex: number): (() => Promise<void>) => {
      let called = false;
      return async (): Promise<void> => {
        if (called) return;
        called = true;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= this.middlewares.length) {
          completed = true;
          return;
        }
        index = nextIndex;
        await this.middlewares[nextIndex](msg, createNext(nextIndex));
      };
    };

    try {
      await this.middlewares[0](msg, createNext(0));
      return completed;
    } catch (err) {
      this.logger.error('Middleware error', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }
}
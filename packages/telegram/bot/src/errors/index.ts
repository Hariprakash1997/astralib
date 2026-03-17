import { AlxError } from '@astralibx/core';

export class AlxTelegramBotError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AlxTelegramBotError';
  }
}

export class BotNotRunningError extends AlxTelegramBotError {
  constructor() {
    super('Bot is not running. Call start() first.', 'BOT_NOT_RUNNING');
    this.name = 'BotNotRunningError';
  }
}

export class BotAlreadyRunningError extends AlxTelegramBotError {
  constructor() {
    super('Bot is already running. Call stop() first.', 'BOT_ALREADY_RUNNING');
    this.name = 'BotAlreadyRunningError';
  }
}

export class ConfigValidationError extends AlxTelegramBotError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class CommandNotFoundError extends AlxTelegramBotError {
  constructor(command: string) {
    super(`Command not found: ${command}`, 'COMMAND_NOT_FOUND');
    this.name = 'CommandNotFoundError';
  }
}

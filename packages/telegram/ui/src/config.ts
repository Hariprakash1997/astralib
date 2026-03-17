export interface AlxTelegramConfigOptions {
  accountManagerApi?: string;
  ruleEngineApi?: string;
  inboxApi?: string;
  botApi?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}

const API_KEY_MAP = {
  accountManager: 'accountManagerApi',
  ruleEngine: 'ruleEngineApi',
  inbox: 'inboxApi',
  bot: 'botApi',
} as const;

/**
 * Global configuration singleton for @astralibx/telegram-ui.
 *
 * Call `AlxTelegramConfig.setup()` once at application startup to configure
 * API base URLs, auth tokens, and theme preferences.
 *
 * @example
 * ```typescript
 * AlxTelegramConfig.setup({
 *   accountManagerApi: '/api/telegram-accounts',
 *   ruleEngineApi: '/api/telegram-rules',
 *   inboxApi: '/api/telegram-inbox',
 *   botApi: '/api/telegram-bot',
 *   authToken: 'Bearer xxx',
 *   theme: 'dark',
 * });
 * ```
 */
export class AlxTelegramConfig {
  private static _options: AlxTelegramConfigOptions = {};

  static setup(options: AlxTelegramConfigOptions): void {
    AlxTelegramConfig._options = { ...options };
  }

  static get(): AlxTelegramConfigOptions {
    return { ...AlxTelegramConfig._options };
  }

  static getApiUrl(key: 'accountManager' | 'ruleEngine' | 'inbox' | 'bot'): string {
    const prop = API_KEY_MAP[key];
    return AlxTelegramConfig._options[prop] ?? '';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (AlxTelegramConfig._options.authToken) {
      headers['Authorization'] = AlxTelegramConfig._options.authToken;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    AlxTelegramConfig._options = { ...AlxTelegramConfig._options, authToken: token };
  }
}

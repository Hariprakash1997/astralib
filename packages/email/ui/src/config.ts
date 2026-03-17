export interface AlxConfigOptions {
  accountManagerApi?: string;
  ruleEngineApi?: string;
  analyticsApi?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}

const API_KEY_MAP = {
  accountManager: 'accountManagerApi',
  ruleEngine: 'ruleEngineApi',
  analytics: 'analyticsApi',
} as const;

/**
 * Global configuration singleton for @astralibx/email-ui.
 *
 * Call `AlxConfig.setup()` once at application startup to configure
 * API base URLs, auth tokens, and theme preferences.
 *
 * @example
 * ```typescript
 * AlxConfig.setup({
 *   accountManagerApi: '/api/email-accounts',
 *   ruleEngineApi: '/api/email-rules',
 *   analyticsApi: '/api/analytics',
 *   authToken: 'Bearer xxx',
 *   theme: 'dark',
 * });
 * ```
 */
export class AlxConfig {
  private static instance: AlxConfigOptions = {};

  static setup(options: AlxConfigOptions): void {
    AlxConfig.instance = { ...options };
  }

  static get(): AlxConfigOptions {
    return { ...AlxConfig.instance };
  }

  static getApiUrl(key: 'accountManager' | 'ruleEngine' | 'analytics'): string {
    const prop = API_KEY_MAP[key];
    return AlxConfig.instance[prop] ?? '';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (AlxConfig.instance.authToken) {
      headers['Authorization'] = AlxConfig.instance.authToken;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    AlxConfig.instance = { ...AlxConfig.instance, authToken: token };
  }
}

export interface AlxConfigOptions {
  apiUrl?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}

/**
 * Global configuration singleton for @astralibx/rule-engine-ui.
 *
 * Call `RuleEngineUIConfig.setup()` once at application startup to configure
 * the API base URL, auth token, and theme preferences.
 *
 * @example
 * ```typescript
 * RuleEngineUIConfig.setup({
 *   apiUrl: '/api/rule-engine',
 *   authToken: 'Bearer xxx',
 *   theme: 'dark',
 * });
 * ```
 */
export class RuleEngineUIConfig {
  private static instance: AlxConfigOptions = {};

  static setup(options: AlxConfigOptions): void {
    RuleEngineUIConfig.instance = { ...options };
  }

  static get(): AlxConfigOptions {
    return { ...RuleEngineUIConfig.instance };
  }

  static getApiUrl(): string {
    return RuleEngineUIConfig.instance.apiUrl ?? '';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (RuleEngineUIConfig.instance.authToken) {
      headers['Authorization'] = RuleEngineUIConfig.instance.authToken;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    RuleEngineUIConfig.instance = { ...RuleEngineUIConfig.instance, authToken: token };
  }
}

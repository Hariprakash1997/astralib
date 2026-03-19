export interface AlxConfigOptions {
  apiUrl?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}

/**
 * Global configuration singleton for @astralibx/rule-engine-ui.
 *
 * Call `AlxConfig.setup()` once at application startup to configure
 * the API base URL, auth token, and theme preferences.
 *
 * @example
 * ```typescript
 * AlxConfig.setup({
 *   apiUrl: '/api/rule-engine',
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

  static getApiUrl(): string {
    return AlxConfig.instance.apiUrl ?? '';
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

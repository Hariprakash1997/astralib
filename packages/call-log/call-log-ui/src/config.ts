export interface CallLogUIConfigOptions {
  callLogApi?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
}

/**
 * Global configuration singleton for @astralibx/call-log-ui.
 *
 * Call `CallLogUIConfig.setup()` once at application startup to configure
 * the API base URL and auth token.
 *
 * @example
 * ```typescript
 * CallLogUIConfig.setup({
 *   callLogApi: '/api/call-log',
 *   authToken: 'Bearer xxx',
 *   theme: 'dark',
 * });
 * ```
 */
export class CallLogUIConfig {
  private static instance: CallLogUIConfigOptions = {};

  static setup(options: CallLogUIConfigOptions): void {
    CallLogUIConfig.instance = { ...options };
  }

  static get(): CallLogUIConfigOptions {
    return { ...CallLogUIConfig.instance };
  }

  static getApiUrl(): string {
    return CallLogUIConfig.instance.callLogApi ?? '';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (CallLogUIConfig.instance.authToken) {
      headers['Authorization'] = CallLogUIConfig.instance.authToken;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    CallLogUIConfig.instance = { ...CallLogUIConfig.instance, authToken: token };
  }
}

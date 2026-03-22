export interface AlxStaffConfigOptions {
  staffApi?: string;
  authToken?: string;
}

/**
 * Global configuration singleton for @astralibx/staff-ui.
 *
 * Call `AlxStaffConfig.setup()` once at application startup to configure
 * the staff API base URL and auth token.
 *
 * @example
 * ```typescript
 * AlxStaffConfig.setup({
 *   staffApi: '/api/staff',
 *   authToken: 'Bearer xxx',
 * });
 * ```
 */
export class AlxStaffConfig {
  private static instance: AlxStaffConfigOptions = {};

  static setup(options: AlxStaffConfigOptions): void {
    AlxStaffConfig.instance = { ...options };
  }

  static get(): AlxStaffConfigOptions {
    return { ...AlxStaffConfig.instance };
  }

  static getApiUrl(): string {
    return AlxStaffConfig.instance.staffApi ?? '';
  }

  static getAuthToken(): string {
    return AlxStaffConfig.instance.authToken ?? '';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (AlxStaffConfig.instance.authToken) {
      headers['Authorization'] = `Bearer ${AlxStaffConfig.instance.authToken}`;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    AlxStaffConfig.instance = { ...AlxStaffConfig.instance, authToken: token };
  }
}

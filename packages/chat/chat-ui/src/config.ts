export interface AlxChatConfigOptions {
  chatEngineApi?: string;
  chatAiApi?: string;
  socketUrl?: string;
  agentNamespace?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}

const API_KEY_MAP = {
  chatEngine: 'chatEngineApi',
  chatAi: 'chatAiApi',
} as const;

/**
 * Global configuration singleton for @astralibx/chat-ui.
 *
 * Call `AlxChatConfig.setup()` once at application startup to configure
 * API base URLs, Socket.IO URL, auth tokens, and theme preferences.
 *
 * @example
 * ```typescript
 * AlxChatConfig.setup({
 *   chatEngineApi: '/api/chat',
 *   chatAiApi: '/api/chat-ai',
 *   socketUrl: 'wss://chat.example.com',
 *   agentNamespace: '/agent',
 *   authToken: 'Bearer xxx',
 *   theme: 'dark',
 * });
 * ```
 */
export class AlxChatConfig {
  private static instance: AlxChatConfigOptions = {};

  static setup(options: AlxChatConfigOptions): void {
    AlxChatConfig.instance = { ...options };
  }

  static get(): AlxChatConfigOptions {
    return { ...AlxChatConfig.instance };
  }

  static getApiUrl(key: 'chatEngine' | 'chatAi'): string {
    const prop = API_KEY_MAP[key];
    return AlxChatConfig.instance[prop] ?? '';
  }

  static getSocketUrl(): string {
    return AlxChatConfig.instance.socketUrl ?? '';
  }

  static getAgentNamespace(): string {
    return AlxChatConfig.instance.agentNamespace ?? '/agent';
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (AlxChatConfig.instance.authToken) {
      headers['Authorization'] = AlxChatConfig.instance.authToken;
    }
    return headers;
  }

  static setAuthToken(token: string): void {
    AlxChatConfig.instance = { ...AlxChatConfig.instance, authToken: token };
  }
}

const STORAGE_PREFIX = 'alx-chat:';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredSession {
  sessionId: string;
  visitorId: string;
  createdAt: number;
}

/**
 * Manages localStorage and sessionStorage for the chat widget.
 *
 * - localStorage: session ID (with 24h TTL), visitor ID (persistent), preferences
 * - sessionStorage: widget UI state (open/closed, sound enabled)
 */
export class ChatStorageManager {
  private readonly prefix: string;

  constructor(channel: string) {
    this.prefix = `${STORAGE_PREFIX}${channel}:`;
  }

  // -- Visitor ID (persistent in localStorage) --

  getVisitorId(): string {
    const key = `${this.prefix}visitorId`;
    let visitorId = this.localGet(key);
    if (!visitorId) {
      visitorId = this.generateId();
      this.localSet(key, visitorId);
    }
    return visitorId;
  }

  // -- Session ID (localStorage with TTL) --

  getSessionId(): string | null {
    const key = `${this.prefix}session`;
    const raw = this.localGet(key);
    if (!raw) return null;

    try {
      const stored: StoredSession = JSON.parse(raw);
      const visitorId = this.getVisitorId();

      // Validate TTL and visitor match
      if (
        stored.visitorId !== visitorId ||
        Date.now() - stored.createdAt > SESSION_TTL_MS
      ) {
        this.clearSession();
        return null;
      }
      return stored.sessionId;
    } catch {
      this.clearSession();
      return null;
    }
  }

  setSessionId(sessionId: string): void {
    const key = `${this.prefix}session`;
    const stored: StoredSession = {
      sessionId,
      visitorId: this.getVisitorId(),
      createdAt: Date.now(),
    };
    this.localSet(key, JSON.stringify(stored));
  }

  clearSession(): void {
    this.localRemove(`${this.prefix}session`);
  }

  // -- UI State (sessionStorage) --

  getWidgetOpen(): boolean {
    return this.sessionGet(`${this.prefix}open`) === 'true';
  }

  setWidgetOpen(open: boolean): void {
    this.sessionSet(`${this.prefix}open`, String(open));
  }

  getSoundEnabled(): boolean {
    const val = this.sessionGet(`${this.prefix}sound`);
    return val === null ? true : val === 'true';
  }

  setSoundEnabled(enabled: boolean): void {
    this.sessionSet(`${this.prefix}sound`, String(enabled));
  }

  // -- Preferences (localStorage) --

  getPreferences(): Record<string, unknown> {
    const raw = this.localGet(`${this.prefix}preferences`);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  setPreferences(prefs: Record<string, unknown>): void {
    this.localSet(`${this.prefix}preferences`, JSON.stringify(prefs));
  }

  // -- Helpers --

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private localGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private localSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked
    }
  }

  private localRemove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Blocked
    }
  }

  private sessionGet(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private sessionSet(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Storage full or blocked
    }
  }
}

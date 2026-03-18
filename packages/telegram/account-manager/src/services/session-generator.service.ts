import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '../types/config.types';

interface PendingSession {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  createdAt: Date;
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_EXPIRE_MS = 10 * 60 * 1000;

export class SessionGeneratorService {
  private pendingSessions = new Map<string, PendingSession>();
  private logger: LogAdapter;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private apiId: number,
    private apiHash: string,
    logger?: LogAdapter,
  ) {
    this.logger = logger || noopLogger;
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupInterval.unref();
  }

  async requestCode(phone: string): Promise<{ phoneCodeHash: string }> {
    // Disconnect any existing pending session for this phone
    const existing = this.pendingSessions.get(phone);
    if (existing) {
      try { await existing.client.disconnect(); } catch {}
      this.pendingSessions.delete(phone);
    }

    const client = new TelegramClient(
      new StringSession(''),
      this.apiId,
      this.apiHash,
      { connectionRetries: 5, retryDelay: 1000 },
    );

    try {
      await client.connect();
      const result = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber: phone,
          apiId: this.apiId,
          apiHash: this.apiHash,
          settings: new Api.CodeSettings({
            allowFlashcall: false,
            currentNumber: false,
            allowAppHash: false,
            allowMissedCall: false,
            allowFirebase: false,
          }),
        }),
      );

      if (!('phoneCodeHash' in result)) {
        await client.disconnect();
        throw new Error('Unexpected response from SendCode — already logged in or invalid state');
      }

      const phoneCodeHash = result.phoneCodeHash;

      this.pendingSessions.set(phone, {
        client,
        phone,
        phoneCodeHash,
        createdAt: new Date(),
      });

      this.logger.info('Auth code sent', { phone });
      return { phoneCodeHash };
    } catch (error: unknown) {
      try { await client.disconnect(); } catch {}

      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('PHONE_NUMBER_INVALID')) {
        throw new Error('Invalid phone number format. Use international format: +919876543210');
      }
      if (errMsg.includes('PHONE_NUMBER_BANNED')) {
        throw new Error('This phone number is banned from Telegram');
      }
      if (errMsg.includes('PHONE_NUMBER_FLOOD')) {
        throw new Error('Too many attempts. Please wait before trying again');
      }

      throw error;
    }
  }

  async verifyCode(
    phone: string,
    code: string,
    phoneCodeHash: string,
    password?: string,
  ): Promise<{ session: string }> {
    const pending = this.pendingSessions.get(phone);
    if (!pending) {
      throw new Error('No pending session. Please request OTP first.');
    }

    const { client } = pending;

    try {
      try {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: phone,
            phoneCodeHash,
            phoneCode: code,
          }),
        );
      } catch (signInError: unknown) {
        const signInMsg = signInError instanceof Error ? signInError.message : String(signInError);
        if (signInMsg.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            throw new Error('2FA password required. Please provide the password parameter.');
          }

          const passwordInfo = await client.invoke(new Api.account.GetPassword());
          const { computeCheck } = await import('telegram/Password');
          const srpResult = await computeCheck(passwordInfo, password);

          await client.invoke(
            new Api.auth.CheckPassword({ password: srpResult }),
          );
        } else if (signInMsg.includes('PHONE_CODE_INVALID')) {
          throw new Error('Invalid OTP code. Please check and try again.');
        } else if (signInMsg.includes('PHONE_CODE_EXPIRED')) {
          this.pendingSessions.delete(phone);
          throw new Error('OTP expired. Please request a new code.');
        } else {
          throw signInError;
        }
      }

      const session = client.session.save() as unknown as string;

      try { await client.disconnect(); } catch {}
      this.pendingSessions.delete(phone);

      this.logger.info('Session generated successfully', { phone });
      return { session };
    } catch (error: unknown) {
      try { await pending.client.disconnect(); } catch {}
      this.pendingSessions.delete(phone);

      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('PASSWORD_HASH_INVALID')) {
        throw new Error('Invalid 2FA password');
      }

      throw error;
    }
  }

  async cancelPending(phone: string): Promise<void> {
    const pending = this.pendingSessions.get(phone);
    if (pending) {
      try { await pending.client.disconnect(); } catch {}
      this.pendingSessions.delete(phone);
      this.logger.info('Pending session cancelled', { phone });
    }
  }

  getPendingCount(): number {
    return this.pendingSessions.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [phone, pending] of this.pendingSessions) {
      if (now - pending.createdAt.getTime() > SESSION_EXPIRE_MS) {
        pending.client.disconnect().catch(() => {});
        this.pendingSessions.delete(phone);
        this.logger.info('Expired pending session cleaned up', { phone });
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [, pending] of this.pendingSessions) {
      try { await pending.client.disconnect(); } catch {}
    }
    this.pendingSessions.clear();
  }
}

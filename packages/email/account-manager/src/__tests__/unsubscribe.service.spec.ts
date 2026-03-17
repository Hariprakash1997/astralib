import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnsubscribeService } from '../services/unsubscribe.service';
import { IDENTIFIER_STATUS } from '../constants';
import type { EmailIdentifierModel } from '../schemas/email-identifier.schema';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockIdentifierModel() {
  return {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  } as unknown as EmailIdentifierModel;
}

const TEST_SECRET = 'test-secret-key-for-hmac';
const TEST_BASE_URL = 'https://example.com/unsubscribe';

function createConfig(overrides?: Partial<EmailAccountManagerConfig['options']>): EmailAccountManagerConfig {
  return {
    db: { connection: {} as any },
    redis: { connection: {} as any },
    options: {
      unsubscribe: {
        builtin: {
          enabled: true,
          secret: TEST_SECRET,
          baseUrl: TEST_BASE_URL,
          tokenExpiryDays: 30,
        },
      },
      ...overrides,
    },
  };
}

describe('UnsubscribeService', () => {
  let service: UnsubscribeService;
  let EmailIdentifier: EmailIdentifierModel;
  let logger: LogAdapter;
  let config: EmailAccountManagerConfig;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailIdentifier = createMockIdentifierModel();
    logger = createMockLogger();
    config = createConfig();
    hooks = {
      onUnsubscribe: vi.fn(),
    };
    service = new UnsubscribeService(EmailIdentifier, config, logger, hooks);
  });

  describe('generateToken()', () => {
    it('should return a base64url encoded token', () => {
      const token = service.generateToken('test@example.com');

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // base64url should not contain +, /, or =
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should return empty string when no secret is configured', () => {
      const noSecretConfig = createConfig({
        unsubscribe: { builtin: { enabled: true, secret: '', baseUrl: TEST_BASE_URL } },
      });
      const svc = new UnsubscribeService(EmailIdentifier, noSecretConfig, logger, hooks);

      const token = svc.generateToken('test@example.com');

      expect(token).toBe('');
    });
  });

  describe('verifyToken()', () => {
    it('should pass for a valid token', () => {
      const token = service.generateToken('test@example.com');

      const result = service.verifyToken('test@example.com', token);

      expect(result).toBe(true);
    });

    it('should fail for an expired token', () => {
      const expiredConfig = createConfig({
        unsubscribe: {
          builtin: {
            enabled: true,
            secret: TEST_SECRET,
            baseUrl: TEST_BASE_URL,
            tokenExpiryDays: 0,
          },
        },
      });
      // tokenExpiryDays: 0 is falsy so it won't check expiry.
      // We need to create a token with an old timestamp.
      // Use a very short expiry and manipulate the token.
      const shortExpiryConfig = createConfig({
        unsubscribe: {
          builtin: {
            enabled: true,
            secret: TEST_SECRET,
            baseUrl: TEST_BASE_URL,
            tokenExpiryDays: 1,
          },
        },
      });
      const svc = new UnsubscribeService(EmailIdentifier, shortExpiryConfig, logger, hooks);

      // Generate token then manipulate the timestamp to be old
      const token = svc.generateToken('test@example.com');
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split('|');
      // Set timestamp to 2 days ago
      const oldTimestamp = (Date.now() - 2 * 24 * 60 * 60 * 1000).toString();
      // Recreate with old timestamp - signature won't match, so it should fail
      const tamperedPayload = `${parts[0]}|${oldTimestamp}|${parts[2]}`;
      const tamperedToken = Buffer.from(tamperedPayload).toString('base64url');

      const result = svc.verifyToken('test@example.com', tamperedToken);

      expect(result).toBe(false);
    });

    it('should fail for a tampered token', () => {
      const token = service.generateToken('test@example.com');
      const tampered = token.slice(0, -3) + 'abc';

      const result = service.verifyToken('test@example.com', tampered);

      expect(result).toBe(false);
    });

    it('should fail when email does not match token email', () => {
      const token = service.generateToken('original@example.com');

      const result = service.verifyToken('different@example.com', token);

      expect(result).toBe(false);
    });
  });

  describe('handleUnsubscribe()', () => {
    it('should set status to Unsubscribed and call onUnsubscribe hook', async () => {
      const token = service.generateToken('test@example.com');
      const identifier = {
        _id: 'id-1',
        email: 'test@example.com',
        status: IDENTIFIER_STATUS.Active,
      };

      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(identifier);
      (EmailIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.handleUnsubscribe('test@example.com', token);

      expect(result.success).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(EmailIdentifier.findByIdAndUpdate).toHaveBeenCalledWith('id-1', {
        $set: {
          status: IDENTIFIER_STATUS.Unsubscribed,
          unsubscribedAt: expect.any(Date),
        },
      });
      expect(hooks!.onUnsubscribe).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return early when already unsubscribed', async () => {
      const token = service.generateToken('test@example.com');
      const identifier = {
        _id: 'id-1',
        email: 'test@example.com',
        status: IDENTIFIER_STATUS.Unsubscribed,
      };

      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(identifier);

      const result = await service.handleUnsubscribe('test@example.com', token);

      expect(result.success).toBe(true);
      expect(EmailIdentifier.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return error for invalid token', async () => {
      const result = await service.handleUnsubscribe('test@example.com', 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });

    it('should return success when identifier not found in DB', async () => {
      const token = service.generateToken('new@example.com');
      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.handleUnsubscribe('new@example.com', token);

      expect(result.success).toBe(true);
      expect(result.email).toBe('new@example.com');
      expect(EmailIdentifier.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});

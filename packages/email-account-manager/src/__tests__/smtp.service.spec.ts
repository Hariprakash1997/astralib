import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmtpService } from '../services/smtp.service';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { CapacityManager } from '../services/capacity-manager';
import type { HealthTracker } from '../services/health-tracker';
import type { IdentifierService } from '../services/identifier.service';
import type { UnsubscribeService } from '../services/unsubscribe.service';
import type { QueueService } from '../services/queue.service';
import type { SettingsService } from '../services/settings.service';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockSettings(): SettingsService {
  return {
    get: vi.fn().mockResolvedValue({
      approval: { enabled: false },
      devMode: { enabled: false, testEmails: [] },
    }),
  } as unknown as SettingsService;
}

function createMockCapacityManager(): CapacityManager {
  return {
    getBestAccount: vi.fn(),
  } as unknown as CapacityManager;
}

function createMockHealthTracker(): HealthTracker {
  return {
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
  } as unknown as HealthTracker;
}

function createMockIdentifierService(): IdentifierService {
  return {
    incrementSentCount: vi.fn(),
  } as unknown as IdentifierService;
}

function createMockUnsubscribeService(): UnsubscribeService {
  return {
    generateUrl: vi.fn().mockReturnValue('https://example.com/unsubscribe?token=abc'),
  } as unknown as UnsubscribeService;
}

function createMockQueueService(): QueueService {
  return {
    enqueueSend: vi.fn().mockResolvedValue('job-123'),
  } as unknown as QueueService;
}

function createMockEmailAccount() {
  return {
    findById: vi.fn(),
  } as unknown as EmailAccountModel;
}

describe('SmtpService', () => {
  let service: SmtpService;
  let EmailAccount: EmailAccountModel;
  let capacityManager: CapacityManager;
  let healthTracker: HealthTracker;
  let identifierService: IdentifierService;
  let unsubscribeService: UnsubscribeService;
  let queueService: QueueService;
  let settings: SettingsService;
  let logger: LogAdapter;
  let config: EmailAccountManagerConfig;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailAccount = createMockEmailAccount();
    capacityManager = createMockCapacityManager();
    healthTracker = createMockHealthTracker();
    identifierService = createMockIdentifierService();
    unsubscribeService = createMockUnsubscribeService();
    queueService = createMockQueueService();
    settings = createMockSettings();
    logger = createMockLogger();
    config = {
      db: { connection: {} as any },
      redis: { connection: {} as any },
    };
    hooks = {
      onSend: vi.fn(),
      onSendError: vi.fn(),
    };
    service = new SmtpService(
      EmailAccount,
      capacityManager,
      healthTracker,
      identifierService,
      unsubscribeService,
      queueService,
      settings,
      config,
      logger,
      hooks,
    );
  });

  describe('send()', () => {
    it('should use explicit accountId when provided', async () => {
      const account = { _id: 'acc-explicit', email: 'sender@test.com' };
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.send({
        accountId: 'acc-explicit',
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(EmailAccount.findById).toHaveBeenCalledWith('acc-explicit');
      expect(capacityManager.getBestAccount).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('job-123');
    });

    it('should call capacityManager.getBestAccount() when no accountId', async () => {
      const account = { _id: 'acc-best', email: 'best@test.com' };
      (capacityManager.getBestAccount as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.send({
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(capacityManager.getBestAccount).toHaveBeenCalled();
      expect(EmailAccount.findById).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should return error when no available account', async () => {
      (capacityManager.getBestAccount as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.send({
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No available email account');
    });

    it('should return success with messageId from queue', async () => {
      const account = { _id: 'acc-1', email: 'sender@test.com' };
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.send({
        accountId: 'acc-1',
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('job-123');
      expect(queueService.enqueueSend).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-1',
          to: 'recipient@test.com',
          subject: 'Test',
          html: '<p>Hello</p>',
        }),
      );
    });

    it('should return draftId when approval is enabled', async () => {
      (settings.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        approval: { enabled: true },
        devMode: { enabled: false, testEmails: [] },
      });

      const result = await service.send({
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
      expect(result.draftId).toBe('approval-required');
      expect(queueService.enqueueSend).not.toHaveBeenCalled();
    });
  });
});

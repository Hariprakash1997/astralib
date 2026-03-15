import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentifierService } from '../services/identifier.service';
import { IDENTIFIER_STATUS, BOUNCE_TYPE } from '../constants';
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
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  } as unknown as EmailIdentifierModel;
}

describe('IdentifierService', () => {
  let service: IdentifierService;
  let EmailIdentifier: EmailIdentifierModel;
  let logger: LogAdapter;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailIdentifier = createMockIdentifierModel();
    logger = createMockLogger();
    hooks = {
      onBounce: vi.fn(),
      onUnsubscribe: vi.fn(),
    };
    service = new IdentifierService(EmailIdentifier, logger, hooks);
  });

  describe('findOrCreate()', () => {
    it('should create new identifier with Active status if not found', async () => {
      const doc = { email: 'test@example.com', status: IDENTIFIER_STATUS.Active, sentCount: 0, bounceCount: 0 };
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findOrCreate('Test@Example.com');

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        {
          $setOnInsert: {
            email: 'test@example.com',
            status: IDENTIFIER_STATUS.Active,
            sentCount: 0,
            bounceCount: 0,
          },
        },
        { upsert: true, new: true },
      );
      expect(result).toEqual(doc);
    });

    it('should return existing identifier if found', async () => {
      const existing = { email: 'test@example.com', status: IDENTIFIER_STATUS.Active, sentCount: 5 };
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await service.findOrCreate('test@example.com');

      expect(result).toEqual(existing);
    });
  });

  describe('findById()', () => {
    it('should return document when found by ID', async () => {
      const doc = { _id: 'id-123', email: 'test@example.com', status: IDENTIFIER_STATUS.Active };
      (EmailIdentifier.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findById('id-123');

      expect(EmailIdentifier.findById).toHaveBeenCalledWith('id-123');
      expect(result).toEqual(doc);
    });

    it('should return null when not found by ID', async () => {
      (EmailIdentifier.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('should return document when found', async () => {
      const doc = { email: 'test@example.com', status: IDENTIFIER_STATUS.Active };
      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findByEmail('Test@Example.com');

      expect(EmailIdentifier.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('markBounced()', () => {
    it('should set status to Bounced, set bounceType, and increment bounceCount', async () => {
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.markBounced('Test@Example.com', BOUNCE_TYPE.Hard);

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        {
          $set: {
            status: IDENTIFIER_STATUS.Bounced,
            bounceType: BOUNCE_TYPE.Hard,
            lastBouncedAt: expect.any(Date),
          },
          $inc: { bounceCount: 1 },
        },
        { upsert: true },
      );
      expect(logger.warn).toHaveBeenCalledWith('Identifier marked bounced', {
        email: 'test@example.com',
        bounceType: BOUNCE_TYPE.Hard,
      });
    });

    it('should call onBounce hook', async () => {
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.markBounced('test@example.com', BOUNCE_TYPE.Soft);

      expect(hooks!.onBounce).toHaveBeenCalledWith({
        accountId: '',
        email: 'test@example.com',
        bounceType: BOUNCE_TYPE.Soft,
        provider: '',
      });
    });
  });

  describe('markUnsubscribed()', () => {
    it('should set status to Unsubscribed and set unsubscribedAt', async () => {
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.markUnsubscribed('Test@Example.com');

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        {
          $set: {
            status: IDENTIFIER_STATUS.Unsubscribed,
            unsubscribedAt: expect.any(Date),
          },
        },
        { upsert: true },
      );
      expect(logger.info).toHaveBeenCalledWith('Identifier marked unsubscribed', { email: 'test@example.com' });
      expect(hooks!.onUnsubscribe).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('updateStatus()', () => {
    it('should update the status field', async () => {
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.updateStatus('test@example.com', IDENTIFIER_STATUS.Blocked);

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { $set: { status: IDENTIFIER_STATUS.Blocked } },
      );
    });
  });

  describe('incrementSentCount()', () => {
    it('should increment sentCount and update lastSentAt', async () => {
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.incrementSentCount('Test@Example.com');

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        {
          $inc: { sentCount: 1 },
          $set: { lastSentAt: expect.any(Date) },
        },
      );
    });
  });

  describe('merge()', () => {
    it('should combine sentCount and bounceCount from source to target', async () => {
      const source = {
        _id: 'src-id',
        email: 'old@example.com',
        sentCount: 10,
        bounceCount: 2,
        lastSentAt: new Date('2025-06-01'),
        metadata: { tag: 'old' },
      };
      const target = {
        _id: 'tgt-id',
        email: 'new@example.com',
        sentCount: 5,
        bounceCount: 1,
        lastSentAt: new Date('2025-01-01'),
        metadata: { campaign: 'v2' },
      };

      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(target);
      (EmailIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (EmailIdentifier.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.merge('old@example.com', 'new@example.com');

      expect(EmailIdentifier.findByIdAndUpdate).toHaveBeenCalledWith('tgt-id', {
        $inc: { sentCount: 10, bounceCount: 2 },
        $set: expect.objectContaining({
          lastSentAt: source.lastSentAt,
          metadata: { tag: 'old', campaign: 'v2' },
        }),
      });
      expect(EmailIdentifier.findByIdAndDelete).toHaveBeenCalledWith('src-id');
      expect(logger.info).toHaveBeenCalledWith('Identifiers merged', {
        sourceEmail: 'old@example.com',
        targetEmail: 'new@example.com',
      });
    });

    it('should rename source when target does not exist', async () => {
      const source = { _id: 'src-id', email: 'old@example.com', sentCount: 5, bounceCount: 0 };

      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(null);
      (EmailIdentifier.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.merge('old@example.com', 'new@example.com');

      expect(EmailIdentifier.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'old@example.com' },
        { $set: { email: 'new@example.com' } },
      );
    });

    it('should log warning and return early when source not found', async () => {
      (EmailIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await service.merge('nonexistent@example.com', 'target@example.com');

      expect(logger.warn).toHaveBeenCalledWith('Merge source not found', { sourceEmail: 'nonexistent@example.com' });
      expect(EmailIdentifier.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});

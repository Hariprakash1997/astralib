import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentifierService } from '../services/identifier.service';
import { IDENTIFIER_STATUS } from '../constants';
import type { TelegramIdentifierModel } from '../schemas/telegram-identifier.schema';
import type { TelegramAccountManagerConfig } from '../types/config.types';

function createMockConfig(): TelegramAccountManagerConfig {
  return {
    db: { connection: {} as any },
    credentials: { apiId: 12345, apiHash: 'abc123' },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

function createMockIdentifierModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
    addKnownAccount: vi.fn(),
  } as unknown as TelegramIdentifierModel;
}

describe('IdentifierService', () => {
  let service: IdentifierService;
  let TelegramIdentifier: TelegramIdentifierModel;
  let config: TelegramAccountManagerConfig;

  beforeEach(() => {
    TelegramIdentifier = createMockIdentifierModel();
    config = createMockConfig();
    service = new IdentifierService(TelegramIdentifier, config);
  });

  describe('create()', () => {
    it('should create new identifier with Active status and defaults', async () => {
      const input = { telegramUserId: '12345', contactId: 'contact-1', username: 'testuser' };
      const createdDoc = { ...input, status: IDENTIFIER_STATUS.Active, sentCount: 0, knownByAccounts: [] };
      (TelegramIdentifier.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      const result = await service.create(input);

      expect(TelegramIdentifier.create).toHaveBeenCalledWith({
        ...input,
        status: IDENTIFIER_STATUS.Active,
        sentCount: 0,
        knownByAccounts: [],
      });
      expect(result).toEqual(createdDoc);
    });

    it('should log creation with telegramUserId and contactId', async () => {
      const input = { telegramUserId: '12345', contactId: 'contact-1' };
      (TelegramIdentifier.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ...input });

      await service.create(input);

      expect(config.logger!.info).toHaveBeenCalledWith('Identifier created', {
        telegramUserId: '12345',
        contactId: 'contact-1',
      });
    });
  });

  describe('findById()', () => {
    it('should return document when found by ID', async () => {
      const doc = { _id: 'id-123', telegramUserId: '12345', status: IDENTIFIER_STATUS.Active };
      (TelegramIdentifier.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findById('id-123');

      expect(TelegramIdentifier.findById).toHaveBeenCalledWith('id-123');
      expect(result).toEqual(doc);
    });

    it('should return null when not found by ID', async () => {
      (TelegramIdentifier.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByTelegramUserId()', () => {
    it('should return document when found', async () => {
      const doc = { telegramUserId: '12345', status: IDENTIFIER_STATUS.Active };
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findByTelegramUserId('12345');

      expect(TelegramIdentifier.findOne).toHaveBeenCalledWith({ telegramUserId: '12345' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findByTelegramUserId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByContactId()', () => {
    it('should return document when found', async () => {
      const doc = { contactId: 'contact-1', telegramUserId: '12345', status: IDENTIFIER_STATUS.Active };
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findByContactId('contact-1');

      expect(TelegramIdentifier.findOne).toHaveBeenCalledWith({ contactId: 'contact-1' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findByContactId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByPhone()', () => {
    it('should return document when found', async () => {
      const doc = { phone: '+1234567890', telegramUserId: '12345', status: IDENTIFIER_STATUS.Active };
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.findByPhone('+1234567890');

      expect(TelegramIdentifier.findOne).toHaveBeenCalledWith({ phone: '+1234567890' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramIdentifier.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findByPhone('+0000000000');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    it('should update fields using $set', async () => {
      const updatedDoc = { _id: 'id-1', username: 'newname', firstName: 'New' };
      (TelegramIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.update('id-1', { username: 'newname', firstName: 'New' });

      expect(TelegramIdentifier.findByIdAndUpdate).toHaveBeenCalledWith(
        'id-1',
        { $set: { username: 'newname', firstName: 'New' } },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should log on successful update', async () => {
      (TelegramIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.update('id-1', { username: 'test' });

      expect(config.logger!.info).toHaveBeenCalledWith('Identifier updated', { id: 'id-1' });
    });

    it('should return null when identifier not found', async () => {
      (TelegramIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.update('nonexistent', { username: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('should update the status field', async () => {
      const updatedDoc = { _id: 'id-1', status: IDENTIFIER_STATUS.Blocked };
      (TelegramIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.updateStatus('id-1', IDENTIFIER_STATUS.Blocked);

      expect(TelegramIdentifier.findByIdAndUpdate).toHaveBeenCalledWith(
        'id-1',
        { $set: { status: IDENTIFIER_STATUS.Blocked } },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });
  });

  describe('addKnownAccount()', () => {
    it('should use addKnownAccount static method (uses $addToSet)', async () => {
      const updatedDoc = { _id: 'id-1', knownByAccounts: ['acc-1'] };
      (TelegramIdentifier.addKnownAccount as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.addKnownAccount('id-1', 'acc-1');

      expect(TelegramIdentifier.addKnownAccount).toHaveBeenCalledWith('id-1', 'acc-1');
      expect(result).toEqual(updatedDoc);
    });
  });

  describe('incrementSentCount()', () => {
    it('should increment sentCount and update lastActiveAt', async () => {
      (TelegramIdentifier.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.incrementSentCount('id-1');

      expect(TelegramIdentifier.findByIdAndUpdate).toHaveBeenCalledWith('id-1', {
        $inc: { sentCount: 1 },
        $set: { lastActiveAt: expect.any(Date) },
      });
    });
  });

  describe('delete()', () => {
    it('should delete and return true when found', async () => {
      (TelegramIdentifier.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      const result = await service.delete('id-1');

      expect(TelegramIdentifier.findByIdAndDelete).toHaveBeenCalledWith('id-1');
      expect(result).toBe(true);
    });

    it('should log on successful deletion', async () => {
      (TelegramIdentifier.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.delete('id-1');

      expect(config.logger!.info).toHaveBeenCalledWith('Identifier deleted', { id: 'id-1' });
    });

    it('should return false when identifier not found', async () => {
      (TelegramIdentifier.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return paginated results with total', async () => {
      const items = [
        { _id: 'id-1', telegramUserId: '111', status: IDENTIFIER_STATUS.Active },
        { _id: 'id-2', telegramUserId: '222', status: IDENTIFIER_STATUS.Active },
      ];

      (TelegramIdentifier.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(items),
          }),
        }),
      });
      (TelegramIdentifier.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await service.list({}, 1, 50);

      expect(result.items).toEqual(items);
      expect(result.total).toBe(10);
    });

    it('should apply status filter', async () => {
      (TelegramIdentifier.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (TelegramIdentifier.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.list({ status: 'blocked' }, 1, 50);

      expect(TelegramIdentifier.find).toHaveBeenCalledWith({ status: 'blocked' });
      expect(TelegramIdentifier.countDocuments).toHaveBeenCalledWith({ status: 'blocked' });
    });

    it('should apply contactId filter', async () => {
      (TelegramIdentifier.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (TelegramIdentifier.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.list({ contactId: 'contact-1' }, 1, 50);

      expect(TelegramIdentifier.find).toHaveBeenCalledWith({ contactId: 'contact-1' });
    });
  });
});

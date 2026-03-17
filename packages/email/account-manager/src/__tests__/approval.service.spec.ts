import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalService } from '../services/approval.service';
import { DRAFT_STATUS } from '../constants';
import { DraftNotFoundError } from '../errors';
import type { EmailDraftModel } from '../schemas/email-draft.schema';
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
      timezone: 'UTC',
      approval: {
        enabled: true,
        defaultMode: 'manual',
        sendWindow: { timezone: 'UTC', startHour: 9, endHour: 21 },
        spreadStrategy: 'random',
        maxSpreadMinutes: 120,
      },
    }),
  } as unknown as SettingsService;
}

function createMockQueueService(): QueueService {
  return {
    enqueueApproval: vi.fn().mockResolvedValue('job-1'),
  } as unknown as QueueService;
}

function createMockDraftModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateMany: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  } as unknown as EmailDraftModel;
}

function makeDraftDoc(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id: 'draft-1',
    to: 'recipient@test.com',
    subject: 'Test Subject',
    htmlBody: '<p>Hello</p>',
    status: DRAFT_STATUS.Pending,
    ...overrides,
    toString() {
      return this._id as string;
    },
    toObject() {
      const { toString: _ts, toObject: _to, ...rest } = this;
      return rest;
    },
  };
  return doc;
}

describe('ApprovalService', () => {
  let service: ApprovalService;
  let EmailDraft: EmailDraftModel;
  let queueService: QueueService;
  let settings: SettingsService;
  let logger: LogAdapter;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailDraft = createMockDraftModel();
    queueService = createMockQueueService();
    settings = createMockSettings();
    logger = createMockLogger();
    hooks = {
      onDraftCreated: vi.fn(),
      onDraftApproved: vi.fn(),
      onDraftRejected: vi.fn(),
    };
    service = new ApprovalService(EmailDraft, queueService, settings, logger, hooks);
  });

  describe('createDraft()', () => {
    it('should create a draft with pending status', async () => {
      const input = {
        to: 'recipient@test.com',
        subject: 'Test Subject',
        htmlBody: '<p>Hello</p>',
        accountId: 'acc-1',
      };
      const createdDraft = makeDraftDoc({ _id: { toString: () => 'draft-new' } });
      (EmailDraft.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDraft);

      const result = await service.createDraft(input);

      expect(EmailDraft.create).toHaveBeenCalledWith({
        ...input,
        status: DRAFT_STATUS.Pending,
      });
      expect(result).toEqual(createdDraft);
      expect(logger.info).toHaveBeenCalledWith('Draft created', expect.objectContaining({ to: input.to }));
      expect(hooks!.onDraftCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          to: input.to,
          subject: input.subject,
        }),
      );
    });

    it('should pass source and identifierId fields through to create', async () => {
      const input = {
        to: 'recipient@test.com',
        subject: 'Test Subject',
        htmlBody: '<p>Hello</p>',
        accountId: 'acc-1',
        source: 'campaign',
        identifierId: 'ident-123',
      };
      const createdDraft = makeDraftDoc({
        _id: { toString: () => 'draft-new' },
        source: 'campaign',
        identifierId: 'ident-123',
      });
      (EmailDraft.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDraft);

      await service.createDraft(input);

      expect(EmailDraft.create).toHaveBeenCalledWith({
        ...input,
        status: DRAFT_STATUS.Pending,
      });
    });
  });

  describe('approve()', () => {
    it('should set status to approved and enqueue', async () => {
      const draft = makeDraftDoc();
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(draft);
      (EmailDraft.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.approve('draft-1');

      expect(EmailDraft.findByIdAndUpdate).toHaveBeenCalledWith('draft-1', {
        $set: {
          status: DRAFT_STATUS.Approved,
          approvedAt: expect.any(Date),
          scheduledAt: expect.any(Date),
        },
      });
      expect(queueService.enqueueApproval).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 'draft-1' }),
      );
      expect(logger.info).toHaveBeenCalledWith('Draft approved', { draftId: 'draft-1' });
    });

    it('should include full draft in onDraftApproved hook', async () => {
      const draft = makeDraftDoc({ source: 'campaign', identifierId: 'ident-1' });
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(draft);
      (EmailDraft.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.approve('draft-1');

      expect(hooks!.onDraftApproved).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: 'draft-1',
          to: 'recipient@test.com',
          scheduledAt: expect.any(Date),
          draft: expect.objectContaining({
            _id: 'draft-1',
            to: 'recipient@test.com',
            subject: 'Test Subject',
            source: 'campaign',
            identifierId: 'ident-1',
          }),
        }),
      );
    });

    it('should throw DraftNotFoundError when draft not found', async () => {
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.approve('nonexistent')).rejects.toThrow(DraftNotFoundError);
    });
  });

  describe('reject()', () => {
    it('should set status to rejected with reason', async () => {
      const draft = makeDraftDoc();
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(draft);
      (EmailDraft.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.reject('draft-1', 'Inappropriate content');

      expect(EmailDraft.findByIdAndUpdate).toHaveBeenCalledWith('draft-1', {
        $set: {
          status: DRAFT_STATUS.Rejected,
          rejectedAt: expect.any(Date),
          rejectionReason: 'Inappropriate content',
        },
      });
      expect(logger.info).toHaveBeenCalledWith('Draft rejected', { draftId: 'draft-1', reason: 'Inappropriate content' });
      expect(hooks!.onDraftRejected).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 'draft-1', reason: 'Inappropriate content' }),
      );
    });

    it('should throw DraftNotFoundError when draft not found', async () => {
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.reject('nonexistent')).rejects.toThrow(DraftNotFoundError);
    });
  });

  describe('bulkApprove()', () => {
    it('should approve multiple drafts', async () => {
      (EmailDraft.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.bulkApprove(['draft-1', 'draft-2', 'draft-3']);

      expect(EmailDraft.findByIdAndUpdate).toHaveBeenCalledTimes(3);
      expect(queueService.enqueueApproval).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('Bulk approve completed', { count: 3 });
    });
  });

  describe('sendNow()', () => {
    it('should set status to approved and enqueue without delay', async () => {
      const draft = makeDraftDoc();
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(draft);
      (EmailDraft.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.sendNow('draft-1');

      expect(EmailDraft.findByIdAndUpdate).toHaveBeenCalledWith('draft-1', {
        $set: {
          status: DRAFT_STATUS.Approved,
          approvedAt: expect.any(Date),
        },
      });
      expect(queueService.enqueueApproval).toHaveBeenCalledWith({ draftId: 'draft-1' });
      expect(logger.info).toHaveBeenCalledWith('Draft sent immediately', { draftId: 'draft-1' });
    });

    it('should throw DraftNotFoundError when draft not found', async () => {
      (EmailDraft.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.sendNow('nonexistent')).rejects.toThrow(DraftNotFoundError);
    });
  });
});

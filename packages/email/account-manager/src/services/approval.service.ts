import type { CreateDraftInput } from '../types/draft.types';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import { DRAFT_STATUS } from '../constants';
import { DraftNotFoundError } from '../errors';
import type { QueueService } from './queue.service';
import type { SettingsService } from './settings.service';
import type { EmailDraftDocument, EmailDraftModel } from '../schemas/email-draft.schema';

export class ApprovalService {
  constructor(
    private EmailDraft: EmailDraftModel,
    private queueService: QueueService,
    private settings: SettingsService,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async createDraft(input: CreateDraftInput): Promise<EmailDraftDocument> {
    const draft = await this.EmailDraft.create({
      ...input,
      status: DRAFT_STATUS.Pending,
    });

    this.logger.info('Draft created', { draftId: draft._id.toString(), to: input.to });
    this.hooks?.onDraftCreated?.({
      draftId: draft._id.toString(),
      to: input.to,
      subject: input.subject,
    });

    return draft;
  }

  async approve(draftId: string): Promise<void> {
    const draft = await this.EmailDraft.findById(draftId);
    if (!draft) throw new DraftNotFoundError(draftId);

    const scheduledAt = await this.calculateScheduledTime(0, 1);

    await this.EmailDraft.findByIdAndUpdate(draftId, {
      $set: {
        status: DRAFT_STATUS.Approved,
        approvedAt: new Date(),
        scheduledAt,
      },
    });

    await this.queueService.enqueueApproval({
      draftId,
      scheduledAt: scheduledAt?.toISOString(),
    });

    this.logger.info('Draft approved', { draftId });
    this.hooks?.onDraftApproved?.({
      draftId,
      to: (draft as any).to,
      scheduledAt,
      draft: (draft as any).toObject(),
    });
  }

  async reject(draftId: string, reason?: string): Promise<void> {
    const draft = await this.EmailDraft.findById(draftId);
    if (!draft) throw new DraftNotFoundError(draftId);

    await this.EmailDraft.findByIdAndUpdate(draftId, {
      $set: {
        status: DRAFT_STATUS.Rejected,
        rejectedAt: new Date(),
        ...(reason ? { rejectionReason: reason } : {}),
      },
    });

    this.logger.info('Draft rejected', { draftId, reason });
    this.hooks?.onDraftRejected?.({
      draftId,
      to: (draft as any).to,
      reason,
    });
  }

  async bulkApprove(draftIds: string[]): Promise<void> {
    const total = draftIds.length;

    for (let i = 0; i < total; i++) {
      const scheduledAt = await this.calculateScheduledTime(i, total);

      await this.EmailDraft.findByIdAndUpdate(draftIds[i], {
        $set: {
          status: DRAFT_STATUS.Approved,
          approvedAt: new Date(),
          scheduledAt,
        },
      });

      await this.queueService.enqueueApproval({
        draftId: draftIds[i],
        scheduledAt: scheduledAt?.toISOString(),
      });
    }

    this.logger.info('Bulk approve completed', { count: total });
  }

  async bulkReject(draftIds: string[], reason?: string): Promise<void> {
    await this.EmailDraft.updateMany(
      { _id: { $in: draftIds } },
      {
        $set: {
          status: DRAFT_STATUS.Rejected,
          rejectedAt: new Date(),
          ...(reason ? { rejectionReason: reason } : {}),
        },
      },
    );

    this.logger.info('Bulk reject completed', { count: draftIds.length, reason });
  }

  async sendNow(draftId: string): Promise<void> {
    const draft = await this.EmailDraft.findById(draftId);
    if (!draft) throw new DraftNotFoundError(draftId);

    await this.EmailDraft.findByIdAndUpdate(draftId, {
      $set: {
        status: DRAFT_STATUS.Approved,
        approvedAt: new Date(),
      },
    });

    await this.queueService.enqueueApproval({ draftId });

    this.logger.info('Draft sent immediately', { draftId });
  }

  async updateContent(
    draftId: string,
    content: { subject?: string; htmlBody?: string; textBody?: string; attachments?: Array<{ filename: string; url: string; contentType: string }> },
  ): Promise<EmailDraftDocument> {
    const updates: Record<string, unknown> = {};
    if (content.subject !== undefined) updates.subject = content.subject;
    if (content.htmlBody !== undefined) updates.htmlBody = content.htmlBody;
    if (content.textBody !== undefined) updates.textBody = content.textBody;
    if (content.attachments !== undefined) updates.attachments = content.attachments;

    const draft = await this.EmailDraft.findByIdAndUpdate(
      draftId,
      { $set: updates },
      { new: true },
    );

    if (!draft) throw new DraftNotFoundError(draftId);
    return draft;
  }

  async getDrafts(
    filters?: { status?: string },
    page = 1,
    limit = 50,
  ): Promise<{ items: EmailDraftDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.EmailDraft.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.EmailDraft.countDocuments(query),
    ]);

    return { items, total };
  }

  async getDraftById(draftId: string): Promise<EmailDraftDocument | null> {
    return this.EmailDraft.findById(draftId);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const counts = await this.EmailDraft.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result: Record<string, number> = {};
    for (const entry of counts) {
      result[entry._id] = entry.count;
    }
    return result;
  }

  private async calculateScheduledTime(index: number, total: number): Promise<Date> {
    const globalSettings = await this.settings.get();
    const approval = globalSettings.approval;

    if (!approval.sendWindow) {
      return new Date();
    }

    const now = new Date();
    const tz = approval.sendWindow.timezone || globalSettings.timezone || 'UTC';

    const currentHour = parseInt(
      now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }),
      10,
    );

    let scheduledDate = new Date(now);

    if (currentHour < approval.sendWindow.startHour) {
      const diff = approval.sendWindow.startHour - currentHour;
      scheduledDate = new Date(now.getTime() + diff * 60 * 60 * 1000);
    } else if (currentHour >= approval.sendWindow.endHour) {
      const hoursUntilNextStart = 24 - currentHour + approval.sendWindow.startHour;
      scheduledDate = new Date(now.getTime() + hoursUntilNextStart * 60 * 60 * 1000);
    }

    if (total <= 1) return scheduledDate;

    const maxSpreadMs = approval.maxSpreadMinutes * 60 * 1000;

    if (approval.spreadStrategy === 'even') {
      const interval = total > 1 ? maxSpreadMs / (total - 1) : 0;
      return new Date(scheduledDate.getTime() + index * interval);
    }

    const randomDelay = Math.floor(Math.random() * maxSpreadMs);
    return new Date(scheduledDate.getTime() + randomDelay);
  }
}

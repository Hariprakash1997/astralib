import type { Job } from 'bullmq';
import type { SmtpService } from '../services/smtp.service';
import type { QueueService } from '../services/queue.service';
import type { LogAdapter } from '../types/config.types';
import { DRAFT_STATUS } from '../constants';
import type { EmailDraftModel } from '../schemas/email-draft.schema';

export function createApprovalProcessor(
  EmailDraft: EmailDraftModel,
  smtpService: SmtpService,
  queueService: QueueService,
  logger: LogAdapter,
) {
  return async (job: Job) => {
    const { draftId } = job.data;

    const draft = await EmailDraft.findById(draftId);
    if (!draft) {
      logger.warn('Approval job: draft not found', { draftId });
      return;
    }

    const d = draft as any;
    if (d.status !== DRAFT_STATUS.Approved) {
      logger.warn('Approval job: draft not in approved status', { draftId, status: d.status });
      return;
    }

    logger.info('Processing approved draft', { draftId, to: d.to });

    await EmailDraft.findByIdAndUpdate(draftId, {
      $set: { status: DRAFT_STATUS.Queued },
    });

    await queueService.enqueueSend({
      accountId: d.accountId.toString(),
      to: d.to,
      subject: d.subject,
      html: d.htmlBody,
      text: d.textBody || '',
    });
  };
}

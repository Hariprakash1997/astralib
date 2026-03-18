import type { Job } from 'bullmq';
import type { SmtpService } from '../services/smtp.service';
import type { LogAdapter } from '../types/config.types';

export function createSendProcessor(smtpService: SmtpService, logger: LogAdapter) {
  return async (job: Job) => {
    const { accountId, to, subject, html, text, unsubscribeUrl, attachments } = job.data;

    logger.info('Processing send job', { jobId: job.id, accountId, to });

    const result = await smtpService.executeSend(accountId, to, subject, html, text, unsubscribeUrl, attachments);

    if (!result.success) {
      throw new Error(result.error || 'Send failed');
    }
  };
}

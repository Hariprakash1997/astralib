import type { Job } from 'bullmq';
import type { SmtpService } from '../services/smtp.service';
import type { LogAdapter } from '../types/config.types';

export function createSendProcessor(smtpService: SmtpService, logger: LogAdapter) {
  return async (job: Job) => {
    const { accountId, to, subject, html, text, unsubscribeUrl } = job.data;

    logger.info('Processing send job', { jobId: job.id, accountId, to });

    const result = await smtpService.executeSend(accountId, to, subject, html, text, unsubscribeUrl);

    if (!result.success) {
      throw new Error(result.error || 'Send failed');
    }
  };
}

import { Queue, Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { EmailAccountManagerConfig, LogAdapter } from '../types/config.types';
import type { SettingsService } from './settings.service';

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface SendJobData {
  accountId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalJobData {
  draftId: string;
  scheduledAt?: string;
}

export class QueueService {
  private sendQueue!: Queue;
  private approvalQueue!: Queue;
  private sendWorker!: Worker;
  private approvalWorker!: Worker;

  constructor(
    private redis: Redis,
    private config: EmailAccountManagerConfig,
    private settings: SettingsService,
    private logger: LogAdapter,
  ) {}

  async init(processors: {
    sendProcessor: (job: Job) => Promise<void>;
    approvalProcessor: (job: Job) => Promise<void>;
  }): Promise<void> {
    const keyPrefix = this.config.redis.keyPrefix || 'eam:';
    const sendQueueName = this.config.options?.queues?.sendQueueName || 'email-send';
    const approvalQueueName = this.config.options?.queues?.approvalQueueName || 'email-approved';

    const globalSettings = await this.settings.get();
    const queueSettings = globalSettings.queues;

    const redisConnection = this.redis as any;

    this.sendQueue = new Queue(sendQueueName, {
      connection: redisConnection,
      prefix: keyPrefix,
    });

    this.approvalQueue = new Queue(approvalQueueName, {
      connection: redisConnection,
      prefix: keyPrefix,
    });

    this.sendWorker = new Worker(
      sendQueueName,
      processors.sendProcessor,
      {
        connection: redisConnection,
        prefix: keyPrefix,
        concurrency: queueSettings.sendConcurrency,
      },
    );

    this.approvalWorker = new Worker(
      approvalQueueName,
      processors.approvalProcessor,
      {
        connection: redisConnection,
        prefix: keyPrefix,
        concurrency: queueSettings.approvalConcurrency,
      },
    );

    this.sendWorker.on('failed', (job, err) => {
      this.logger.error('Send job failed', {
        jobId: job?.id,
        error: err.message,
      });
    });

    this.approvalWorker.on('failed', (job, err) => {
      this.logger.error('Approval job failed', {
        jobId: job?.id,
        error: err.message,
      });
    });

    this.logger.info('Queue service initialized', {
      sendQueue: sendQueueName,
      approvalQueue: approvalQueueName,
    });
  }

  async enqueueSend(data: SendJobData): Promise<string> {
    const globalSettings = await this.settings.get();
    const queueSettings = globalSettings.queues;

    const job = await this.sendQueue.add('send', data, {
      attempts: queueSettings.sendAttempts,
      backoff: {
        type: 'exponential',
        delay: queueSettings.sendBackoffMs,
      },
    });

    return job.id || '';
  }

  async enqueueApproval(data: ApprovalJobData): Promise<string> {
    const globalSettings = await this.settings.get();
    const queueSettings = globalSettings.queues;

    const delay = data.scheduledAt
      ? Math.max(0, new Date(data.scheduledAt).getTime() - Date.now())
      : 0;

    const job = await this.approvalQueue.add('approved', data, {
      attempts: queueSettings.approvalAttempts,
      backoff: {
        type: 'exponential',
        delay: queueSettings.approvalBackoffMs,
      },
      delay,
    });

    return job.id || '';
  }

  async getStats(): Promise<{ send: QueueStats; approval: QueueStats }> {
    const [sendCounts, approvalCounts] = await Promise.all([
      this.sendQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.approvalQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    return {
      send: sendCounts as unknown as QueueStats,
      approval: approvalCounts as unknown as QueueStats,
    };
  }

  async pause(queue: 'send' | 'approval'): Promise<void> {
    const target = queue === 'send' ? this.sendQueue : this.approvalQueue;
    await target.pause();
    this.logger.info('Queue paused', { queue });
  }

  async resume(queue: 'send' | 'approval'): Promise<void> {
    const target = queue === 'send' ? this.sendQueue : this.approvalQueue;
    await target.resume();
    this.logger.info('Queue resumed', { queue });
  }

  async close(): Promise<void> {
    await Promise.all([
      this.sendWorker?.close(),
      this.approvalWorker?.close(),
      this.sendQueue?.close(),
      this.approvalQueue?.close(),
    ]);
    this.logger.info('Queue service closed');
  }
}

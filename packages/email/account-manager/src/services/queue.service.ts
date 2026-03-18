import { Queue, Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { EmailAccountManagerConfig, LogAdapter } from '../types/config.types';
import type { SettingsService } from './settings.service';

/** Extract plain connection options from an ioredis instance for BullMQ (avoids duplicate() race). Sentinel/Cluster configs are not forwarded. */
function getRedisOptions(redis: Redis): { host: string; port: number; password?: string; username?: string; db?: number; tls?: object } {
  const opts = redis.options;
  const config: Record<string, unknown> = {
    host: opts.host || 'localhost',
    port: opts.port || 6379,
    db: opts.db ?? 0,
  };
  if (opts.username) config.username = opts.username;
  if (opts.password) config.password = opts.password;
  if (opts.tls) config.tls = opts.tls;
  return config as { host: string; port: number; password?: string; username?: string; db?: number; tls?: object };
}

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
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
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

    const connectionOpts = getRedisOptions(this.redis);

    this.sendQueue = new Queue(sendQueueName, {
      connection: connectionOpts,
      prefix: keyPrefix,
    });

    this.approvalQueue = new Queue(approvalQueueName, {
      connection: connectionOpts,
      prefix: keyPrefix,
    });

    this.sendWorker = new Worker(
      sendQueueName,
      processors.sendProcessor,
      {
        connection: connectionOpts,
        prefix: keyPrefix,
        concurrency: queueSettings.sendConcurrency,
      },
    );

    this.approvalWorker = new Worker(
      approvalQueueName,
      processors.approvalProcessor,
      {
        connection: connectionOpts,
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

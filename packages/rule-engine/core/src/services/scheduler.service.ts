import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

export class SchedulerService {
  private queue: Queue;
  private worker?: Worker;
  private keyPrefix: string;
  private queueName: string;

  constructor(connection: Redis, keyPrefix = '', queueName = 'rule-engine-scheduler') {
    this.keyPrefix = keyPrefix;
    this.queueName = queueName;
    const connectionOpts = { host: connection.options?.host, port: connection.options?.port, password: connection.options?.password, db: connection.options?.db };
    this.queue = new Queue(this.queueName, { connection: connectionOpts, prefix: keyPrefix });
  }

  async syncRule(rule: { _id: any; schedule?: { enabled: boolean; cron: string; timezone?: string } }): Promise<void> {
    const ruleId = String(rule._id);
    const jobId = `sched-${ruleId}`;

    // Remove existing
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.id === jobId) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    // Add if enabled
    if (rule.schedule?.enabled && rule.schedule.cron) {
      await this.queue.add('run-scheduled', { ruleId }, {
        repeat: { pattern: rule.schedule.cron, tz: rule.schedule.timezone || 'UTC' },
        jobId,
      });
    }
  }

  async removeRule(ruleId: string): Promise<void> {
    const jobId = `sched-${ruleId}`;
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.id === jobId) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
  }

  startWorker(runFn: (triggeredBy: string) => Promise<any>): void {
    const connectionOpts = (this.queue as any).opts?.connection;
    this.worker = new Worker(this.queueName, async (job) => {
      const { ruleId } = job.data;
      await runFn(`scheduled:${ruleId}`);
    }, { connection: connectionOpts, prefix: this.keyPrefix });
  }

  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
    }
  }

  async destroy(): Promise<void> {
    await this.stopWorker();
    await this.queue.close();
  }

  async getScheduledJobs(): Promise<Array<{ ruleId: string; cron: string; next: number | null }>> {
    const jobs = await this.queue.getRepeatableJobs();
    return jobs.map(j => ({
      ruleId: (j.id || '').replace('sched-', ''),
      cron: j.pattern || '',
      next: j.next ?? null,
    }));
  }
}

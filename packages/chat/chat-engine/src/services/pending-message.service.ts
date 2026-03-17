import type { LogAdapter } from '@astralibx/core';
import type { PendingMessageModel, PendingMessageDocument } from '../schemas/pending-message.schema';
import type { ResolvedOptions } from '../types/config.types';

export class PendingMessageService {
  constructor(
    private PendingMessage: PendingMessageModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
  ) {}

  async save(sessionId: string, message: Record<string, unknown>): Promise<PendingMessageDocument> {
    const expiresAt = new Date(Date.now() + this.options.pendingMessageTTLMs);
    const doc = await this.PendingMessage.create({
      sessionId,
      message,
      expiresAt,
    });
    this.logger.info('Pending message saved', { sessionId });
    return doc;
  }

  async get(sessionId: string): Promise<PendingMessageDocument[]> {
    return this.PendingMessage.find({ sessionId }).sort({ createdAt: 1 });
  }

  async clear(sessionId: string): Promise<void> {
    const result = await this.PendingMessage.deleteMany({ sessionId });
    if (result.deletedCount > 0) {
      this.logger.info('Pending messages cleared', { sessionId, count: result.deletedCount });
    }
  }
}

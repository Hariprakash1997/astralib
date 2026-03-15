import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import type { BounceType, IdentifierStatus } from '../constants';
import { IDENTIFIER_STATUS } from '../constants';
import type { EmailIdentifierDocument, EmailIdentifierModel } from '../schemas/email-identifier.schema';

export class IdentifierService {
  constructor(
    private EmailIdentifier: EmailIdentifierModel,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async findOrCreate(email: string): Promise<EmailIdentifierDocument> {
    const normalized = email.toLowerCase().trim();

    const doc = await this.EmailIdentifier.findOneAndUpdate(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          status: IDENTIFIER_STATUS.Active,
          sentCount: 0,
          bounceCount: 0,
        },
      },
      { upsert: true, new: true },
    );

    return doc!;
  }

  async findById(id: string): Promise<EmailIdentifierDocument | null> {
    return this.EmailIdentifier.findById(id);
  }

  async findByEmail(email: string): Promise<EmailIdentifierDocument | null> {
    return this.EmailIdentifier.findOne({ email: email.toLowerCase().trim() });
  }

  async markBounced(email: string, bounceType: BounceType): Promise<void> {
    const normalized = email.toLowerCase().trim();

    await this.EmailIdentifier.findOneAndUpdate(
      { email: normalized },
      {
        $set: {
          status: IDENTIFIER_STATUS.Bounced,
          bounceType,
          lastBouncedAt: new Date(),
        },
        $inc: { bounceCount: 1 },
      },
      { upsert: true },
    );

    this.logger.warn('Identifier marked bounced', { email: normalized, bounceType });
    this.hooks?.onBounce?.({ accountId: '', email: normalized, bounceType, provider: '' });
  }

  async markUnsubscribed(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();

    await this.EmailIdentifier.findOneAndUpdate(
      { email: normalized },
      {
        $set: {
          status: IDENTIFIER_STATUS.Unsubscribed,
          unsubscribedAt: new Date(),
        },
      },
      { upsert: true },
    );

    this.logger.info('Identifier marked unsubscribed', { email: normalized });
    this.hooks?.onUnsubscribe?.({ email: normalized });
  }

  async updateStatus(email: string, status: IdentifierStatus): Promise<void> {
    await this.EmailIdentifier.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { status } },
    );
  }

  async incrementSentCount(email: string): Promise<void> {
    await this.EmailIdentifier.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        $inc: { sentCount: 1 },
        $set: { lastSentAt: new Date() },
      },
    );
  }

  async merge(sourceEmail: string, targetEmail: string): Promise<void> {
    const source = await this.findByEmail(sourceEmail);
    const target = await this.findByEmail(targetEmail);

    if (!source) {
      this.logger.warn('Merge source not found', { sourceEmail });
      return;
    }

    if (!target) {
      await this.EmailIdentifier.findOneAndUpdate(
        { email: sourceEmail.toLowerCase().trim() },
        { $set: { email: targetEmail.toLowerCase().trim() } },
      );
      return;
    }

    await this.EmailIdentifier.findByIdAndUpdate(target._id, {
      $inc: {
        sentCount: source.sentCount || 0,
        bounceCount: source.bounceCount || 0,
      },
      $set: {
        ...(source.lastSentAt && (!target.lastSentAt || source.lastSentAt > target.lastSentAt)
          ? { lastSentAt: source.lastSentAt }
          : {}),
        ...(source.metadata
          ? { metadata: { ...source.metadata, ...(target.metadata || {}) } }
          : {}),
      },
    });

    await this.EmailIdentifier.findByIdAndDelete(source._id);
    this.logger.info('Identifiers merged', { sourceEmail, targetEmail });
  }

  async list(
    filters?: { status?: string },
    page = 1,
    limit = 50,
  ): Promise<{ items: EmailIdentifierDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.EmailIdentifier.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.EmailIdentifier.countDocuments(query),
    ]);

    return { items, total };
  }
}

import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import type { CreateTelegramIdentifierInput, UpdateTelegramIdentifierInput } from '../types/identifier.types';
import type { IdentifierStatus } from '../constants';
import { IDENTIFIER_STATUS } from '../constants';
import type { TelegramIdentifierDocument, TelegramIdentifierModel } from '../schemas/telegram-identifier.schema';

export class IdentifierService {
  private logger: LogAdapter;

  constructor(
    private TelegramIdentifier: TelegramIdentifierModel,
    private config: TelegramAccountManagerConfig,
  ) {
    this.logger = config.logger || noopLogger;
  }

  async create(input: CreateTelegramIdentifierInput): Promise<TelegramIdentifierDocument> {
    const doc = await this.TelegramIdentifier.create({
      ...input,
      status: IDENTIFIER_STATUS.Active,
      sentCount: 0,
      knownByAccounts: [],
    });

    this.logger.info('Identifier created', { telegramUserId: input.telegramUserId, contactId: input.contactId });
    return doc;
  }

  async findById(id: string): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.findById(id);
  }

  async findByTelegramUserId(telegramUserId: string): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.findOne({ telegramUserId });
  }

  async findByContactId(contactId: string): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.findOne({ contactId });
  }

  async findByPhone(phone: string): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.findOne({ phone });
  }

  async update(id: string, input: UpdateTelegramIdentifierInput): Promise<TelegramIdentifierDocument | null> {
    const doc = await this.TelegramIdentifier.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true },
    );

    if (doc) {
      this.logger.info('Identifier updated', { id });
    }

    return doc;
  }

  async updateStatus(id: string, status: IdentifierStatus): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    );
  }

  async addKnownAccount(identifierId: string, accountId: string): Promise<TelegramIdentifierDocument | null> {
    return this.TelegramIdentifier.addKnownAccount(identifierId, accountId);
  }

  async incrementSentCount(identifierId: string): Promise<void> {
    await this.TelegramIdentifier.findByIdAndUpdate(identifierId, {
      $inc: { sentCount: 1 },
      $set: { lastActiveAt: new Date() },
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.TelegramIdentifier.findByIdAndDelete(id);
    if (result) {
      this.logger.info('Identifier deleted', { id });
      return true;
    }
    return false;
  }

  async list(
    filters?: { status?: string; contactId?: string },
    page = 1,
    limit = 50,
  ): Promise<{ items: TelegramIdentifierDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.contactId) query.contactId = filters.contactId;

    const [items, total] = await Promise.all([
      this.TelegramIdentifier.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.TelegramIdentifier.countDocuments(query),
    ]);

    return { items, total };
  }
}

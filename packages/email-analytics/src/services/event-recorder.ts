import type { FilterQuery } from 'mongoose';
import type { EmailEventModel } from '../schemas/email-event.schema';
import type { LogAdapter } from '@astralibx/core';
import type { EmailEvent, CreateEventInput } from '../types/event.types';

export interface EventQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  type?: string;
  accountId?: string;
  ruleId?: string;
  recipientEmail?: string;
}

export interface PaginatedEvents {
  events: EmailEvent[];
  total: number;
}

export class EventRecorderService {
  constructor(
    private EmailEvent: EmailEventModel,
    private logger: LogAdapter,
  ) {}

  async record(event: CreateEventInput): Promise<void> {
    await this.EmailEvent.record(event);
    this.logger.info('Event recorded', { type: event.type, accountId: event.accountId });
  }

  async recordBatch(events: CreateEventInput[]): Promise<void> {
    if (events.length === 0) return;

    const docs = events.map((e) => ({
      ...e,
      timestamp: e.timestamp || new Date(),
    }));

    await this.EmailEvent.insertMany(docs, { ordered: false });
    this.logger.info('Batch events recorded', { count: events.length });
  }

  async getEvents(
    filters: EventQueryFilters,
    page = 1,
    limit = 50,
  ): Promise<PaginatedEvents> {
    const query: FilterQuery<EmailEvent> = {
      timestamp: { $gte: filters.dateFrom, $lte: filters.dateTo },
    };

    if (filters.type) query.type = filters.type;
    if (filters.accountId) query.accountId = filters.accountId;
    if (filters.ruleId) query.ruleId = filters.ruleId;
    if (filters.recipientEmail) query.recipientEmail = filters.recipientEmail;

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.EmailEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean<EmailEvent[]>(),
      this.EmailEvent.countDocuments(query),
    ]);

    return { events, total };
  }

  async purgeOldEvents(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.EmailEvent.deleteMany({
      timestamp: { $lt: cutoff },
    });

    const count = result.deletedCount || 0;
    this.logger.info('Purged old events', { olderThanDays, deleted: count });
    return count;
  }
}

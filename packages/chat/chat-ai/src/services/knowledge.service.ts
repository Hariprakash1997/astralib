import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatKnowledgeEntryModel } from '../schemas/chat-knowledge-entry.schema';
import type {
  ChatKnowledgeEntry,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeListQuery,
  KnowledgeSearchConfig,
  KnowledgeSearchOptions,
} from '../types/knowledge.types';
import { DEFAULT_KNOWLEDGE_SEARCH } from '../types/config.types';
import { KnowledgeEntryNotFoundError } from '../errors';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function docToEntry(doc: any): ChatKnowledgeEntry {
  return {
    entryId: doc.entryId,
    title: doc.title,
    content: doc.content,
    category: doc.category,
    tags: doc.tags ?? [],
    isActive: doc.isActive,
    priority: doc.priority,
    embedding: doc.embedding,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

export class KnowledgeService {
  private searchConfig: Required<KnowledgeSearchConfig>;

  constructor(
    private ChatKnowledgeEntry: ChatKnowledgeEntryModel,
    private logger: LogAdapter,
    searchConfig?: KnowledgeSearchConfig,
    private embeddingAdapter?: {
      generate: (text: string) => Promise<number[]>;
      dimensions: number;
    },
  ) {
    this.searchConfig = {
      ...DEFAULT_KNOWLEDGE_SEARCH,
      ...searchConfig,
    };
  }

  async create(input: CreateKnowledgeInput): Promise<ChatKnowledgeEntry> {
    const entryId = crypto.randomUUID();
    const data: Record<string, unknown> = {
      entryId,
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags ?? [],
      isActive: input.isActive ?? true,
      priority: input.priority ?? 50,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    };

    if (this.embeddingAdapter) {
      try {
        data.embedding = await this.embeddingAdapter.generate(`${input.title}\n${input.content}`);
      } catch (err) {
        this.logger.error('Failed to generate embedding for knowledge entry', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const doc = await this.ChatKnowledgeEntry.create(data);
    this.logger.info('Knowledge entry created', { entryId });
    return docToEntry(doc);
  }

  async update(entryId: string, input: UpdateKnowledgeInput): Promise<ChatKnowledgeEntry> {
    const updateData: Record<string, unknown> = { ...input };

    if (this.embeddingAdapter && (input.title || input.content)) {
      try {
        // Need existing doc for full text
        const existing = await this.ChatKnowledgeEntry.findOne({ entryId });
        if (existing) {
          const title = input.title ?? existing.title;
          const content = input.content ?? existing.content;
          updateData.embedding = await this.embeddingAdapter.generate(`${title}\n${content}`);
        }
      } catch (err) {
        this.logger.error('Failed to generate embedding for knowledge update', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const doc = await this.ChatKnowledgeEntry.findOneAndUpdate(
      { entryId },
      { $set: updateData },
      { new: true },
    );

    if (!doc) throw new KnowledgeEntryNotFoundError(entryId);
    this.logger.info('Knowledge entry updated', { entryId });
    return docToEntry(doc);
  }

  async delete(entryId: string): Promise<void> {
    const result = await this.ChatKnowledgeEntry.deleteOne({ entryId });
    if (result.deletedCount === 0) throw new KnowledgeEntryNotFoundError(entryId);
    this.logger.info('Knowledge entry deleted', { entryId });
  }

  async bulkDelete(entryIds: string[]): Promise<{ deleted: number }> {
    const result = await this.ChatKnowledgeEntry.deleteMany({ entryId: { $in: entryIds } });
    this.logger.info('Knowledge entries bulk deleted', { count: result.deletedCount });
    return { deleted: result.deletedCount };
  }

  async findById(entryId: string): Promise<ChatKnowledgeEntry | null> {
    const doc = await this.ChatKnowledgeEntry.findOne({ entryId });
    return doc ? docToEntry(doc) : null;
  }

  async list(query: KnowledgeListQuery): Promise<{ entries: ChatKnowledgeEntry[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { content: { $regex: query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(query.search, 'i')] } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.ChatKnowledgeEntry.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit),
      this.ChatKnowledgeEntry.countDocuments(filter),
    ]);

    return { entries: docs.map(docToEntry), total };
  }

  async search(query: string): Promise<ChatKnowledgeEntry[]> {
    const docs = await this.ChatKnowledgeEntry.find(
      { $text: { $search: query }, isActive: true },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' }, priority: -1 })
      .limit(20);

    return docs.map(docToEntry);
  }

  async getCategories(): Promise<string[]> {
    return this.ChatKnowledgeEntry.distinct('category', { category: { $ne: null } });
  }

  async getRelevantKnowledge(query: string, options?: { limit?: number; category?: string }): Promise<ChatKnowledgeEntry[]> {
    const maxEntries = options?.limit ?? this.searchConfig.maxEntries;
    const maxTokens = this.searchConfig.maxTokens;

    let entries: ChatKnowledgeEntry[];

    switch (this.searchConfig.strategy) {
      case 'priority': {
        const filter: Record<string, unknown> = { isActive: true };
        if (options?.category) filter.category = options.category;
        const docs = await this.ChatKnowledgeEntry.find(filter)
          .sort({ priority: -1 })
          .limit(maxEntries);
        entries = docs.map(docToEntry);
        break;
      }

      case 'text': {
        entries = await this.search(query);
        break;
      }

      case 'custom': {
        if (this.searchConfig.customSearch) {
          entries = await this.searchConfig.customSearch(query, {
            limit: maxEntries,
            category: options?.category,
          });
        } else {
          entries = [];
        }
        break;
      }

      default:
        entries = [];
    }

    // Cap by count
    entries = entries.slice(0, maxEntries);

    // Cap by token budget
    let tokenCount = 0;
    const budgeted: ChatKnowledgeEntry[] = [];
    for (const entry of entries) {
      const tokens = estimateTokens(entry.content);
      if (tokenCount + tokens > maxTokens) break;
      tokenCount += tokens;
      budgeted.push(entry);
    }

    return budgeted;
  }

  async import(entries: CreateKnowledgeInput[]): Promise<{ imported: number }> {
    const docs = entries.map((entry) => ({
      entryId: crypto.randomUUID(),
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags ?? [],
      isActive: entry.isActive ?? true,
      priority: entry.priority ?? 50,
      metadata: entry.metadata ?? {},
      createdBy: entry.createdBy,
    }));

    const created = await this.ChatKnowledgeEntry.insertMany(docs);
    this.logger.info('Knowledge entries imported', { count: created.length });
    return { imported: created.length };
  }

  async export(): Promise<ChatKnowledgeEntry[]> {
    const docs = await this.ChatKnowledgeEntry.find({}).sort({ priority: -1, createdAt: -1 });
    return docs.map(docToEntry);
  }
}

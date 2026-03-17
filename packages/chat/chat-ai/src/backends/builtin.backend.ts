import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatMemoryModel } from '../schemas/chat-memory.schema';
import type {
  MemoryBackend,
  ChatMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListQuery,
  MemoryScope,
  MemorySearchScope,
} from '../types/memory.types';
import { MemoryNotFoundError } from '../errors';

function docToMemory(doc: any): ChatMemory {
  return {
    memoryId: doc.memoryId,
    scope: doc.scope,
    scopeId: doc.scopeId ?? undefined,
    key: doc.key,
    content: doc.content,
    category: doc.category ?? undefined,
    tags: doc.tags ?? [],
    priority: doc.priority,
    isActive: doc.isActive,
    source: doc.source,
    embedding: doc.embedding ?? undefined,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy ?? undefined,
  };
}

export class BuiltinMemoryBackend implements MemoryBackend {
  constructor(
    private ChatMemory: ChatMemoryModel,
    private logger: LogAdapter,
  ) {}

  async create(input: CreateMemoryInput, embedding?: number[]): Promise<ChatMemory> {
    const memoryId = crypto.randomUUID();
    const data: Record<string, unknown> = {
      memoryId,
      scope: input.scope,
      scopeId: input.scope === 'global' ? null : input.scopeId,
      key: input.key,
      content: input.content,
      category: input.category,
      tags: input.tags ?? [],
      priority: input.priority ?? 50,
      isActive: input.isActive ?? true,
      source: input.source ?? 'admin',
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    };
    if (embedding) {
      data.embedding = embedding;
    }
    const doc = await this.ChatMemory.create(data);
    this.logger.info('Memory created', { memoryId });
    return docToMemory(doc);
  }

  async update(memoryId: string, input: UpdateMemoryInput, embedding?: number[]): Promise<ChatMemory> {
    const updateData: Record<string, unknown> = { ...input };
    if (embedding) {
      updateData.embedding = embedding;
    }
    const doc = await this.ChatMemory.findOneAndUpdate(
      { memoryId },
      { $set: updateData },
      { new: true },
    );
    if (!doc) throw new MemoryNotFoundError(memoryId);
    this.logger.info('Memory updated', { memoryId });
    return docToMemory(doc);
  }

  async delete(memoryId: string): Promise<void> {
    const result = await this.ChatMemory.deleteOne({ memoryId });
    if (result.deletedCount === 0) throw new MemoryNotFoundError(memoryId);
    this.logger.info('Memory deleted', { memoryId });
  }

  async bulkDelete(memoryIds: string[]): Promise<{ deleted: number }> {
    const result = await this.ChatMemory.deleteMany({ memoryId: { $in: memoryIds } });
    this.logger.info('Memories bulk deleted', { count: result.deletedCount });
    return { deleted: result.deletedCount };
  }

  async findById(memoryId: string): Promise<ChatMemory | null> {
    const doc = await this.ChatMemory.findOne({ memoryId });
    return doc ? docToMemory(doc) : null;
  }

  async findByKey(scope: MemoryScope, scopeId: string | null, key: string): Promise<ChatMemory | null> {
    const doc = await this.ChatMemory.findOne({
      scope,
      scopeId: scopeId ?? null,
      key,
    });
    return doc ? docToMemory(doc) : null;
  }

  async list(query: MemoryListQuery): Promise<{ memories: ChatMemory[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.scope) filter.scope = query.scope;
    if (query.scopeId !== undefined) filter.scopeId = query.scopeId;
    if (query.category) filter.category = query.category;
    if (query.source) filter.source = query.source;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.$or = [
        { content: { $regex: query.search, $options: 'i' } },
        { key: { $regex: query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(query.search, 'i')] } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.ChatMemory.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit),
      this.ChatMemory.countDocuments(filter),
    ]);

    return { memories: docs.map(docToMemory), total };
  }

  async listByScope(scope: MemoryScope, scopeId?: string): Promise<ChatMemory[]> {
    const filter: Record<string, unknown> = { scope, isActive: true };
    if (scopeId !== undefined) filter.scopeId = scopeId;
    else if (scope === 'global') filter.scopeId = null;
    const docs = await this.ChatMemory.find(filter).sort({ priority: -1 });
    return docs.map(docToMemory);
  }

  async listByCategory(category: string): Promise<ChatMemory[]> {
    const docs = await this.ChatMemory.find({ category, isActive: true }).sort({ priority: -1 });
    return docs.map(docToMemory);
  }

  async listByVisitor(visitorId: string): Promise<ChatMemory[]> {
    const docs = await this.ChatMemory.find({
      scope: 'visitor',
      scopeId: visitorId,
    }).sort({ priority: -1, createdAt: -1 });
    return docs.map(docToMemory);
  }

  async getCategories(): Promise<string[]> {
    return this.ChatMemory.distinct('category', { category: { $ne: null } });
  }

  async search(query: string, scope: MemorySearchScope): Promise<ChatMemory[]> {
    const scopeFilters: Record<string, unknown>[] = [
      { scope: 'global', scopeId: null },
    ];
    if (scope.visitorId) {
      scopeFilters.push({ scope: 'visitor', scopeId: scope.visitorId });
    }
    if (scope.agentId) {
      scopeFilters.push({ scope: 'agent', scopeId: scope.agentId });
    }
    if (scope.channel) {
      scopeFilters.push({ scope: 'channel', scopeId: scope.channel });
    }

    const filter: Record<string, unknown> = {
      $or: scopeFilters,
      isActive: true,
      $text: { $search: query },
    };

    const docs = await this.ChatMemory.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' }, priority: -1 })
      .limit(20);

    return docs.map(docToMemory);
  }

  async import(memories: CreateMemoryInput[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const input of memories) {
      try {
        const memoryId = crypto.randomUUID();
        await this.ChatMemory.create({
          memoryId,
          scope: input.scope,
          scopeId: input.scope === 'global' ? null : input.scopeId,
          key: input.key,
          content: input.content,
          category: input.category,
          tags: input.tags ?? [],
          priority: input.priority ?? 50,
          isActive: input.isActive ?? true,
          source: 'import',
          metadata: input.metadata ?? {},
          createdBy: input.createdBy,
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    this.logger.info('Memories imported', { imported, skipped });
    return { imported, skipped };
  }

  async export(query?: MemoryListQuery): Promise<ChatMemory[]> {
    const filter: Record<string, unknown> = {};
    if (query?.scope) filter.scope = query.scope;
    if (query?.scopeId !== undefined) filter.scopeId = query.scopeId;
    if (query?.category) filter.category = query.category;
    if (query?.source) filter.source = query.source;
    if (query?.isActive !== undefined) filter.isActive = query.isActive;

    const docs = await this.ChatMemory.find(filter).sort({ priority: -1, createdAt: -1 });
    return docs.map(docToMemory);
  }
}

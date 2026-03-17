import type { LogAdapter } from '@astralibx/core';
import type {
  MemoryBackend,
  ChatMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListQuery,
  MemoryScope,
  MemorySearchScope,
  MemoryBackendCustom,
} from '../types/memory.types';

export class CustomMemoryBackend implements MemoryBackend {
  constructor(
    private config: MemoryBackendCustom,
    private logger: LogAdapter,
  ) {}

  async create(input: CreateMemoryInput): Promise<ChatMemory> {
    const result = await this.config.create(input);
    this.logger.info('Custom memory created', { memoryId: result.memoryId });
    return result;
  }

  async update(memoryId: string, input: UpdateMemoryInput): Promise<ChatMemory> {
    const result = await this.config.update(memoryId, input);
    this.logger.info('Custom memory updated', { memoryId });
    return result;
  }

  async delete(memoryId: string): Promise<void> {
    await this.config.delete(memoryId);
    this.logger.info('Custom memory deleted', { memoryId });
  }

  async bulkDelete(memoryIds: string[]): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of memoryIds) {
      try {
        await this.config.delete(id);
        deleted++;
      } catch {
        // skip failures
      }
    }
    this.logger.info('Custom memories bulk deleted', { deleted });
    return { deleted };
  }

  async findById(memoryId: string): Promise<ChatMemory | null> {
    const result = await this.config.list({ limit: 1 });
    return result.memories.find((m) => m.memoryId === memoryId) ?? null;
  }

  async findByKey(scope: MemoryScope, scopeId: string | null, key: string): Promise<ChatMemory | null> {
    const result = await this.config.list({ scope, scopeId: scopeId ?? undefined, limit: 100 });
    return result.memories.find((m) => m.key === key) ?? null;
  }

  async list(query: MemoryListQuery): Promise<{ memories: ChatMemory[]; total: number }> {
    return this.config.list(query);
  }

  async listByScope(scope: MemoryScope, scopeId?: string): Promise<ChatMemory[]> {
    const result = await this.config.list({ scope, scopeId });
    return result.memories;
  }

  async listByCategory(category: string): Promise<ChatMemory[]> {
    const result = await this.config.list({ category });
    return result.memories;
  }

  async listByVisitor(visitorId: string): Promise<ChatMemory[]> {
    return this.config.getByVisitor(visitorId);
  }

  async getCategories(): Promise<string[]> {
    const result = await this.config.list({ limit: 1000 });
    const categories = new Set<string>();
    for (const m of result.memories) {
      if (m.category) categories.add(m.category);
    }
    return Array.from(categories);
  }

  async search(query: string, scope: MemorySearchScope): Promise<ChatMemory[]> {
    return this.config.search(query, scope);
  }

  async import(memories: CreateMemoryInput[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const input of memories) {
      try {
        await this.config.create({ ...input, source: 'import' });
        imported++;
      } catch {
        skipped++;
      }
    }
    this.logger.info('Custom memories imported', { imported, skipped });
    return { imported, skipped };
  }

  async export(query?: MemoryListQuery): Promise<ChatMemory[]> {
    const result = await this.config.list(query ?? {});
    return result.memories;
  }
}

import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type {
  MemoryBackend,
  ChatMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListQuery,
  MemoryScope,
  MemorySearchScope,
  MemoryBackendMem0,
} from '../types/memory.types';
import { MemoryNotFoundError } from '../errors';

const DEFAULT_SCOPE_MAPPING: Required<NonNullable<MemoryBackendMem0['scopeMapping']>> = {
  visitor: (scopeId: string) => ({ user_id: scopeId }),
  agent: (scopeId: string) => ({ agent_id: scopeId }),
  global: () => ({ user_id: 'global' }),
  channel: (scopeId: string) => ({ metadata: { channel: scopeId } }),
};

function mem0ResultToMemory(item: any, scope: MemoryScope = 'global', scopeId?: string): ChatMemory {
  return {
    memoryId: item.id ?? item.memory_id ?? crypto.randomUUID(),
    scope,
    scopeId,
    key: item.metadata?.key ?? item.id ?? '',
    content: item.memory ?? item.text ?? item.content ?? '',
    category: item.metadata?.category,
    tags: item.metadata?.tags ?? [],
    priority: item.metadata?.priority ?? 50,
    isActive: true,
    source: item.metadata?.source ?? 'admin',
    metadata: item.metadata ?? {},
    createdAt: item.created_at ? new Date(item.created_at) : new Date(),
    updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(),
    createdBy: item.metadata?.createdBy,
  };
}

export class Mem0MemoryBackend implements MemoryBackend {
  private client: any;
  private scopeMapping: Required<NonNullable<MemoryBackendMem0['scopeMapping']>>;

  constructor(
    config: MemoryBackendMem0,
    private logger: LogAdapter,
  ) {
    this.client = config.client;
    this.scopeMapping = {
      ...DEFAULT_SCOPE_MAPPING,
      ...config.scopeMapping,
    };
  }

  private getScopeParams(scope: MemoryScope, scopeId?: string): Record<string, unknown> {
    const mapper = this.scopeMapping[scope];
    if (scope === 'global') {
      return (this.scopeMapping.global as () => Record<string, unknown>)();
    }
    return (mapper as (id: string) => Record<string, unknown>)(scopeId ?? '');
  }

  async create(input: CreateMemoryInput): Promise<ChatMemory> {
    const scopeParams = this.getScopeParams(input.scope, input.scopeId);
    const metadata: Record<string, unknown> = {
      scope: input.scope,
      scopeId: input.scopeId,
      key: input.key,
      category: input.category,
      tags: input.tags,
      priority: input.priority ?? 50,
      source: input.source ?? 'admin',
      createdBy: input.createdBy,
      ...input.metadata,
    };

    const result = await this.client.add(input.content, {
      ...scopeParams,
      metadata,
    });

    this.logger.info('Mem0 memory created', { scope: input.scope });

    const id = result?.id ?? result?.results?.[0]?.id ?? crypto.randomUUID();
    return {
      memoryId: id,
      scope: input.scope,
      scopeId: input.scopeId,
      key: input.key,
      content: input.content,
      category: input.category,
      tags: input.tags ?? [],
      priority: input.priority ?? 50,
      isActive: true,
      source: input.source ?? 'admin',
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: input.createdBy,
    };
  }

  async update(memoryId: string, input: UpdateMemoryInput): Promise<ChatMemory> {
    if (input.content) {
      await this.client.update(memoryId, input.content);
    }
    this.logger.info('Mem0 memory updated', { memoryId });

    // Mem0 does not return full updated document, reconstruct best-effort
    return {
      memoryId,
      scope: 'global',
      key: input.key ?? '',
      content: input.content ?? '',
      category: input.category,
      tags: input.tags ?? [],
      priority: input.priority ?? 50,
      isActive: input.isActive ?? true,
      source: input.source ?? 'admin',
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async delete(memoryId: string): Promise<void> {
    try {
      await this.client.delete(memoryId);
      this.logger.info('Mem0 memory deleted', { memoryId });
    } catch {
      throw new MemoryNotFoundError(memoryId);
    }
  }

  async bulkDelete(memoryIds: string[]): Promise<{ deleted: number }> {
    let deleted = 0;
    for (const id of memoryIds) {
      try {
        await this.client.delete(id);
        deleted++;
      } catch {
        // skip failures
      }
    }
    this.logger.info('Mem0 memories bulk deleted', { deleted });
    return { deleted };
  }

  async findById(memoryId: string): Promise<ChatMemory | null> {
    try {
      const result = await this.client.get(memoryId);
      if (!result) return null;
      return mem0ResultToMemory(result);
    } catch {
      return null;
    }
  }

  async findByKey(_scope: MemoryScope, _scopeId: string | null, _key: string): Promise<ChatMemory | null> {
    // Mem0 does not support key-based lookup natively; search as fallback
    const scopeParams = this.getScopeParams(_scope, _scopeId ?? undefined);
    try {
      const results = await this.client.getAll(scopeParams);
      const items = Array.isArray(results) ? results : results?.results ?? [];
      const match = items.find((item: any) => item.metadata?.key === _key);
      return match ? mem0ResultToMemory(match, _scope, _scopeId ?? undefined) : null;
    } catch {
      return null;
    }
  }

  async list(query: MemoryListQuery): Promise<{ memories: ChatMemory[]; total: number }> {
    const scope = query.scope ?? 'global';
    const scopeParams = this.getScopeParams(scope, query.scopeId);

    try {
      const results = await this.client.getAll(scopeParams);
      let items: any[] = Array.isArray(results) ? results : results?.results ?? [];

      // Apply client-side filters
      if (query.category) {
        items = items.filter((i: any) => i.metadata?.category === query.category);
      }
      if (query.source) {
        items = items.filter((i: any) => i.metadata?.source === query.source);
      }
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        items = items.filter(
          (i: any) =>
            (i.memory ?? i.content ?? '').toLowerCase().includes(searchLower) ||
            (i.metadata?.key ?? '').toLowerCase().includes(searchLower),
        );
      }

      const total = items.length;
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const start = (page - 1) * limit;
      const paged = items.slice(start, start + limit);

      return {
        memories: paged.map((i: any) => mem0ResultToMemory(i, scope, query.scopeId)),
        total,
      };
    } catch {
      return { memories: [], total: 0 };
    }
  }

  async listByScope(scope: MemoryScope, scopeId?: string): Promise<ChatMemory[]> {
    const scopeParams = this.getScopeParams(scope, scopeId);
    try {
      const results = await this.client.getAll(scopeParams);
      const items: any[] = Array.isArray(results) ? results : results?.results ?? [];
      return items.map((i: any) => mem0ResultToMemory(i, scope, scopeId));
    } catch {
      return [];
    }
  }

  async listByCategory(category: string): Promise<ChatMemory[]> {
    // Mem0 does not natively support category filtering
    // Fetch all global and filter
    try {
      const results = await this.client.getAll(this.getScopeParams('global'));
      const items: any[] = Array.isArray(results) ? results : results?.results ?? [];
      return items
        .filter((i: any) => i.metadata?.category === category)
        .map((i: any) => mem0ResultToMemory(i, 'global'));
    } catch {
      return [];
    }
  }

  async listByVisitor(visitorId: string): Promise<ChatMemory[]> {
    return this.listByScope('visitor', visitorId);
  }

  async getCategories(): Promise<string[]> {
    // Mem0 does not support distinct queries natively
    try {
      const results = await this.client.getAll(this.getScopeParams('global'));
      const items: any[] = Array.isArray(results) ? results : results?.results ?? [];
      const categories = new Set<string>();
      for (const item of items) {
        if (item.metadata?.category) categories.add(item.metadata.category);
      }
      return Array.from(categories);
    } catch {
      return [];
    }
  }

  async search(query: string, scope: MemorySearchScope): Promise<ChatMemory[]> {
    const results: ChatMemory[] = [];

    // Search in each scope
    const scopes: Array<{ scope: MemoryScope; scopeId?: string }> = [
      { scope: 'global' },
    ];
    if (scope.visitorId) scopes.push({ scope: 'visitor', scopeId: scope.visitorId });
    if (scope.agentId) scopes.push({ scope: 'agent', scopeId: scope.agentId });
    if (scope.channel) scopes.push({ scope: 'channel', scopeId: scope.channel });

    for (const s of scopes) {
      try {
        const scopeParams = this.getScopeParams(s.scope, s.scopeId);
        const searchResults = await this.client.search(query, scopeParams);
        const items: any[] = Array.isArray(searchResults) ? searchResults : searchResults?.results ?? [];
        results.push(...items.map((i: any) => mem0ResultToMemory(i, s.scope, s.scopeId)));
      } catch {
        // Continue with other scopes
      }
    }

    return results;
  }

  async import(memories: CreateMemoryInput[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const input of memories) {
      try {
        await this.create({ ...input, source: 'import' });
        imported++;
      } catch {
        skipped++;
      }
    }

    this.logger.info('Mem0 memories imported', { imported, skipped });
    return { imported, skipped };
  }

  async export(query?: MemoryListQuery): Promise<ChatMemory[]> {
    const result = await this.list(query ?? {});
    return result.memories;
  }
}

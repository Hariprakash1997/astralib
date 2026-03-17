import type { LogAdapter } from '@astralibx/core';
import type {
  MemoryBackend,
  ChatMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryListQuery,
  MemoryScope,
  MemorySearchScope,
  MemoryContext,
  MemorySearchConfig,
} from '../types/memory.types';
import { DEFAULT_MEMORY_SEARCH } from '../types/config.types';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class MemoryService {
  private searchConfig: Required<MemorySearchConfig>;

  constructor(
    private backend: MemoryBackend,
    private logger: LogAdapter,
    searchConfig?: MemorySearchConfig,
    private embeddingAdapter?: {
      generate: (text: string) => Promise<number[]>;
      dimensions: number;
    },
  ) {
    this.searchConfig = {
      ...DEFAULT_MEMORY_SEARCH,
      ...searchConfig,
    };
  }

  async create(input: CreateMemoryInput): Promise<ChatMemory> {
    let embedding: number[] | undefined;
    if (this.embeddingAdapter) {
      try {
        embedding = await this.embeddingAdapter.generate(input.content);
      } catch (err) {
        this.logger.error('Failed to generate embedding for memory', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
    return this.backend.create(input, embedding);
  }

  async update(memoryId: string, input: UpdateMemoryInput): Promise<ChatMemory> {
    let embedding: number[] | undefined;
    if (this.embeddingAdapter && input.content) {
      try {
        embedding = await this.embeddingAdapter.generate(input.content);
      } catch (err) {
        this.logger.error('Failed to generate embedding for memory update', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
    return this.backend.update(memoryId, input, embedding);
  }

  async delete(memoryId: string): Promise<void> {
    return this.backend.delete(memoryId);
  }

  async bulkDelete(memoryIds: string[]): Promise<{ deleted: number }> {
    return this.backend.bulkDelete(memoryIds);
  }

  async findById(memoryId: string): Promise<ChatMemory | null> {
    return this.backend.findById(memoryId);
  }

  async findByKey(scope: MemoryScope, scopeId: string | null, key: string): Promise<ChatMemory | null> {
    return this.backend.findByKey(scope, scopeId, key);
  }

  async list(query: MemoryListQuery): Promise<{ memories: ChatMemory[]; total: number }> {
    return this.backend.list(query);
  }

  async listByScope(scope: MemoryScope, scopeId?: string): Promise<ChatMemory[]> {
    return this.backend.listByScope(scope, scopeId);
  }

  async listByCategory(category: string): Promise<ChatMemory[]> {
    return this.backend.listByCategory(category);
  }

  async listByVisitor(visitorId: string): Promise<ChatMemory[]> {
    return this.backend.listByVisitor(visitorId);
  }

  async getCategories(): Promise<string[]> {
    return this.backend.getCategories();
  }

  async getRelevantMemories(context: MemoryContext): Promise<ChatMemory[]> {
    const maxMemories = context.maxMemories ?? this.searchConfig.maxMemories;
    const maxTokens = context.maxTokens ?? this.searchConfig.maxTokens;
    const scope: MemorySearchScope = {
      visitorId: context.visitorId,
      agentId: context.agentId,
      channel: context.channel,
    };

    let memories: ChatMemory[];

    switch (this.searchConfig.strategy) {
      case 'priority': {
        // No search, just fetch by scope and sort by priority
        const lists = await Promise.all([
          this.backend.listByScope('global'),
          context.agentId ? this.backend.listByScope('agent', context.agentId) : Promise.resolve([]),
          this.backend.listByScope('visitor', context.visitorId),
          context.channel ? this.backend.listByScope('channel', context.channel) : Promise.resolve([]),
        ]);
        memories = lists.flat().sort((a, b) => b.priority - a.priority);
        break;
      }

      case 'text': {
        if (context.query) {
          memories = await this.backend.search(context.query, scope);
        } else {
          // Fallback to priority-based when no query
          const lists = await Promise.all([
            this.backend.listByScope('global'),
            context.agentId ? this.backend.listByScope('agent', context.agentId) : Promise.resolve([]),
            this.backend.listByScope('visitor', context.visitorId),
            context.channel ? this.backend.listByScope('channel', context.channel) : Promise.resolve([]),
          ]);
          memories = lists.flat().sort((a, b) => b.priority - a.priority);
        }
        break;
      }

      case 'custom': {
        if (this.searchConfig.customSearch && context.query) {
          memories = await this.searchConfig.customSearch(context.query, scope);
        } else {
          const lists = await Promise.all([
            this.backend.listByScope('global'),
            context.agentId ? this.backend.listByScope('agent', context.agentId) : Promise.resolve([]),
            this.backend.listByScope('visitor', context.visitorId),
            context.channel ? this.backend.listByScope('channel', context.channel) : Promise.resolve([]),
          ]);
          memories = lists.flat().sort((a, b) => b.priority - a.priority);
        }
        break;
      }

      default:
        memories = [];
    }

    // Cap by count
    memories = memories.slice(0, maxMemories);

    // Cap by token budget
    let tokenCount = 0;
    const budgeted: ChatMemory[] = [];
    for (const memory of memories) {
      const tokens = estimateTokens(memory.content);
      if (tokenCount + tokens > maxTokens) break;
      tokenCount += tokens;
      budgeted.push(memory);
    }

    return budgeted;
  }

  async import(memories: CreateMemoryInput[]): Promise<{ imported: number; skipped: number }> {
    return this.backend.import(memories);
  }

  async export(query?: MemoryListQuery): Promise<ChatMemory[]> {
    return this.backend.export(query);
  }
}

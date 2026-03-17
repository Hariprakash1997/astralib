import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService } from '../services/memory.service';
import type { MemoryBackend, ChatMemory, CreateMemoryInput, MemorySearchScope } from '../types/memory.types';
import type { LogAdapter } from '@astralibx/core';

function createMockMemory(overrides: Partial<ChatMemory> = {}): ChatMemory {
  return {
    memoryId: 'mem-1',
    scope: 'global',
    key: 'test-key',
    content: 'test content',
    tags: [],
    priority: 50,
    isActive: true,
    source: 'admin',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockBackend(): MemoryBackend {
  return {
    create: vi.fn().mockResolvedValue(createMockMemory()),
    update: vi.fn().mockResolvedValue(createMockMemory()),
    delete: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue({ deleted: 2 }),
    findById: vi.fn().mockResolvedValue(createMockMemory()),
    findByKey: vi.fn().mockResolvedValue(createMockMemory()),
    list: vi.fn().mockResolvedValue({ memories: [createMockMemory()], total: 1 }),
    listByScope: vi.fn().mockResolvedValue([createMockMemory()]),
    listByCategory: vi.fn().mockResolvedValue([createMockMemory()]),
    listByVisitor: vi.fn().mockResolvedValue([createMockMemory()]),
    getCategories: vi.fn().mockResolvedValue(['general']),
    search: vi.fn().mockResolvedValue([createMockMemory()]),
    import: vi.fn().mockResolvedValue({ imported: 2, skipped: 0 }),
    export: vi.fn().mockResolvedValue([createMockMemory()]),
  };
}

const mockLogger: LogAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;
  let backend: MemoryBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    backend = createMockBackend();
    service = new MemoryService(backend, mockLogger);
  });

  describe('CRUD', () => {
    it('should create a memory', async () => {
      const input: CreateMemoryInput = {
        scope: 'global',
        key: 'hours',
        content: '9am-5pm',
      };
      const result = await service.create(input);
      expect(result.memoryId).toBe('mem-1');
      expect(backend.create).toHaveBeenCalledWith(input, undefined);
    });

    it('should create a memory with embedding when adapter configured', async () => {
      const embeddingAdapter = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        dimensions: 3,
      };
      service = new MemoryService(backend, mockLogger, undefined, embeddingAdapter);

      const input: CreateMemoryInput = {
        scope: 'global',
        key: 'hours',
        content: '9am-5pm',
      };
      await service.create(input);
      expect(embeddingAdapter.generate).toHaveBeenCalledWith('9am-5pm');
      expect(backend.create).toHaveBeenCalledWith(input, [0.1, 0.2, 0.3]);
    });

    it('should update a memory', async () => {
      const result = await service.update('mem-1', { content: 'updated' });
      expect(result.memoryId).toBe('mem-1');
      expect(backend.update).toHaveBeenCalledWith('mem-1', { content: 'updated' }, undefined);
    });

    it('should delete a memory', async () => {
      await service.delete('mem-1');
      expect(backend.delete).toHaveBeenCalledWith('mem-1');
    });

    it('should bulk delete memories', async () => {
      const result = await service.bulkDelete(['mem-1', 'mem-2']);
      expect(result.deleted).toBe(2);
    });
  });

  describe('Query', () => {
    it('should find by id', async () => {
      const result = await service.findById('mem-1');
      expect(result?.memoryId).toBe('mem-1');
    });

    it('should find by key', async () => {
      const result = await service.findByKey('global', null, 'test-key');
      expect(result?.key).toBe('test-key');
    });

    it('should list memories', async () => {
      const result = await service.list({ scope: 'global' });
      expect(result.memories).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should list by visitor', async () => {
      const result = await service.listByVisitor('visitor-1');
      expect(backend.listByVisitor).toHaveBeenCalledWith('visitor-1');
      expect(result).toHaveLength(1);
    });

    it('should get categories', async () => {
      const result = await service.getCategories();
      expect(result).toEqual(['general']);
    });
  });

  describe('getRelevantMemories', () => {
    it('should fetch memories by priority strategy', async () => {
      service = new MemoryService(backend, mockLogger, { strategy: 'priority' });

      await service.getRelevantMemories({
        visitorId: 'v1',
        agentId: 'a1',
        channel: 'web',
      });

      expect(backend.listByScope).toHaveBeenCalledWith('global');
      expect(backend.listByScope).toHaveBeenCalledWith('agent', 'a1');
      expect(backend.listByScope).toHaveBeenCalledWith('visitor', 'v1');
      expect(backend.listByScope).toHaveBeenCalledWith('channel', 'web');
    });

    it('should use text search when query provided', async () => {
      service = new MemoryService(backend, mockLogger, { strategy: 'text' });

      await service.getRelevantMemories({
        visitorId: 'v1',
        query: 'refund policy',
      });

      expect(backend.search).toHaveBeenCalledWith('refund policy', {
        visitorId: 'v1',
        agentId: undefined,
        channel: undefined,
      });
    });

    it('should respect maxMemories limit', async () => {
      const manyMemories = Array.from({ length: 20 }, (_, i) =>
        createMockMemory({ memoryId: `mem-${i}`, priority: 100 - i, content: 'x' }),
      );
      (backend.listByScope as any).mockResolvedValue(manyMemories);

      service = new MemoryService(backend, mockLogger, {
        strategy: 'priority',
        maxMemories: 3,
        maxTokens: 10000,
      });

      const result = await service.getRelevantMemories({ visitorId: 'v1' });
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should respect maxTokens budget', async () => {
      const longMemory = createMockMemory({ content: 'x'.repeat(8000) }); // ~2000 tokens
      (backend.listByScope as any).mockResolvedValue([longMemory, longMemory, longMemory]);

      service = new MemoryService(backend, mockLogger, {
        strategy: 'priority',
        maxMemories: 10,
        maxTokens: 2500,
      });

      const result = await service.getRelevantMemories({ visitorId: 'v1' });
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('import/export', () => {
    it('should import memories', async () => {
      const result = await service.import([
        { scope: 'global', key: 'k1', content: 'c1' },
      ]);
      expect(result.imported).toBe(2);
    });

    it('should export memories', async () => {
      const result = await service.export();
      expect(result).toHaveLength(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuiltinMemoryBackend } from '../backends/builtin.backend';
import { MemoryNotFoundError } from '../errors';
import type { LogAdapter } from '@astralibx/core';

function createMockDoc(overrides: Record<string, unknown> = {}) {
  return {
    memoryId: 'mem-1',
    scope: 'global',
    scopeId: null,
    key: 'hours',
    content: 'Business hours are 9am-5pm',
    category: 'info',
    tags: ['hours'],
    priority: 50,
    isActive: true,
    source: 'admin',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockModel() {
  const doc = createMockDoc();
  return {
    create: vi.fn().mockResolvedValue(doc),
    findOne: vi.fn().mockResolvedValue(doc),
    findOneAndUpdate: vi.fn().mockResolvedValue(doc),
    find: vi.fn().mockImplementation((_filter?: any, _projection?: any) => ({
      sort: vi.fn().mockImplementation(() => ({
        skip: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockResolvedValue([doc]),
        })),
        limit: vi.fn().mockResolvedValue([doc]),
      })),
    })),
    countDocuments: vi.fn().mockResolvedValue(1),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    distinct: vi.fn().mockResolvedValue(['info']),
    insertMany: vi.fn().mockResolvedValue([doc]),
  };
}

const mockLogger: LogAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('BuiltinMemoryBackend', () => {
  let backend: BuiltinMemoryBackend;
  let model: ReturnType<typeof createMockModel>;

  beforeEach(() => {
    vi.clearAllMocks();
    model = createMockModel();
    backend = new BuiltinMemoryBackend(model as any, mockLogger);
  });

  describe('create', () => {
    it('should create a memory with generated id', async () => {
      const result = await backend.create({
        scope: 'global',
        key: 'hours',
        content: 'Business hours are 9am-5pm',
      });
      expect(result.memoryId).toBe('mem-1');
      expect(model.create).toHaveBeenCalled();
    });

    it('should set scopeId to null for global scope', async () => {
      await backend.create({
        scope: 'global',
        key: 'hours',
        content: 'test',
      });
      const createArg = model.create.mock.calls[0][0];
      expect(createArg.scopeId).toBeNull();
    });

    it('should store embedding when provided', async () => {
      await backend.create(
        { scope: 'global', key: 'hours', content: 'test' },
        [0.1, 0.2, 0.3],
      );
      const createArg = model.create.mock.calls[0][0];
      expect(createArg.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('update', () => {
    it('should update and return the memory', async () => {
      const result = await backend.update('mem-1', { content: 'updated' });
      expect(result.memoryId).toBe('mem-1');
    });

    it('should throw MemoryNotFoundError when not found', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);
      await expect(backend.update('nonexistent', { content: 'x' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete a memory', async () => {
      await backend.delete('mem-1');
      expect(model.deleteOne).toHaveBeenCalledWith({ memoryId: 'mem-1' });
    });

    it('should throw when memory not found', async () => {
      model.deleteOne.mockResolvedValue({ deletedCount: 0 });
      await expect(backend.delete('nonexistent')).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('list', () => {
    it('should list with pagination', async () => {
      const result = await backend.list({ page: 1, limit: 10 });
      expect(result.memories).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply filters', async () => {
      await backend.list({
        scope: 'visitor',
        scopeId: 'v1',
        category: 'notes',
        source: 'agent',
        isActive: true,
      });
      const findArg = model.find.mock.calls[0][0];
      expect(findArg.scope).toBe('visitor');
      expect(findArg.scopeId).toBe('v1');
      expect(findArg.category).toBe('notes');
      expect(findArg.source).toBe('agent');
      expect(findArg.isActive).toBe(true);
    });
  });

  describe('search', () => {
    it('should search with text index and scope filters', async () => {
      await backend.search('refund', {
        visitorId: 'v1',
        agentId: 'a1',
        channel: 'web',
      });

      expect(model.find).toHaveBeenCalled();
      const filter = model.find.mock.calls[0][0];
      expect(filter.$text).toEqual({ $search: 'refund' });
      expect(filter.isActive).toBe(true);
      expect(filter.$or).toHaveLength(4); // global + visitor + agent + channel
    });
  });

  describe('import', () => {
    it('should import memories and count results', async () => {
      const result = await backend.import([
        { scope: 'global', key: 'k1', content: 'c1' },
        { scope: 'global', key: 'k2', content: 'c2' },
      ]);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should skip failed imports', async () => {
      model.create.mockRejectedValueOnce(new Error('duplicate key'));
      model.create.mockResolvedValueOnce(createMockDoc());

      const result = await backend.import([
        { scope: 'global', key: 'k1', content: 'c1' },
        { scope: 'global', key: 'k2', content: 'c2' },
      ]);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('getCategories', () => {
    it('should return distinct categories', async () => {
      const result = await backend.getCategories();
      expect(result).toEqual(['info']);
    });
  });
});

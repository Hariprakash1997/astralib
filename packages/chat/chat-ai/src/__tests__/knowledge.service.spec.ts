import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeService } from '../services/knowledge.service';
import { KnowledgeEntryNotFoundError } from '../errors';
import type { LogAdapter } from '@astralibx/core';

function createMockDoc(overrides: Record<string, unknown> = {}) {
  return {
    entryId: 'k-1',
    title: 'Return Policy',
    content: '30 day returns accepted.',
    category: 'policies',
    tags: ['returns'],
    isActive: true,
    priority: 50,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    ...overrides,
  };
}

function createSortResult(docs: any[]) {
  // Mongoose query result: thenable + chainable (.skip, .limit)
  const result = {
    skip: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockResolvedValue(docs),
    })),
    limit: vi.fn().mockResolvedValue(docs),
    then: (resolve: any) => resolve(docs),
  };
  return result;
}

function createMockModel() {
  const doc = createMockDoc();
  return {
    create: vi.fn().mockResolvedValue(doc),
    findOne: vi.fn().mockResolvedValue(doc),
    findOneAndUpdate: vi.fn().mockResolvedValue(doc),
    find: vi.fn().mockImplementation((_filter?: any, _projection?: any) => ({
      sort: vi.fn().mockReturnValue(createSortResult([doc])),
    })),
    countDocuments: vi.fn().mockResolvedValue(1),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
    distinct: vi.fn().mockResolvedValue(['policies']),
    insertMany: vi.fn().mockResolvedValue([doc]),
  };
}

const mockLogger: LogAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let model: ReturnType<typeof createMockModel>;

  beforeEach(() => {
    vi.clearAllMocks();
    model = createMockModel();
    service = new KnowledgeService(model as any, mockLogger);
  });

  it('should create an entry', async () => {
    const result = await service.create({
      title: 'Test',
      content: 'Test content',
    });
    expect(result.entryId).toBe('k-1');
    expect(model.create).toHaveBeenCalled();
  });

  it('should generate embedding on create when adapter configured', async () => {
    const embeddingAdapter = {
      generate: vi.fn().mockResolvedValue([0.1, 0.2]),
      dimensions: 2,
    };
    service = new KnowledgeService(model as any, mockLogger, undefined, embeddingAdapter);

    await service.create({ title: 'Test', content: 'Content' });
    expect(embeddingAdapter.generate).toHaveBeenCalledWith('Test\nContent');
  });

  it('should update an entry', async () => {
    const result = await service.update('k-1', { title: 'Updated' });
    expect(result.entryId).toBe('k-1');
  });

  it('should throw on update if not found', async () => {
    model.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.update('nonexistent', { title: 'X' })).rejects.toThrow(KnowledgeEntryNotFoundError);
  });

  it('should delete an entry', async () => {
    await service.delete('k-1');
    expect(model.deleteOne).toHaveBeenCalledWith({ entryId: 'k-1' });
  });

  it('should throw on delete if not found', async () => {
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.delete('nonexistent')).rejects.toThrow(KnowledgeEntryNotFoundError);
  });

  it('should bulk delete', async () => {
    const result = await service.bulkDelete(['k-1', 'k-2']);
    expect(result.deleted).toBe(2);
  });

  it('should list entries', async () => {
    const result = await service.list({});
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should get categories', async () => {
    const result = await service.getCategories();
    expect(result).toEqual(['policies']);
  });

  it('should import entries', async () => {
    const result = await service.import([
      { title: 'T1', content: 'C1' },
    ]);
    expect(result.imported).toBe(1);
  });

  it('should export entries', async () => {
    const result = await service.export();
    expect(result).toHaveLength(1);
  });

  describe('getRelevantKnowledge', () => {
    it('should fetch by priority strategy', async () => {
      service = new KnowledgeService(model as any, mockLogger, { strategy: 'priority' });
      const result = await service.getRelevantKnowledge('refund');
      expect(result).toHaveLength(1);
    });

    it('should respect token budget', async () => {
      const longDoc = createMockDoc({ content: 'x'.repeat(12000) }); // ~3000 tokens
      model.find.mockImplementation(() => ({
        sort: vi.fn().mockReturnValue(createSortResult([longDoc, longDoc, longDoc])),
      }));

      service = new KnowledgeService(model as any, mockLogger, {
        strategy: 'priority',
        maxTokens: 3500,
        maxEntries: 10,
      });

      const result = await service.getRelevantKnowledge('test');
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FAQService } from '../services/faq.service';
import type { ChatFAQItemModel } from '../schemas/chat-faq-item.schema';
import type { LogAdapter } from '@astralibx/core';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockFAQModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }),
    distinct: vi.fn().mockResolvedValue([]),
    bulkWrite: vi.fn().mockResolvedValue({}),
    insertMany: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  } as unknown as ChatFAQItemModel;
}

function createMockFAQItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'faq-1',
    question: 'How do I reset?',
    answer: 'Click the reset button.',
    category: 'general',
    tags: ['reset'],
    order: 0,
    isActive: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    ...overrides,
  };
}

describe('FAQService', () => {
  let service: FAQService;
  let model: ChatFAQItemModel;
  let logger: LogAdapter;

  beforeEach(() => {
    model = createMockFAQModel();
    logger = createMockLogger();
    service = new FAQService(model, logger);
  });

  describe('create()', () => {
    it('should create a FAQ item with generated itemId', async () => {
      const mockItem = createMockFAQItem();
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockItem);

      const result = await service.create({ question: 'Q?', answer: 'A.' });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: expect.any(String),
          question: 'Q?',
          answer: 'A.',
        }),
      );
      expect(result).toBe(mockItem);
      expect(logger.info).toHaveBeenCalledWith('FAQ item created', expect.any(Object));
    });
  });

  describe('list()', () => {
    it('should list items with no filters', async () => {
      await service.list();
      expect(model.find).toHaveBeenCalledWith({});
    });

    it('should apply category filter', async () => {
      await service.list({ category: 'billing' });
      expect(model.find).toHaveBeenCalledWith({ category: 'billing' });
    });

    it('should apply search filter with regex', async () => {
      await service.list({ search: 'reset' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({ question: { $regex: 'reset', $options: 'i' } }),
          ]),
        }),
      );
    });
  });

  describe('update()', () => {
    it('should update a FAQ item by itemId', async () => {
      const updatedItem = createMockFAQItem({ answer: 'Updated answer' });
      (model.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedItem);

      const result = await service.update('faq-1', { answer: 'Updated answer' });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { itemId: 'faq-1' },
        { $set: { answer: 'Updated answer' } },
        { new: true },
      );
      expect(result).toBe(updatedItem);
    });

    it('should return null when item not found', async () => {
      (model.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.update('nonexistent', { answer: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('remove()', () => {
    it('should delete item by itemId', async () => {
      await service.remove('faq-1');
      expect(model.deleteOne).toHaveBeenCalledWith({ itemId: 'faq-1' });
    });
  });

  describe('getCategories()', () => {
    it('should return distinct categories', async () => {
      (model.distinct as ReturnType<typeof vi.fn>).mockResolvedValue(['billing', 'general']);

      const result = await service.getCategories();
      expect(result).toEqual(['billing', 'general']);
    });
  });

  describe('reorder()', () => {
    it('should bulkWrite reorder operations', async () => {
      await service.reorder([
        { itemId: 'faq-1', order: 0 },
        { itemId: 'faq-2', order: 1 },
      ]);

      expect(model.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: { itemId: 'faq-1' }, update: { $set: { order: 0 } } } },
        { updateOne: { filter: { itemId: 'faq-2' }, update: { $set: { order: 1 } } } },
      ]);
    });
  });

  describe('bulkImport()', () => {
    it('should insert multiple items with generated IDs', async () => {
      const items = [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2', category: 'billing' },
      ];
      const createdDocs = items.map((item, i) => ({ ...item, itemId: `gen-${i}` }));
      (model.insertMany as ReturnType<typeof vi.fn>).mockResolvedValue(createdDocs);

      const result = await service.bulkImport(items);

      expect(model.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ question: 'Q1', answer: 'A1', isActive: true }),
          expect.objectContaining({ question: 'Q2', answer: 'A2', category: 'billing' }),
        ]),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('incrementViewCount()', () => {
    it('should increment viewCount', async () => {
      await service.incrementViewCount('faq-1');
      expect(model.updateOne).toHaveBeenCalledWith(
        { itemId: 'faq-1' },
        { $inc: { viewCount: 1 } },
      );
    });
  });

  describe('recordFeedback()', () => {
    it('should increment helpfulCount when helpful', async () => {
      await service.recordFeedback('faq-1', true);
      expect(model.updateOne).toHaveBeenCalledWith(
        { itemId: 'faq-1' },
        { $inc: { helpfulCount: 1 } },
      );
    });

    it('should increment notHelpfulCount when not helpful', async () => {
      await service.recordFeedback('faq-1', false);
      expect(model.updateOne).toHaveBeenCalledWith(
        { itemId: 'faq-1' },
        { $inc: { notHelpfulCount: 1 } },
      );
    });
  });
});

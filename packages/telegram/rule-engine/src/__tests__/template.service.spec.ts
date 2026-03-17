import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../services/template.service';

function createMockModel() {
  return {
    create: vi.fn().mockImplementation((data: any) => Promise.resolve({ _id: 'tmpl-1', ...data })),
    findById: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }),
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    findByIdAndDelete: vi.fn().mockResolvedValue(null),
  };
}

function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    db: { connection: {} },
    redis: { connection: {} },
    adapters: {
      queryUsers: vi.fn(),
      resolveData: vi.fn(),
      sendMessage: vi.fn(),
      selectAccount: vi.fn(),
      findIdentifier: vi.fn(),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function createService(model = createMockModel(), config = createMockConfig()) {
  return {
    service: new TemplateService(model as any, config as any),
    model,
    config,
  };
}

describe('TemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a template and auto-extracts variables', async () => {
      const { service, model } = createService();

      await service.create({
        name: 'Welcome',
        messages: ['Hello {{name}}, welcome to {{platform}}!'],
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Welcome',
          messages: ['Hello {{name}}, welcome to {{platform}}!'],
          variables: expect.arrayContaining(['name', 'platform']),
        })
      );
    });

    it('uses provided variables if given', async () => {
      const { service, model } = createService();

      await service.create({
        name: 'Custom',
        messages: ['Hello {{name}}'],
        variables: ['name', 'customVar'],
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: ['name', 'customVar'],
        })
      );
    });

    it('throws when no messages provided', async () => {
      const { service } = createService();

      await expect(
        service.create({ name: 'Empty', messages: [] } as any)
      ).rejects.toThrow('At least one message is required');
    });

    it('throws when messages is undefined', async () => {
      const { service } = createService();

      await expect(
        service.create({ name: 'No messages' } as any)
      ).rejects.toThrow();
    });

    it('throws when a message has invalid Handlebars syntax', async () => {
      const { service } = createService();

      await expect(
        service.create({
          name: 'Bad',
          messages: ['{{#if}}{{/unless}}'],
        } as any)
      ).rejects.toThrow('Template validation failed');
    });
  });

  describe('list', () => {
    it('returns all templates when no filters', async () => {
      const model = createMockModel();
      const sortMock = vi.fn().mockResolvedValue([{ _id: '1', name: 'T1' }]);
      model.find.mockReturnValue({ sort: sortMock });

      const { service } = createService(model);
      const result = await service.list();

      expect(model.find).toHaveBeenCalledWith({});
      expect(result).toHaveLength(1);
    });

    it('applies category filter', async () => {
      const model = createMockModel();
      model.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

      const { service } = createService(model);
      await service.list({ category: 'onboarding' });

      expect(model.find).toHaveBeenCalledWith({ category: 'onboarding' });
    });

    it('applies platform filter', async () => {
      const model = createMockModel();
      model.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

      const { service } = createService(model);
      await service.list({ platform: 'telegram' });

      expect(model.find).toHaveBeenCalledWith({ platform: 'telegram' });
    });

    it('applies audience filter', async () => {
      const model = createMockModel();
      model.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

      const { service } = createService(model);
      await service.list({ audience: 'customer' });

      expect(model.find).toHaveBeenCalledWith({ audience: 'customer' });
    });

    it('applies multiple filters', async () => {
      const model = createMockModel();
      model.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

      const { service } = createService(model);
      await service.list({ category: 'onboarding', platform: 'telegram' });

      expect(model.find).toHaveBeenCalledWith({
        category: 'onboarding',
        platform: 'telegram',
      });
    });
  });

  describe('update', () => {
    it('returns null when template not found', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue(null);

      const { service } = createService(model);
      const result = await service.update('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('re-extracts variables when messages are updated', async () => {
      const model = createMockModel();
      const existingTemplate = {
        _id: 'tmpl-1',
        messages: ['Old {{oldVar}}'],
        variables: ['oldVar'],
      };
      model.findById.mockResolvedValue(existingTemplate);
      model.findByIdAndUpdate.mockResolvedValue({ ...existingTemplate, messages: ['New {{newVar}}'] });

      const { service } = createService(model);
      await service.update('tmpl-1', { messages: ['New {{newVar}}'] } as any);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'tmpl-1',
        {
          $set: expect.objectContaining({
            messages: ['New {{newVar}}'],
            variables: expect.arrayContaining(['newVar']),
          }),
        },
        { new: true }
      );
    });

    it('throws when empty messages array provided', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue({ _id: 'tmpl-1', messages: ['Old'] });

      const { service } = createService(model);

      await expect(
        service.update('tmpl-1', { messages: [] } as any)
      ).rejects.toThrow('At least one message is required');
    });

    it('validates messages syntax on update', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue({ _id: 'tmpl-1', messages: ['Old'] });

      const { service } = createService(model);

      await expect(
        service.update('tmpl-1', { messages: ['{{#if}}{{/unless}}'] } as any)
      ).rejects.toThrow('Template validation failed');
    });
  });

  describe('delete', () => {
    it('returns true when template is deleted', async () => {
      const model = createMockModel();
      model.findByIdAndDelete.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(model);
      const result = await service.delete('tmpl-1');

      expect(result).toBe(true);
    });

    it('returns false when template not found', async () => {
      const model = createMockModel();
      model.findByIdAndDelete.mockResolvedValue(null);

      const { service } = createService(model);
      const result = await service.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('preview', () => {
    it('returns null when template not found', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue(null);

      const { service } = createService(model);
      const result = await service.preview('non-existent');

      expect(result).toBeNull();
    });

    it('generates placeholder values for missing variables', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue({
        _id: 'tmpl-1',
        messages: ['Hello {{name}}, your code is {{code}}'],
        variables: ['name', 'code'],
      });

      const { service } = createService(model);
      const result = await service.preview('tmpl-1');

      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0]).toContain('[name]');
      expect(result!.messages[0]).toContain('[code]');
    });

    it('uses provided sample data', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue({
        _id: 'tmpl-1',
        messages: ['Hello {{name}}'],
        variables: ['name'],
      });

      const { service } = createService(model);
      const result = await service.preview('tmpl-1', { name: 'Alice' });

      expect(result).not.toBeNull();
      expect(result!.messages[0]).toBe('Hello Alice');
    });

    it('renders multiple message variants', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue({
        _id: 'tmpl-1',
        messages: ['Hello {{name}}', 'Hi {{name}}'],
        variables: ['name'],
      });

      const { service } = createService(model);
      const result = await service.preview('tmpl-1', { name: 'Bob' });

      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[0]).toBe('Hello Bob');
      expect(result!.messages[1]).toBe('Hi Bob');
    });
  });

  describe('getById()', () => {
    it('should return template when found', async () => {
      const model = createMockModel();
      const templateDoc = { _id: 'tmpl-1', name: 'Welcome', messages: ['Hello {{name}}'] };
      model.findById.mockResolvedValue(templateDoc);

      const { service } = createService(model);
      const result = await service.getById('tmpl-1');

      expect(model.findById).toHaveBeenCalledWith('tmpl-1');
      expect(result).toEqual(templateDoc);
    });

    it('should return null when not found', async () => {
      const model = createMockModel();
      model.findById.mockResolvedValue(null);

      const { service } = createService(model);
      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('extractVariables', () => {
    it('delegates to render service', () => {
      const { service } = createService();
      const vars = service.extractVariables(['Hello {{name}}, your {{item}}']);

      expect(vars).toContain('name');
      expect(vars).toContain('item');
    });
  });

  describe('compileMessages', () => {
    it('returns compiled handlebars functions', () => {
      const { service } = createService();
      const fns = service.compileMessages({ messages: ['Hello {{name}}'] });

      expect(fns).toHaveLength(1);
      expect(typeof fns[0]).toBe('function');
      expect(fns[0]({ name: 'Alice' })).toBe('Hello Alice');
    });
  });
});

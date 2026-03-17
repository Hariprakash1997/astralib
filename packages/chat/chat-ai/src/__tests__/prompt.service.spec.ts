import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptService } from '../services/prompt.service';
import { PromptTemplateNotFoundError } from '../errors';
import type { LogAdapter } from '@astralibx/core';

function createMockModel() {
  const mockDoc = {
    templateId: 'tpl-1',
    name: 'Default Support',
    description: 'Default template',
    isDefault: true,
    isActive: true,
    sections: [
      {
        key: 'identity',
        label: 'Identity',
        content: 'You are {{agentName}}.',
        position: 1,
        isEnabled: true,
        isSystem: false,
        variables: ['agentName'],
      },
    ],
    responseFormat: undefined,
    temperature: 0.7,
    maxTokens: 1000,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
  };

  return {
    create: vi.fn().mockResolvedValue(mockDoc),
    findOne: vi.fn().mockResolvedValue(mockDoc),
    findOneAndUpdate: vi.fn().mockResolvedValue(mockDoc),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([mockDoc]),
    }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
}

const mockLogger: LogAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('PromptService', () => {
  let service: PromptService;
  let model: ReturnType<typeof createMockModel>;

  beforeEach(() => {
    vi.clearAllMocks();
    model = createMockModel();
    service = new PromptService(model as any, mockLogger);
  });

  it('should create a template', async () => {
    const result = await service.create({
      name: 'Test',
      sections: [],
    });
    expect(result.name).toBe('Default Support');
    expect(model.create).toHaveBeenCalled();
  });

  it('should unset other defaults when creating a default template', async () => {
    await service.create({
      name: 'Test',
      isDefault: true,
      sections: [],
    });
    expect(model.updateMany).toHaveBeenCalledWith(
      { isDefault: true },
      { $set: { isDefault: false } },
    );
  });

  it('should update a template', async () => {
    const result = await service.update('tpl-1', { name: 'Updated' });
    expect(result.templateId).toBe('tpl-1');
    expect(model.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should throw on update if not found', async () => {
    model.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(PromptTemplateNotFoundError);
  });

  it('should delete a template', async () => {
    await service.delete('tpl-1');
    expect(model.deleteOne).toHaveBeenCalledWith({ templateId: 'tpl-1' });
  });

  it('should throw on delete if not found', async () => {
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.delete('nonexistent')).rejects.toThrow(PromptTemplateNotFoundError);
  });

  it('should set default', async () => {
    await service.setDefault('tpl-1');
    expect(model.updateMany).toHaveBeenCalledWith(
      { isDefault: true },
      { $set: { isDefault: false } },
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { templateId: 'tpl-1' },
      { $set: { isDefault: true } },
      { new: true },
    );
  });

  it('should find by id', async () => {
    const result = await service.findById('tpl-1');
    expect(result?.templateId).toBe('tpl-1');
  });

  it('should find default', async () => {
    const result = await service.findDefault();
    expect(result?.isDefault).toBe(true);
  });

  it('should list templates', async () => {
    const result = await service.list();
    expect(result).toHaveLength(1);
  });
});

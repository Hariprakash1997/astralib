import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleService } from '../services/rule.service';
import { TemplateNotFoundError, RuleNotFoundError } from '../errors';

function createMockRuleModel() {
  return {
    create: vi.fn().mockImplementation((data: any) => Promise.resolve({ _id: 'rule-1', ...data })),
    findById: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    }),
    findActive: vi.fn().mockResolvedValue([]),
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    findByIdAndDelete: vi.fn().mockResolvedValue(null),
  };
}

function createMockTemplateModel() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  };
}

function createMockRunLogModel() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    db: { connection: {} },
    redis: { connection: {} },
    adapters: {
      queryUsers: vi.fn().mockResolvedValue([]),
      resolveData: vi.fn(),
      sendMessage: vi.fn(),
      selectAccount: vi.fn(),
      findIdentifier: vi.fn(),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    options: { defaultMaxPerRun: 50 },
    ...overrides,
  };
}

function createService(
  ruleModel = createMockRuleModel(),
  templateModel = createMockTemplateModel(),
  runLogModel = createMockRunLogModel(),
  config = createMockConfig()
) {
  return {
    service: new RuleService(ruleModel as any, templateModel as any, runLogModel as any, config as any),
    ruleModel,
    templateModel,
    runLogModel,
    config,
  };
}

describe('RuleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates rule when template exists and target is valid (query mode)', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1', name: 'Welcome' });

      const { service, ruleModel } = createService(undefined, templateModel);
      await service.create({
        name: 'Test Rule',
        templateId: 'tmpl-1',
        target: { mode: 'query', conditions: { role: 'customer' } },
      });

      expect(ruleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Rule',
          templateId: 'tmpl-1',
        })
      );
    });

    it('creates rule with list mode target', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service, ruleModel } = createService(undefined, templateModel);
      await service.create({
        name: 'List Rule',
        templateId: 'tmpl-1',
        target: { mode: 'list', identifiers: ['+919876543210'] },
      });

      expect(ruleModel.create).toHaveBeenCalled();
    });

    it('throws TemplateNotFoundError when templateId does not exist', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue(null);

      const { service } = createService(undefined, templateModel);

      await expect(
        service.create({
          name: 'Test',
          templateId: 'non-existent',
          target: { mode: 'query', conditions: {} },
        })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('throws when query mode has no conditions', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(undefined, templateModel);

      await expect(
        service.create({
          name: 'Bad Query',
          templateId: 'tmpl-1',
          target: { mode: 'query' } as any,
        })
      ).rejects.toThrow('Query mode requires a conditions object');
    });

    it('throws when list mode has empty identifiers', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(undefined, templateModel);

      await expect(
        service.create({
          name: 'Bad List',
          templateId: 'tmpl-1',
          target: { mode: 'list', identifiers: [] },
        })
      ).rejects.toThrow('List mode requires a non-empty identifiers array');
    });

    it('throws when list mode has no identifiers field', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(undefined, templateModel);

      await expect(
        service.create({
          name: 'No Ids',
          templateId: 'tmpl-1',
          target: { mode: 'list' } as any,
        })
      ).rejects.toThrow('List mode requires a non-empty identifiers array');
    });

    it('throws when target mode is invalid', async () => {
      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(undefined, templateModel);

      await expect(
        service.create({
          name: 'Bad Mode',
          templateId: 'tmpl-1',
          target: { mode: 'invalid' } as any,
        })
      ).rejects.toThrow('Invalid target mode');
    });
  });

  describe('list', () => {
    it('queries with no filter by default', async () => {
      const { service, ruleModel } = createService();
      await service.list();

      expect(ruleModel.find).toHaveBeenCalledWith({});
    });

    it('applies isActive filter', async () => {
      const { service, ruleModel } = createService();
      await service.list({ isActive: true });

      expect(ruleModel.find).toHaveBeenCalledWith({ isActive: true });
    });

    it('applies platform filter', async () => {
      const { service, ruleModel } = createService();
      await service.list({ platform: 'telegram' });

      expect(ruleModel.find).toHaveBeenCalledWith({ platform: 'telegram' });
    });
  });

  describe('activate', () => {
    it('returns null when rule not found', async () => {
      const { service } = createService();
      const result = await service.activate('non-existent');
      expect(result).toBeNull();
    });

    it('throws TemplateNotFoundError when rule template is missing', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({ _id: 'rule-1', templateId: 'tmpl-missing' });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel, templateModel);

      await expect(service.activate('rule-1')).rejects.toThrow(TemplateNotFoundError);
    });

    it('sets isActive to true when template exists', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({ _id: 'rule-1', templateId: 'tmpl-1' });
      ruleModel.findByIdAndUpdate.mockResolvedValue({ _id: 'rule-1', isActive: true });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(ruleModel, templateModel);
      const result = await service.activate('rule-1');

      expect(ruleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { isActive: true } },
        { new: true }
      );
      expect(result).toEqual(expect.objectContaining({ isActive: true }));
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findByIdAndUpdate.mockResolvedValue({ _id: 'rule-1', isActive: false });

      const { service } = createService(ruleModel);
      await service.deactivate('rule-1');

      expect(ruleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { isActive: false } },
        { new: true }
      );
    });

    it('returns null when rule not found', async () => {
      const { service } = createService();
      const result = await service.deactivate('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns { deleted: true } when rule is deleted', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findByIdAndDelete.mockResolvedValue({ _id: 'rule-1' });

      const { service } = createService(ruleModel);
      const result = await service.delete('rule-1');
      expect(result).toEqual({ deleted: true });
    });

    it('returns { deleted: false } when rule not found', async () => {
      const { service } = createService();
      const result = await service.delete('non-existent');
      expect(result).toEqual({ deleted: false });
    });
  });

  describe('dryRun', () => {
    it('throws RuleNotFoundError when rule does not exist', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel);

      await expect(service.dryRun('non-existent')).rejects.toThrow(RuleNotFoundError);
    });

    it('reports template not found in errors', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({
        _id: 'rule-1',
        templateId: 'tmpl-missing',
        target: { mode: 'query', conditions: { role: 'customer' } },
      });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel, templateModel);
      const result = await service.dryRun('rule-1');

      expect(result.templateExists).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Template'),
      ]));
    });

    it('reports valid when all checks pass (query mode)', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({
        _id: 'rule-1',
        templateId: 'tmpl-1',
        target: { mode: 'query', conditions: { role: 'customer' } },
        maxPerRun: 10,
      });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const config = createMockConfig();
      config.adapters.queryUsers.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]);

      const { service } = createService(ruleModel, templateModel, undefined, config);
      const result = await service.dryRun('rule-1');

      expect(result.valid).toBe(true);
      expect(result.templateExists).toBe(true);
      expect(result.targetValid).toBe(true);
      expect(result.matchedCount).toBe(2);
      expect(result.effectiveLimit).toBe(10);
    });

    it('reports matchedCount for list mode', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({
        _id: 'rule-1',
        templateId: 'tmpl-1',
        target: { mode: 'list', identifiers: ['+91111', '+91222', '+91333'] },
      });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(ruleModel, templateModel);
      const result = await service.dryRun('rule-1');

      expect(result.valid).toBe(true);
      expect(result.matchedCount).toBe(3);
    });

    it('uses defaultMaxPerRun from config when rule has none', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({
        _id: 'rule-1',
        templateId: 'tmpl-1',
        target: { mode: 'list', identifiers: ['+91111'] },
      });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const config = createMockConfig({ options: { defaultMaxPerRun: 50 } });
      const { service } = createService(ruleModel, templateModel, undefined, config);
      const result = await service.dryRun('rule-1');

      expect(result.effectiveLimit).toBe(50);
    });

    it('reports invalid target in errors', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({
        _id: 'rule-1',
        templateId: 'tmpl-1',
        target: { mode: 'invalid' },
      });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue({ _id: 'tmpl-1' });

      const { service } = createService(ruleModel, templateModel);
      const result = await service.dryRun('rule-1');

      expect(result.targetValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getById()', () => {
    it('should return rule when found', async () => {
      const ruleModel = createMockRuleModel();
      const ruleDoc = { _id: 'rule-1', name: 'Test Rule', templateId: 'tmpl-1' };
      ruleModel.findById.mockResolvedValue(ruleDoc);

      const { service } = createService(ruleModel);
      const result = await service.getById('rule-1');

      expect(ruleModel.findById).toHaveBeenCalledWith('rule-1');
      expect(result).toEqual(ruleDoc);
    });

    it('should return null when not found', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel);
      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findActive()', () => {
    it('should return only active rules', async () => {
      const ruleModel = createMockRuleModel();
      const activeRules = [
        { _id: 'rule-1', name: 'Active Rule', isActive: true },
        { _id: 'rule-2', name: 'Another Active', isActive: true },
      ];
      ruleModel.findActive.mockResolvedValue(activeRules);

      const { service } = createService(ruleModel);
      const result = await service.findActive();

      expect(ruleModel.findActive).toHaveBeenCalled();
      expect(result).toEqual(activeRules);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active rules', async () => {
      const { service } = createService();
      const result = await service.findActive();

      expect(result).toEqual([]);
    });
  });

  describe('update()', () => {
    it('should update rule fields and return updated document', async () => {
      const ruleModel = createMockRuleModel();
      const existingRule = { _id: 'rule-1', name: 'Old Name', templateId: 'tmpl-1' };
      ruleModel.findById.mockResolvedValue(existingRule);
      ruleModel.findByIdAndUpdate.mockResolvedValue({ ...existingRule, name: 'New Name' });

      const { service } = createService(ruleModel);
      const result = await service.update('rule-1', { name: 'New Name' });

      expect(ruleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { name: 'New Name' } },
        { new: true },
      );
      expect(result).toEqual(expect.objectContaining({ name: 'New Name' }));
    });

    it('should return null when rule not found', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel);
      const result = await service.update('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });

    it('should validate target when target is changed', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({ _id: 'rule-1', name: 'Rule', templateId: 'tmpl-1' });

      const { service } = createService(ruleModel);

      await expect(
        service.update('rule-1', { target: { mode: 'list', identifiers: [] } }),
      ).rejects.toThrow('List mode requires a non-empty identifiers array');
    });

    it('should throw TemplateNotFoundError when templateId is changed to non-existent', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({ _id: 'rule-1', name: 'Rule', templateId: 'tmpl-1' });

      const templateModel = createMockTemplateModel();
      templateModel.findById.mockResolvedValue(null);

      const { service } = createService(ruleModel, templateModel);

      await expect(
        service.update('rule-1', { templateId: 'tmpl-missing' }),
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should ignore non-updateable fields', async () => {
      const ruleModel = createMockRuleModel();
      ruleModel.findById.mockResolvedValue({ _id: 'rule-1', name: 'Rule' });
      ruleModel.findByIdAndUpdate.mockResolvedValue({ _id: 'rule-1', name: 'Updated' });

      const { service } = createService(ruleModel);
      await service.update('rule-1', { name: 'Updated', _id: 'hacked', isActive: true } as any);

      expect(ruleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { name: 'Updated' } },
        { new: true },
      );
    });
  });

  describe('validateTarget', () => {
    it('accepts valid query target', () => {
      const { service } = createService();
      expect(() =>
        service.validateTarget({ mode: 'query', conditions: { role: 'customer' } })
      ).not.toThrow();
    });

    it('accepts valid list target', () => {
      const { service } = createService();
      expect(() =>
        service.validateTarget({ mode: 'list', identifiers: ['+919876543210'] })
      ).not.toThrow();
    });

    it('rejects query target without conditions', () => {
      const { service } = createService();
      expect(() =>
        service.validateTarget({ mode: 'query' } as any)
      ).toThrow('Query mode requires a conditions object');
    });

    it('rejects list target with empty identifiers', () => {
      const { service } = createService();
      expect(() =>
        service.validateTarget({ mode: 'list', identifiers: [] })
      ).toThrow('List mode requires a non-empty identifiers array');
    });

    it('rejects unknown mode', () => {
      const { service } = createService();
      expect(() =>
        service.validateTarget({ mode: 'broadcast' } as any)
      ).toThrow('Invalid target mode');
    });
  });
});

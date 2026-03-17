import type { TelegramRuleModel, TelegramRuleDocument } from '../schemas/rule.schema';
import type { TelegramTemplateModel } from '../schemas/template.schema';
import type { TelegramRunLogModel } from '../schemas/run-log.schema';
import type { RuleTarget, QueryTarget, ListTarget } from '../types/rule.types';
import type { TelegramRuleEngineConfig, LogAdapter } from '../types/config.types';
import { noopLogger } from '@astralibx/core';
import { TemplateNotFoundError, RuleNotFoundError } from '../errors';

function isQueryTarget(target: RuleTarget): target is QueryTarget {
  return target.mode === 'query';
}

function isListTarget(target: RuleTarget): target is ListTarget {
  return target.mode === 'list';
}

const UPDATEABLE_FIELDS = new Set([
  'name', 'target', 'templateId', 'schedule',
  'sendOnce', 'maxPerRun', 'autoApprove',
  'validFrom', 'validTill', 'platform', 'audience'
]);

export class RuleService {
  private logger: LogAdapter;

  constructor(
    private TelegramRule: TelegramRuleModel,
    private TelegramTemplate: TelegramTemplateModel,
    private TelegramRunLog: TelegramRunLogModel,
    private config: TelegramRuleEngineConfig
  ) {
    this.logger = config.logger || noopLogger;
  }

  async create(input: {
    name: string;
    templateId: string;
    target: RuleTarget;
    schedule?: string;
    sendOnce?: boolean;
    maxPerRun?: number;
    autoApprove?: boolean;
    validFrom?: Date;
    validTill?: Date;
    platform?: string;
    audience?: string;
  }): Promise<TelegramRuleDocument> {
    const template = await this.TelegramTemplate.findById(input.templateId);
    if (!template) {
      throw new TemplateNotFoundError(input.templateId);
    }

    this.validateTarget(input.target);

    return this.TelegramRule.create(input);
  }

  async getById(id: string): Promise<TelegramRuleDocument | null> {
    return this.TelegramRule.findById(id);
  }

  async list(filters?: {
    isActive?: boolean;
    platform?: string;
    audience?: string;
  }): Promise<TelegramRuleDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.isActive !== undefined) query['isActive'] = filters.isActive;
    if (filters?.platform) query['platform'] = filters.platform;
    if (filters?.audience) query['audience'] = filters.audience;

    return this.TelegramRule.find(query)
      .sort({ createdAt: -1 });
  }

  async findActive(): Promise<TelegramRuleDocument[]> {
    return this.TelegramRule.findActive();
  }

  async update(id: string, input: Record<string, unknown>): Promise<TelegramRuleDocument | null> {
    const rule = await this.TelegramRule.findById(id);
    if (!rule) return null;

    if (input.target) {
      this.validateTarget(input.target as RuleTarget);
    }

    if (input.templateId) {
      const template = await this.TelegramTemplate.findById(input.templateId as string);
      if (!template) {
        throw new TemplateNotFoundError(input.templateId as string);
      }
    }

    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && UPDATEABLE_FIELDS.has(key)) {
        setFields[key] = value;
      }
    }

    return this.TelegramRule.findByIdAndUpdate(
      id,
      { $set: setFields },
      { new: true }
    );
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const result = await this.TelegramRule.findByIdAndDelete(id);
    return { deleted: result !== null };
  }

  async activate(id: string): Promise<TelegramRuleDocument | null> {
    const rule = await this.TelegramRule.findById(id);
    if (!rule) return null;

    const template = await this.TelegramTemplate.findById(rule.templateId);
    if (!template) {
      throw new TemplateNotFoundError(rule.templateId.toString());
    }

    return this.TelegramRule.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true }
    );
  }

  async deactivate(id: string): Promise<TelegramRuleDocument | null> {
    return this.TelegramRule.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
  }

  async dryRun(id: string): Promise<{
    valid: boolean;
    templateExists: boolean;
    targetValid: boolean;
    matchedCount?: number;
    effectiveLimit: number;
    errors: string[];
  }> {
    const rule = await this.TelegramRule.findById(id);
    if (!rule) {
      throw new RuleNotFoundError(id);
    }

    const errors: string[] = [];
    let templateExists = false;
    let targetValid = false;
    let matchedCount: number | undefined;

    const template = await this.TelegramTemplate.findById(rule.templateId);
    if (!template) {
      errors.push(`Template ${rule.templateId} not found`);
    } else {
      templateExists = true;
    }

    const target = rule.target as unknown as RuleTarget;
    try {
      this.validateTarget(target);
      targetValid = true;
    } catch (err) {
      errors.push((err as Error).message);
    }

    const effectiveLimit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 100;

    if (targetValid) {
      if (isListTarget(target)) {
        matchedCount = target.identifiers.length;
      } else if (isQueryTarget(target)) {
        try {
          const users = await this.config.adapters.queryUsers(target, effectiveLimit);
          matchedCount = users.length;
        } catch (err) {
          errors.push(`Query failed: ${(err as Error).message}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      templateExists,
      targetValid,
      matchedCount,
      effectiveLimit,
      errors
    };
  }

  validateTarget(target: RuleTarget): void {
    if (isQueryTarget(target)) {
      if (!target.conditions || typeof target.conditions !== 'object') {
        throw new Error('Query mode requires a conditions object');
      }
    } else if (isListTarget(target)) {
      if (!target.identifiers || !Array.isArray(target.identifiers) || target.identifiers.length === 0) {
        throw new Error('List mode requires a non-empty identifiers array');
      }
    } else {
      throw new Error(`Invalid target mode: ${(target as any).mode}`);
    }
  }
}

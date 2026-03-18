import type { EmailRuleModel, EmailRuleDocument } from '../schemas/rule.schema';
import type { EmailTemplateModel, EmailTemplateDocument } from '../schemas/template.schema';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { CreateEmailRuleInput, UpdateEmailRuleInput, RuleTarget, QueryTarget } from '../types/rule.types';
import type { EmailRuleEngineConfig } from '../types/config.types';
import { TemplateNotFoundError, RuleNotFoundError, RuleTemplateIncompatibleError } from '../errors';
import { validateConditions } from '../validation/condition.validator';

function isQueryTarget(target: RuleTarget): target is QueryTarget {
  return !target.mode || target.mode === 'query';
}

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'sortOrder', 'target', 'templateId',
  'sendOnce', 'resendAfterDays', 'cooldownDays', 'autoApprove',
  'maxPerRun', 'bypassThrottle', 'throttleOverride', 'emailType',
  'validFrom', 'validTill', 'schedule'
]);

function validateRuleTemplateCompat(
  targetRole: string,
  targetPlatform: string,
  template: EmailTemplateDocument
): string | null {
  const templateAudience = template.audience;
  const templatePlatform = template.platform;

  if (templateAudience !== 'all') {
    if (targetRole === 'all') {
      return `Template "${template.name}" targets ${templateAudience} only, but rule targets all users`;
    }
    if (targetRole !== templateAudience) {
      return `Template targets ${templateAudience}, but rule targets ${targetRole}`;
    }
  }

  if (templatePlatform !== 'both') {
    if (targetPlatform === 'both') {
      return `Template is for ${templatePlatform} only, but rule targets all platforms`;
    }
    if (templatePlatform !== targetPlatform) {
      return `Template is for ${templatePlatform}, but rule targets ${targetPlatform}`;
    }
  }

  return null;
}

export class RuleService {
  constructor(
    private EmailRule: EmailRuleModel,
    private EmailTemplate: EmailTemplateModel,
    private EmailRuleRunLog: EmailRuleRunLogModel,
    private config: EmailRuleEngineConfig
  ) {}

  async list(): Promise<EmailRuleDocument[]> {
    return this.EmailRule.find()
      .populate('templateId', 'name slug')
      .sort({ sortOrder: 1, createdAt: -1 });
  }

  async getById(id: string): Promise<EmailRuleDocument | null> {
    return this.EmailRule.findById(id);
  }

  async create(input: CreateEmailRuleInput): Promise<EmailRuleDocument> {
    const template = await this.EmailTemplate.findById(input.templateId);
    if (!template) {
      throw new TemplateNotFoundError(input.templateId);
    }

    if (isQueryTarget(input.target)) {
      if (!input.target.role || !input.target.platform) {
        throw new RuleTemplateIncompatibleError('target.role and target.platform are required for query mode, validation failed');
      }
      const compatError = validateRuleTemplateCompat(
        input.target.role,
        input.target.platform,
        template
      );
      if (compatError) {
        throw new RuleTemplateIncompatibleError(compatError);
      }
    } else {
      if (!input.target.identifiers || input.target.identifiers.length === 0) {
        throw new RuleTemplateIncompatibleError('target.identifiers must be a non-empty array for list mode, validation failed');
      }
    }

    if (isQueryTarget(input.target) && input.target.collection && this.config.collections?.length) {
      const condErrors = validateConditions(input.target.conditions, input.target.collection, this.config.collections);
      if (condErrors.length > 0) {
        throw new RuleTemplateIncompatibleError(
          `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
        );
      }
    }

    return this.EmailRule.createRule(input);
  }

  async update(id: string, input: UpdateEmailRuleInput): Promise<EmailRuleDocument | null> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) return null;

    const templateId = input.templateId ?? rule.templateId.toString();

    if (input.target) {
      if (isQueryTarget(input.target)) {
        if (!input.target.role || !input.target.platform) {
          throw new RuleTemplateIncompatibleError('target.role and target.platform are required for query mode, validation failed');
        }
      } else {
        if (!input.target.identifiers || input.target.identifiers.length === 0) {
          throw new RuleTemplateIncompatibleError('target.identifiers must be a non-empty array for list mode, validation failed');
        }
      }
    }

    const effectiveTarget = input.target ?? rule.target;

    if ((input.templateId || input.target) && isQueryTarget(effectiveTarget as RuleTarget)) {
      const qt = effectiveTarget as QueryTarget;
      const template = await this.EmailTemplate.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      const compatError = validateRuleTemplateCompat(qt.role, qt.platform, template);
      if (compatError) {
        throw new RuleTemplateIncompatibleError(compatError);
      }
    }

    if (isQueryTarget(effectiveTarget as RuleTarget)) {
      const qt = effectiveTarget as QueryTarget;
      if (qt.collection && this.config.collections?.length) {
        const condErrors = validateConditions(qt.conditions || [], qt.collection, this.config.collections);
        if (condErrors.length > 0) {
          throw new RuleTemplateIncompatibleError(
            `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
          );
        }
      }
    }

    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && UPDATEABLE_FIELDS.has(key)) {
        setFields[key] = value;
      }
    }

    return this.EmailRule.findByIdAndUpdate(
      id,
      { $set: setFields },
      { new: true }
    );
  }

  async delete(id: string): Promise<{ deleted: boolean; disabled?: boolean }> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) return { deleted: false };

    if (rule.totalSent > 0) {
      rule.isActive = false;
      await rule.save();
      return { deleted: false, disabled: true };
    }

    await this.EmailRule.findByIdAndDelete(id);
    return { deleted: true };
  }

  async toggleActive(id: string): Promise<EmailRuleDocument | null> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) return null;

    if (!rule.isActive) {
      const template = await this.EmailTemplate.findById(rule.templateId);
      if (!template) {
        throw new TemplateNotFoundError(rule.templateId.toString());
      }
      if (!template.isActive) {
        throw new RuleTemplateIncompatibleError('Cannot activate rule: linked template is inactive');
      }
    }

    rule.isActive = !rule.isActive;
    await rule.save();
    return rule;
  }

  async dryRun(id: string): Promise<{
    matchedCount: number;
    effectiveLimit: number;
    willProcess: number;
    ruleId: string;
    sample: Array<{ email: string; name?: string; [key: string]: unknown }>;
  }> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) {
      throw new RuleNotFoundError(id);
    }

    const defaultMaxPerRun = this.config.options?.defaultMaxPerRun;
    const effectiveLimit = rule.maxPerRun || defaultMaxPerRun || 500;

    const target = rule.target as unknown as RuleTarget;
    if (target.mode === 'list') {
      const identifiers = (target as any).identifiers || [];
      const matchedCount = identifiers.length;
      const willProcess = Math.min(matchedCount, effectiveLimit);
      const sample = identifiers.slice(0, 10).map((id: string) => ({ email: id }));
      return { matchedCount, effectiveLimit, willProcess, ruleId: id, sample };
    }

    const queryTarget = rule.target as unknown as QueryTarget;
    const collectionName = queryTarget.collection;
    const collectionSchema = collectionName
      ? this.config.collections?.find(c => c.name === collectionName)
      : undefined;
    const users = await this.config.adapters.queryUsers(rule.target, 50000, collectionSchema ? { collectionSchema } : undefined);
    const matchedCount = users.length;
    const willProcess = Math.min(matchedCount, effectiveLimit);
    const sample = users.slice(0, 10).map((u: any) => ({
      email: u.email || '',
      name: u.name || u.firstName || '',
      ...(u._id ? { id: String(u._id) } : {}),
    }));
    return { matchedCount, effectiveLimit, willProcess, ruleId: id, sample };
  }

  async clone(sourceId: string, newName?: string): Promise<any> {
    const source = await this.EmailRule.findById(sourceId);
    if (!source) throw new Error('Rule not found');

    const { _id, __v, createdAt, updatedAt, ...rest } = source.toObject() as any;

    rest.name = newName || `${rest.name} (copy)`;
    rest.isActive = false;
    rest.totalSent = 0;
    rest.totalSkipped = 0;
    rest.lastRunAt = undefined;
    rest.lastRunStats = undefined;

    return this.EmailRule.create(rest);
  }

  async getRunHistory(limit = 20): Promise<unknown[]> {
    return this.EmailRuleRunLog.getRecent(limit);
  }
}

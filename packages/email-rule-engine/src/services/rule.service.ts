import type { EmailRuleModel, EmailRuleDocument } from '../schemas/rule.schema';
import type { EmailTemplateModel, EmailTemplateDocument } from '../schemas/template.schema';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { CreateEmailRuleInput, UpdateEmailRuleInput } from '../types/rule.types';
import type { TemplateAudience } from '../constants';
import type { EmailRuleEngineConfig } from '../types/config.types';
import { TemplateNotFoundError, RuleNotFoundError, RuleTemplateIncompatibleError } from '../errors';

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'sortOrder', 'target', 'templateId',
  'sendOnce', 'resendAfterDays', 'cooldownDays', 'autoApprove',
  'maxPerRun', 'bypassThrottle', 'emailType'
]);

function validateRuleTemplateCompat(
  targetRole: TemplateAudience,
  targetPlatform: string,
  template: EmailTemplateDocument
): string | null {
  const templateAudience = template.audience as TemplateAudience;
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

    const compatError = validateRuleTemplateCompat(
      input.target.role,
      input.target.platform,
      template
    );
    if (compatError) {
      throw new RuleTemplateIncompatibleError(compatError);
    }

    return this.EmailRule.createRule(input);
  }

  async update(id: string, input: UpdateEmailRuleInput): Promise<EmailRuleDocument | null> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) return null;

    const templateId = input.templateId ?? rule.templateId.toString();
    const targetRole = input.target?.role ?? rule.target.role;
    const targetPlatform = input.target?.platform ?? rule.target.platform;

    if (input.templateId || input.target) {
      const template = await this.EmailTemplate.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      const compatError = validateRuleTemplateCompat(targetRole, targetPlatform, template);
      if (compatError) {
        throw new RuleTemplateIncompatibleError(compatError);
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

  async dryRun(id: string): Promise<{ matchedCount: number; ruleId: string }> {
    const rule = await this.EmailRule.findById(id);
    if (!rule) {
      throw new RuleNotFoundError(id);
    }

    const users = await this.config.adapters.queryUsers(rule.target, 50000);
    return { matchedCount: users.length, ruleId: id };
  }

  async getRunHistory(limit = 20): Promise<unknown[]> {
    return this.EmailRuleRunLog.getRecent(limit);
  }
}

import type { RuleModel, RuleDocument } from '../schemas/rule.schema';
import type { TemplateModel, TemplateDocument } from '../schemas/template.schema';
import type { RunLogModel } from '../schemas/run-log.schema';
import type { CreateRuleInput, UpdateRuleInput, RuleTarget, QueryTarget } from '../types/rule.types';
import type { RuleEngineConfig } from '../types/config.types';
import type { JoinDefinition } from '../types/collection.types';
import { TemplateNotFoundError, RuleNotFoundError, RuleTemplateIncompatibleError } from '../errors';
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';
import { filterUpdateableFields } from '../utils/helpers';

function isQueryTarget(target: RuleTarget): target is QueryTarget {
  return !target.mode || target.mode === 'query';
}

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'sortOrder', 'target', 'templateId',
  'sendOnce', 'resendAfterDays', 'cooldownDays', 'autoApprove',
  'maxPerRun', 'bypassThrottle', 'throttleOverride', 'ruleType',
  'validFrom', 'validTill', 'schedule'
]);

export class RuleService {
  constructor(
    private Rule: RuleModel,
    private Template: TemplateModel,
    private RunLog: RunLogModel,
    private config: RuleEngineConfig
  ) {}

  async list(opts?: { page?: number; limit?: number; platform?: string }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 200, 200);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (opts?.platform) filter.platform = opts.platform;
    const [rules, total] = await Promise.all([
      this.Rule.find(filter)
        .populate('templateId', 'name slug collectionName joins')
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip).limit(limit),
      this.Rule.countDocuments(filter),
    ]);
    return { rules, total };
  }

  async getById(id: string): Promise<RuleDocument | null> {
    return this.Rule.findById(id);
  }

  async create(input: CreateRuleInput): Promise<RuleDocument> {
    const template = await this.Template.findById(input.templateId);
    if (!template) throw new TemplateNotFoundError(input.templateId);

    if (isQueryTarget(input.target)) {
      this.validateConditionsAgainstTemplate(input.target, template);
    } else {
      if (!input.target.identifiers || input.target.identifiers.length === 0) {
        throw new RuleTemplateIncompatibleError('target.identifiers must be a non-empty array for list mode');
      }
    }

    return this.Rule.createRule(input);
  }

  async update(id: string, input: UpdateRuleInput): Promise<RuleDocument | null> {
    const rule = await this.Rule.findById(id);
    if (!rule) return null;

    const templateId = input.templateId ?? rule.templateId.toString();
    const template = await this.Template.findById(templateId);
    if (!template) throw new TemplateNotFoundError(templateId);

    const effectiveTarget = (input.target ?? rule.target) as RuleTarget;
    if (isQueryTarget(effectiveTarget)) {
      this.validateConditionsAgainstTemplate(effectiveTarget, template);
    }

    const setFields = filterUpdateableFields(input as Record<string, unknown>, UPDATEABLE_FIELDS);
    return this.Rule.findByIdAndUpdate(id, { $set: setFields }, { new: true });
  }

  async delete(id: string): Promise<{ deleted: boolean; disabled?: boolean }> {
    const rule = await this.Rule.findById(id);
    if (!rule) return { deleted: false };
    if (rule.totalSent > 0) {
      rule.isActive = false;
      await rule.save();
      return { deleted: false, disabled: true };
    }
    await this.Rule.findByIdAndDelete(id);
    return { deleted: true };
  }

  async toggleActive(id: string): Promise<RuleDocument | null> {
    const rule = await this.Rule.findById(id);
    if (!rule) return null;
    if (!rule.isActive) {
      const template = await this.Template.findById(rule.templateId);
      if (!template) throw new TemplateNotFoundError(rule.templateId.toString());
      if (!template.isActive) throw new RuleTemplateIncompatibleError('Cannot activate rule: linked template is inactive');
    }
    rule.isActive = !rule.isActive;
    await rule.save();
    return rule;
  }

  async dryRun(id: string) {
    const rule = await this.Rule.findById(id);
    if (!rule) throw new RuleNotFoundError(id);

    const effectiveLimit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    const target = rule.target as unknown as RuleTarget;

    if (target.mode === 'list') {
      const identifiers = (target as any).identifiers || [];
      return {
        matchedCount: identifiers.length,
        effectiveLimit,
        willProcess: Math.min(identifiers.length, effectiveLimit),
        ruleId: id,
        sample: identifiers.slice(0, 10).map((id: string) => ({ contactValue: id })),
      };
    }

    const template = await this.Template.findById(rule.templateId);
    const { collectionSchema, activeJoins } = this.resolveCollectionContext(template);

    const users = await this.config.adapters.queryUsers(
      rule.target, 50000,
      collectionSchema ? { collectionSchema, activeJoins } : undefined
    );

    return {
      matchedCount: users.length,
      effectiveLimit,
      willProcess: Math.min(users.length, effectiveLimit),
      ruleId: id,
      sample: users.slice(0, 10).map((u: any) => ({
        contactValue: u.contactValue || u.email || u.phone || u.userId || '',
        name: u.name || u.firstName || '',
        ...(u._id ? { id: String(u._id) } : {}),
      })),
    };
  }

  async previewConditions(body: { collectionName: string; joins?: string[]; conditions: any[] }) {
    const { collectionName, joins, conditions } = body;

    if (!this.config.collections?.length) {
      throw new RuleTemplateIncompatibleError('No collections configured');
    }

    const collection = this.config.collections.find(c => c.name === collectionName);
    if (!collection) {
      throw new RuleTemplateIncompatibleError(`Collection "${collectionName}" not found`);
    }

    if (joins?.length) {
      const joinErrors = validateJoinAliases(joins, collectionName, this.config.collections);
      if (joinErrors.length > 0) {
        throw new RuleTemplateIncompatibleError(`Invalid joins: ${joinErrors.join('; ')}`);
      }
    }

    const condErrors = validateConditions(conditions, collectionName, this.config.collections, joins);
    if (condErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(`Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`);
    }

    const activeJoins: JoinDefinition[] = collection.joins?.filter(j => joins?.includes(j.as)) ?? [];
    const target: QueryTarget = { mode: 'query', role: 'all', platform: 'all', conditions };

    const users = await this.config.adapters.queryUsers(
      target, 50000,
      { collectionSchema: collection, activeJoins }
    );

    return {
      matchedCount: users.length,
      sample: users.slice(0, 10).map((u: any) => ({
        contactValue: u.contactValue || u.email || u.phone || u.userId || '',
        name: u.name || u.firstName || '',
        ...(u._id ? { id: String(u._id) } : {}),
      })),
    };
  }

  async clone(sourceId: string, newName?: string): Promise<any> {
    const source = await this.Rule.findById(sourceId);
    if (!source) throw new RuleNotFoundError(sourceId);
    const { _id, __v, createdAt, updatedAt, ...rest } = source.toObject() as any;
    rest.name = newName || `${rest.name} (copy)`;
    rest.isActive = false;
    rest.totalSent = 0;
    rest.totalSkipped = 0;
    rest.lastRunAt = undefined;
    rest.lastRunStats = undefined;
    return this.Rule.create(rest);
  }

  async runHistory(opts?: { page?: number; limit?: number }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 50, 200);
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.RunLog.find().sort({ runAt: -1 }).skip(skip).limit(limit).lean(),
      this.RunLog.countDocuments(),
    ]);
    return { logs, total };
  }

  private validateConditionsAgainstTemplate(target: QueryTarget, template: TemplateDocument): void {
    const collectionName = (template as any).collectionName as string | undefined;
    if (!collectionName || !this.config.collections?.length) return;

    const templateJoins: string[] = ((template as any).joins as string[] | undefined) ?? [];
    const condErrors = validateConditions(
      target.conditions || [], collectionName, this.config.collections, templateJoins
    );
    if (condErrors.length > 0) {
      throw new RuleTemplateIncompatibleError(
        `Invalid conditions: ${condErrors.map(e => e.message).join('; ')}`
      );
    }
  }

  private resolveCollectionContext(template: TemplateDocument | null) {
    const collectionName = (template as any)?.collectionName as string | undefined;
    if (!collectionName || !this.config.collections?.length) {
      return { collectionSchema: undefined, activeJoins: [] as JoinDefinition[] };
    }
    const collectionSchema = this.config.collections.find(c => c.name === collectionName);
    const joinAliases: string[] = ((template as any)?.joins as string[] | undefined) ?? [];
    const activeJoins: JoinDefinition[] = collectionSchema?.joins?.filter(
      j => joinAliases.includes(j.as)
    ) ?? [];
    return { collectionSchema, activeJoins };
  }
}

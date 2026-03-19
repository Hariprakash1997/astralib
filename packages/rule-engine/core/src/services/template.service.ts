import type { TemplateModel, TemplateDocument } from '../schemas/template.schema';
import type { RuleModel } from '../schemas/rule.schema';
import type { CreateTemplateInput, UpdateTemplateInput } from '../types/template.types';
import type { RuleEngineConfig } from '../types/config.types';
import { TemplateNotFoundError, DuplicateSlugError, RuleTemplateIncompatibleError } from '../errors';
import { validateJoinAliases } from '../validation/condition.validator';
import { filterUpdateableFields } from '../utils/helpers';
import { TemplateRenderService } from './template-render.service';

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'category', 'audience', 'platform',
  'textBody', 'subjects', 'bodies', 'preheaders',
  'fields', 'variables', 'collectionName', 'joins',
  'attachments', 'metadata', 'isActive'
]);

export class TemplateService {
  private renderService: TemplateRenderService;

  constructor(
    private Template: TemplateModel,
    private config: RuleEngineConfig,
    private Rule?: RuleModel
  ) {
    this.renderService = new TemplateRenderService();
  }

  async list(opts?: { page?: number; limit?: number; platform?: string; category?: string; audience?: string; isActive?: boolean }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 200, 200);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (opts?.platform) filter.platform = opts.platform;
    if (opts?.category) filter.category = opts.category;
    if (opts?.audience) filter.audience = opts.audience;
    if (opts?.isActive !== undefined) filter.isActive = opts.isActive;
    const [templates, total] = await Promise.all([
      this.Template.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit),
      this.Template.countDocuments(filter),
    ]);
    return { templates, total };
  }

  async getById(id: string): Promise<TemplateDocument | null> {
    return this.Template.findById(id);
  }

  async create(input: CreateTemplateInput): Promise<TemplateDocument> {
    const existing = await this.Template.findBySlug(input.slug);
    if (existing) throw new DuplicateSlugError(input.slug);
    this.validateCollectionAndJoins(input.collectionName, input.joins);
    return this.Template.createTemplate(input);
  }

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateDocument | null> {
    const template = await this.Template.findById(id);
    if (!template) return null;

    const effectiveCollectionName = input.collectionName !== undefined ? input.collectionName : template.collectionName;
    const effectiveJoins = input.joins !== undefined ? input.joins : (template.joins as string[] | undefined);
    this.validateCollectionAndJoins(effectiveCollectionName, effectiveJoins);

    const setFields = filterUpdateableFields(input as Record<string, unknown>, UPDATEABLE_FIELDS);
    // Bump version on content changes
    if (input.subjects || input.bodies || input.textBody !== undefined || input.preheaders) {
      setFields.version = ((template.version as number) || 1) + 1;
    }
    return this.Template.findByIdAndUpdate(id, { $set: setFields }, { new: true });
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const result = await this.Template.findByIdAndDelete(id);
    return { deleted: !!result };
  }

  async toggleActive(id: string): Promise<TemplateDocument | null> {
    const template = await this.Template.findById(id);
    if (!template) return null;
    template.isActive = !template.isActive;
    await template.save();
    return template;
  }

  async clone(sourceId: string, newName?: string): Promise<TemplateDocument> {
    const source = await this.Template.findById(sourceId);
    if (!source) throw new TemplateNotFoundError(sourceId);
    const { _id, __v, createdAt, updatedAt, slug, ...rest } = source.toObject() as any;
    rest.name = newName || `${rest.name} (copy)`;
    rest.slug = `${slug}-copy-${Date.now()}`;
    rest.isActive = false;
    rest.version = 1;
    return this.Template.create(rest);
  }

  async preview(
    id: string,
    sampleData: Record<string, unknown>
  ): Promise<{ body: string; textBody: string; subject?: string } | null> {
    const template = await this.Template.findById(id);
    if (!template) return null;
    const data = this._buildSampleData((template as any).variables ?? [], sampleData);
    return this.renderService.renderPreview(
      (template as any).subjects?.[0],
      (template as any).bodies[0],
      data,
      (template as any).textBody
    );
  }

  async previewRaw(
    subject: string | undefined,
    body: string,
    sampleData: Record<string, unknown>,
    variables?: string[],
    textBody?: string
  ): Promise<{ body: string; textBody: string; subject?: string }> {
    const data = this._buildSampleData(variables ?? [], sampleData);
    return this.renderService.renderPreview(subject, body, data, textBody);
  }

  async validate(body: string): Promise<{ valid: boolean; errors: string[]; variables: string[] }> {
    const validation = this.renderService.validateTemplate(body);
    const variables = this.renderService.extractVariables(body);
    return { ...validation, variables };
  }

  async sendTest(
    id: string,
    testEmail: string,
    sampleData: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.adapters.sendTest) {
      return { success: false, error: 'Test sending not configured' };
    }
    const template = await this.Template.findById(id);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }
    const rendered = this.renderService.renderSingle(
      (template as any).subjects?.[0],
      (template as any).bodies[0],
      sampleData,
      (template as any).textBody
    );
    try {
      await this.config.adapters.sendTest(
        testEmail,
        rendered.body,
        rendered.subject ? `[TEST] ${rendered.subject}` : undefined,
        {}
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async previewWithRecipient(
    templateId: string,
    recipientData: Record<string, unknown>
  ): Promise<{ body: string; textBody: string; subject?: string } | null> {
    const template = await this.Template.findById(templateId);
    if (!template) return null;
    const variables = (template as any).variables ?? [];
    const fields = (template as any).fields ?? {};
    const data = this._buildSampleData(variables, { ...fields, ...recipientData });
    return this.renderService.renderPreview(
      (template as any).subjects?.[0],
      (template as any).bodies[0],
      data,
      (template as any).textBody
    );
  }

  private _buildSampleData(variables: string[], sampleData: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const v of variables) {
      data[v] = sampleData[v] ?? `{{${v}}}`;
    }
    return { ...data, ...sampleData };
  }

  private validateCollectionAndJoins(collectionName?: string, joins?: string[]): void {
    if (!collectionName || !this.config.collections?.length) return;
    const collection = this.config.collections.find(c => c.name === collectionName);
    if (!collection) {
      throw new RuleTemplateIncompatibleError(`Collection "${collectionName}" is not registered`);
    }
    if (joins?.length) {
      const errors = validateJoinAliases(joins, collectionName, this.config.collections);
      if (errors.length > 0) {
        throw new RuleTemplateIncompatibleError(`Invalid joins: ${errors.join('; ')}`);
      }
    }
  }
}

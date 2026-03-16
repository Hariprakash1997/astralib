import { TemplateRenderService } from './template-render.service';
import type { EmailTemplateModel, EmailTemplateDocument } from '../schemas/template.schema';
import type { CreateEmailTemplateInput, UpdateEmailTemplateInput } from '../types/template.types';
import type { EmailRuleEngineConfig } from '../types/config.types';
import { DuplicateSlugError, TemplateSyntaxError, TemplateNotFoundError } from '../errors';

const UPDATEABLE_FIELDS = new Set([
  'name', 'description', 'category', 'audience', 'platform',
  'textBody', 'subjects', 'bodies', 'preheaders', 'variables', 'isActive', 'fields'
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class TemplateService {
  private renderService = new TemplateRenderService();

  constructor(
    private EmailTemplate: EmailTemplateModel,
    private config: EmailRuleEngineConfig
  ) {}

  async list(filters?: {
    category?: string;
    audience?: string;
    platform?: string;
    isActive?: boolean;
  }): Promise<EmailTemplateDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.category) query['category'] = filters.category;
    if (filters?.audience) query['audience'] = filters.audience;
    if (filters?.platform) query['platform'] = filters.platform;
    if (filters?.isActive !== undefined) query['isActive'] = filters.isActive;

    return this.EmailTemplate.find(query).sort({ category: 1, name: 1 });
  }

  async getById(id: string): Promise<EmailTemplateDocument | null> {
    return this.EmailTemplate.findById(id);
  }

  async getBySlug(slug: string): Promise<EmailTemplateDocument | null> {
    return this.EmailTemplate.findBySlug(slug);
  }

  async create(input: CreateEmailTemplateInput): Promise<EmailTemplateDocument> {
    const slug = input.slug || slugify(input.name);

    const existing = await this.EmailTemplate.findBySlug(slug);
    if (existing) {
      throw new DuplicateSlugError(slug);
    }

    const { subjects, bodies } = input;
    if (subjects.length === 0) throw new TemplateSyntaxError('At least one subject is required', ['At least one subject is required']);
    if (bodies.length === 0) throw new TemplateSyntaxError('At least one body is required', ['At least one body is required']);

    for (const b of bodies) {
      const validation = this.renderService.validateTemplate(b);
      if (!validation.valid) {
        throw new TemplateSyntaxError(`Template validation failed: ${validation.errors.join('; ')}`, validation.errors);
      }
    }

    const allContent = [...subjects, ...bodies, ...(input.preheaders || []), input.textBody || ''].join(' ');
    const variables = input.variables || this.renderService.extractVariables(allContent);

    return this.EmailTemplate.createTemplate({
      ...input,
      slug,
      subjects,
      bodies,
      variables
    });
  }

  async update(id: string, input: UpdateEmailTemplateInput): Promise<EmailTemplateDocument | null> {
    const template = await this.EmailTemplate.findById(id);
    if (!template) return null;

    if (input.subjects && input.subjects.length === 0) {
      throw new TemplateSyntaxError('At least one subject is required', ['At least one subject is required']);
    }
    if (input.bodies && input.bodies.length === 0) {
      throw new TemplateSyntaxError('At least one body is required', ['At least one body is required']);
    }

    const bodiesToValidate = input.bodies || null;
    if (bodiesToValidate) {
      for (const b of bodiesToValidate) {
        const validation = this.renderService.validateTemplate(b);
        if (!validation.valid) {
          throw new TemplateSyntaxError(`Template validation failed: ${validation.errors.join('; ')}`, validation.errors);
        }
      }
    }

    if (input.textBody || input.subjects || input.bodies || input.preheaders) {
      const subjects = input.subjects ?? template.subjects;
      const bodies = input.bodies ?? template.bodies;
      const preheaders = input.preheaders ?? (template as any).preheaders ?? [];
      const textBody = input.textBody ?? template.textBody;

      const allContent = [...subjects, ...bodies, ...preheaders, textBody || ''].join(' ');
      input.variables = this.renderService.extractVariables(allContent);
    }

    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && UPDATEABLE_FIELDS.has(key)) {
        setFields[key] = value;
      }
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (input.textBody || input.subjects || input.bodies || input.preheaders) {
      update['$inc'] = { version: 1 };
    }

    return this.EmailTemplate.findByIdAndUpdate(
      id,
      update,
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.EmailTemplate.findByIdAndDelete(id);
    return result !== null;
  }

  async toggleActive(id: string): Promise<EmailTemplateDocument | null> {
    const template = await this.EmailTemplate.findById(id);
    if (!template) return null;

    template.isActive = !template.isActive;
    await template.save();
    return template;
  }

  private _buildSampleData(
    variables: string[],
    provided: Record<string, unknown>
  ): Record<string, unknown> {
    const data = { ...provided };
    for (const v of variables) {
      if (!(v in data)) {
        data[v] = `[${v}]`;
      }
    }
    return data;
  }

  async preview(
    id: string,
    sampleData: Record<string, unknown>
  ): Promise<{ html: string; text: string; subject: string } | null> {
    const template = await this.EmailTemplate.findById(id);
    if (!template) return null;

    const variables = template.variables ?? [];
    const data = this._buildSampleData(variables, sampleData);

    return this.renderService.renderPreview(
      template.subjects[0],
      template.bodies[0],
      data,
      template.textBody
    );
  }

  async previewRaw(
    subject: string,
    body: string,
    sampleData: Record<string, unknown>,
    variables?: string[],
    textBody?: string
  ): Promise<{ html: string; text: string; subject: string }> {
    const data = this._buildSampleData(variables ?? [], sampleData);
    return this.renderService.renderPreview(subject, body, data, textBody);
  }

  async validate(body: string): Promise<{ valid: boolean; errors: string[]; variables: string[] }> {
    const validation = this.renderService.validateTemplate(body);
    const variables = this.renderService.extractVariables(body);
    return { ...validation, variables };
  }

  async sendTestEmail(
    id: string,
    testEmail: string,
    sampleData: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.adapters.sendTestEmail) {
      return { success: false, error: 'Test email sending not configured' };
    }

    const template = await this.EmailTemplate.findById(id);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const rendered = this.renderService.renderSingle(
      template.subjects[0],
      template.bodies[0],
      sampleData,
      template.textBody
    );

    try {
      await this.config.adapters.sendTestEmail(
        testEmail,
        `[TEST] ${rendered.subject}`,
        rendered.html,
        rendered.text
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

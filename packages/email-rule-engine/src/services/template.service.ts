import { TemplateRenderService } from './template-render.service';
import type { EmailTemplateModel, EmailTemplateDocument } from '../schemas/template.schema';
import type { CreateEmailTemplateInput, UpdateEmailTemplateInput } from '../types/template.types';
import type { TemplateCategory, TemplateAudience } from '../types/enums';
import type { EmailRuleEngineConfig } from '../types/config.types';

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
    category?: TemplateCategory;
    audience?: TemplateAudience;
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
      throw new Error(`Template with slug "${slug}" already exists`);
    }

    const validation = this.renderService.validateTemplate(input.body);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
    }

    const variables = input.variables || this.renderService.extractVariables(
      `${input.subject} ${input.body} ${input.textBody || ''}`
    );

    return this.EmailTemplate.createTemplate({
      ...input,
      slug,
      variables
    });
  }

  async update(id: string, input: UpdateEmailTemplateInput): Promise<EmailTemplateDocument | null> {
    const template = await this.EmailTemplate.findById(id);
    if (!template) return null;

    if (input.body) {
      const validation = this.renderService.validateTemplate(input.body);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
      }
    }

    if (input.body || input.subject || input.textBody) {
      const subject = input.subject ?? template.subject;
      const body = input.body ?? template.body;
      const textBody = input.textBody ?? template.textBody;

      input.variables = this.renderService.extractVariables(
        `${subject} ${body} ${textBody || ''}`
      );
    }

    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        setFields[key] = value;
      }
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (input.body || input.subject || input.textBody) {
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

  async preview(
    id: string,
    sampleData: Record<string, unknown>
  ): Promise<{ html: string; text: string; subject: string } | null> {
    const template = await this.EmailTemplate.findById(id);
    if (!template) return null;

    return this.renderService.renderPreview(
      template.subject,
      template.body,
      sampleData,
      template.textBody
    );
  }

  async previewRaw(
    subject: string,
    body: string,
    sampleData: Record<string, unknown>,
    textBody?: string
  ): Promise<{ html: string; text: string; subject: string }> {
    return this.renderService.renderPreview(subject, body, sampleData, textBody);
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
      template.subject,
      template.body,
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

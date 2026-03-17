import { TemplateRenderService } from './template-render.service';
import type { TelegramTemplateModel, TelegramTemplateDocument } from '../schemas/template.schema';
import type { CreateTelegramTemplateInput, UpdateTelegramTemplateInput } from '../types/template.types';
import type { TelegramRuleEngineConfig, LogAdapter } from '../types/config.types';
import { noopLogger } from '@astralibx/core';
import { TemplateNotFoundError } from '../errors';

const UPDATEABLE_FIELDS = new Set([
  'name', 'messages', 'variables', 'category', 'platform',
  'audience', 'media', 'fields'
]);

export class TemplateService {
  private renderService = new TemplateRenderService();
  private logger: LogAdapter;

  constructor(
    private TelegramTemplate: TelegramTemplateModel,
    private config: TelegramRuleEngineConfig
  ) {
    this.logger = config.logger || noopLogger;
  }

  async create(input: CreateTelegramTemplateInput): Promise<TelegramTemplateDocument> {
    const { messages } = input;
    if (!messages || messages.length === 0) {
      throw new Error('At least one message is required');
    }

    for (const m of messages) {
      const validation = this.renderService.validateTemplate(m);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
      }
    }

    const variables = input.variables || this.renderService.extractVariables(messages);

    return this.TelegramTemplate.create({
      ...input,
      messages,
      variables
    });
  }

  async getById(id: string): Promise<TelegramTemplateDocument | null> {
    return this.TelegramTemplate.findById(id);
  }

  async list(filters?: {
    category?: string;
    platform?: string;
    audience?: string;
  }): Promise<TelegramTemplateDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.category) query['category'] = filters.category;
    if (filters?.platform) query['platform'] = filters.platform;
    if (filters?.audience) query['audience'] = filters.audience;

    return this.TelegramTemplate.find(query).sort({ category: 1, name: 1 });
  }

  async update(id: string, input: UpdateTelegramTemplateInput): Promise<TelegramTemplateDocument | null> {
    const template = await this.TelegramTemplate.findById(id);
    if (!template) return null;

    if (input.messages && input.messages.length === 0) {
      throw new Error('At least one message is required');
    }

    if (input.messages) {
      for (const m of input.messages) {
        const validation = this.renderService.validateTemplate(m);
        if (!validation.valid) {
          throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
        }
      }
    }

    if (input.messages) {
      const messages = input.messages ?? template.messages;
      input.variables = this.renderService.extractVariables(messages);
    }

    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && UPDATEABLE_FIELDS.has(key)) {
        setFields[key] = value;
      }
    }

    return this.TelegramTemplate.findByIdAndUpdate(
      id,
      { $set: setFields },
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.TelegramTemplate.findByIdAndDelete(id);
    return result !== null;
  }

  async preview(
    id: string,
    sampleData?: Record<string, unknown>
  ): Promise<{ messages: string[] } | null> {
    const template = await this.TelegramTemplate.findById(id);
    if (!template) return null;

    const variables = template.variables ?? [];
    const data = this.buildSampleData(variables, sampleData || {});

    const rendered = template.messages.map(m =>
      this.renderService.renderPreview(m, data)
    );

    return { messages: rendered };
  }

  compileMessages(template: { messages: string[] }): HandlebarsTemplateDelegate[] {
    const compiled = this.renderService.compile(template.messages);
    return compiled.messageFns;
  }

  extractVariables(messages: string[]): string[] {
    return this.renderService.extractVariables(messages);
  }

  private buildSampleData(
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
}

import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatPromptTemplateModel, ChatPromptTemplateDocument } from '../schemas/chat-prompt-template.schema';
import type {
  ChatPromptTemplate,
  CreatePromptInput,
  UpdatePromptInput,
  PromptListQuery,
} from '../types/prompt.types';
import { PromptTemplateNotFoundError } from '../errors';

function docToTemplate(doc: any): ChatPromptTemplate {
  return {
    templateId: doc.templateId,
    name: doc.name,
    description: doc.description,
    isDefault: doc.isDefault,
    isActive: doc.isActive,
    sections: doc.sections ?? [],
    responseFormat: doc.responseFormat,
    temperature: doc.temperature,
    maxTokens: doc.maxTokens,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

export class PromptService {
  constructor(
    private ChatPromptTemplate: ChatPromptTemplateModel,
    private logger: LogAdapter,
  ) {}

  async create(input: CreatePromptInput): Promise<ChatPromptTemplate> {
    const templateId = crypto.randomUUID();

    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await this.ChatPromptTemplate.updateMany(
        { isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    const doc = await this.ChatPromptTemplate.create({
      templateId,
      name: input.name,
      description: input.description,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      sections: input.sections ?? [],
      responseFormat: input.responseFormat,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    });

    this.logger.info('Prompt template created', { templateId });
    return docToTemplate(doc);
  }

  async update(templateId: string, input: UpdatePromptInput): Promise<ChatPromptTemplate> {
    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await this.ChatPromptTemplate.updateMany(
        { isDefault: true, templateId: { $ne: templateId } },
        { $set: { isDefault: false } },
      );
    }

    const doc = await this.ChatPromptTemplate.findOneAndUpdate(
      { templateId },
      { $set: input },
      { new: true },
    );

    if (!doc) throw new PromptTemplateNotFoundError(templateId);
    this.logger.info('Prompt template updated', { templateId });
    return docToTemplate(doc);
  }

  async delete(templateId: string): Promise<void> {
    const result = await this.ChatPromptTemplate.deleteOne({ templateId });
    if (result.deletedCount === 0) throw new PromptTemplateNotFoundError(templateId);
    this.logger.info('Prompt template deleted', { templateId });
  }

  async setDefault(templateId: string): Promise<void> {
    // Unset all defaults
    await this.ChatPromptTemplate.updateMany(
      { isDefault: true },
      { $set: { isDefault: false } },
    );

    // Set the new default
    const doc = await this.ChatPromptTemplate.findOneAndUpdate(
      { templateId },
      { $set: { isDefault: true } },
      { new: true },
    );

    if (!doc) throw new PromptTemplateNotFoundError(templateId);
    this.logger.info('Prompt template set as default', { templateId });
  }

  async findById(templateId: string): Promise<ChatPromptTemplate | null> {
    const doc = await this.ChatPromptTemplate.findOne({ templateId });
    return doc ? docToTemplate(doc) : null;
  }

  async findDefault(): Promise<ChatPromptTemplate | null> {
    const doc = await this.ChatPromptTemplate.findOne({ isDefault: true, isActive: true });
    return doc ? docToTemplate(doc) : null;
  }

  async list(query?: PromptListQuery): Promise<ChatPromptTemplate[]> {
    const filter: Record<string, unknown> = {};
    if (query?.isActive !== undefined) filter.isActive = query.isActive;
    if (query?.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const docs = await this.ChatPromptTemplate.find(filter).sort({ isDefault: -1, createdAt: -1 });
    return docs.map(docToTemplate);
  }
}

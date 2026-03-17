import { AlxError } from '@astralibx/core';

export class ChatAIError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'ChatAIError';
  }
}

export class MemoryNotFoundError extends ChatAIError {
  constructor(public readonly memoryId: string) {
    super(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND');
    this.name = 'MemoryNotFoundError';
  }
}

export class PromptTemplateNotFoundError extends ChatAIError {
  constructor(public readonly templateId: string) {
    super(`Prompt template not found: ${templateId}`, 'PROMPT_TEMPLATE_NOT_FOUND');
    this.name = 'PromptTemplateNotFoundError';
  }
}

export class KnowledgeEntryNotFoundError extends ChatAIError {
  constructor(public readonly entryId: string) {
    super(`Knowledge entry not found: ${entryId}`, 'KNOWLEDGE_ENTRY_NOT_FOUND');
    this.name = 'KnowledgeEntryNotFoundError';
  }
}

export class NoProviderConfiguredError extends ChatAIError {
  constructor() {
    super(
      'No chat provider configured. Provide a chat.generate function to use AI response generation.',
      'NO_PROVIDER_CONFIGURED',
    );
    this.name = 'NoProviderConfiguredError';
  }
}

export class InvalidConfigError extends ChatAIError {
  constructor(message: string, public readonly field: string) {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigError';
  }
}

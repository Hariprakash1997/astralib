import type { Router } from 'express';
import type { LogAdapter } from '@astralibx/core';
import { noopLogger } from '@astralibx/core';
import type { AiResponseInput, AiResponseOutput } from '@astralibx/chat-types';
import type { ChatAIConfig, ResolvedOptions } from './types/config.types';
import type { PromptBuildInput, PromptOutput, ParsedAIResponse } from './types/prompt.types';
import { DEFAULT_OPTIONS } from './types/config.types';
import { validateConfig } from './validation';
import { NoProviderConfiguredError } from './errors';
import { createChatMemorySchema, type ChatMemoryModel } from './schemas/chat-memory.schema';
import { createChatPromptTemplateSchema, type ChatPromptTemplateModel } from './schemas/chat-prompt-template.schema';
import { createChatKnowledgeEntrySchema, type ChatKnowledgeEntryModel } from './schemas/chat-knowledge-entry.schema';
import { BuiltinMemoryBackend } from './backends/builtin.backend';
import { Mem0MemoryBackend } from './backends/mem0.backend';
import { CustomMemoryBackend } from './backends/custom.backend';
import { MemoryService } from './services/memory.service';
import { PromptService } from './services/prompt.service';
import { KnowledgeService } from './services/knowledge.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { createRoutes } from './routes';
import type { MemoryBackend } from './types/memory.types';

export interface ChatAI {
  routes: Router;
  generateResponse(input: AiResponseInput): Promise<AiResponseOutput>;
  memories: MemoryService;
  prompts: PromptService;
  knowledge: KnowledgeService;
  buildPrompt(input: PromptBuildInput): Promise<PromptOutput>;
  parseResponse(raw: string): ParsedAIResponse;
}

export function createChatAI(config: ChatAIConfig): ChatAI {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;

  const resolvedOptions: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...config.options,
  };

  // Register Mongoose models

  const ChatMemory = conn.model<any>(
    `${prefix}ChatMemory`,
    createChatMemorySchema(),
  ) as ChatMemoryModel;

  const ChatPromptTemplate = conn.model<any>(
    `${prefix}ChatPromptTemplate`,
    createChatPromptTemplateSchema(),
  ) as ChatPromptTemplateModel;

  const ChatKnowledgeEntry = conn.model<any>(
    `${prefix}ChatKnowledgeEntry`,
    createChatKnowledgeEntrySchema(),
  ) as ChatKnowledgeEntryModel;

  // Create memory backend

  let memoryBackend: MemoryBackend;
  const backendConfig = config.memoryBackend ?? { type: 'builtin' as const };

  switch (backendConfig.type) {
    case 'mem0':
      memoryBackend = new Mem0MemoryBackend(backendConfig, logger);
      break;
    case 'custom':
      memoryBackend = new CustomMemoryBackend(backendConfig, logger);
      break;
    case 'builtin':
    default:
      memoryBackend = new BuiltinMemoryBackend(ChatMemory, logger);
      break;
  }

  // Create services

  const memoryService = new MemoryService(
    memoryBackend,
    logger,
    config.memorySearch,
    config.embedding,
  );

  const promptService = new PromptService(ChatPromptTemplate, logger);

  const knowledgeService = new KnowledgeService(
    ChatKnowledgeEntry,
    logger,
    config.knowledgeSearch,
    config.embedding,
    config.vectorStore,
    config.embeddingAdapter,
    config.knowledgeVector,
    config.generateAiResponse,
  );

  const promptBuilder = new PromptBuilderService(
    promptService,
    memoryService,
    knowledgeService,
    logger,
  );

  // Create routes

  const routes = createRoutes(
    {
      memories: memoryService,
      prompts: promptService,
      promptBuilder,
      knowledge: knowledgeService,
    },
    logger,
  );

  // Generate response function

  async function generateResponse(input: AiResponseInput): Promise<AiResponseOutput> {
    if (!config.chat?.generate) {
      throw new NoProviderConfiguredError();
    }

    // 1. Determine prompt template (from agent's promptTemplateId or default)
    const agentTemplateId = (input.agent as any)?.promptTemplateId ?? null;

    // 2. Build prompt (includes memory + knowledge injection)
    const recentMessages = input.messages.slice(-resolvedOptions.maxContextMessages);

    const promptOutput = await promptBuilder.buildPrompt({
      templateId: agentTemplateId,
      context: {
        agentName: input.agent.name,
        agentId: input.agent.agentId,
        visitorId: input.visitorId,
        channel: input.visitorContext?.channel ?? 'default',
        message: recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].content : '',
        recentMessages,
        conversationSummary: input.conversationSummary,
        variables: input.metadata as Record<string, string> | undefined,
      },
    });

    // 3. Determine options from template
    const template = promptOutput.templateId
      ? await promptService.findById(promptOutput.templateId)
      : null;

    const generateOptions: Record<string, unknown> = {};
    if (template?.temperature !== undefined) generateOptions.temperature = template.temperature;
    if (template?.maxTokens !== undefined) generateOptions.maxTokens = template.maxTokens;
    if (template?.responseFormat) generateOptions.responseFormat = template.responseFormat;

    // 4. Call AI provider
    const userMessage = promptOutput.userMessage;
    const result = await config.chat.generate(
      promptOutput.systemPrompt,
      userMessage,
      recentMessages,
      generateOptions,
    );

    // 5. Parse response
    const parsed = promptBuilder.parseResponse(result.content);

    // 6. Return output
    return {
      messages: parsed.messages,
      conversationSummary: parsed.conversationSummary ?? input.conversationSummary,
      shouldEscalate: parsed.shouldEscalate,
      escalationReason: parsed.escalationReason,
      extracted: parsed.extracted,
      metadata: {
        ...parsed.metadata,
        model: result.model,
        tokensUsed: result.tokensUsed,
        templateId: promptOutput.templateId,
      },
    };
  }

  function buildPrompt(input: PromptBuildInput): Promise<PromptOutput> {
    return promptBuilder.buildPrompt(input);
  }

  function parseResponse(raw: string): ParsedAIResponse {
    return promptBuilder.parseResponse(raw);
  }

  return {
    routes,
    generateResponse,
    memories: memoryService,
    prompts: promptService,
    knowledge: knowledgeService,
    buildPrompt,
    parseResponse,
  };
}

// Barrel exports
export * from './types';
export * from './errors';
export { validateConfig } from './validation';
export * from './schemas';
export { MemoryService } from './services/memory.service';
export { PromptService } from './services/prompt.service';
export { KnowledgeService } from './services/knowledge.service';
export { PromptBuilderService } from './services/prompt-builder.service';
export { BuiltinMemoryBackend } from './backends/builtin.backend';
export { Mem0MemoryBackend } from './backends/mem0.backend';
export { CustomMemoryBackend } from './backends/custom.backend';
export { createRoutes } from './routes';

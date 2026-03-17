import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage } from '@astralibx/chat-types';
import type { MemoryBackendConfig, MemorySearchConfig } from './memory.types';
import type { KnowledgeSearchConfig } from './knowledge.types';

export type { LogAdapter };

export interface ChatGenerateResult {
  content: string;
  model?: string;
  tokensUsed?: number;
}

export interface ChatGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
}

export interface ChatAIConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  chat?: {
    generate: (
      systemPrompt: string,
      userMessage: string,
      history: ChatMessage[],
      options?: ChatGenerateOptions,
    ) => Promise<ChatGenerateResult>;
  };

  memoryBackend?: MemoryBackendConfig;

  memorySearch?: MemorySearchConfig;

  knowledgeSearch?: KnowledgeSearchConfig;

  embedding?: {
    generate: (text: string) => Promise<number[]>;
    dimensions: number;
  };

  options?: {
    maxContextMessages?: number;
    escalationThreshold?: number;
  };

  logger?: LogAdapter;
}

export interface ResolvedOptions {
  maxContextMessages: number;
  escalationThreshold: number;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  maxContextMessages: 6,
  escalationThreshold: 3,
};

export const DEFAULT_MEMORY_SEARCH: Required<MemorySearchConfig> = {
  strategy: 'text',
  customSearch: async () => [],
  maxMemories: 10,
  maxTokens: 2000,
};

export const DEFAULT_KNOWLEDGE_SEARCH: Required<KnowledgeSearchConfig> = {
  strategy: 'text',
  customSearch: async () => [],
  maxEntries: 5,
  maxTokens: 3000,
};

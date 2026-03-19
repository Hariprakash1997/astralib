import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage } from '@astralibx/chat-types';
import type { MemoryBackendConfig, MemorySearchConfig } from './memory.types';
import type { KnowledgeSearchConfig, KnowledgeVectorConfig } from './knowledge.types';
import type { VectorStoreAdapter, EmbeddingAdapter } from './vector-store.types';

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

  /** Vector store adapter for RAG knowledge base. Optional — when absent, knowledge uses MongoDB text search only. */
  vectorStore?: VectorStoreAdapter;

  /** Embedding adapter for vector operations. Required when vectorStore is provided. */
  embeddingAdapter?: EmbeddingAdapter;

  /** Configuration for vector-backed knowledge dedup and staleness. */
  knowledgeVector?: KnowledgeVectorConfig;

  /** AI generate function used for Stage 2 dedup review and staleness analysis. */
  generateAiResponse?: (systemPrompt: string, userMessage: string) => Promise<string>;

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

export const DEFAULT_KNOWLEDGE_VECTOR: Required<KnowledgeVectorConfig> = {
  dedupThreshold: 0.90,
  aiReviewEnabled: false,
  staleDays: 30,
  staleMinHits: 0,
};

import { z } from 'zod';
import { loggerSchema, baseDbSchema, createConfigValidator, ConfigValidationError } from '@astralibx/core';
import { InvalidConfigError } from '../errors';

const chatSchema = z.object({
  generate: z.function(),
}).optional();

const memoryBackendSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('builtin'),
  }),
  z.object({
    type: z.literal('mem0'),
    client: z.any().refine((val) => val != null, 'mem0 client is required'),
    scopeMapping: z.object({
      visitor: z.function().optional(),
      agent: z.function().optional(),
      global: z.function().optional(),
      channel: z.function().optional(),
    }).optional(),
  }),
  z.object({
    type: z.literal('custom'),
    create: z.function(),
    update: z.function(),
    delete: z.function(),
    list: z.function(),
    search: z.function(),
    getByVisitor: z.function(),
  }),
]).optional();

const memorySearchSchema = z.object({
  strategy: z.enum(['priority', 'text', 'custom']).optional(),
  customSearch: z.function().optional(),
  maxMemories: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
}).optional();

const knowledgeSearchSchema = z.object({
  strategy: z.enum(['priority', 'text', 'custom']).optional(),
  customSearch: z.function().optional(),
  maxEntries: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
}).optional();

const embeddingSchema = z.object({
  generate: z.function(),
  dimensions: z.number().int().positive(),
}).optional();

const vectorStoreSchema = z.object({
  upsert: z.function(),
  search: z.function(),
  delete: z.function(),
  deleteBatch: z.function(),
  get: z.function(),
  list: z.function(),
  getSimilar: z.function(),
  count: z.function(),
}).optional();

const embeddingAdapterSchema = z.object({
  embed: z.function(),
  embedBatch: z.function(),
  dimensions: z.number().int().positive(),
}).optional();

const knowledgeVectorSchema = z.object({
  dedupThreshold: z.number().min(0).max(1).optional(),
  aiReviewEnabled: z.boolean().optional(),
  staleDays: z.number().int().positive().optional(),
  staleMinHits: z.number().int().nonnegative().optional(),
}).optional();

const optionsSchema = z.object({
  maxContextMessages: z.number().int().positive().optional(),
  escalationThreshold: z.number().int().positive().optional(),
}).optional();

const configSchema = z.object({
  db: baseDbSchema,
  chat: chatSchema,
  memoryBackend: memoryBackendSchema,
  memorySearch: memorySearchSchema,
  knowledgeSearch: knowledgeSearchSchema,
  vectorStore: vectorStoreSchema,
  embeddingAdapter: embeddingAdapterSchema,
  knowledgeVector: knowledgeVectorSchema,
  generateAiResponse: z.function().optional(),
  embedding: embeddingSchema,
  options: optionsSchema,
  logger: loggerSchema.optional(),
});

export const validateConfig = createConfigValidator(
  configSchema,
  InvalidConfigError as unknown as typeof ConfigValidationError,
);

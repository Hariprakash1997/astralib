import { Router } from 'express';
import type { LogAdapter } from '@astralibx/core';
import type { MemoryService } from '../services/memory.service';
import type { PromptService } from '../services/prompt.service';
import type { PromptBuilderService } from '../services/prompt-builder.service';
import type { KnowledgeService } from '../services/knowledge.service';
import { createMemoryRoutes } from './memory.routes';
import { createPromptRoutes } from './prompt.routes';
import { createKnowledgeRoutes } from './knowledge.routes';

export interface RouteServices {
  memories: MemoryService;
  prompts: PromptService;
  promptBuilder: PromptBuilderService;
  knowledge: KnowledgeService;
}

export function createRoutes(services: RouteServices, logger: LogAdapter): Router {
  const router = Router();

  router.use('/memories', createMemoryRoutes(services.memories, logger));
  router.use('/prompts', createPromptRoutes(services.prompts, services.promptBuilder, logger));
  router.use('/knowledge', createKnowledgeRoutes(services.knowledge, logger));

  return router;
}

export { createMemoryRoutes } from './memory.routes';
export { createPromptRoutes } from './prompt.routes';
export { createKnowledgeRoutes } from './knowledge.routes';

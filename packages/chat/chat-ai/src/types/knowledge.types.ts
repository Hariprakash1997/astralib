export interface ChatKnowledgeEntry {
  entryId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  priority: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateKnowledgeInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeListQuery {
  category?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export type KnowledgeSearchStrategy = 'priority' | 'text' | 'custom';

export interface KnowledgeSearchOptions {
  limit?: number;
  category?: string;
}

export interface KnowledgeSearchConfig {
  strategy: KnowledgeSearchStrategy;
  customSearch?: (query: string, options: KnowledgeSearchOptions) => Promise<ChatKnowledgeEntry[]>;
  maxEntries?: number;
  maxTokens?: number;
}

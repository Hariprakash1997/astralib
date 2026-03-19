export interface ChatKnowledgeEntry {
  entryId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  priority: number;
  source: 'document' | 'conversation';
  embedding?: number[];
  hitCount: number;
  lastHitAt?: Date;
  sessionId?: string;
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
  source?: 'document' | 'conversation';
  sessionId?: string;
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

export type KnowledgeSearchStrategy = 'priority' | 'text' | 'vector' | 'custom';

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

// ---------------------------------------------------------------------------
// Vector-backed knowledge config
// ---------------------------------------------------------------------------

export interface KnowledgeVectorConfig {
  /** Similarity threshold for dedup (0-1). Default: 0.90 */
  dedupThreshold?: number;

  /** Enable AI-based Stage 2 dedup review. Default: false */
  aiReviewEnabled?: boolean;

  /** Days without hits before an entry is flagged as stale. Default: 30 */
  staleDays?: number;

  /** Minimum hit count — entries below this after staleDays are flagged. Default: 0 */
  staleMinHits?: number;
}

export interface KnowledgeStats {
  total: number;
  bySource: { document: number; conversation: number };
  byCategory: Record<string, number>;
}

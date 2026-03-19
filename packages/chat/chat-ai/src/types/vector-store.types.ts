// ---------------------------------------------------------------------------
// Vector Store Adapter — abstract interface for any vector DB (Qdrant, Pinecone, etc.)
// ---------------------------------------------------------------------------

/**
 * Source of a knowledge entry — either pre-fed documents or conversation-derived.
 */
export type KnowledgeSource = 'document' | 'conversation';

/**
 * Metadata attached to every vector entry.
 */
export interface KnowledgeMetadata {
  source: KnowledgeSource;
  category?: string;
  tags?: string[];
  title?: string;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  /** How many times this entry was returned as a search result. */
  hitCount: number;
  /** Last time this entry was returned as a search result. */
  lastHitAt?: Date;
  /** Opaque bag for consumer-specific data. */
  extra?: Record<string, unknown>;
}

/**
 * A single result from a vector similarity search.
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: KnowledgeMetadata;
}

/**
 * A stored vector entry (no score).
 */
export interface VectorEntry {
  id: string;
  content: string;
  metadata: KnowledgeMetadata;
}

/**
 * Filter object passed to list / search operations.
 * Implementations map these to their native filter syntax.
 */
export type VectorFilter = Record<string, unknown>;

/**
 * Adapter interface that any vector database must implement.
 */
export interface VectorStoreAdapter {
  /** Insert or update a knowledge entry. */
  upsert(id: string, vector: number[], metadata: KnowledgeMetadata, content: string): Promise<void>;

  /** Search for similar entries by vector. */
  search(vector: number[], limit: number, filter?: VectorFilter): Promise<VectorSearchResult[]>;

  /** Delete an entry by id. */
  delete(id: string): Promise<void>;

  /** Delete multiple entries by id. */
  deleteBatch(ids: string[]): Promise<void>;

  /** Get a single entry by id. */
  get(id: string): Promise<VectorEntry | null>;

  /** List entries with optional filter + pagination. */
  list(filter?: VectorFilter, limit?: number, offset?: number): Promise<VectorEntry[]>;

  /** Return entries above a similarity threshold. */
  getSimilar(vector: number[], threshold: number, filter?: VectorFilter): Promise<VectorSearchResult[]>;

  /** Count entries matching an optional filter. */
  count(filter?: VectorFilter): Promise<number>;
}

/**
 * Embedding adapter — wraps any embedding provider (OpenAI, Cohere, local model, etc.).
 */
export interface EmbeddingAdapter {
  /** Generate an embedding vector for a single text. */
  embed(text: string): Promise<number[]>;

  /** Generate embeddings for multiple texts in one call. */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Dimensionality of vectors produced by this adapter. */
  readonly dimensions: number;
}

// ---------------------------------------------------------------------------
// Dedup types
// ---------------------------------------------------------------------------

/** Dedup decision returned by AI review (Stage 2). */
export type DedupDecision = 'duplicate' | 'overlapping' | 'related' | 'stale_replacement';

/** Result of the two-stage dedup pipeline. */
export interface DedupResult {
  action: 'inserted' | 'skipped_duplicate' | 'merged' | 'replaced';
  id: string;
  /** Present when stage-2 AI review ran. */
  aiDecision?: DedupDecision;
  /** The existing entry that was matched (if any). */
  matchedEntryId?: string;
  matchScore?: number;
}

// ---------------------------------------------------------------------------
// Staleness cleanup types
// ---------------------------------------------------------------------------

export interface StaleEntryReport {
  id: string;
  content: string;
  metadata: KnowledgeMetadata;
  /** Why it was flagged. */
  reason: 'zero_hits' | 'expired' | 'low_hits';
  /** AI-suggested action (only when AI review is enabled). */
  suggestedAction?: 'delete' | 'merge' | 'keep';
  /** If merge is suggested, target entry id. */
  mergeTargetId?: string;
}

export interface CleanupReport {
  scannedCount: number;
  flaggedEntries: StaleEntryReport[];
  generatedAt: Date;
}

export interface CleanupApplyResult {
  deleted: number;
  merged: number;
  kept: number;
}

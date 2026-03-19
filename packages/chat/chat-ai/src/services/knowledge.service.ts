import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatKnowledgeEntryModel } from '../schemas/chat-knowledge-entry.schema.js';
import type {
  ChatKnowledgeEntry,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeListQuery,
  KnowledgeSearchConfig,
  KnowledgeSearchOptions,
  KnowledgeVectorConfig,
  KnowledgeStats,
} from '../types/knowledge.types.js';
import type {
  VectorStoreAdapter,
  EmbeddingAdapter,
  DedupResult,
  DedupDecision,
  KnowledgeMetadata,
  CleanupReport,
  CleanupApplyResult,
  StaleEntryReport,
  VectorSearchResult,
} from '../types/vector-store.types.js';
import { DEFAULT_KNOWLEDGE_SEARCH, DEFAULT_KNOWLEDGE_VECTOR } from '../types/config.types.js';
import { KnowledgeEntryNotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEDUP_SYSTEM_PROMPT = `You are a knowledge base deduplication reviewer. Given an incoming entry and a list of similar existing entries, classify the relationship.

Respond with EXACTLY one JSON object (no markdown, no explanation):
{"decision": "<decision>", "reason": "<short reason>"}

Possible decisions:
- "duplicate" — the incoming entry says the same thing as an existing entry
- "overlapping" — the incoming entry partially overlaps; suggest merging
- "related" — different but related content; safe to add
- "stale_replacement" — the incoming entry is a newer version of an existing entry`;

const CLEANUP_SYSTEM_PROMPT = `You are a knowledge base maintenance assistant. Given a list of stale entries, suggest an action for each.

Respond with EXACTLY a JSON array (no markdown, no explanation):
[{"id": "<entryId>", "action": "delete" | "merge" | "keep", "mergeTargetId": "<optional>", "reason": "<short reason>"}]`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function docToEntry(doc: any): ChatKnowledgeEntry {
  return {
    entryId: doc.entryId,
    title: doc.title,
    content: doc.content,
    category: doc.category,
    tags: doc.tags ?? [],
    isActive: doc.isActive,
    priority: doc.priority,
    source: doc.source ?? 'document',
    embedding: doc.embedding,
    hitCount: doc.hitCount ?? 0,
    lastHitAt: doc.lastHitAt,
    sessionId: doc.sessionId,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class KnowledgeService {
  private searchConfig: Required<KnowledgeSearchConfig>;
  private vectorConfig: Required<KnowledgeVectorConfig>;

  constructor(
    private ChatKnowledgeEntry: ChatKnowledgeEntryModel,
    private logger: LogAdapter,
    searchConfig?: KnowledgeSearchConfig,
    private embeddingLegacy?: {
      generate: (text: string) => Promise<number[]>;
      dimensions: number;
    },
    private vectorStore?: VectorStoreAdapter,
    private embeddingAdapter?: EmbeddingAdapter,
    vectorConfig?: KnowledgeVectorConfig,
    private generateAiResponse?: (systemPrompt: string, userMessage: string) => Promise<string>,
  ) {
    this.searchConfig = {
      ...DEFAULT_KNOWLEDGE_SEARCH,
      ...searchConfig,
    };
    this.vectorConfig = {
      ...DEFAULT_KNOWLEDGE_VECTOR,
      ...vectorConfig,
    };
  }

  // -------------------------------------------------------------------------
  // CRUD — Mongo-backed (existing behaviour preserved)
  // -------------------------------------------------------------------------

  async create(input: CreateKnowledgeInput): Promise<ChatKnowledgeEntry> {
    const entryId = crypto.randomUUID();
    const data: Record<string, unknown> = {
      entryId,
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags ?? [],
      isActive: input.isActive ?? true,
      priority: input.priority ?? 50,
      source: input.source ?? 'document',
      sessionId: input.sessionId,
      hitCount: 0,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    };

    // Generate embedding (legacy adapter)
    if (this.embeddingLegacy) {
      try {
        data.embedding = await this.embeddingLegacy.generate(`${input.title}\n${input.content}`);
      } catch (err) {
        this.logger.error('Failed to generate embedding for knowledge entry', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const doc = await this.ChatKnowledgeEntry.create(data);
    this.logger.info('Knowledge entry created', { entryId });

    // Sync to vector store if available
    if (this.vectorStore && this.embeddingAdapter) {
      try {
        await this.syncToVectorStore(entryId, input.title, input.content, {
          source: (input.source ?? 'document') as 'document' | 'conversation',
          category: input.category,
          tags: input.tags,
          title: input.title,
          createdAt: doc.createdAt,
          hitCount: 0,
        });
      } catch (err) {
        this.logger.error('Failed to sync knowledge entry to vector store', {
          entryId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return docToEntry(doc);
  }

  async update(entryId: string, input: UpdateKnowledgeInput): Promise<ChatKnowledgeEntry> {
    const updateData: Record<string, unknown> = { ...input };

    if (this.embeddingLegacy && (input.title || input.content)) {
      try {
        const existing = await this.ChatKnowledgeEntry.findOne({ entryId });
        if (existing) {
          const title = input.title ?? existing.title;
          const content = input.content ?? existing.content;
          updateData.embedding = await this.embeddingLegacy.generate(`${title}\n${content}`);
        }
      } catch (err) {
        this.logger.error('Failed to generate embedding for knowledge update', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const doc = await this.ChatKnowledgeEntry.findOneAndUpdate(
      { entryId },
      { $set: updateData },
      { new: true },
    );

    if (!doc) throw new KnowledgeEntryNotFoundError(entryId);
    this.logger.info('Knowledge entry updated', { entryId });

    // Sync update to vector store
    if (this.vectorStore && this.embeddingAdapter && (input.title || input.content)) {
      try {
        const title = input.title ?? doc.title;
        const content = input.content ?? doc.content;
        await this.syncToVectorStore(entryId, title, content, {
          source: doc.source as 'document' | 'conversation',
          category: doc.category,
          tags: doc.tags,
          title,
          createdAt: doc.createdAt,
          updatedAt: new Date(),
          hitCount: doc.hitCount ?? 0,
          lastHitAt: doc.lastHitAt,
        });
      } catch (err) {
        this.logger.error('Failed to sync knowledge update to vector store', {
          entryId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return docToEntry(doc);
  }

  async delete(entryId: string): Promise<void> {
    const result = await this.ChatKnowledgeEntry.deleteOne({ entryId });
    if (result.deletedCount === 0) throw new KnowledgeEntryNotFoundError(entryId);
    this.logger.info('Knowledge entry deleted', { entryId });

    // Remove from vector store
    if (this.vectorStore) {
      try {
        await this.vectorStore.delete(entryId);
      } catch (err) {
        this.logger.error('Failed to delete knowledge entry from vector store', {
          entryId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  async bulkDelete(entryIds: string[]): Promise<{ deleted: number }> {
    const result = await this.ChatKnowledgeEntry.deleteMany({ entryId: { $in: entryIds } });
    this.logger.info('Knowledge entries bulk deleted', { count: result.deletedCount });

    if (this.vectorStore) {
      try {
        await this.vectorStore.deleteBatch(entryIds);
      } catch (err) {
        this.logger.error('Failed to bulk delete from vector store', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { deleted: result.deletedCount };
  }

  async findById(entryId: string): Promise<ChatKnowledgeEntry | null> {
    const doc = await this.ChatKnowledgeEntry.findOne({ entryId });
    return doc ? docToEntry(doc) : null;
  }

  async list(query: KnowledgeListQuery): Promise<{ entries: ChatKnowledgeEntry[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { content: { $regex: query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(query.search, 'i')] } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.ChatKnowledgeEntry.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit),
      this.ChatKnowledgeEntry.countDocuments(filter),
    ]);

    return { entries: docs.map(docToEntry), total };
  }

  async search(query: string): Promise<ChatKnowledgeEntry[]> {
    const docs = await this.ChatKnowledgeEntry.find(
      { $text: { $search: query }, isActive: true },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' }, priority: -1 })
      .limit(20);

    return docs.map(docToEntry);
  }

  async getCategories(): Promise<string[]> {
    return this.ChatKnowledgeEntry.distinct('category', { category: { $ne: null } });
  }

  async getRelevantKnowledge(query: string, options?: { limit?: number; category?: string }): Promise<ChatKnowledgeEntry[]> {
    const maxEntries = options?.limit ?? this.searchConfig.maxEntries;
    const maxTokens = this.searchConfig.maxTokens;

    let entries: ChatKnowledgeEntry[];

    switch (this.searchConfig.strategy) {
      case 'priority': {
        const filter: Record<string, unknown> = { isActive: true };
        if (options?.category) filter.category = options.category;
        const docs = await this.ChatKnowledgeEntry.find(filter)
          .sort({ priority: -1 })
          .limit(maxEntries);
        entries = docs.map(docToEntry);
        break;
      }

      case 'vector': {
        entries = await this.vectorSearch(query, maxEntries, options?.category);
        break;
      }

      case 'text': {
        entries = await this.search(query);
        break;
      }

      case 'custom': {
        if (this.searchConfig.customSearch) {
          entries = await this.searchConfig.customSearch(query, {
            limit: maxEntries,
            category: options?.category,
          });
        } else {
          entries = [];
        }
        break;
      }

      default:
        entries = [];
    }

    // Cap by count
    entries = entries.slice(0, maxEntries);

    // Cap by token budget
    let tokenCount = 0;
    const budgeted: ChatKnowledgeEntry[] = [];
    for (const entry of entries) {
      const tokens = estimateTokens(entry.content);
      if (tokenCount + tokens > maxTokens) break;
      tokenCount += tokens;
      budgeted.push(entry);
    }

    return budgeted;
  }

  async import(entries: CreateKnowledgeInput[]): Promise<{ imported: number }> {
    const docs = entries.map((entry) => ({
      entryId: crypto.randomUUID(),
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags ?? [],
      isActive: entry.isActive ?? true,
      priority: entry.priority ?? 50,
      source: entry.source ?? 'document',
      hitCount: 0,
      metadata: entry.metadata ?? {},
      createdBy: entry.createdBy,
    }));

    const created = await this.ChatKnowledgeEntry.insertMany(docs);
    this.logger.info('Knowledge entries imported', { count: created.length });
    return { imported: created.length };
  }

  async export(): Promise<ChatKnowledgeEntry[]> {
    const docs = await this.ChatKnowledgeEntry.find({}).sort({ priority: -1, createdAt: -1 });
    return docs.map(docToEntry);
  }

  // -------------------------------------------------------------------------
  // RAG — Vector-backed knowledge management
  // -------------------------------------------------------------------------

  /**
   * Add knowledge with two-stage dedup pipeline.
   * Stage 1: Vector similarity check (always runs when vectorStore is configured).
   * Stage 2: AI review (runs only when aiReviewEnabled + generateAiResponse are present).
   */
  async addKnowledge(
    content: string,
    metadata: { title?: string; category?: string; tags?: string[]; source?: 'document' | 'conversation'; sessionId?: string; createdBy?: string },
  ): Promise<DedupResult> {
    const entryId = crypto.randomUUID();
    const title = metadata.title ?? content.slice(0, 80);
    const source = metadata.source ?? 'document';

    // If no vector store, fall back to simple Mongo insert
    if (!this.vectorStore || !this.embeddingAdapter) {
      await this.create({
        title,
        content,
        category: metadata.category,
        tags: metadata.tags,
        source,
        sessionId: metadata.sessionId,
        createdBy: metadata.createdBy,
      });
      return { action: 'inserted', id: entryId };
    }

    // Generate embedding
    const embedding = await this.embeddingAdapter.embed(`${title}\n${content}`);

    // --- Stage 1: Vector similarity check ---
    const similar = await this.vectorStore.getSimilar(embedding, this.vectorConfig.dedupThreshold);

    if (similar.length === 0) {
      // No duplicates — safe to insert
      await this.insertWithVector(entryId, title, content, embedding, source, metadata);
      return { action: 'inserted', id: entryId };
    }

    const topMatch = similar[0];

    // --- Stage 2: AI review (optional) ---
    if (this.vectorConfig.aiReviewEnabled && this.generateAiResponse) {
      const decision = await this.getAiDedupDecision(content, similar);

      switch (decision) {
        case 'duplicate': {
          this.logger.info('Knowledge entry skipped — AI confirmed duplicate', {
            entryId,
            matchedEntryId: topMatch.id,
            score: topMatch.score,
          });
          // Bump hit count on existing entry
          await this.bumpHitCount(topMatch.id);
          return {
            action: 'skipped_duplicate',
            id: entryId,
            aiDecision: decision,
            matchedEntryId: topMatch.id,
            matchScore: topMatch.score,
          };
        }

        case 'stale_replacement': {
          // Replace the old entry with the new one
          await this.delete(topMatch.id);
          await this.insertWithVector(entryId, title, content, embedding, source, metadata);
          this.logger.info('Knowledge entry replaced stale entry', {
            newId: entryId,
            replacedId: topMatch.id,
          });
          return {
            action: 'replaced',
            id: entryId,
            aiDecision: decision,
            matchedEntryId: topMatch.id,
            matchScore: topMatch.score,
          };
        }

        case 'overlapping': {
          // Merge: keep the existing entry but append new content
          const existingEntry = await this.findById(topMatch.id);
          if (existingEntry) {
            const mergedContent = `${existingEntry.content}\n\n---\n\n${content}`;
            await this.update(topMatch.id, { content: mergedContent });
            this.logger.info('Knowledge entry merged with existing', {
              entryId,
              mergedInto: topMatch.id,
            });
          }
          return {
            action: 'merged',
            id: topMatch.id,
            aiDecision: decision,
            matchedEntryId: topMatch.id,
            matchScore: topMatch.score,
          };
        }

        case 'related':
        default: {
          // Safe to insert alongside
          await this.insertWithVector(entryId, title, content, embedding, source, metadata);
          return {
            action: 'inserted',
            id: entryId,
            aiDecision: decision,
            matchedEntryId: topMatch.id,
            matchScore: topMatch.score,
          };
        }
      }
    }

    // AI review disabled — insert even though similar entries exist
    await this.insertWithVector(entryId, title, content, embedding, source, metadata);
    return {
      action: 'inserted',
      id: entryId,
      matchedEntryId: topMatch.id,
      matchScore: topMatch.score,
    };
  }

  /**
   * Pre-feed a document into the knowledge base.
   */
  async addDocument(content: string, category?: string, title?: string, tags?: string[]): Promise<DedupResult> {
    return this.addKnowledge(content, {
      title,
      category,
      tags,
      source: 'document',
    });
  }

  /**
   * Add knowledge derived from a conversation.
   */
  async addFromConversation(sessionId: string, content: string, category?: string): Promise<DedupResult> {
    return this.addKnowledge(content, {
      source: 'conversation',
      sessionId,
      category,
    });
  }

  /**
   * Vector-powered semantic search.
   */
  async vectorSearch(query: string, limit?: number, category?: string): Promise<ChatKnowledgeEntry[]> {
    if (!this.vectorStore || !this.embeddingAdapter) {
      this.logger.warn('vectorSearch called but no vector store configured — falling back to text search');
      return this.search(query);
    }

    const maxEntries = limit ?? this.searchConfig.maxEntries;
    const embedding = await this.embeddingAdapter.embed(query);

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;

    const results = await this.vectorStore.search(embedding, maxEntries, filter);

    // Bump hit counts for returned entries
    const ids = results.map((r) => r.id);
    if (ids.length > 0) {
      await this.ChatKnowledgeEntry.updateMany(
        { entryId: { $in: ids } },
        { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } },
      );
    }

    // Map vector results back to ChatKnowledgeEntry (fetch from Mongo for full data)
    const docs = await this.ChatKnowledgeEntry.find({ entryId: { $in: ids } });
    const docMap = new Map(docs.map((d: any) => [d.entryId, d]));

    // Preserve score-based ordering
    const entries: ChatKnowledgeEntry[] = [];
    for (const result of results) {
      const doc = docMap.get(result.id);
      if (doc) {
        entries.push(docToEntry(doc));
      }
    }

    return entries;
  }

  /**
   * Get entry statistics.
   */
  async getEntryStats(): Promise<KnowledgeStats> {
    const [total, bySourceAgg, byCategoryAgg] = await Promise.all([
      this.ChatKnowledgeEntry.countDocuments({}),
      this.ChatKnowledgeEntry.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      this.ChatKnowledgeEntry.aggregate([
        { $match: { category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const bySource = { document: 0, conversation: 0 };
    for (const row of bySourceAgg) {
      if (row._id === 'document') bySource.document = row.count;
      if (row._id === 'conversation') bySource.conversation = row.count;
    }

    const byCategory: Record<string, number> = {};
    for (const row of byCategoryAgg) {
      byCategory[row._id] = row.count;
    }

    return { total, bySource, byCategory };
  }

  // -------------------------------------------------------------------------
  // Staleness cleanup
  // -------------------------------------------------------------------------

  /**
   * Scan for stale entries and return a report. Does NOT delete anything.
   */
  async cleanupStaleEntries(): Promise<CleanupReport> {
    const staleDays = this.vectorConfig.staleDays;
    const staleMinHits = this.vectorConfig.staleMinHits;
    const cutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    // Find entries with zero or low hits that haven't been accessed recently
    const staleDocs = await this.ChatKnowledgeEntry.find({
      $or: [
        // Zero hits and created before cutoff
        { hitCount: { $lte: staleMinHits }, createdAt: { $lt: cutoffDate } },
        // Has expiration date that has passed
        { 'metadata.expiresAt': { $lt: new Date() } },
      ],
    }).sort({ hitCount: 1, createdAt: 1 });

    const flaggedEntries: StaleEntryReport[] = staleDocs.map((doc: any) => {
      const isExpired = doc.metadata?.expiresAt && new Date(doc.metadata.expiresAt) < new Date();
      return {
        id: doc.entryId,
        content: doc.content,
        metadata: {
          source: doc.source ?? 'document',
          category: doc.category,
          tags: doc.tags,
          title: doc.title,
          createdAt: doc.createdAt,
          hitCount: doc.hitCount ?? 0,
          lastHitAt: doc.lastHitAt,
        },
        reason: isExpired ? 'expired' as const : (doc.hitCount ?? 0) === 0 ? 'zero_hits' as const : 'low_hits' as const,
      };
    });

    // If AI review is enabled, ask AI for suggestions
    if (this.vectorConfig.aiReviewEnabled && this.generateAiResponse && flaggedEntries.length > 0) {
      try {
        const aiSuggestions = await this.getAiCleanupSuggestions(flaggedEntries);
        for (const suggestion of aiSuggestions) {
          const entry = flaggedEntries.find((e) => e.id === suggestion.id);
          if (entry) {
            entry.suggestedAction = suggestion.action;
            entry.mergeTargetId = suggestion.mergeTargetId;
          }
        }
      } catch (err) {
        this.logger.error('AI cleanup review failed — returning report without suggestions', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const report: CleanupReport = {
      scannedCount: staleDocs.length,
      flaggedEntries,
      generatedAt: new Date(),
    };

    this.logger.info('Staleness cleanup report generated', {
      scanned: report.scannedCount,
      flagged: report.flaggedEntries.length,
    });

    return report;
  }

  /**
   * Apply a cleanup report — actually delete/merge entries.
   * Only processes entries with suggestedAction or explicit deleteIds/mergeIds.
   */
  async applyCleanup(
    deleteIds: string[],
    mergeInstructions?: Array<{ sourceId: string; targetId: string }>,
  ): Promise<CleanupApplyResult> {
    let deleted = 0;
    let merged = 0;
    const kept = 0;

    // Delete entries
    if (deleteIds.length > 0) {
      const result = await this.bulkDelete(deleteIds);
      deleted = result.deleted;
    }

    // Merge entries
    if (mergeInstructions && mergeInstructions.length > 0) {
      for (const { sourceId, targetId } of mergeInstructions) {
        try {
          const source = await this.findById(sourceId);
          const target = await this.findById(targetId);
          if (source && target) {
            const mergedContent = `${target.content}\n\n---\n\n${source.content}`;
            await this.update(targetId, { content: mergedContent });
            await this.delete(sourceId);
            merged++;
          }
        } catch (err) {
          this.logger.error('Failed to merge knowledge entries', {
            sourceId,
            targetId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    this.logger.info('Cleanup applied', { deleted, merged, kept });
    return { deleted, merged, kept };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async insertWithVector(
    entryId: string,
    title: string,
    content: string,
    embedding: number[],
    source: 'document' | 'conversation',
    metadata: { category?: string; tags?: string[]; sessionId?: string; createdBy?: string },
  ): Promise<void> {
    const now = new Date();

    // Insert into Mongo
    await this.ChatKnowledgeEntry.create({
      entryId,
      title,
      content,
      category: metadata.category,
      tags: metadata.tags ?? [],
      isActive: true,
      priority: 50,
      source,
      sessionId: metadata.sessionId,
      embedding,
      hitCount: 0,
      metadata: {},
      createdBy: metadata.createdBy,
    });

    // Insert into vector store
    const vectorMeta: KnowledgeMetadata = {
      source,
      category: metadata.category,
      tags: metadata.tags,
      title,
      createdAt: now,
      hitCount: 0,
    };

    await this.vectorStore!.upsert(entryId, embedding, vectorMeta, content);
  }

  private async syncToVectorStore(
    entryId: string,
    title: string,
    content: string,
    metadata: KnowledgeMetadata,
  ): Promise<void> {
    const embedding = await this.embeddingAdapter!.embed(`${title}\n${content}`);
    await this.vectorStore!.upsert(entryId, embedding, metadata, content);
  }

  private async bumpHitCount(entryId: string): Promise<void> {
    await this.ChatKnowledgeEntry.updateOne(
      { entryId },
      { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } },
    );
  }

  private async getAiDedupDecision(
    incomingContent: string,
    similar: VectorSearchResult[],
  ): Promise<DedupDecision> {
    const existingList = similar
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] (score: ${s.score.toFixed(3)}) ${s.content.slice(0, 500)}`)
      .join('\n\n');

    const userMessage = `Incoming entry:\n${incomingContent.slice(0, 1000)}\n\nExisting similar entries:\n${existingList}`;

    try {
      const raw = await this.generateAiResponse!(DEDUP_SYSTEM_PROMPT, userMessage);
      const parsed = JSON.parse(raw);
      const validDecisions: DedupDecision[] = ['duplicate', 'overlapping', 'related', 'stale_replacement'];
      if (validDecisions.includes(parsed.decision)) {
        this.logger.info('AI dedup decision', { decision: parsed.decision, reason: parsed.reason });
        return parsed.decision;
      }
    } catch (err) {
      this.logger.error('Failed to parse AI dedup response', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Default to 'related' (safe to insert)
    return 'related';
  }

  private async getAiCleanupSuggestions(
    entries: StaleEntryReport[],
  ): Promise<Array<{ id: string; action: 'delete' | 'merge' | 'keep'; mergeTargetId?: string }>> {
    const entrySummary = entries
      .slice(0, 20)
      .map((e, i) => `[${i + 1}] id="${e.id}" reason="${e.reason}" hits=${e.metadata.hitCount} content="${e.content.slice(0, 200)}"`)
      .join('\n');

    const userMessage = `Stale knowledge entries to review:\n${entrySummary}`;

    try {
      const raw = await this.generateAiResponse!(CLEANUP_SYSTEM_PROMPT, userMessage);
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error('Failed to parse AI cleanup suggestions', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return [];
    }
  }
}

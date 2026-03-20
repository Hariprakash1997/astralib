import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatSessionSummary, VisitorContext, SessionStats, ChatFeedback } from '@astralibx/chat-types';
import { ChatSessionStatus, SessionMode, ChatSenderType } from '@astralibx/chat-types';
import type { ChatSessionModel, ChatSessionDocument } from '../schemas/chat-session.schema.js';
import type { ChatMessageModel, ChatMessageDocument } from '../schemas/chat-message.schema.js';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types.js';
import type { SettingsService } from './settings.service.js';
import { SessionNotFoundError, InvalidConfigError } from '../errors/index.js';
import { validateSessionTransition } from '../validation/state.validator.js';
import { withTenantFilter, withTenantId } from '../utils/helpers.js';

export class SessionService {
  constructor(
    private ChatSession: ChatSessionModel,
    private ChatMessage: ChatMessageModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
    private hooks?: ChatEngineConfig['hooks'],
    private tenantId?: string,
  ) {}

  async create(context: VisitorContext, mode: SessionMode): Promise<ChatSessionDocument> {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session = await this.ChatSession.create(withTenantId({
      sessionId,
      visitorId: context.visitorId,
      visitorFingerprint: context.fingerprint,
      status: ChatSessionStatus.New,
      mode,
      channel: context.channel,
      messageCount: 0,
      startedAt: now,
      visibleUntil: new Date(now.getTime() + this.options.sessionVisibilityMs),
      preferences: context.metadata || {},
      metadata: context.metadata || {},
    }, this.tenantId));

    this.logger.info('Session created', { sessionId, visitorId: context.visitorId });
    this.hooks?.onSessionCreated?.(this.toSummary(session));

    return session;
  }

  async findById(sessionId: string): Promise<ChatSessionDocument | null> {
    return this.ChatSession.findOne(withTenantFilter({ sessionId }, this.tenantId));
  }

  async findByIdOrFail(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  async findOrCreate(context: VisitorContext, existingSessionId?: string, defaultMode?: SessionMode): Promise<{
    session: ChatSessionDocument;
    isNew: boolean;
    messages: ChatMessageDocument[];
  }> {
    if (existingSessionId) {
      const existing = await this.findById(existingSessionId);
      if (existing && this.canResume(existing) && existing.visitorId === context.visitorId) {
        const messages = await this.ChatMessage
          .find({ sessionId: existing.sessionId })
          .sort({ createdAt: -1 })
          .limit(this.options.maxSessionHistory)
          .sort({ createdAt: 1 });

        if (existing.status === ChatSessionStatus.Abandoned) {
          validateSessionTransition(existing.sessionId, existing.status, ChatSessionStatus.Active);
          existing.status = ChatSessionStatus.Active;
          existing.endedAt = undefined;
          existing.visibleUntil = new Date(Date.now() + this.options.sessionVisibilityMs);
          await existing.save();
        }

        return { session: existing, isNew: false, messages };
      }
    }

    // Gap 18: Only reuse existing active sessions when singleSessionPerVisitor is enabled
    if (this.options.singleSessionPerVisitor) {
      const recentSession = await this.ChatSession.findOne(withTenantFilter({
        visitorId: context.visitorId,
        status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
      } as Record<string, unknown>, this.tenantId)).sort({ startedAt: -1 });

      if (recentSession) {
        const messages = await this.ChatMessage
          .find({ sessionId: recentSession.sessionId })
          .sort({ createdAt: -1 })
          .limit(this.options.maxSessionHistory)
          .sort({ createdAt: 1 });

        return { session: recentSession, isNew: false, messages };
      }
    }

    const mode = defaultMode || SessionMode.AI;
    const session = await this.create(context, mode);
    return { session, isNew: true, messages: [] };
  }

  async resolve(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, ChatSessionStatus.Resolved);
    const now = new Date();

    session.status = ChatSessionStatus.Resolved;
    session.resolvedAt = now;
    session.endedAt = now;
    await session.save();

    const stats = await this.getSessionStats(sessionId);
    this.logger.info('Session resolved', { sessionId });
    this.hooks?.onSessionResolved?.(this.toSummary(session), stats);

    return session;
  }

  async abandon(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, ChatSessionStatus.Abandoned);

    session.status = ChatSessionStatus.Abandoned;
    session.endedAt = new Date();
    await session.save();

    this.logger.info('Session abandoned', { sessionId });
    this.hooks?.onSessionAbandoned?.(this.toSummary(session));

    return session;
  }

  async close(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, ChatSessionStatus.Closed);

    session.status = ChatSessionStatus.Closed;
    session.closedAt = new Date();
    await session.save();

    this.logger.info('Session closed', { sessionId });
    this.hooks?.onSessionClosed?.(this.toSummary(session));

    return session;
  }

  async findResolvedForAutoClose(autoCloseAfterMs: number): Promise<ChatSessionDocument[]> {
    const cutoff = new Date(Date.now() - autoCloseAfterMs);
    return this.ChatSession.find(withTenantFilter({
      status: ChatSessionStatus.Resolved,
      resolvedAt: { $lte: cutoff },
    } as Record<string, unknown>, this.tenantId));
  }

  async updateMode(sessionId: string, mode: SessionMode, takenOverBy?: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);

    session.mode = mode;
    if (takenOverBy) {
      session.takenOverBy = takenOverBy;
    }
    await session.save();

    this.logger.info('Session mode updated', { sessionId, mode, takenOverBy });

    return session;
  }

  async transfer(sessionId: string, targetAgentId: string, note?: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    const fromAgentId = session.agentId;

    session.transferredFrom = fromAgentId;
    session.agentId = targetAgentId;
    session.transferNote = note;
    await session.save();

    if (fromAgentId) {
      this.hooks?.onAgentTransfer?.(sessionId, fromAgentId, targetAgentId);
    }
    this.logger.info('Session transferred', { sessionId, from: fromAgentId, to: targetAgentId });

    return session;
  }

  async assignAgent(sessionId: string, agentId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, ChatSessionStatus.WithAgent);

    session.agentId = agentId;
    session.status = ChatSessionStatus.WithAgent;
    session.queuePosition = undefined;
    await session.save();

    return session;
  }

  async setQueuePosition(sessionId: string, position: number): Promise<void> {
    const session = await this.findByIdOrFail(sessionId);
    if (session.status !== ChatSessionStatus.WaitingAgent) {
      validateSessionTransition(sessionId, session.status, ChatSessionStatus.WaitingAgent);
    }

    await this.ChatSession.updateOne(
      { sessionId },
      {
        $set: {
          status: ChatSessionStatus.WaitingAgent,
          queuePosition: position,
        },
      },
    );
    this.hooks?.onQueuePositionChanged?.(sessionId, position);
  }

  async estimateWaitTime(queuePosition: number): Promise<number> {
    const recentResolved = await this.ChatSession.find(withTenantFilter({
      status: ChatSessionStatus.Resolved,
      resolvedAt: { $exists: true },
      startedAt: { $exists: true },
    } as Record<string, unknown>, this.tenantId))
      .sort({ resolvedAt: -1 })
      .limit(50);

    let avgResolutionMs = 5 * 60 * 1000; // default 5 minutes if no data
    if (recentResolved.length > 0) {
      const totalMs = recentResolved.reduce((sum, s) => {
        const start = s.startedAt?.getTime() || 0;
        const end = s.resolvedAt?.getTime() || s.endedAt?.getTime() || 0;
        return sum + (end - start);
      }, 0);
      avgResolutionMs = totalMs / recentResolved.length;
    }

    const onlineAgents = await this.getOnlineAgentCount();
    const agentCount = Math.max(onlineAgents, 1);
    const estimatedMs = (avgResolutionMs / agentCount) * queuePosition;
    const estimatedMinutes = Math.ceil(estimatedMs / 60_000);

    return Math.max(estimatedMinutes, 1);
  }

  private async getOnlineAgentCount(): Promise<number> {
    // Use dashboard stats to get active agent count; fallback to 1
    const stats = await this.getDashboardStats();
    return stats.activeAgents || 1;
  }

  async escalate(sessionId: string, reason?: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, ChatSessionStatus.WaitingAgent);

    session.mode = SessionMode.Manual;
    session.status = ChatSessionStatus.WaitingAgent;
    session.escalatedAt = new Date();

    // Calculate queue position
    const waitingCount = await this.ChatSession.countDocuments(withTenantFilter({
      status: ChatSessionStatus.WaitingAgent,
    } as Record<string, unknown>, this.tenantId));
    session.queuePosition = waitingCount + 1;

    await session.save();

    this.hooks?.onEscalation?.(sessionId, reason);
    this.hooks?.onQueueJoin?.(sessionId, session.queuePosition);
    this.logger.info('Session escalated', { sessionId, reason, queuePosition: session.queuePosition });

    return session;
  }

  async submitFeedback(sessionId: string, feedback: ChatFeedback): Promise<void> {
    await this.ChatSession.updateOne(
      withTenantFilter({ sessionId }, this.tenantId),
      {
        $set: {
          feedback: {
            ...feedback,
            submittedAt: new Date(),
          },
        },
      },
    );

    this.hooks?.onFeedbackReceived?.(sessionId, feedback);
    this.logger.info('Feedback received', { sessionId });
  }

  async updateLastMessage(sessionId: string): Promise<void> {
    await this.ChatSession.updateOne(
      withTenantFilter({ sessionId }, this.tenantId),
      {
        $inc: { messageCount: 1 },
        $set: {
          lastMessageAt: new Date(),
          visibleUntil: new Date(Date.now() + this.options.sessionVisibilityMs),
        },
      },
    );
  }

  async updateConversationSummary(sessionId: string, summary: string): Promise<void> {
    await this.ChatSession.updateOne(
      { sessionId },
      { $set: { conversationSummary: summary } },
    );
  }

  async updateMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
    const session = await this.findByIdOrFail(sessionId);
    session.metadata = { ...session.metadata, ...metadata };
    await session.save();
  }

  async recalculateQueuePositions(fromPosition: number): Promise<{ sessionId: string; queuePosition: number }[]> {
    const waitingSessions = await this.ChatSession.find({
      status: ChatSessionStatus.WaitingAgent,
      queuePosition: { $gt: fromPosition },
    }).sort({ queuePosition: 1 });

    const updates: { sessionId: string; queuePosition: number }[] = [];
    for (let i = 0; i < waitingSessions.length; i++) {
      const newPosition = fromPosition + i;
      await this.ChatSession.updateOne(
        { _id: waitingSessions[i]._id },
        { $set: { queuePosition: newPosition } },
      );
      updates.push({ sessionId: waitingSessions[i].sessionId, queuePosition: newPosition });
    }
    return updates;
  }

  async setStatus(sessionId: string, status: ChatSessionStatus): Promise<void> {
    const session = await this.findByIdOrFail(sessionId);
    validateSessionTransition(sessionId, session.status, status);

    await this.ChatSession.updateOne(
      { sessionId },
      { $set: { status } },
    );
  }

  async findPaginated(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ sessions: ChatSessionDocument[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const scopedFilter = withTenantFilter({ ...filter }, this.tenantId);
    const [sessions, total] = await Promise.all([
      this.ChatSession.find(scopedFilter).sort({ startedAt: -1 }).skip(skip).limit(limit),
      this.ChatSession.countDocuments(scopedFilter),
    ]);
    return { sessions, total, page, limit };
  }

  async findAllWithFeedback(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find(withTenantFilter({ 'feedback.rating': { $exists: true, $ne: null } } as Record<string, unknown>, this.tenantId));
  }

  async findActiveSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find(withTenantFilter({
      status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
    } as Record<string, unknown>, this.tenantId)).sort({ lastMessageAt: -1 });
  }

  async findWaitingSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find(withTenantFilter({
      status: ChatSessionStatus.WaitingAgent,
    } as Record<string, unknown>, this.tenantId)).sort({ queuePosition: 1, escalatedAt: 1 });
  }

  /**
   * Returns sessions that need agent attention: both WaitingAgent and
   * unassigned Active/New sessions with messages. This is the full
   * pending queue surfaced to agents on connect.
   */
  async findPendingQueue(): Promise<ChatSessionDocument[]> {
    const baseConditions = [
      { status: ChatSessionStatus.WaitingAgent },
      {
        status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active] },
        agentId: { $in: [null, undefined] },
        messageCount: { $gt: 0 },
      },
    ];

    // When tenantId is set, add it to each $or branch
    if (this.tenantId) {
      for (const cond of baseConditions) {
        (cond as Record<string, unknown>).tenantId = this.tenantId;
      }
    }

    return this.ChatSession.find({
      $or: baseConditions,
    }).sort({ queuePosition: 1, escalatedAt: 1, lastMessageAt: 1 });
  }

  async findByAgent(agentId: string): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find(withTenantFilter({
      agentId,
      status: { $in: [ChatSessionStatus.Active, ChatSessionStatus.WithAgent] },
    } as Record<string, unknown>, this.tenantId)).sort({ lastMessageAt: -1 });
  }

  async findExpiredSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find(withTenantFilter({
      status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
      visibleUntil: { $lt: new Date() },
    } as Record<string, unknown>, this.tenantId));
  }

  async getSessionStats(sessionId: string): Promise<SessionStats> {
    const messages = await this.ChatMessage.find({ sessionId });
    const session = await this.findById(sessionId);

    const visitorMessages = messages.filter(m => m.senderType === ChatSenderType.Visitor).length;
    const agentMessages = messages.filter(m => m.senderType === ChatSenderType.Agent).length;
    const aiMessages = messages.filter(m => m.senderType === ChatSenderType.AI).length;

    const startedAt = session?.startedAt?.getTime() || Date.now();
    const endedAt = session?.endedAt?.getTime() || Date.now();

    return {
      totalMessages: messages.length,
      visitorMessages,
      agentMessages,
      aiMessages,
      durationMs: endedAt - startedAt,
    };
  }

  async getDashboardStats(): Promise<{
    activeSessions: number;
    waitingSessions: number;
    resolvedToday: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeSessions, waitingSessions, resolvedToday] = await Promise.all([
      this.ChatSession.countDocuments(withTenantFilter({
        status: { $in: [ChatSessionStatus.Active, ChatSessionStatus.WithAgent] },
      } as Record<string, unknown>, this.tenantId)),
      this.ChatSession.countDocuments(withTenantFilter({
        status: ChatSessionStatus.WaitingAgent,
      } as Record<string, unknown>, this.tenantId)),
      this.ChatSession.countDocuments(withTenantFilter({
        status: ChatSessionStatus.Resolved,
        endedAt: { $gte: todayStart },
      } as Record<string, unknown>, this.tenantId)),
    ]);

    return {
      activeSessions,
      waitingSessions,
      resolvedToday,
      totalAgents: 0,
      activeAgents: 0,
    };
  }

  async getSessionContext(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.findByIdOrFail(sessionId);
    const messages = await this.ChatMessage
      .find({ sessionId })
      .sort({ createdAt: 1 });

    return {
      session: this.toSummary(session),
      messages,
      visitorId: session.visitorId,
      preferences: session.preferences,
      conversationSummary: session.conversationSummary,
      feedback: session.feedback,
      metadata: session.metadata,
    };
  }

  // ── Tag management ─────────────────────────────────────────────────────────

  async addTag(sessionId: string, tag: string): Promise<string[]> {
    const session = await this.findByIdOrFail(sessionId);
    if (!session.tags.includes(tag)) {
      session.tags.push(tag);
      await session.save();
    }
    this.logger.info('Tag added', { sessionId, tag });
    return session.tags;
  }

  async removeTag(sessionId: string, tag: string): Promise<string[]> {
    const session = await this.findByIdOrFail(sessionId);
    session.tags = session.tags.filter((t: string) => t !== tag);
    await session.save();
    this.logger.info('Tag removed', { sessionId, tag });
    return session.tags;
  }

  async getTags(sessionId: string): Promise<string[]> {
    const session = await this.findByIdOrFail(sessionId);
    return session.tags;
  }

  // ── User category ───────────────────────────────────────────────────────

  async setUserCategory(sessionId: string, category: string | null, settingsService?: SettingsService): Promise<string | null> {
    const session = await this.findByIdOrFail(sessionId);

    if (category !== null && settingsService) {
      const settings = await settingsService.get();
      if (settings.availableUserCategories.length > 0) {
        if (!settings.availableUserCategories.includes(category)) {
          throw new InvalidConfigError('userCategory', `Category "${category}" is not in the available categories list`);
        }
      }
    }

    session.userCategory = category;
    await session.save();
    this.logger.info('User category set', { sessionId, category });
    return session.userCategory ?? null;
  }

  // ── User identity merge ──────────────────────────────────────────────────

  async mergeAnonymousSessions(anonymousId: string, userId: string): Promise<number> {
    const result = await this.ChatSession.updateMany(
      withTenantFilter({ visitorId: anonymousId }, this.tenantId),
      { $set: { visitorId: userId } },
    );
    const count = result.modifiedCount;
    if (count > 0) {
      this.logger.info('Merged anonymous sessions', { anonymousId, userId, count });
    }
    return count;
  }

  // ── User info & agent notes ─────────────────────────────────────────────

  async updateUserInfo(
    sessionId: string,
    info: { name?: string | null; email?: string | null; mobile?: string | null },
  ): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    const current = session.userInfo || { name: null, email: null, mobile: null };
    session.userInfo = {
      name: info.name !== undefined ? info.name : current.name,
      email: info.email !== undefined ? info.email : current.email,
      mobile: info.mobile !== undefined ? info.mobile : current.mobile,
    };
    await session.save();
    this.logger.info('User info updated', { sessionId });
    return session;
  }

  async addNote(sessionId: string, note: string): Promise<string[]> {
    const session = await this.findByIdOrFail(sessionId);
    session.agentNotes.push(note);
    await session.save();
    this.logger.info('Note added', { sessionId });
    return session.agentNotes;
  }

  async removeNote(sessionId: string, index: number): Promise<string[]> {
    const session = await this.findByIdOrFail(sessionId);
    if (index < 0 || index >= session.agentNotes.length) {
      throw new SessionNotFoundError(sessionId); // reuse — index out of range
    }
    session.agentNotes.splice(index, 1);
    await session.save();
    this.logger.info('Note removed', { sessionId, index });
    return session.agentNotes;
  }

  // ── User conversation history ───────────────────────────────────────────

  async getUserHistory(visitorId: string, limit: number = 5): Promise<ChatSessionDocument[]> {
    const effectiveLimit = Math.min(Math.max(limit, 1), 5);
    return this.ChatSession.find(withTenantFilter({
      visitorId,
      isDeletedForUser: { $ne: true },
    } as Record<string, unknown>, this.tenantId))
      .sort({ startedAt: -1 })
      .limit(effectiveLimit);
  }

  toSummary(session: ChatSessionDocument): ChatSessionSummary {
    return {
      sessionId: session.sessionId,
      status: session.status,
      mode: session.mode,
      visitorId: session.visitorId,
      agentId: session.agentId,
      messageCount: session.messageCount,
      lastMessageAt: session.lastMessageAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      channel: session.channel,
      queuePosition: session.queuePosition,
      userCategory: session.userCategory,
      tags: session.tags,
      metadata: session.metadata,
    };
  }

  private canResume(session: ChatSessionDocument): boolean {
    if (session.status === ChatSessionStatus.Resolved) return false;
    if (session.status === ChatSessionStatus.Closed) return false;

    if (session.status === ChatSessionStatus.Abandoned) {
      const abandonedAt = session.endedAt?.getTime() || 0;
      return (Date.now() - abandonedAt) < this.options.sessionResumptionMs;
    }

    return true;
  }
}

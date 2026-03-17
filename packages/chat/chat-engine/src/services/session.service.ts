import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatSessionSummary, VisitorContext, SessionStats, ChatFeedback } from '@astralibx/chat-types';
import { ChatSessionStatus, SessionMode, ChatSenderType } from '@astralibx/chat-types';
import type { ChatSessionModel, ChatSessionDocument } from '../schemas/chat-session.schema';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import { SessionNotFoundError } from '../errors';

export class SessionService {
  constructor(
    private ChatSession: ChatSessionModel,
    private ChatMessage: ChatMessageModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
    private hooks?: ChatEngineConfig['hooks'],
  ) {}

  async create(context: VisitorContext, mode: SessionMode): Promise<ChatSessionDocument> {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session = await this.ChatSession.create({
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
    });

    this.logger.info('Session created', { sessionId, visitorId: context.visitorId });
    this.hooks?.onSessionCreated?.(this.toSummary(session));

    return session;
  }

  async findById(sessionId: string): Promise<ChatSessionDocument | null> {
    return this.ChatSession.findOne({ sessionId });
  }

  async findByIdOrFail(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  async findOrCreate(context: VisitorContext, existingSessionId?: string, defaultMode?: SessionMode): Promise<{
    session: ChatSessionDocument;
    isNew: boolean;
    messages: any[];
  }> {
    if (existingSessionId) {
      const existing = await this.findById(existingSessionId);
      if (existing && this.canResume(existing)) {
        const messages = await this.ChatMessage
          .find({ sessionId: existing.sessionId })
          .sort({ createdAt: -1 })
          .limit(this.options.maxSessionHistory)
          .sort({ createdAt: 1 });

        if (existing.status === ChatSessionStatus.Abandoned) {
          existing.status = ChatSessionStatus.Active;
          existing.endedAt = undefined;
          existing.visibleUntil = new Date(Date.now() + this.options.sessionVisibilityMs);
          await existing.save();
        }

        return { session: existing, isNew: false, messages };
      }
    }

    const recentSession = await this.ChatSession.findOne({
      visitorId: context.visitorId,
      status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
    }).sort({ startedAt: -1 });

    if (recentSession) {
      const messages = await this.ChatMessage
        .find({ sessionId: recentSession.sessionId })
        .sort({ createdAt: -1 })
        .limit(this.options.maxSessionHistory)
        .sort({ createdAt: 1 });

      return { session: recentSession, isNew: false, messages };
    }

    const mode = defaultMode || SessionMode.AI;
    const session = await this.create(context, mode);
    return { session, isNew: true, messages: [] };
  }

  async resolve(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);
    const now = new Date();

    session.status = ChatSessionStatus.Resolved;
    session.endedAt = now;
    await session.save();

    const stats = await this.getSessionStats(sessionId);
    this.logger.info('Session resolved', { sessionId });
    this.hooks?.onSessionResolved?.(this.toSummary(session), stats);

    return session;
  }

  async abandon(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);

    session.status = ChatSessionStatus.Abandoned;
    session.endedAt = new Date();
    await session.save();

    this.logger.info('Session abandoned', { sessionId });
    this.hooks?.onSessionAbandoned?.(this.toSummary(session));

    return session;
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

    session.agentId = agentId;
    session.status = ChatSessionStatus.WithAgent;
    session.queuePosition = undefined;
    await session.save();

    return session;
  }

  async setQueuePosition(sessionId: string, position: number): Promise<void> {
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

  async escalate(sessionId: string, reason?: string): Promise<ChatSessionDocument> {
    const session = await this.findByIdOrFail(sessionId);

    session.mode = SessionMode.Manual;
    session.status = ChatSessionStatus.WaitingAgent;
    session.escalatedAt = new Date();

    // Calculate queue position
    const waitingCount = await this.ChatSession.countDocuments({
      status: ChatSessionStatus.WaitingAgent,
    });
    session.queuePosition = waitingCount + 1;

    await session.save();

    this.hooks?.onEscalation?.(sessionId, reason);
    this.hooks?.onQueueJoin?.(sessionId, session.queuePosition);
    this.logger.info('Session escalated', { sessionId, reason, queuePosition: session.queuePosition });

    return session;
  }

  async submitFeedback(sessionId: string, feedback: ChatFeedback): Promise<void> {
    await this.ChatSession.updateOne(
      { sessionId },
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
      { sessionId },
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

  async setStatus(sessionId: string, status: ChatSessionStatus): Promise<void> {
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
    const [sessions, total] = await Promise.all([
      this.ChatSession.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit),
      this.ChatSession.countDocuments(filter),
    ]);
    return { sessions, total, page, limit };
  }

  async findAllWithFeedback(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find({ 'feedback.rating': { $exists: true, $ne: null } });
  }

  async findActiveSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find({
      status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
    }).sort({ lastMessageAt: -1 });
  }

  async findWaitingSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find({
      status: ChatSessionStatus.WaitingAgent,
    }).sort({ queuePosition: 1, escalatedAt: 1 });
  }

  async findByAgent(agentId: string): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find({
      agentId,
      status: { $in: [ChatSessionStatus.Active, ChatSessionStatus.WithAgent] },
    }).sort({ lastMessageAt: -1 });
  }

  async findExpiredSessions(): Promise<ChatSessionDocument[]> {
    return this.ChatSession.find({
      status: { $in: [ChatSessionStatus.New, ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent] },
      visibleUntil: { $lt: new Date() },
    });
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
      this.ChatSession.countDocuments({
        status: { $in: [ChatSessionStatus.Active, ChatSessionStatus.WithAgent] },
      }),
      this.ChatSession.countDocuments({
        status: ChatSessionStatus.WaitingAgent,
      }),
      this.ChatSession.countDocuments({
        status: ChatSessionStatus.Resolved,
        endedAt: { $gte: todayStart },
      }),
    ]);

    return {
      activeSessions,
      waitingSessions,
      resolvedToday,
      totalAgents: 0,
      activeAgents: 0,
    };
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
      metadata: session.metadata,
    };
  }

  private canResume(session: ChatSessionDocument): boolean {
    if (session.status === ChatSessionStatus.Resolved) return false;

    if (session.status === ChatSessionStatus.Abandoned) {
      const abandonedAt = session.endedAt?.getTime() || 0;
      return (Date.now() - abandonedAt) < this.options.sessionResumptionMs;
    }

    return true;
  }
}

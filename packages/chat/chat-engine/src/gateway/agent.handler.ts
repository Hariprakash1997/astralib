import type { Namespace, Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import {
  AgentEvent,
  AgentStatus,
  ServerToAgentEvent,
  ServerToVisitorEvent,
  ChatSessionStatus,
  ChatSenderType,
  ChatContentType,
  SessionMode,
} from '@astralibx/chat-types';
import type {
  TransferChatPayload,
  SaveMemoryPayload,
  SendAiMessagePayload,
  AgentDisconnectedPayload,
  MessagePayload,
  TypingPayload,
  LabelMessagePayload,
  LabelSessionPayload,
  UpdateStatusPayload,
  EscalateChatPayload,
  LeaveChatPayload,
  WatchChatPayload,
} from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service.js';
import type { MessageService } from '../services/message.service.js';
import type { AgentService } from '../services/agent.service.js';
import type { SettingsService } from '../services/settings.service.js';
import type { RedisService } from '../services/redis.service.js';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types.js';
import type { EmitDeps } from './emit.js';
import { emitToVisitor, emitToAgent } from './emit.js';
import type { NotificationDeps } from './notifications.js';
import {
  broadcastStatsUpdate,
  broadcastSessionUpdate,
  broadcastModeChange,
  broadcastQueuePositions,
} from './notifications.js';
import { clearAiDebounce } from './ai-debounce.js';
import {
  validateMessageContent,
  validateSessionForMessaging,
  validateAgentOwnership,
  setTypingTimeout,
  clearTypingTimeout,
  withSocketErrorHandler,
} from './helpers.js';
import { validateEscalation } from '../validation/escalation.validator.js';
import { ERROR_CODE, ERROR_MESSAGE, INTERNAL_EVENT, SYSTEM_MESSAGE, SYSTEM_MESSAGE_FN } from '../constants/index.js';
import { resolveAiMode, resolveAiCharacter } from '../utils/ai-resolver.js';

export interface AgentHandlerDeps {
  sessionService: SessionService;
  messageService: MessageService;
  agentService: AgentService;
  settingsService: SettingsService;
  redisService: RedisService;
  config: ChatEngineConfig;
  options: ResolvedOptions;
  emitDeps: EmitDeps;
  notificationDeps: NotificationDeps;
  logger: LogAdapter;
}

/** Record agent activity timestamp in Redis (non-blocking, fire-and-forget). */
function trackAgentActivity(agentId: string | undefined, deps: AgentHandlerDeps): void {
  if (!agentId) return;
  deps.redisService.setAgentActivity(agentId).catch((err) => {
    deps.logger.warn('Failed to track agent activity', {
      agentId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });
}

export function setupAgentHandlers(
  agentNs: Namespace,
  deps: AgentHandlerDeps,
): void {
  agentNs.on('connection', (socket: Socket) => {
    deps.logger.info('Agent socket connected', { socketId: socket.id });

    let connectedAgentId: string | undefined;

    socket.on(AgentEvent.Connect, withSocketErrorHandler(socket, deps.logger, async (payload: { token?: string; agentId: string }) => {
      if (deps.config.adapters.authenticateAgent) {
        if (!payload.token) {
          deps.logger.warn('Agent connection rejected: no token provided');
          socket.disconnect();
          return;
        }
        const identity = await deps.config.adapters.authenticateAgent(payload.token);
        if (!identity) {
          deps.logger.warn('Agent connection rejected: invalid token');
          socket.disconnect();
          return;
        }
      } else {
        deps.logger.warn('No authenticateAgent adapter configured — agent namespace is unprotected. Configure authenticateAgent for production use.');
      }

      const agent = await deps.agentService.connect(payload.agentId);
      connectedAgentId = payload.agentId;

      await deps.redisService.setAgentConnection(payload.agentId, socket.id, payload.agentId);
      trackAgentActivity(payload.agentId, deps);

      // Gap 25: Track agent connection count for multi-tab dedup
      await deps.redisService.incrementAgentConnections(payload.agentId);

      const isManager = await deps.agentService.isManager(payload.agentId);

      const [waitingChats, assignedChats] = await Promise.all([
        deps.sessionService.findPendingQueue(),
        deps.sessionService.findByAgent(payload.agentId),
      ]);

      // Managers see all active sessions for read-only monitoring
      const allChats = isManager
        ? (await deps.sessionService.findActiveSessions()).map(s => deps.sessionService.toSummary(s))
        : undefined;

      const dashStats = await deps.sessionService.getDashboardStats();
      const [totalAgents, activeAgents] = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);

      socket.emit(ServerToAgentEvent.Connected, {
        agentId: payload.agentId,
        stats: { ...dashStats, totalAgents, activeAgents },
        waitingChats: waitingChats.map(s => deps.sessionService.toSummary(s)),
        assignedChats: assignedChats.map(s => deps.sessionService.toSummary(s)),
        isManager,
        ...(allChats ? { allChats } : {}),
      });

      broadcastStatsUpdate(deps.notificationDeps, {
        ...dashStats,
        totalAgents,
        activeAgents,
      });

      deps.config.hooks?.onMetric?.({
        name: 'ws_connections',
        value: 1,
        labels: { namespace: 'agent' },
      });
    }));

    socket.on(AgentEvent.AcceptChat, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string }) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const hasCapacity = await deps.agentService.hasCapacity(connectedAgentId);
      if (!hasCapacity) {
        socket.emit(INTERNAL_EVENT.AgentError, { code: ERROR_CODE.CapacityFull, message: ERROR_MESSAGE.CapacityFull });
        return;
      }

      const session = await deps.sessionService.assignAgent(payload.sessionId, connectedAgentId);
      await deps.agentService.incrementChats(connectedAgentId);

      const agent = await deps.agentService.findByIdOrFail(connectedAgentId);
      const agentInfo = deps.agentService.toAgentInfo(agent);

      const messages = await deps.messageService.findBySession(payload.sessionId, deps.options.maxSessionHistory);

      socket.emit(ServerToAgentEvent.ChatAssigned, {
        session: deps.sessionService.toSummary(session),
        messages: messages.map(m => deps.messageService.toPayload(m)),
      });

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentJoin, {
        agent: agentInfo,
      });
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WithAgent,
        agent: agentInfo,
      });

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE_FN.agentJoined(agent.name),
      );

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'accepted', {
        agentId: connectedAgentId,
      });

      // Gap 9: Recalculate queue positions for sessions behind the accepted one
      const accepted = await deps.sessionService.findById(payload.sessionId);
      if (accepted?.queuePosition != null) {
        const updates = await deps.sessionService.recalculateQueuePositions(accepted.queuePosition);
        const enriched = await Promise.all(updates.map(async (u) => ({
          ...u,
          estimatedWaitMinutes: await deps.sessionService.estimateWaitTime(u.queuePosition),
        })));
        await broadcastQueuePositions(enriched, deps.emitDeps, deps.logger);
      }
    }));

    socket.on(AgentEvent.SendMessage, withSocketErrorHandler(socket, deps.logger, async (payload: MessagePayload & { sessionId: string }) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);

      // Manager read-only: reject message if manager and session not assigned to them
      const isManager = await deps.agentService.isManager(connectedAgentId);
      if (isManager && session.agentId !== connectedAgentId) {
        socket.emit(INTERNAL_EVENT.AgentError, {
          code: ERROR_CODE.ManagerNotAllowed,
          message: ERROR_MESSAGE.ManagerMessageNotAllowed,
        });
        return;
      }

      validateAgentOwnership(session, connectedAgentId);
      validateSessionForMessaging(session);

      const content = validateMessageContent(payload.content, deps.options);
      const agent = await deps.agentService.findByIdOrFail(connectedAgentId);

      const message = await deps.messageService.create({
        sessionId: payload.sessionId,
        senderType: ChatSenderType.Agent,
        senderName: agent.name,
        content,
        contentType: payload.contentType || ChatContentType.Text,
        metadata: payload.metadata,
      });

      await deps.sessionService.updateLastMessage(payload.sessionId);
      await deps.redisService.setSessionActivity(payload.sessionId);

      const messagePayload = deps.messageService.toPayload(message);

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Message, {
        message: messagePayload,
      });

      socket.emit(ServerToAgentEvent.Message, {
        sessionId: payload.sessionId,
        message: messagePayload,
      });

      deps.config.hooks?.onMetric?.({
        name: 'message_sent',
        value: 1,
        labels: { channel: session.channel, senderType: ChatSenderType.Agent, contentType: payload.contentType || ChatContentType.Text },
      });
    }));

    socket.on(AgentEvent.Typing, withSocketErrorHandler(socket, deps.logger, async (payload: TypingPayload) => {
      if (!payload.sessionId) return;

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Typing, {
        isTyping: payload.isTyping,
      });

      if (payload.isTyping) {
        setTypingTimeout(`agent:${payload.sessionId}`, async () => {
          await emitToVisitor(deps.emitDeps, payload.sessionId!, ServerToVisitorEvent.Typing, {
            isTyping: false,
          });
        });
      }
    }));

    socket.on(AgentEvent.ResolveChat, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string }) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const preResolve = await deps.sessionService.findByIdOrFail(payload.sessionId);
      validateAgentOwnership(preResolve, connectedAgentId);

      clearAiDebounce(payload.sessionId);

      // Gap 9: Capture queue position before resolving
      const preQueuePosition = preResolve?.queuePosition;

      const session = await deps.sessionService.resolve(payload.sessionId);
      await deps.agentService.decrementChats(connectedAgentId);

      // Gap 23: Conversation archiving hook
      if (deps.config.hooks?.onSessionArchive) {
        const archiveMessages = await deps.messageService.findBySession(payload.sessionId);
        await deps.config.hooks.onSessionArchive({
          sessionId: session.sessionId,
          visitorId: session.visitorId,
          messages: archiveMessages.map(m => deps.messageService.toPayload(m)),
          metadata: session.metadata,
        }).catch((err: unknown) => {
          deps.logger.error('Session archive hook failed', {
            sessionId: payload.sessionId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
      }

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE.ConversationResolved,
      );

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.Resolved,
      });

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.RatingPrompt, {
        sessionId: payload.sessionId,
      });

      socket.emit(ServerToAgentEvent.ChatEnded, {
        sessionId: payload.sessionId,
      });

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'resolved');

      deps.config.hooks?.onMetric?.({
        name: 'session_resolved',
        value: 1,
        labels: { channel: session.channel, mode: session.mode },
      });

      const dashStats = await deps.sessionService.getDashboardStats();
      const [totalAgents, activeAgents] = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);
      broadcastStatsUpdate(deps.notificationDeps, {
        ...dashStats,
        totalAgents,
        activeAgents,
      });

      // Gap 9: Recalculate queue positions for sessions behind the resolved one
      if (preQueuePosition != null) {
        const updates = await deps.sessionService.recalculateQueuePositions(preQueuePosition);
        const enriched = await Promise.all(updates.map(async (u) => ({
          ...u,
          estimatedWaitMinutes: await deps.sessionService.estimateWaitTime(u.queuePosition),
        })));
        await broadcastQueuePositions(enriched, deps.emitDeps, deps.logger);
      }
    }));

    socket.on(AgentEvent.TakeOver, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string }) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      clearAiDebounce(payload.sessionId);

      const session = await deps.sessionService.updateMode(payload.sessionId, SessionMode.Manual, connectedAgentId);

      const agent = await deps.agentService.findByIdOrFail(connectedAgentId);

      if (!session.agentId || session.agentId !== connectedAgentId) {
        await deps.sessionService.assignAgent(payload.sessionId, connectedAgentId);
        await deps.agentService.incrementChats(connectedAgentId);
      }

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE_FN.agentTookOver(agent.name),
      );

      const agentInfo = deps.agentService.toAgentInfo(agent);
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentJoin, {
        agent: agentInfo,
      });
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WithAgent,
        agent: agentInfo,
      });

      deps.config.hooks?.onAgentTakeOver?.(payload.sessionId, connectedAgentId);
      deps.config.hooks?.onMetric?.({
        name: 'agent_takeover',
        value: 1,
        labels: { channel: session.channel },
      });
      broadcastModeChange(deps.notificationDeps, payload.sessionId, SessionMode.Manual, connectedAgentId, agent.name);
    }));

    socket.on(AgentEvent.HandBack, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string }) => {
      if (!connectedAgentId) return;

      const settings = await deps.settingsService.get();
      // Use two-layer AI mode resolution
      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      const agentDoc = session.agentId ? await deps.agentService.findById(session.agentId) : null;
      const resolvedMode = resolveAiMode(settings, agentDoc);
      if (resolvedMode === 'manual') {
        socket.emit(INTERNAL_EVENT.AgentError, { code: ERROR_CODE.AiDisabled, message: ERROR_MESSAGE.AiModeDisabled });
        return;
      }

      await deps.sessionService.updateMode(payload.sessionId, SessionMode.AI);
      await deps.agentService.decrementChats(connectedAgentId);

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE.HandedBackToAi,
      );

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentLeave, {});

      deps.config.hooks?.onAgentHandBack?.(payload.sessionId);
      broadcastModeChange(deps.notificationDeps, payload.sessionId, SessionMode.AI);
    }));

    socket.on(AgentEvent.SetMode, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string; mode: SessionMode }) => {
      if (!connectedAgentId) return;

      if (payload.mode === SessionMode.Manual) {
        clearAiDebounce(payload.sessionId);
      }

      await deps.sessionService.updateMode(payload.sessionId, payload.mode, connectedAgentId);

      const agent = await deps.agentService.findByIdOrFail(connectedAgentId);
      broadcastModeChange(deps.notificationDeps, payload.sessionId, payload.mode, connectedAgentId, agent.name);
    }));

    socket.on(AgentEvent.GetSettings, withSocketErrorHandler(socket, deps.logger, async () => {
      const settings = await deps.settingsService.get();
      socket.emit(ServerToAgentEvent.SettingsUpdated, { settings });
    }));

    socket.on(AgentEvent.UpdateSettings, withSocketErrorHandler(socket, deps.logger, async (payload: Record<string, unknown>) => {
      const settings = await deps.settingsService.update(payload as Parameters<SettingsService['update']>[0]);
      deps.notificationDeps.agentNs.emit(ServerToAgentEvent.SettingsUpdated, { settings });
    }));

    socket.on(AgentEvent.SaveMemory, withSocketErrorHandler(socket, deps.logger, async (payload: SaveMemoryPayload) => {
      if (!deps.config.hooks?.onSaveMemory) {
        socket.emit(ServerToAgentEvent.SessionEvent, { error: 'Memory feature not configured' });
        return;
      }

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      await deps.config.hooks.onSaveMemory({
        sessionId: payload.sessionId,
        visitorId: session.visitorId,
        content: payload.content,
        key: payload.key,
        category: payload.category,
      });

      deps.logger.info('Memory saved', { sessionId: payload.sessionId });
    }));

    socket.on(AgentEvent.DeleteMemory, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string; memoryId: string }) => {
      if (!deps.config.hooks?.onDeleteMemory) {
        socket.emit(ServerToAgentEvent.SessionEvent, { error: 'Memory feature not configured' });
        return;
      }

      await deps.config.hooks.onDeleteMemory({
        sessionId: payload.sessionId,
        memoryId: payload.memoryId,
      });

      deps.logger.info('Memory deleted', { sessionId: payload.sessionId, memoryId: payload.memoryId });
    }));

    socket.on(AgentEvent.TransferChat, withSocketErrorHandler(socket, deps.logger, async (payload: TransferChatPayload) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const sessionToTransfer = await deps.sessionService.findByIdOrFail(payload.sessionId);
      validateAgentOwnership(sessionToTransfer, connectedAgentId);

      const session = await deps.sessionService.transfer(
        payload.sessionId,
        payload.targetAgentId,
        payload.note,
      );

      await deps.agentService.decrementChats(connectedAgentId);
      await deps.agentService.incrementChats(payload.targetAgentId);

      const targetAgent = await deps.agentService.findByIdOrFail(payload.targetAgentId);

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE_FN.conversationTransferred(targetAgent.name),
      );

      const messages = await deps.messageService.findBySession(payload.sessionId, deps.options.maxSessionHistory);

      await emitToAgent(deps.emitDeps, payload.targetAgentId, ServerToAgentEvent.ChatTransferred, {
        session: deps.sessionService.toSummary(session),
        messages: messages.map(m => deps.messageService.toPayload(m)),
        transferNote: payload.note,
      });

      socket.emit(ServerToAgentEvent.ChatEnded, {
        sessionId: payload.sessionId,
      });

      const agentInfo = deps.agentService.toAgentInfo(targetAgent);
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentJoin, {
        agent: agentInfo,
      });

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'transferred', {
        fromAgentId: connectedAgentId,
        toAgentId: payload.targetAgentId,
      });
    }));

    socket.on(AgentEvent.EscalateChat, withSocketErrorHandler(socket, deps.logger, async (payload: EscalateChatPayload) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      validateAgentOwnership(session, connectedAgentId);

      const currentAgent = await deps.agentService.findByIdOrFail(connectedAgentId);

      let targetAgent;
      if (payload.targetAgentId) {
        // Agent specified a target — validate it
        targetAgent = await deps.agentService.findByIdOrFail(payload.targetAgentId);
        validateEscalation(payload.sessionId, currentAgent, targetAgent);
      } else {
        // Auto-find the least busy supervisor at the next level
        targetAgent = await deps.agentService.findLeastBusySupervisor(currentAgent);
        if (!targetAgent) {
          socket.emit(INTERNAL_EVENT.AgentError, {
            code: ERROR_CODE.EscalationFailed,
            message: `No available supervisor at L${currentAgent.level + 1}`,
          });
          return;
        }
      }

      // Transfer the session to the target agent
      await deps.sessionService.transfer(
        payload.sessionId,
        targetAgent._id.toString(),
        payload.note,
      );

      await deps.agentService.decrementChats(connectedAgentId);
      await deps.agentService.incrementChats(targetAgent._id.toString());

      const systemMsg = `${SYSTEM_MESSAGE.AgentEscalated} from ${currentAgent.name} (L${currentAgent.level}) to ${targetAgent.name} (L${targetAgent.level})`;
      await deps.messageService.createSystemMessage(payload.sessionId, systemMsg);

      const messages = await deps.messageService.findBySession(payload.sessionId, deps.options.maxSessionHistory);

      await emitToAgent(deps.emitDeps, targetAgent._id.toString(), ServerToAgentEvent.ChatTransferred, {
        session: deps.sessionService.toSummary(session),
        messages: messages.map(m => deps.messageService.toPayload(m)),
        transferNote: payload.note,
      });

      socket.emit(ServerToAgentEvent.ChatEnded, {
        sessionId: payload.sessionId,
      });

      const agentInfo = deps.agentService.toAgentInfo(targetAgent);
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentJoin, {
        agent: agentInfo,
      });

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'escalated', {
        fromAgentId: connectedAgentId,
        toAgentId: targetAgent._id.toString(),
        fromLevel: currentAgent.level,
        toLevel: targetAgent.level,
      });

      deps.config.hooks?.onMetric?.({
        name: 'agent_escalation',
        value: 1,
        labels: { channel: session.channel, fromLevel: String(currentAgent.level), toLevel: String(targetAgent.level) },
      });
    }));

    socket.on(AgentEvent.LeaveChat, withSocketErrorHandler(socket, deps.logger, async (payload: LeaveChatPayload) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      validateAgentOwnership(session, connectedAgentId);

      const currentAgent = await deps.agentService.findByIdOrFail(connectedAgentId);

      // Unassign agent, put session back to waiting
      session.agentId = undefined;
      session.status = ChatSessionStatus.WaitingAgent;

      // Calculate new queue position
      const waitingCount = await deps.sessionService.findWaitingSessions();
      session.queuePosition = waitingCount.length + 1;
      await session.save();

      await deps.agentService.decrementChats(connectedAgentId);

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        SYSTEM_MESSAGE.AgentLeft,
      );

      socket.emit(ServerToAgentEvent.ChatEnded, {
        sessionId: payload.sessionId,
      });

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.AgentLeave, {});
      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WaitingAgent,
        queuePosition: session.queuePosition,
      });

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'agent_left', {
        agentId: connectedAgentId,
      });

      // Notify all agents so the session appears in the waiting queue
      const summary = deps.sessionService.toSummary(session);
      deps.notificationDeps.agentNs.emit(ServerToAgentEvent.NewChat, { session: summary });

      const dashStats = await deps.sessionService.getDashboardStats();
      const [totalAgents, activeAgents] = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);
      broadcastStatsUpdate(deps.notificationDeps, {
        ...dashStats,
        totalAgents,
        activeAgents,
      });

      deps.config.hooks?.onMetric?.({
        name: 'agent_leave',
        value: 1,
        labels: { channel: session.channel },
      });
    }));

    socket.on(AgentEvent.SendAiMessage, withSocketErrorHandler(socket, deps.logger, async (payload: SendAiMessagePayload) => {
      if (!connectedAgentId) return;

      if (!deps.config.adapters.generateAiResponse) {
        socket.emit(ServerToAgentEvent.SessionEvent, {
          sessionId: payload.sessionId,
          error: 'AI not configured',
        });
        return;
      }

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      const messages = await deps.messageService.findBySession(payload.sessionId, deps.options.maxSessionHistory);

      const agentDoc = await deps.agentService.findById(connectedAgentId);
      const aiAgent = agentDoc || await deps.agentService.findDefaultAiAgent();
      const agentInfo = aiAgent ? deps.agentService.toAgentInfo(aiAgent) : {
        agentId: 'ai',
        name: 'AI Assistant',
        status: AgentStatus.Available,
        isAI: true,
      };

      // Resolve AI character for this session
      const settings = await deps.settingsService.get();
      const aiCharacter = resolveAiCharacter(settings, aiAgent);

      const aiInput = {
        sessionId: session.sessionId,
        visitorId: session.visitorId,
        messages: messages.map(m => deps.messageService.toPayload(m)),
        agent: agentInfo,
        visitorContext: {
          visitorId: session.visitorId,
          channel: session.channel,
          fingerprint: session.visitorFingerprint,
        },
        conversationSummary: session.conversationSummary,
        metadata: session.metadata,
        aiCharacter,
      };

      const aiOutput = await deps.config.adapters.generateAiResponse(aiInput);

      for (const content of aiOutput.messages) {
        const msg = await deps.messageService.create({
          sessionId: session.sessionId,
          senderType: ChatSenderType.AI,
          senderName: agentInfo.name,
          content,
          contentType: ChatContentType.Text,
        });

        await deps.sessionService.updateLastMessage(session.sessionId);

        const messagePayload = deps.messageService.toPayload(msg);

        await emitToVisitor(deps.emitDeps, session.sessionId, ServerToVisitorEvent.Message, {
          message: messagePayload,
        });

        deps.emitDeps.agentNs?.emit(ServerToAgentEvent.Message, {
          sessionId: session.sessionId,
          message: messagePayload,
        });
      }

      if (aiOutput.conversationSummary) {
        await deps.sessionService.updateConversationSummary(session.sessionId, aiOutput.conversationSummary);
      }

      deps.logger.info('AI message sent by agent', {
        sessionId: payload.sessionId,
        messageCount: aiOutput.messages.length,
      });
    }));

    // Gap 8: Message labeling
    socket.on(AgentEvent.LabelMessage, withSocketErrorHandler(socket, deps.logger, async (payload: LabelMessagePayload) => {
      if (!deps.options.labelingEnabled) return;
      await deps.messageService.updateLabel(payload.messageId, payload.trainingQuality);
      deps.logger.info('Message labeled', { messageId: payload.messageId, quality: payload.trainingQuality });
    }));

    // Gap 8: Session labeling
    socket.on(AgentEvent.LabelSession, withSocketErrorHandler(socket, deps.logger, async (payload: LabelSessionPayload) => {
      if (!deps.options.labelingEnabled) return;
      await deps.sessionService.updateMetadata(payload.sessionId, {
        trainingQuality: payload.trainingQuality,
      });
      deps.logger.info('Session labeled', { sessionId: payload.sessionId, quality: payload.trainingQuality });
    }));

    // Gap 11: Agent status update
    socket.on(AgentEvent.UpdateStatus, withSocketErrorHandler(socket, deps.logger, async (payload: UpdateStatusPayload) => {
      if (!connectedAgentId) return;
      trackAgentActivity(connectedAgentId, deps);

      await deps.agentService.updateStatus(connectedAgentId, payload.status);

      const stats = await deps.sessionService.getDashboardStats();
      const [totalAgents, activeAgents] = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);
      broadcastStatsUpdate(deps.notificationDeps, {
        ...stats,
        totalAgents,
        activeAgents,
      });

      deps.logger.info('Agent status updated', { agentId: connectedAgentId, status: payload.status });
    }));

    // Manager watch — subscribe to a specific session's real-time updates (read-only)
    socket.on(AgentEvent.WatchChat, withSocketErrorHandler(socket, deps.logger, async (payload: WatchChatPayload) => {
      if (!connectedAgentId) return;

      const isManager = await deps.agentService.isManager(connectedAgentId);
      if (!isManager) {
        socket.emit(INTERNAL_EVENT.AgentError, {
          code: ERROR_CODE.ManagerNotAllowed,
          message: ERROR_MESSAGE.ManagerWatchOnly,
        });
        return;
      }

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
      const messages = await deps.messageService.findBySession(payload.sessionId, deps.options.maxSessionHistory);

      // Join the session room so the manager receives real-time messages
      socket.join(payload.sessionId);

      socket.emit(ServerToAgentEvent.WatchingChat, {
        session: deps.sessionService.toSummary(session),
        messages: messages.map(m => deps.messageService.toPayload(m)),
      });

      deps.logger.info('Manager watching chat', { agentId: connectedAgentId, sessionId: payload.sessionId });
    }));

    socket.on('disconnect', async () => {
      deps.logger.info('Agent socket disconnected', { socketId: socket.id, agentId: connectedAgentId });

      if (connectedAgentId) {
        // Clear typing timeouts for all sessions this agent was handling
        const assignedSessions = await deps.sessionService.findByAgent(connectedAgentId);
        for (const session of assignedSessions) {
          clearTypingTimeout(`agent:${session.sessionId}`);
        }

        // Notify visitors whose agent has disconnected
        const agentDoc = await deps.agentService.findById(connectedAgentId);
        for (const session of assignedSessions) {
          await emitToVisitor(deps.emitDeps, session.sessionId, ServerToVisitorEvent.AgentDisconnected, {
            sessionId: session.sessionId,
            agentId: connectedAgentId,
            agentName: agentDoc?.name,
          } as AgentDisconnectedPayload);
        }

        await deps.agentService.disconnect(connectedAgentId);
        await deps.redisService.removeAgentConnection(connectedAgentId);
        await deps.redisService.removeAgentActivity(connectedAgentId);

        // Gap 25: Decrement agent connection count
        await deps.redisService.decrementAgentConnections(connectedAgentId);

        const dashStats = await deps.sessionService.getDashboardStats();
        const [totalAgents, activeAgents] = await Promise.all([
          deps.agentService.getTotalAgentCount(),
          deps.agentService.getOnlineAgentCount(),
        ]);
        broadcastStatsUpdate(deps.notificationDeps, {
          ...dashStats,
          totalAgents,
          activeAgents,
        });

        deps.config.hooks?.onMetric?.({
          name: 'ws_connections',
          value: -1,
          labels: { namespace: 'agent' },
        });
      }
    });
  });
}

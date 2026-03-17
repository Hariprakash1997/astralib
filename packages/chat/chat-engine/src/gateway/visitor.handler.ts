import type { Namespace, Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import {
  VisitorEvent,
  ServerToVisitorEvent,
  ServerToAgentEvent,
  ChatSessionStatus,
  ChatSenderType,
  ChatContentType,
  SessionMode,
} from '@astralibx/chat-types';
import type {
  ConnectPayload,
  MessagePayload,
  TypingPayload,
  EscalatePayload,
  TrackEventPayload,
  FeedbackPayload,
} from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import type { AgentService } from '../services/agent.service';
import type { SettingsService } from '../services/settings.service';
import type { PendingMessageService } from '../services/pending-message.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import type { EmitDeps } from './emit';
import { emitToVisitor, emitToAgent } from './emit';
import type { NotificationDeps } from './notifications';
import { notifyAgentsNewChat, notifyAgentsNewMessage, broadcastStatsUpdate } from './notifications';
import { scheduleAiResponse, clearAiDebounce } from './ai-debounce';
import type { AiDebounceDeps } from './ai-debounce';
import {
  validateMessageContent,
  validateSessionForMessaging,
  checkRateLimit,
  setTypingTimeout,
  withSocketErrorHandler,
} from './helpers';

export interface VisitorHandlerDeps {
  sessionService: SessionService;
  messageService: MessageService;
  agentService: AgentService;
  settingsService: SettingsService;
  pendingMessageService: PendingMessageService;
  redisService: RedisService;
  config: ChatEngineConfig;
  options: ResolvedOptions;
  emitDeps: EmitDeps;
  notificationDeps: NotificationDeps;
  logger: LogAdapter;
}

export function setupVisitorHandlers(
  visitorNs: Namespace,
  deps: VisitorHandlerDeps,
): void {
  visitorNs.on('connection', (socket: Socket) => {
    deps.logger.info('Visitor socket connected', { socketId: socket.id });

    const aiDebounceDeps: AiDebounceDeps = {
      sessionService: deps.sessionService,
      messageService: deps.messageService,
      redisService: deps.redisService,
      options: deps.options,
      config: deps.config,
      emitDeps: deps.emitDeps,
      notificationDeps: deps.notificationDeps,
      logger: deps.logger,
    };

    socket.on(VisitorEvent.Connect, withSocketErrorHandler(socket, deps.logger, async (payload: ConnectPayload) => {
      const { context, existingSessionId } = payload;

      if (deps.config.adapters.authenticateVisitor) {
        const allowed = await deps.config.adapters.authenticateVisitor(context);
        if (!allowed) {
          socket.emit(ServerToVisitorEvent.Error, { code: 'AUTH_FAILED', message: 'Authentication failed' });
          socket.disconnect();
          return;
        }
      }

      const settings = await deps.settingsService.get();
      const defaultMode = settings.aiEnabled ? settings.defaultSessionMode : SessionMode.Manual;

      const { session, isNew, messages } = await deps.sessionService.findOrCreate(
        context,
        existingSessionId,
        defaultMode as SessionMode,
      );

      socket.join(session.sessionId);
      await deps.redisService.setVisitorConnection(session.sessionId, socket.id, context.visitorId);
      await deps.redisService.setSessionActivity(session.sessionId);

      if (session.status === ChatSessionStatus.New) {
        session.status = ChatSessionStatus.Active;
        await session.save();
      }

      const messagePayloads = messages.map((m: any) => deps.messageService.toPayload(m));

      let agentInfo;
      if (session.agentId) {
        const agent = await deps.agentService.findById(session.agentId);
        if (agent) agentInfo = deps.agentService.toAgentInfo(agent);
      }

      socket.emit(ServerToVisitorEvent.Connected, {
        sessionId: session.sessionId,
        session: deps.sessionService.toSummary(session),
        messages: messagePayloads,
        agent: agentInfo,
        preferences: session.preferences,
      });

      const pending = await deps.pendingMessageService.get(session.sessionId);
      if (pending.length > 0) {
        for (const pm of pending) {
          const pmData = pm.message as Record<string, unknown>;
          if (pmData.event && pmData.data) {
            socket.emit(pmData.event as string, pmData.data);
          }
        }
        await deps.pendingMessageService.clear(session.sessionId);
      }

      if (!isNew && session.agentId) {
        // Visitor reconnecting — notify assigned agent
        await emitToAgent(deps.emitDeps, session.agentId, ServerToAgentEvent.VisitorReconnected, {
          sessionId: session.sessionId,
        });
      }

      if (isNew) {
        notifyAgentsNewChat(deps.notificationDeps, deps.sessionService.toSummary(session));

        if (settings.autoAssignEnabled) {
          const assignedAgent = await deps.config.adapters.assignAgent({
            visitorId: context.visitorId,
            channel: context.channel,
            preferences: context.metadata,
          });

          if (assignedAgent) {
            await deps.sessionService.assignAgent(session.sessionId, assignedAgent.agentId);
            await deps.agentService.incrementChats(assignedAgent.agentId);

            socket.emit(ServerToVisitorEvent.AgentJoin, { agent: assignedAgent });
            socket.emit(ServerToVisitorEvent.Status, {
              status: ChatSessionStatus.WithAgent,
              agent: assignedAgent,
            });
          }
        }
      }

      deps.config.hooks?.onVisitorConnected?.(context.visitorId, session.sessionId);
      deps.config.hooks?.onMetric?.({
        name: 'ws_connections',
        value: 1,
        labels: { namespace: 'visitor' },
      });

      if (isNew) {
        deps.config.hooks?.onMetric?.({
          name: 'session_created',
          value: 1,
          labels: { channel: context.channel, mode: defaultMode },
        });
      }

      const dashStats = await deps.sessionService.getDashboardStats();
      const agentCounts = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);
      broadcastStatsUpdate(deps.notificationDeps, {
        ...dashStats,
        totalAgents: agentCounts[0],
        activeAgents: agentCounts[1],
      });
    }));

    socket.on(VisitorEvent.Message, withSocketErrorHandler(socket, deps.logger, async (payload: MessagePayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) {
        socket.emit(ServerToVisitorEvent.Error, { code: 'NO_SESSION', message: 'No active session' });
        return;
      }

      await checkRateLimit(sessionId, deps.redisService);

      const session = await deps.sessionService.findByIdOrFail(sessionId);
      validateSessionForMessaging(session);

      const content = validateMessageContent(payload.content, deps.options);

      const message = await deps.messageService.create({
        sessionId,
        senderType: ChatSenderType.Visitor,
        content,
        contentType: payload.contentType || ChatContentType.Text,
        metadata: payload.metadata,
      });

      await deps.sessionService.updateLastMessage(sessionId);
      await deps.redisService.setSessionActivity(sessionId);

      const messagePayload = deps.messageService.toPayload(message);

      socket.emit(ServerToVisitorEvent.MessageStatus, {
        messageId: message.messageId,
        status: message.status,
        tempId: payload.tempId,
      });

      notifyAgentsNewMessage(deps.notificationDeps, sessionId, messagePayload);

      deps.config.hooks?.onMetric?.({
        name: 'message_sent',
        value: 1,
        labels: { channel: session.channel, senderType: 'visitor', contentType: payload.contentType || 'text' },
      });

      if (session.agentId) {
        await emitToAgent(deps.emitDeps, session.agentId, 'agent:message', {
          sessionId,
          message: messagePayload,
        });
      }

      const settings = await deps.settingsService.get();
      if (session.mode === SessionMode.AI && settings.aiEnabled && deps.config.adapters.generateAiResponse) {
        scheduleAiResponse(aiDebounceDeps, sessionId);
      }
    }));

    socket.on(VisitorEvent.Typing, withSocketErrorHandler(socket, deps.logger, async (payload: TypingPayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const session = await deps.sessionService.findById(sessionId);
      if (!session?.agentId) return;

      await emitToAgent(deps.emitDeps, session.agentId, 'agent:visitor_typing', {
        sessionId,
        isTyping: payload.isTyping,
      });

      if (payload.isTyping) {
        setTypingTimeout(`visitor:${sessionId}`, async () => {
          if (session.agentId) {
            await emitToAgent(deps.emitDeps, session.agentId, 'agent:visitor_typing', {
              sessionId,
              isTyping: false,
            });
          }
        });
      }
    }));

    socket.on(VisitorEvent.Read, withSocketErrorHandler(socket, deps.logger, async (data: { messageIds: string[] }) => {
      if (data.messageIds && data.messageIds.length > 0) {
        await deps.messageService.markRead(data.messageIds);
      }
    }));

    socket.on(VisitorEvent.Escalate, withSocketErrorHandler(socket, deps.logger, async (payload: EscalatePayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      clearAiDebounce(sessionId);

      const session = await deps.sessionService.escalate(sessionId, payload.reason);

      deps.config.hooks?.onMetric?.({
        name: 'escalation',
        value: 1,
        labels: { channel: session.channel },
      });

      socket.emit(ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WaitingAgent,
      });

      await deps.messageService.createSystemMessage(
        sessionId,
        payload.reason
          ? `Visitor requested human agent: ${payload.reason}`
          : 'Visitor requested human agent',
      );

      const assignedAgent = await deps.config.adapters.assignAgent({
        visitorId: session.visitorId,
        channel: session.channel,
        preferences: session.preferences as Record<string, unknown>,
      });

      if (assignedAgent) {
        await deps.sessionService.assignAgent(sessionId, assignedAgent.agentId);
        await deps.agentService.incrementChats(assignedAgent.agentId);

        socket.emit(ServerToVisitorEvent.AgentJoin, { agent: assignedAgent });
        socket.emit(ServerToVisitorEvent.Status, {
          status: ChatSessionStatus.WithAgent,
          agent: assignedAgent,
        });
      }
    }));

    socket.on(VisitorEvent.Identify, withSocketErrorHandler(socket, deps.logger, async (data: Record<string, unknown>) => {
      if (!deps.config.adapters.identifyVisitor) return;

      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const session = await deps.sessionService.findById(sessionId);
      if (!session) return;

      const identity = await deps.config.adapters.identifyVisitor(session.visitorId, data);
      if (identity) {
        deps.logger.info('Visitor identified', {
          sessionId,
          visitorId: session.visitorId,
          userId: identity.userId,
        });
      }
    }));

    socket.on(VisitorEvent.Preferences, withSocketErrorHandler(socket, deps.logger, async (data: Record<string, unknown>) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const session = await deps.sessionService.findByIdOrFail(sessionId);
      session.preferences = { ...session.preferences, ...data };
      await session.save();
    }));

    socket.on(VisitorEvent.TrackEvent, withSocketErrorHandler(socket, deps.logger, async (payload: TrackEventPayload) => {
      if (!deps.config.adapters.trackEvent) return;

      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const session = await deps.sessionService.findById(sessionId);
      if (!session) return;

      await deps.config.adapters.trackEvent({
        sessionId,
        visitorId: session.visitorId,
        eventType: payload.eventType,
        description: payload.description,
        data: payload.data,
        channel: session.channel,
        timestamp: new Date(),
      });
    }));

    socket.on(VisitorEvent.Ping, () => {
      socket.emit(ServerToVisitorEvent.Pong, { timestamp: Date.now() });
    });

    socket.on(VisitorEvent.Feedback, withSocketErrorHandler(socket, deps.logger, async (payload: FeedbackPayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      await deps.sessionService.submitFeedback(sessionId, {
        rating: payload.rating,
        survey: payload.survey,
      });
    }));

    socket.on('disconnect', async () => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];

      deps.logger.info('Visitor socket disconnected', { socketId: socket.id, sessionId });

      if (sessionId) {
        await deps.redisService.removeVisitorConnection(sessionId);

        const session = await deps.sessionService.findById(sessionId);
        if (session?.agentId) {
          await emitToAgent(deps.emitDeps, session.agentId, 'agent:visitor_disconnected', {
            sessionId,
          });
        }

        deps.config.hooks?.onVisitorDisconnected?.(session?.visitorId || '', sessionId);
        deps.config.hooks?.onMetric?.({
          name: 'ws_connections',
          value: -1,
          labels: { namespace: 'visitor' },
        });
      }
    });
  });
}

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
  FetchSupportPersonsPayload,
  SetPreferredAgentPayload,
  SupportPersonsPayload,
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
  checkConnectionRateLimit,
  isJsonSafe,
  setTypingTimeout,
  clearTypingTimeout,
  isTypingThrottled,
  clearTypingThrottle,
  withSocketErrorHandler,
} from './helpers';
import { ERROR_CODE, ERROR_MESSAGE, SYSTEM_MESSAGE, AGENT_VISIBILITY, CHAT_MODE, USER_EVENT_TYPE } from '../constants/index.js';
import type { IAnalyticsConfig } from '../schemas/chat-settings.schema.js';
import type { VisitorAnalytics } from '@astralibx/chat-types';
import { resolveAiMode, resolveAiCharacter } from '../utils/ai-resolver.js';

/**
 * Strip analytics fields based on privacy settings.
 * Returns only the fields that are enabled in the analytics config.
 */
function stripAnalytics(
  analytics: VisitorAnalytics | undefined,
  config: IAnalyticsConfig,
): Record<string, unknown> | undefined {
  if (!analytics || !config.enabled) return undefined;

  const result: Record<string, unknown> = {};
  if (config.collectIp && analytics.ip != null) result.ip = analytics.ip;
  if (config.collectBrowser && analytics.browser != null) result.browser = analytics.browser;
  if (config.collectBrowser && analytics.os != null) result.os = analytics.os;
  if (config.collectScreen && analytics.screenResolution != null) result.screenResolution = analytics.screenResolution;
  if (config.collectPageView && analytics.currentPage != null) result.currentPage = analytics.currentPage;
  if (config.collectPageView && analytics.currentPageTitle != null) result.currentPageTitle = analytics.currentPageTitle;
  if (config.collectLocation && analytics.location != null) result.location = analytics.location;

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Validate file/image content type against file sharing settings.
 * Returns an error message if validation fails, or null if valid.
 */
function validateFileSharing(
  contentType: ChatContentType,
  settings: { fileSharing: { enabled: boolean; maxFileSizeMb: number; allowedTypes: string[] } },
): string | null {
  if (contentType !== ChatContentType.Image && contentType !== ChatContentType.File) {
    return null;
  }

  if (!settings.fileSharing.enabled) {
    return 'File sharing is disabled';
  }

  return null;
}

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
    const clientIP = socket.handshake.address;
    if (!checkConnectionRateLimit(clientIP)) {
      deps.logger.warn('Connection rate limited', { ip: clientIP });
      socket.disconnect();
      return;
    }

    deps.logger.info('Visitor socket connected', { socketId: socket.id });

    const aiDebounceDeps: AiDebounceDeps = {
      sessionService: deps.sessionService,
      messageService: deps.messageService,
      agentService: deps.agentService,
      settingsService: deps.settingsService,
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
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.AuthFailed, message: ERROR_MESSAGE.AuthFailed });
          socket.disconnect();
          return;
        }
      }

      const settings = await deps.settingsService.get();
      // Two-layer AI control: resolve global AI mode (ignoring per-agent until session is assigned)
      const globalResolvedMode = resolveAiMode(settings);
      const defaultMode = globalResolvedMode === 'ai'
        ? (settings.defaultSessionMode ?? SessionMode.AI)
        : (settings.aiEnabled ? settings.defaultSessionMode : SessionMode.Manual);

      const { session, isNew, messages } = await deps.sessionService.findOrCreate(
        context,
        existingSessionId,
        defaultMode as SessionMode,
      );

      socket.join(session.sessionId);
      await deps.redisService.setVisitorConnection(session.sessionId, socket.id, context.visitorId);
      await deps.redisService.setSessionActivity(session.sessionId);

      // Store visitor analytics on session (privacy-filtered)
      if (context.analytics) {
        const strippedAnalytics = stripAnalytics(context.analytics, settings.analyticsConfig);
        if (strippedAnalytics) {
          session.analytics = strippedAnalytics as any;
        }
      }

      if (session.status === ChatSessionStatus.New) {
        session.status = ChatSessionStatus.Active;
      }
      await session.save();

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

      if (!isNew) {
        const wasDisconnected = await deps.redisService.hadRecentDisconnect(session.sessionId);
        if (wasDisconnected) {
          await deps.messageService.createSystemMessage(session.sessionId, SYSTEM_MESSAGE.VisitorReconnected);
          if (session.agentId) {
            await emitToAgent(deps.emitDeps, session.agentId, ServerToAgentEvent.VisitorReconnected, {
              sessionId: session.sessionId,
            });
          }
          deps.notificationDeps.agentNs.emit(ServerToAgentEvent.VisitorReconnected, {
            sessionId: session.sessionId,
          });
        }
      }

      if (isNew) {
        notifyAgentsNewChat(deps.notificationDeps, deps.sessionService.toSummary(session));

        if (settings.autoAssignEnabled && deps.config.adapters.assignAgent) {
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

      // Resolve user identity — merge anonymous sessions if a known user is identified
      if (deps.config.adapters.resolveUserIdentity) {
        try {
          const resolvedUserId = await deps.config.adapters.resolveUserIdentity(context);
          if (resolvedUserId && resolvedUserId !== context.visitorId) {
            await deps.sessionService.mergeAnonymousSessions(context.visitorId, resolvedUserId);
            deps.logger.info('User identity resolved', {
              sessionId: session.sessionId,
              anonymousId: context.visitorId,
              userId: resolvedUserId,
            });
          }
        } catch (err) {
          deps.logger.error('resolveUserIdentity failed', { error: err, visitorId: context.visitorId });
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
        socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.NoSession, message: ERROR_MESSAGE.NoActiveSession });
        return;
      }

      if (payload.metadata && !isJsonSafe(payload.metadata)) {
        socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidData, message: ERROR_MESSAGE.InvalidMetadata });
        return;
      }

      await checkRateLimit(sessionId, deps.redisService);

      const session = await deps.sessionService.findByIdOrFail(sessionId);
      validateSessionForMessaging(session);

      const content = validateMessageContent(payload.content, deps.options);

      // Validate file sharing settings for file/image messages
      if (payload.contentType === ChatContentType.Image || payload.contentType === ChatContentType.File) {
        const settings = await deps.settingsService.get();
        const fileSharingError = validateFileSharing(payload.contentType, settings);
        if (fileSharingError) {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.FileSharingDisabled, message: fileSharingError });
          return;
        }
      }

      // Validate that file/image messages have a valid URL as content
      if ((payload.contentType === ChatContentType.Image || payload.contentType === ChatContentType.File) && content) {
        try {
          new URL(content);
        } catch {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidUrl, message: ERROR_MESSAGE.FileContentInvalidUrl });
          return;
        }
      }

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
        labels: { channel: session.channel, senderType: ChatSenderType.Visitor, contentType: payload.contentType || ChatContentType.Text },
      });

      if (session.agentId) {
        await emitToAgent(deps.emitDeps, session.agentId, 'agent:message', {
          sessionId,
          message: messagePayload,
        });
      }

      const settings = await deps.settingsService.get();
      // Use two-layer AI mode resolution: check global switch, then per-agent
      const sessionAgent = session.agentId ? await deps.agentService.findById(session.agentId) : null;
      const resolvedMode = resolveAiMode(settings, sessionAgent);
      if (session.mode === SessionMode.AI && resolvedMode === 'ai' && deps.config.adapters.generateAiResponse) {
        scheduleAiResponse(aiDebounceDeps, sessionId);
      }
    }));

    socket.on(VisitorEvent.Typing, withSocketErrorHandler(socket, deps.logger, async (payload: TypingPayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      // Throttle typing-start events to avoid flooding the agent
      if (payload.isTyping && isTypingThrottled(sessionId)) return;

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

      const assignedAgent = deps.config.adapters.assignAgent
        ? await deps.config.adapters.assignAgent({
            visitorId: session.visitorId,
            channel: session.channel,
            preferences: session.preferences as Record<string, unknown>,
          })
        : null;

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

      if (!isJsonSafe(data)) {
        socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidData, message: ERROR_MESSAGE.InvalidDataFormat });
        return;
      }

      const session = await deps.sessionService.findByIdOrFail(sessionId);
      session.preferences = { ...session.preferences, ...data };
      await session.save();
    }));

    socket.on(VisitorEvent.TrackEvent, withSocketErrorHandler(socket, deps.logger, async (payload: TrackEventPayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const session = await deps.sessionService.findById(sessionId);
      if (!session) return;

      if (deps.config.adapters.trackEvent) {
        await deps.config.adapters.trackEvent({
          sessionId,
          visitorId: session.visitorId,
          eventType: payload.eventType,
          description: payload.description,
          data: payload.data,
          channel: session.channel,
          timestamp: new Date(),
        });
      }

      // Store tracked events as inline event messages (senderType: system, contentType: event)
      const eventContent = `${payload.eventType}: ${payload.description || ''}`.trim();
      const eventMetadata: Record<string, unknown> = {
        eventType: payload.eventType,
        eventData: payload.data,
      };
      if (payload.pageTitle) eventMetadata.pageTitle = payload.pageTitle;
      if (payload.pageUrl) eventMetadata.pageUrl = payload.pageUrl;

      const eventMsg = await deps.messageService.create({
        sessionId,
        senderType: ChatSenderType.System,
        senderName: SYSTEM_MESSAGE.SenderName,
        content: eventContent,
        contentType: ChatContentType.Event,
        metadata: eventMetadata,
      });

      // Forward inline event to assigned agent so they see it in the chat timeline
      if (session.agentId) {
        await emitToAgent(deps.emitDeps, session.agentId, ServerToAgentEvent.SessionEvent, {
          sessionId,
          message: deps.messageService.toPayload(eventMsg),
        });
      }

      // Also broadcast to all agents (e.g. agent dashboard)
      deps.emitDeps.agentNs?.emit(ServerToAgentEvent.SessionEvent, {
        sessionId,
        message: deps.messageService.toPayload(eventMsg),
      });
    }));

    socket.on(VisitorEvent.Ping, () => {
      socket.emit(ServerToVisitorEvent.Pong, { timestamp: Date.now() });
    });

    socket.on(VisitorEvent.Feedback, withSocketErrorHandler(socket, deps.logger, async (payload: FeedbackPayload) => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      // Two-step rating flow
      if (payload.ratingType != null || payload.ratingValue != null) {
        if (!payload.ratingType || typeof payload.ratingType !== 'string') {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: ERROR_MESSAGE.RatingTypeRequired });
          return;
        }

        if (payload.ratingValue == null) {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: ERROR_MESSAGE.RatingValueRequired });
          return;
        }

        // Validate ratingType matches settings
        const settings = await deps.settingsService.get();
        if (settings.ratingConfig?.enabled && settings.ratingConfig.ratingType !== payload.ratingType) {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: `ratingType must be '${settings.ratingConfig.ratingType}'` });
          return;
        }

        // Validate ratingValue range
        if (payload.ratingType === 'thumbs') {
          if (payload.ratingValue !== 0 && payload.ratingValue !== 1) {
            socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: ERROR_MESSAGE.RatingThumbsRange });
            return;
          }
        } else if (payload.ratingType === 'stars' || payload.ratingType === 'emoji') {
          const numVal = Number(payload.ratingValue);
          if (!Number.isInteger(numVal) || numVal < 1 || numVal > 5) {
            socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: ERROR_MESSAGE.RatingStarsRange });
            return;
          }
        } else {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: `Invalid ratingType: ${payload.ratingType}` });
          return;
        }

        await deps.sessionService.submitFeedback(sessionId, {
          ratingType: payload.ratingType,
          ratingValue: payload.ratingValue,
          followUpSelections: payload.followUpSelections,
          comment: payload.comment,
        });
        return;
      }

      // Legacy rating flow
      if (payload.rating != null) {
        if (typeof payload.rating !== 'number' || payload.rating < 1 || payload.rating > 5 || !Number.isInteger(payload.rating)) {
          socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.InvalidRating, message: ERROR_MESSAGE.RatingLegacyRange });
          return;
        }
      }

      await deps.sessionService.submitFeedback(sessionId, {
        rating: payload.rating,
        survey: payload.survey,
      });
    }));

    socket.on(VisitorEvent.FetchSupportPersons, withSocketErrorHandler(socket, deps.logger, async (payload: FetchSupportPersonsPayload) => {
      const settings = await deps.settingsService.get();
      if (!settings?.visitorAgentSelection) {
        deps.logger.info('Visitor agent selection disabled, ignoring FetchSupportPersons');
        return;
      }

      const agents = await deps.agentService.listPublicAgents();
      socket.emit(ServerToVisitorEvent.SupportPersons, { agents } as SupportPersonsPayload);
    }));

    socket.on(VisitorEvent.SetPreferredAgent, withSocketErrorHandler(socket, deps.logger, async (payload: SetPreferredAgentPayload) => {
      const settings = await deps.settingsService.get();
      if (!settings?.visitorAgentSelection) return;

      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      // Fixed mode: reject switch unless the assigned agent has left/disconnected
      if (settings.chatMode === CHAT_MODE.Fixed) {
        const session = await deps.sessionService.findById(sessionId);
        if (session?.agentId) {
          const currentAgent = await deps.agentService.findById(session.agentId);
          // Only allow switch if current agent is offline or not found
          if (currentAgent && currentAgent.isOnline) {
            socket.emit(ServerToVisitorEvent.Error, {
              code: ERROR_CODE.FixedModeSwitch,
              message: ERROR_MESSAGE.FixedModeSwitch,
            });
            return;
          }
        }
      }

      const agent = await deps.agentService.findById(payload.agentId);
      if (!agent || !agent.isActive || agent.visibility !== AGENT_VISIBILITY.Public) {
        socket.emit(ServerToVisitorEvent.Error, { code: ERROR_CODE.AgentUnavailable, message: ERROR_MESSAGE.AgentNotAvailable });
        return;
      }

      await deps.sessionService.assignAgent(sessionId, agent._id.toString());
      const agentInfo = deps.agentService.toAgentInfo(agent);

      socket.emit(ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WithAgent,
        agent: agentInfo,
      });

      const session = await deps.sessionService.findById(sessionId);
      if (session) {
        const summary = deps.sessionService.toSummary(session);
        await emitToAgent(deps.emitDeps, agent._id.toString(), ServerToAgentEvent.ChatAssigned, { session: summary });
      }
    }));

    socket.on('disconnect', async () => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];

      deps.logger.info('Visitor socket disconnected', { socketId: socket.id, sessionId });

      if (sessionId) {
        clearAiDebounce(sessionId);
        clearTypingTimeout(`visitor:${sessionId}`);
        clearTypingThrottle(sessionId);

        await deps.redisService.markDisconnected(sessionId);
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

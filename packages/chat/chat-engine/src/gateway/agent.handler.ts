import type { Namespace, Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import {
  AgentEvent,
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
  MessagePayload,
  TypingPayload,
} from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import type { AgentService } from '../services/agent.service';
import type { SettingsService } from '../services/settings.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import type { EmitDeps } from './emit';
import { emitToVisitor, emitToAgent } from './emit';
import type { NotificationDeps } from './notifications';
import {
  broadcastStatsUpdate,
  broadcastSessionUpdate,
  broadcastModeChange,
} from './notifications';
import { clearAiDebounce } from './ai-debounce';
import {
  validateMessageContent,
  validateSessionForMessaging,
  setTypingTimeout,
  withSocketErrorHandler,
} from './helpers';

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

export function setupAgentHandlers(
  agentNs: Namespace,
  deps: AgentHandlerDeps,
): void {
  agentNs.on('connection', (socket: Socket) => {
    deps.logger.info('Agent socket connected', { socketId: socket.id });

    let connectedAgentId: string | undefined;

    socket.on(AgentEvent.Connect, withSocketErrorHandler(socket, deps.logger, async (payload: { token?: string; agentId: string }) => {
      if (deps.config.adapters.authenticateAgent && payload.token) {
        const identity = await deps.config.adapters.authenticateAgent(payload.token);
        if (!identity) {
          socket.emit('agent:error', { code: 'AUTH_FAILED', message: 'Agent authentication failed' });
          socket.disconnect();
          return;
        }
      }

      const agent = await deps.agentService.connect(payload.agentId);
      connectedAgentId = payload.agentId;

      await deps.redisService.setAgentConnection(payload.agentId, socket.id, payload.agentId);

      const [waitingChats, assignedChats] = await Promise.all([
        deps.sessionService.findWaitingSessions(),
        deps.sessionService.findByAgent(payload.agentId),
      ]);

      const dashStats = await deps.sessionService.getDashboardStats();
      const [totalAgents, activeAgents] = await Promise.all([
        deps.agentService.getTotalAgentCount(),
        deps.agentService.getOnlineAgentCount(),
      ]);

      socket.emit(ServerToAgentEvent.Connected, {
        stats: { ...dashStats, totalAgents, activeAgents },
        waitingChats: waitingChats.map(s => deps.sessionService.toSummary(s)),
        assignedChats: assignedChats.map(s => deps.sessionService.toSummary(s)),
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

      const hasCapacity = await deps.agentService.hasCapacity(connectedAgentId);
      if (!hasCapacity) {
        socket.emit('agent:error', { code: 'CAPACITY_FULL', message: 'Maximum concurrent chats reached' });
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
        `${agent.name} joined the conversation`,
      );

      broadcastSessionUpdate(deps.notificationDeps, payload.sessionId, 'accepted', {
        agentId: connectedAgentId,
      });
    }));

    socket.on(AgentEvent.SendMessage, withSocketErrorHandler(socket, deps.logger, async (payload: MessagePayload & { sessionId: string }) => {
      if (!connectedAgentId) return;

      const session = await deps.sessionService.findByIdOrFail(payload.sessionId);
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
        labels: { channel: session.channel, senderType: 'agent', contentType: payload.contentType || 'text' },
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

      clearAiDebounce(payload.sessionId);

      const session = await deps.sessionService.resolve(payload.sessionId);
      await deps.agentService.decrementChats(connectedAgentId);

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        'Conversation has been resolved',
      );

      await emitToVisitor(deps.emitDeps, payload.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.Resolved,
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
    }));

    socket.on(AgentEvent.TakeOver, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string }) => {
      if (!connectedAgentId) return;

      clearAiDebounce(payload.sessionId);

      const session = await deps.sessionService.updateMode(payload.sessionId, SessionMode.Manual, connectedAgentId);

      const agent = await deps.agentService.findByIdOrFail(connectedAgentId);

      if (!session.agentId || session.agentId !== connectedAgentId) {
        await deps.sessionService.assignAgent(payload.sessionId, connectedAgentId);
        await deps.agentService.incrementChats(connectedAgentId);
      }

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        `${agent.name} took over the conversation`,
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
      if (!settings.aiEnabled) {
        socket.emit('agent:error', { code: 'AI_DISABLED', message: 'AI mode is not enabled' });
        return;
      }

      await deps.sessionService.updateMode(payload.sessionId, SessionMode.AI);
      await deps.agentService.decrementChats(connectedAgentId);

      await deps.messageService.createSystemMessage(
        payload.sessionId,
        'Conversation handed back to AI',
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
      const settings = await deps.settingsService.update(payload as any);
      deps.notificationDeps.agentNs.emit(ServerToAgentEvent.SettingsUpdated, { settings });
    }));

    socket.on(AgentEvent.SaveMemory, withSocketErrorHandler(socket, deps.logger, async (payload: SaveMemoryPayload) => {
      deps.logger.info('Memory save requested', {
        sessionId: payload.sessionId,
        key: payload.key,
        category: payload.category,
      });
    }));

    socket.on(AgentEvent.DeleteMemory, withSocketErrorHandler(socket, deps.logger, async (payload: { sessionId: string; key: string }) => {
      deps.logger.info('Memory delete requested', {
        sessionId: payload.sessionId,
        key: payload.key,
      });
    }));

    socket.on(AgentEvent.TransferChat, withSocketErrorHandler(socket, deps.logger, async (payload: TransferChatPayload) => {
      if (!connectedAgentId) return;

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
        `Conversation transferred to ${targetAgent.name}`,
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

    socket.on('disconnect', async () => {
      deps.logger.info('Agent socket disconnected', { socketId: socket.id, agentId: connectedAgentId });

      if (connectedAgentId) {
        await deps.agentService.disconnect(connectedAgentId);
        await deps.redisService.removeAgentConnection(connectedAgentId);

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

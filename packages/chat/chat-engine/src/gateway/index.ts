import { Server as SocketIOServer, type Namespace } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { LogAdapter } from '@astralibx/core';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import type { AgentService } from '../services/agent.service';
import type { SettingsService } from '../services/settings.service';
import type { PendingMessageService } from '../services/pending-message.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import type { EmitDeps } from './emit';
import { setupVisitorHandlers } from './visitor.handler';
import { setupAgentHandlers } from './agent.handler';

export interface GatewayDeps {
  sessionService: SessionService;
  messageService: MessageService;
  agentService: AgentService;
  settingsService: SettingsService;
  pendingMessageService: PendingMessageService;
  redisService: RedisService;
  config: ChatEngineConfig;
  options: ResolvedOptions;
  logger: LogAdapter;
}

export interface GatewayResult {
  io: SocketIOServer;
  emitDeps: EmitDeps | undefined;
  agentNs: Namespace | undefined;
  attach: (httpServer: HttpServer) => void;
}

export function createGateway(deps: GatewayDeps): GatewayResult {
  const visitorPath = deps.config.socket.namespaces?.visitor || '/chat';
  const agentPath = deps.config.socket.namespaces?.agent || '/agent';

  let io: SocketIOServer;
  let currentEmitDeps: EmitDeps | undefined;
  let currentAgentNs: Namespace | undefined;

  function attach(httpServer: HttpServer): void {
    io = new SocketIOServer(httpServer, {
      pingInterval: deps.config.socket.pingIntervalMs || 25_000,
      pingTimeout: deps.config.socket.pingTimeoutMs || 60_000,
      cors: deps.config.socket.cors || undefined,
    });

    const visitorNs = io.of(visitorPath);
    const agentNs = io.of(agentPath);

    const emitDeps: EmitDeps = {
      visitorNs,
      agentNs,
      redisService: deps.redisService,
      pendingMessageService: deps.pendingMessageService,
      logger: deps.logger,
    };

    const notificationDeps = {
      agentNs,
      logger: deps.logger,
    };

    setupVisitorHandlers(visitorNs, {
      sessionService: deps.sessionService,
      messageService: deps.messageService,
      agentService: deps.agentService,
      settingsService: deps.settingsService,
      pendingMessageService: deps.pendingMessageService,
      redisService: deps.redisService,
      config: deps.config,
      options: deps.options,
      emitDeps,
      notificationDeps,
      logger: deps.logger,
    });

    setupAgentHandlers(agentNs, {
      sessionService: deps.sessionService,
      messageService: deps.messageService,
      agentService: deps.agentService,
      settingsService: deps.settingsService,
      redisService: deps.redisService,
      config: deps.config,
      options: deps.options,
      emitDeps,
      notificationDeps,
      logger: deps.logger,
    });

    currentEmitDeps = emitDeps;
    currentAgentNs = agentNs;

    deps.logger.info('Chat gateway attached', {
      visitorPath,
      agentPath,
    });
  }

  return {
    get io() {
      return io;
    },
    get emitDeps() {
      return currentEmitDeps;
    },
    get agentNs() {
      return currentAgentNs;
    },
    attach,
  };
}

export { setupVisitorHandlers } from './visitor.handler';
export { setupAgentHandlers } from './agent.handler';
export { emitToVisitor, emitToAgent } from './emit';
export { notifyAgentsNewChat, notifyAgentsNewMessage, broadcastStatsUpdate, broadcastSessionUpdate, broadcastModeChange, broadcastQueuePositions } from './notifications';
export { scheduleAiResponse, resetAiDebounce, clearAiDebounce } from './ai-debounce';
export * from './helpers';

import type { Namespace } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import { ServerToAgentEvent } from '@astralibx/chat-types';
import type { ChatSessionSummary, ChatMessage, DashboardStats } from '@astralibx/chat-types';
import type { SessionMode } from '@astralibx/chat-types';

export interface NotificationDeps {
  agentNs: Namespace;
  logger: LogAdapter;
}

export function notifyAgentsNewChat(
  deps: NotificationDeps,
  session: ChatSessionSummary,
): void {
  deps.agentNs.emit(ServerToAgentEvent.NewChat, { session });
}

export function notifyAgentsNewMessage(
  deps: NotificationDeps,
  sessionId: string,
  message: ChatMessage,
): void {
  deps.agentNs.emit(ServerToAgentEvent.Message, { sessionId, message });
}

export function broadcastStatsUpdate(
  deps: NotificationDeps,
  stats: DashboardStats,
): void {
  deps.agentNs.emit(ServerToAgentEvent.StatsUpdate, { stats });
}

export function broadcastSessionUpdate(
  deps: NotificationDeps,
  sessionId: string,
  eventType: string,
  data?: Record<string, unknown>,
): void {
  deps.agentNs.emit(ServerToAgentEvent.SessionEvent, {
    sessionId,
    eventType,
    ...data,
  });
}

export function broadcastModeChange(
  deps: NotificationDeps,
  sessionId: string,
  mode: SessionMode,
  takenOverBy?: string,
  agentName?: string,
): void {
  deps.agentNs.emit(ServerToAgentEvent.ModeChanged, {
    sessionId,
    mode,
    takenOverBy,
    agentName,
  });
}

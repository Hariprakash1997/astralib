import type { Namespace } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import { ServerToAgentEvent, ServerToVisitorEvent, ChatSessionStatus } from '@astralibx/chat-types';
import type { ChatSessionSummary, ChatMessage, DashboardStats, EscalationNeededPayload } from '@astralibx/chat-types';
import type { SessionMode } from '@astralibx/chat-types';
import type { EmitDeps } from './emit.js';
import { emitToVisitor } from './emit.js';

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

export function notifyAgentsEscalation(
  deps: NotificationDeps,
  payload: EscalationNeededPayload,
): void {
  deps.agentNs.emit(ServerToAgentEvent.EscalationNeeded, payload);
  deps.logger.info('Escalation broadcast to agents', { sessionId: payload.sessionId });
}

export async function broadcastQueuePositions(
  updates: { sessionId: string; queuePosition: number; estimatedWaitMinutes?: number }[],
  emitDeps: EmitDeps,
  logger: LogAdapter,
): Promise<void> {
  for (const update of updates) {
    await emitToVisitor(emitDeps, update.sessionId, ServerToVisitorEvent.Status, {
      status: ChatSessionStatus.WaitingAgent,
      queuePosition: update.queuePosition,
      ...(update.estimatedWaitMinutes != null && { estimatedWaitMinutes: update.estimatedWaitMinutes }),
    });
  }
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

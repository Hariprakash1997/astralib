import type { Namespace } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import type { RedisService } from '../services/redis.service';
import type { PendingMessageService } from '../services/pending-message.service';

export interface EmitDeps {
  visitorNs: Namespace;
  agentNs: Namespace;
  redisService: RedisService;
  pendingMessageService: PendingMessageService;
  logger: LogAdapter;
}

export async function emitToVisitor(
  deps: EmitDeps,
  sessionId: string,
  event: string,
  data: unknown,
): Promise<boolean> {
  const conn = await deps.redisService.getVisitorConnection(sessionId);
  if (!conn) {
    deps.logger.info('Visitor offline, saving pending message', { sessionId, event });
    await deps.pendingMessageService.save(sessionId, {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  const socket = deps.visitorNs.sockets.get(conn.socketId);
  if (!socket) {
    deps.logger.info('Visitor socket not found, saving pending message', { sessionId, event });
    await deps.pendingMessageService.save(sessionId, {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  socket.emit(event, data);
  return true;
}

export async function emitToAgent(
  deps: EmitDeps,
  agentId: string,
  event: string,
  data: unknown,
): Promise<boolean> {
  const conn = await deps.redisService.getAgentConnection(agentId);
  if (!conn) {
    return false;
  }

  const socket = deps.agentNs.sockets.get(conn.socketId);
  if (!socket) {
    return false;
  }

  socket.emit(event, data);
  return true;
}

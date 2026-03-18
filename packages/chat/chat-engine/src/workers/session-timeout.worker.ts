import type { LogAdapter } from '@astralibx/core';
import { ChatSessionStatus } from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service';
import type { AgentService } from '../services/agent.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';

export interface SessionTimeoutWorkerDeps {
  sessionService: SessionService;
  agentService: AgentService;
  redisService: RedisService;
  config: ChatEngineConfig;
  options: ResolvedOptions;
  logger: LogAdapter;
}

export class SessionTimeoutWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private deps: SessionTimeoutWorkerDeps) {}

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        this.deps.logger.error('Session timeout worker tick failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }, this.deps.options.sessionTimeoutCheckMs);

    this.deps.logger.info('Session timeout worker started', {
      intervalMs: this.deps.options.sessionTimeoutCheckMs,
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.deps.logger.info('Session timeout worker stopped');
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const expiredSessions = await this.deps.sessionService.findExpiredSessions();

      for (const session of expiredSessions) {
        try {
          // Call onSessionTimeout hook BEFORE marking abandoned —
          // this fires specifically for disconnect window expiry (visitor disconnected, never came back)
          if (this.deps.config.hooks?.onSessionTimeout) {
            try {
              await this.deps.config.hooks.onSessionTimeout({
                sessionId: session.sessionId,
                visitorId: session.visitorId,
                channel: session.channel,
                startedAt: session.startedAt,
              });
            } catch (hookErr) {
              this.deps.logger.error('onSessionTimeout hook failed', {
                sessionId: session.sessionId,
                error: hookErr instanceof Error ? hookErr.message : 'Unknown error',
              });
            }
          }

          await this.deps.sessionService.abandon(session.sessionId);

          if (session.agentId) {
            await this.deps.agentService.decrementChats(session.agentId);
          }

          await this.deps.redisService.removeVisitorConnection(session.sessionId);
          await this.deps.redisService.removeSessionActivity(session.sessionId);

          this.deps.config.hooks?.onMetric?.({
            name: 'session_timeout',
            value: 1,
            labels: { channel: session.channel, mode: session.mode },
          });

          this.deps.logger.info('Session expired and abandoned', {
            sessionId: session.sessionId,
            visitorId: session.visitorId,
          });
        } catch (err) {
          this.deps.logger.error('Failed to abandon expired session', {
            sessionId: session.sessionId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      const activeSessions = await this.deps.sessionService.findActiveSessions();
      const activeSessionIds = activeSessions.map(s => s.sessionId);
      const staleSessions = await this.deps.redisService.getStaleActiveSessions(activeSessionIds);

      for (const sessionId of staleSessions) {
        try {
          const conn = await this.deps.redisService.getVisitorConnection(sessionId);
          if (conn) continue;

          const session = await this.deps.sessionService.findById(sessionId);
          if (!session) continue;

          if (session.status === ChatSessionStatus.Active || session.status === ChatSessionStatus.New) {
            await this.deps.sessionService.abandon(sessionId);

            if (session.agentId) {
              await this.deps.agentService.decrementChats(session.agentId);
            }

            await this.deps.redisService.removeSessionActivity(sessionId);

            this.deps.config.hooks?.onMetric?.({
              name: 'session_abandoned',
              value: 1,
              labels: { channel: session.channel, mode: session.mode },
            });

            this.deps.logger.info('Idle session abandoned', {
              sessionId,
              visitorId: session.visitorId,
            });
          }
        } catch (err) {
          this.deps.logger.error('Failed to abandon idle session', {
            sessionId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}

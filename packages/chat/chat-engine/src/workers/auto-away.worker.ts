import type { Namespace } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import { AgentStatus, ServerToAgentEvent } from '@astralibx/chat-types';
import type { AgentService } from '../services/agent.service.js';
import type { SettingsService } from '../services/settings.service.js';
import type { RedisService } from '../services/redis.service.js';
import { AGENT_ACTIVITY } from '../constants/index.js';

export interface AutoAwayWorkerDeps {
  agentService: AgentService;
  settingsService: SettingsService;
  redisService: RedisService;
  logger: LogAdapter;
}

/**
 * Periodically checks online agents for inactivity and auto-sets them to 'away'.
 * The timeout is configurable via `autoAwayTimeoutMinutes` in chat settings.
 * The agentNs is set lazily after the gateway attaches.
 */
export class AutoAwayWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;
  private agentNs: Namespace | null = null;

  constructor(private deps: AutoAwayWorkerDeps) {}

  /** Must be called after gateway.attach() so we can broadcast status changes. */
  setAgentNamespace(ns: Namespace): void {
    this.agentNs = ns;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        this.deps.logger.error('Auto-away worker tick failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }, AGENT_ACTIVITY.CheckIntervalMs);

    this.deps.logger.info('Auto-away worker started', {
      intervalMs: AGENT_ACTIVITY.CheckIntervalMs,
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.deps.logger.info('Auto-away worker stopped');
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const settings = await this.deps.settingsService.get();
      const timeoutMinutes = settings.autoAwayTimeoutMinutes;

      // 0 means disabled
      if (!timeoutMinutes || timeoutMinutes <= 0) return;

      const thresholdMs = timeoutMinutes * 60 * 1000;

      // Find all online, non-AI agents that are currently available
      const onlineAgents = await this.deps.agentService.getOnlineAgents();
      const availableAgents = onlineAgents.filter(
        (a) => a.status === AgentStatus.Available && !a.isAI,
      );

      if (availableAgents.length === 0) return;

      const agentIds = availableAgents.map((a) => a._id.toString());
      const idleAgentIds = await this.deps.redisService.getIdleAgents(agentIds, thresholdMs);

      for (const agentId of idleAgentIds) {
        try {
          await this.deps.agentService.updateStatus(agentId, AgentStatus.Away);

          // Broadcast status change to all agents
          if (this.agentNs) {
            const dashStats = await this.deps.agentService.getOnlineAgentCount();
            const totalAgents = await this.deps.agentService.getTotalAgentCount();

            this.agentNs.emit(ServerToAgentEvent.StatsUpdate, {
              activeAgents: dashStats,
              totalAgents,
            });
          }

          this.deps.logger.info('Agent auto-set to away due to inactivity', {
            agentId,
            timeoutMinutes,
          });
        } catch (err) {
          this.deps.logger.error('Failed to auto-away agent', {
            agentId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}

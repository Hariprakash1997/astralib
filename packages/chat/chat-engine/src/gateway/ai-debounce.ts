import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage as ChatMessageType } from '@astralibx/chat-types';
import { AgentStatus, ChatSenderType, ChatContentType, SessionMode } from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import type { EmitDeps } from './emit';
import { emitToVisitor } from './emit';
import { notifyAgentsNewMessage } from './notifications';
import type { NotificationDeps } from './notifications';
import { ServerToVisitorEvent } from '@astralibx/chat-types';

export interface AiDebounceDeps {
  sessionService: SessionService;
  messageService: MessageService;
  redisService: RedisService;
  options: ResolvedOptions;
  config: ChatEngineConfig;
  emitDeps: EmitDeps;
  notificationDeps: NotificationDeps;
  logger: LogAdapter;
}

const debounceTimers = new Map<string, NodeJS.Timeout>();

export function scheduleAiResponse(
  deps: AiDebounceDeps,
  sessionId: string,
): void {
  if (!deps.config.adapters.generateAiResponse) return;

  resetAiDebounce(sessionId);

  const timer = setTimeout(async () => {
    debounceTimers.delete(sessionId);
    await executeAiResponse(deps, sessionId);
  }, deps.options.aiDebounceMs);

  debounceTimers.set(sessionId, timer);

  deps.redisService.setDebounceTimer(sessionId, Date.now().toString()).catch((err) => {
    deps.logger.warn('Failed to set debounce timer in Redis', {
      sessionId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });
}

export function resetAiDebounce(sessionId: string): void {
  const existing = debounceTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    debounceTimers.delete(sessionId);
  }
}

export function clearAiDebounce(sessionId: string): void {
  resetAiDebounce(sessionId);
}

async function executeAiResponse(
  deps: AiDebounceDeps,
  sessionId: string,
): Promise<void> {
  const generateAiResponse = deps.config.adapters.generateAiResponse;
  if (!generateAiResponse) return;

  const session = await deps.sessionService.findById(sessionId);
  if (!session) return;
  if (session.mode !== SessionMode.AI) return;

  const locked = await deps.redisService.acquireAiLock(sessionId);
  if (!locked) {
    deps.logger.info('AI lock not acquired, skipping', { sessionId });
    return;
  }

  try {
    const messages = await deps.messageService.findBySession(sessionId, deps.options.maxSessionHistory);

    const aiStartTime = Date.now();

    if (deps.options.aiTypingSimulation) {
      await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
        isTyping: true,
      });
    }

    const agentInfo = session.agentId
      ? { agentId: session.agentId, name: 'AI', status: AgentStatus.Available, isAI: true }
      : { agentId: 'ai', name: 'AI', status: AgentStatus.Available, isAI: true };

    const input = {
      sessionId,
      visitorId: session.visitorId,
      messages: messages.map((m) => deps.messageService.toPayload(m)),
      agent: agentInfo,
      visitorContext: {
        visitorId: session.visitorId,
        channel: session.channel,
        fingerprint: session.visitorFingerprint,
      },
      conversationSummary: session.conversationSummary,
      metadata: session.metadata,
    };

    const output = await generateAiResponse(input);

    if (deps.options.aiTypingSimulation) {
      await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
        isTyping: false,
      });
    }

    const aiResponseTimeMs = Date.now() - aiStartTime;
    deps.config.hooks?.onMetric?.({
      name: 'ai_response_time_ms',
      value: aiResponseTimeMs,
      labels: { channel: session.channel },
    });

    if (output.shouldEscalate) {
      await deps.sessionService.escalate(sessionId, output.escalationReason);
      return;
    }

    for (const text of output.messages) {
      if (deps.options.aiTypingSimulation) {
        const delayMs = Math.ceil((text.length / deps.options.aiTypingSpeedCpm) * 60_000);
        await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
          isTyping: true,
        });
        await sleep(Math.min(delayMs, 5000));
        await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
          isTyping: false,
        });
      }

      const message = await deps.messageService.create({
        sessionId,
        senderType: ChatSenderType.AI,
        senderName: agentInfo.name,
        content: text,
        contentType: ChatContentType.Text,
      });

      await deps.sessionService.updateLastMessage(sessionId);

      const payload = deps.messageService.toPayload(message);
      await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Message, {
        message: payload,
      });
      notifyAgentsNewMessage(deps.notificationDeps, sessionId, payload);

      deps.config.hooks?.onMetric?.({
        name: 'message_sent',
        value: 1,
        labels: { channel: session.channel, senderType: 'ai', contentType: 'text' },
      });
    }

    if (output.conversationSummary) {
      await deps.sessionService.updateConversationSummary(sessionId, output.conversationSummary);
    }

    await deps.redisService.setSessionActivity(sessionId);
  } catch (err) {
    deps.logger.error('AI response generation failed', {
      sessionId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    deps.config.hooks?.onError?.(
      err instanceof Error ? err : new Error('AI response generation failed'),
      { sessionId, event: 'ai_response' },
    );
  } finally {
    await deps.redisService.releaseAiLock(sessionId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

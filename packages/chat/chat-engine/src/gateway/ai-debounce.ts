import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage as ChatMessageType } from '@astralibx/chat-types';
import { AgentStatus, ChatSenderType, ChatContentType, ChatMessageStatus, SessionMode } from '@astralibx/chat-types';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import type { RedisService } from '../services/redis.service';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types';
import type { EmitDeps } from './emit';
import { emitToVisitor } from './emit';
import { notifyAgentsNewMessage, notifyAgentsEscalation } from './notifications';
import type { NotificationDeps } from './notifications';
import { ServerToVisitorEvent, ServerToAgentEvent } from '@astralibx/chat-types';
import type { AiSimulationConfig } from '../types/config.types';

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

const AI_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
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

export function clearAllDebounceTimers(): void {
  for (const [, timer] of debounceTimers) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
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

  let aiStartTime = Date.now();
  try {
    const messages = await deps.messageService.findBySession(sessionId, deps.options.maxSessionHistory);
    const simConfig: AiSimulationConfig = deps.config.options?.aiSimulation ?? {};
    const simulate = deps.options.aiTypingSimulation;

    // --- Step 1-4: Delivery and read status simulation ---
    if (simulate) {
      // Compute total incoming message length for read delay scaling
      const visitorMessages = messages.filter((m) => m.senderType === ChatSenderType.Visitor);
      const totalMsgLength = visitorMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);

      // Mark visitor messages as delivered
      const deliveredIds = await deps.messageService.markSessionMessagesDelivered(
        sessionId,
        ChatSenderType.Visitor,
      );
      if (deliveredIds.length > 0) {
        for (const msgId of deliveredIds) {
          await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.MessageStatus, {
            messageId: msgId,
            status: ChatMessageStatus.Delivered,
          });
        }
      }

      await sleep(calculateDeliveryDelay(simConfig));

      // Mark visitor messages as read
      await deps.messageService.markSessionMessagesRead(sessionId, ChatSenderType.Visitor);
      if (deliveredIds.length > 0) {
        for (const msgId of deliveredIds) {
          await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.MessageStatus, {
            messageId: msgId,
            status: ChatMessageStatus.Read,
          });
        }
      }

      await sleep(calculateReadDelay(simConfig, totalMsgLength));
      await sleep(calculatePreTypingDelay(simConfig));
    }

    // Gap 24: AI request logging hook -- received
    await deps.config.hooks?.onAiRequest?.({ sessionId, stage: 'received' }).catch(() => {});

    aiStartTime = Date.now();

    if (simulate) {
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

    const output = await withTimeout(generateAiResponse(input), AI_TIMEOUT_MS, 'AI response generation');

    if (simulate) {
      await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
        isTyping: false,
      });
    }

    const aiResponseTimeMs = Date.now() - aiStartTime;

    // Gap 24: AI request logging hook -- completed
    await deps.config.hooks?.onAiRequest?.({ sessionId, stage: 'completed', durationMs: aiResponseTimeMs }).catch(() => {});

    deps.config.hooks?.onMetric?.({
      name: 'ai_response_time_ms',
      value: aiResponseTimeMs,
      labels: { channel: session.channel },
    });

    if (output.shouldEscalate) {
      await deps.sessionService.escalate(sessionId, output.escalationReason);

      await deps.messageService.createSystemMessage(sessionId, 'Escalated to human agent');

      const sessionSummary = deps.sessionService.toSummary(session);
      notifyAgentsEscalation(deps.notificationDeps, {
        sessionId,
        visitorId: session.visitorId,
        reason: output.escalationReason,
        session: sessionSummary,
      });

      deps.config.hooks?.onEscalation?.(sessionId, output.escalationReason);
      return;
    }

    for (let i = 0; i < output.messages.length; i++) {
      const text = output.messages[i];

      if (simulate && i > 0) {
        await sleep(calculateBubbleDelay(simConfig, text.length));
      }

      if (simulate) {
        await emitToVisitor(deps.emitDeps, sessionId, ServerToVisitorEvent.Typing, {
          isTyping: true,
        });
        const delayMs = Math.ceil((text.length / deps.options.aiTypingSpeedCpm) * 60_000);
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
        labels: { channel: session.channel, senderType: ChatSenderType.AI, contentType: ChatContentType.Text },
      });
    }

    if (output.conversationSummary) {
      await deps.sessionService.updateConversationSummary(sessionId, output.conversationSummary);
    }

    await deps.redisService.setSessionActivity(sessionId);
  } catch (err) {
    // Gap 24: AI request logging hook -- failed
    const failedDuration = Date.now() - aiStartTime;
    await deps.config.hooks?.onAiRequest?.({ sessionId, stage: 'failed', durationMs: failedDuration }).catch(() => {});

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

// --- AI simulation delay helpers ---

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateDeliveryDelay(config: AiSimulationConfig): number {
  return randomBetween(config.deliveryDelay?.min ?? 300, config.deliveryDelay?.max ?? 1000);
}

export function calculateReadDelay(config: AiSimulationConfig, messageLength: number): number {
  const base = randomBetween(config.readDelay?.min ?? 1000, config.readDelay?.max ?? 3000);
  const scale = Math.min(messageLength / 200, 1.5);
  return Math.round(base * (0.5 + scale * 0.5));
}

export function calculatePreTypingDelay(config: AiSimulationConfig): number {
  return randomBetween(config.preTypingDelay?.min ?? 500, config.preTypingDelay?.max ?? 1500);
}

export function calculateBubbleDelay(config: AiSimulationConfig, responseLength: number): number {
  const base = randomBetween(config.bubbleDelay?.min ?? 800, config.bubbleDelay?.max ?? 2000);
  const scale = Math.min(responseLength / 100, 1.5);
  return Math.round(base * (0.5 + scale * 0.5));
}

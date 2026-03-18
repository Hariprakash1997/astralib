# Lifecycle Hooks

Hooks are optional callbacks passed in the `hooks` config object. They fire after internal state has been updated and are intended for logging, analytics, and side effects. All hooks are fire-and-forget -- they do not block the main flow.

## Session Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onSessionCreated` | `(session: ChatSessionSummary) => void` | New session created |
| `onSessionResolved` | `(session: ChatSessionSummary, stats: SessionStats) => void` | Session resolved (ended normally) |
| `onSessionAbandoned` | `(session: ChatSessionSummary) => void` | Session abandoned due to idle timeout |

## Message Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onMessageSent` | `(message: ChatMessage) => void` | Any message sent (visitor, agent, AI, or system) |
| `onOfflineMessage` | `(data: { visitorId: string; formData: Record<string, unknown> }) => void` | Offline message submitted via REST |

## Agent Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onAgentTakeOver` | `(sessionId: string, agentId: string) => void` | Agent takes over an AI session |
| `onAgentHandBack` | `(sessionId: string) => void` | Agent hands session back to AI |
| `onAgentTransfer` | `(sessionId: string, fromAgentId: string, toAgentId: string) => void` | Session transferred between agents |

## Queue Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onQueueJoin` | `(sessionId: string, position: number) => void` | Visitor joins the agent queue |
| `onQueuePositionChanged` | `(sessionId: string, position: number) => void` | Queue position updated |

## Escalation Hook

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onEscalation` | `(sessionId: string, reason?: string) => void` | Visitor requests human agent from AI mode |

## Connection Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onVisitorConnected` | `(visitorId: string, sessionId: string) => void` | Visitor WebSocket connected |
| `onVisitorDisconnected` | `(visitorId: string, sessionId: string) => void` | Visitor WebSocket disconnected |

## Memory Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onSaveMemory` | `(payload: { sessionId: string; visitorId: string; content: string; key?: string; category?: string }) => Promise<void>` | Agent saves a memory note during a chat session |
| `onDeleteMemory` | `(payload: { sessionId: string; memoryId: string }) => Promise<void>` | Agent deletes a memory note |

Wire both to `chat-ai` memory service for persistence. If `onSaveMemory` is not provided, `SaveMemory` socket events return an error to the agent.

## Feedback Hook

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onFeedbackReceived` | `(sessionId: string, feedback: ChatFeedback) => void` | Visitor submits rating or survey feedback |

## Session Lifecycle Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onSessionTimeout` | `(session: { sessionId: string; visitorId: string; channel: string; startedAt: Date }) => Promise<void>` | Visitor disconnects and the reconnect window expires without them coming back |
| `onSessionArchive` | `(session: { sessionId: string; visitorId: string; messages: unknown[]; metadata?: Record<string, unknown> }) => Promise<void>` | Session is resolved (chat ended) -- called with full message history |

`onSessionTimeout` is different from `onSessionAbandoned` (which fires for idle timeout). Use `onSessionTimeout` for follow-up emails, ticket creation, or CRM updates.

`onSessionArchive` is called with the complete message history when a session is resolved. Use it for archiving to external storage (S3, data warehouse, etc.).

## AI Lifecycle Hook

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onAiRequest` | `(payload: { sessionId: string; stage: 'received' \| 'processing' \| 'completed' \| 'failed'; durationMs?: number; metadata?: Record<string, unknown> }) => Promise<void>` | Each stage of the AI response lifecycle |

Fired at each stage transition: `received` (request queued), `processing` (AI call started), `completed` (response delivered), `failed` (error). Use for audit trails, performance monitoring, and cost tracking.

## Observability Hooks

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onMetric` | `(metric: ChatMetric) => void` | Metric event emitted (connections, messages, escalations, etc.) |
| `onError` | `(error: Error, context: ErrorContext) => void` | Error occurred during processing |

## Example

```ts
const engine = createChatEngine({
  // ...config
  hooks: {
    onSessionCreated: (session) => {
      analytics.track('chat_started', { sessionId: session.sessionId, channel: session.channel });
    },
    onSessionResolved: (session, stats) => {
      analytics.track('chat_resolved', { sessionId: session.sessionId, duration: stats.durationMs });
    },
    onSessionTimeout: async (session) => {
      await emailService.sendFollowUp(session.visitorId, session.sessionId);
    },
    onSessionArchive: async (session) => {
      await s3.putObject({ Key: `chats/${session.sessionId}.json`, Body: JSON.stringify(session.messages) });
    },
    onSaveMemory: async (payload) => {
      await memoryService.save(payload.sessionId, payload.content, payload.category);
    },
    onDeleteMemory: async (payload) => {
      await memoryService.delete(payload.memoryId);
    },
    onAiRequest: async (payload) => {
      if (payload.stage === 'completed') {
        metrics.histogram('ai_response_duration', payload.durationMs);
      }
    },
    onMetric: (metric) => {
      prometheus.counter(metric.name).inc(metric.value, metric.labels);
    },
    onError: (error, context) => {
      sentry.captureException(error, { extra: context });
    },
  },
});
```

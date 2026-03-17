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

## Feedback Hook

| Hook | Signature | Trigger |
|------|-----------|---------|
| `onFeedbackReceived` | `(sessionId: string, feedback: ChatFeedback) => void` | Visitor submits rating or survey feedback |

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
    onMetric: (metric) => {
      prometheus.counter(metric.name).inc(metric.value, metric.labels);
    },
    onError: (error, context) => {
      sentry.captureException(error, { extra: context });
    },
  },
});
```

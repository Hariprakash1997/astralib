# Error Handling

All error classes extend `AlxError` from `@astralibx/core` and carry a machine-readable `code` property.

## Error Classes

### `ChatEngineError`

Base error class for all chat engine errors.

```ts
class ChatEngineError extends AlxError {
  constructor(message: string, code: string);
}
```

### `SessionNotFoundError`

Thrown when a session lookup fails.

```ts
class SessionNotFoundError extends ChatEngineError {
  readonly sessionId: string;
  // code: 'SESSION_NOT_FOUND'
}
```

### `AgentNotFoundError`

Thrown when an agent lookup fails.

```ts
class AgentNotFoundError extends ChatEngineError {
  readonly agentId: string;
  // code: 'AGENT_NOT_FOUND'
}
```

### `RateLimitError`

Thrown when a visitor exceeds the per-session rate limit (`options.rateLimitPerMinute`).

```ts
class RateLimitError extends ChatEngineError {
  readonly sessionId: string;
  // code: 'RATE_LIMIT_EXCEEDED'
}
```

### `InvalidConfigError`

Thrown during initialization when the configuration is invalid.

```ts
class InvalidConfigError extends ChatEngineError {
  readonly field: string;
  // code: 'INVALID_CONFIG'
}
```

## Error Codes Summary

| Code | Class | Description |
|------|-------|-------------|
| `SESSION_NOT_FOUND` | `SessionNotFoundError` | Session does not exist or has expired |
| `AGENT_NOT_FOUND` | `AgentNotFoundError` | Agent does not exist |
| `RATE_LIMIT_EXCEEDED` | `RateLimitError` | Too many messages per minute for this session |
| `INVALID_CONFIG` | `InvalidConfigError` | Configuration validation failed |

## Socket Error Codes

These are sent as payloads on `chat:error` or `agent:error` events (not thrown as exceptions):

| Code | Context | Description |
|------|---------|-------------|
| `AUTH_FAILED` | Visitor / Agent | Authentication adapter rejected the connection |
| `NO_SESSION` | Visitor | Message sent before a session was established |
| `CAPACITY_FULL` | Agent | Agent has reached `maxConcurrentChatsPerAgent` |
| `AI_DISABLED` | Agent | Hand-back attempted but AI is not enabled in settings |

## REST API Errors

REST endpoints return errors in the envelope format:

```json
{
  "success": false,
  "error": "Session not found: abc123"
}
```

When `authenticateRequest` is provided and returns `null`, routes respond with HTTP 401.

## Error Hook

Use the `onError` hook to capture errors for monitoring:

```ts
hooks: {
  onError: (error, context) => {
    // error: the Error instance
    // context: { sessionId?, agentId?, socketId?, operation? }
    sentry.captureException(error, { extra: context });
  },
}
```

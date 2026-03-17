# Adapters

Adapters are callback functions passed in the `adapters` config object. They let you plug in custom logic for agent assignment, AI responses, authentication, visitor identification, and event tracking.

## `assignAgent` (required)

Determines which agent should handle a new or escalated session. Return an agent info object to assign immediately, or `null` to queue the session.

```ts
assignAgent: async (context: AssignAgentContext) => Promise<ChatAgentInfo | null>
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `context.visitorId` | `string` | Visitor identifier |
| `context.channel` | `string` | Channel the session originated from |
| `context.preferences` | `Record<string, unknown>` | Visitor preferences/metadata |

Called when:
- A new session is created (if `autoAssignEnabled` is true in settings)
- A visitor escalates from AI to human agent

## `generateAiResponse` (optional)

Generates an AI response for a visitor message. Only called when the session is in AI mode and `aiEnabled` is true in settings.

```ts
generateAiResponse: async (input: AiResponseInput) => Promise<AiResponseOutput>
```

The engine handles debouncing (`aiDebounceMs`) and typing simulation (`aiTypingSimulation`, `aiTypingSpeedCpm`) automatically.

## `identifyVisitor` (optional)

Maps a visitor to a known user identity. Called when the visitor emits the `chat:identify` event.

```ts
identifyVisitor: async (visitorId: string, identifyData: Record<string, unknown>) => Promise<VisitorIdentity | null>
```

## `authenticateAgent` (optional)

Validates an agent's WebSocket connection token. Return an `AgentIdentity` on success or `null` to reject.

```ts
authenticateAgent: async (token: string) => Promise<AgentIdentity | null>
```

If this adapter is not provided, agent connections are accepted without authentication.

## `authenticateVisitor` (optional)

Validates a visitor's WebSocket connection. Return `true` to allow or `false` to reject (socket is disconnected).

```ts
authenticateVisitor: async (context: VisitorContext) => Promise<boolean>
```

## `authenticateRequest` (optional)

Protects REST admin routes. Wraps all routes except `GET /widget-config` and `POST /offline-messages`. Return a user object on success or `null` to reject with 401.

```ts
authenticateRequest: async (req: any) => Promise<{ userId: string; permissions?: string[] } | null>
```

## `trackEvent` (optional)

Called when a visitor emits a `chat:track_event` event. Use this to record analytics or forward events to an external service.

```ts
trackEvent: async (event: ChatTrackingEvent) => Promise<void>
```

**Event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Session identifier |
| `visitorId` | `string` | Visitor identifier |
| `eventType` | `string` | Custom event type |
| `description` | `string?` | Optional description |
| `data` | `Record<string, unknown>?` | Optional event data |
| `channel` | `string` | Session channel |
| `timestamp` | `Date` | Event timestamp |

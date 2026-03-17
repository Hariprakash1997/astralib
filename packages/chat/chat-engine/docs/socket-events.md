# Socket.IO Event Reference

The chat engine uses two Socket.IO namespaces: one for visitors (default `/chat`) and one for agents (default `/agent`). Event type definitions are available in [@astralibx/chat-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types).

## Visitor Events (Client to Server)

Emitted by the visitor client on the visitor namespace.

| Event | Value | Payload | Description |
|-------|-------|---------|-------------|
| Connect | `chat:connect` | `{ context: VisitorContext, existingSessionId?: string }` | Initialize or resume a session |
| Message | `chat:message` | `{ content, contentType?, metadata?, tempId? }` | Send a message |
| Typing | `chat:typing` | `{ isTyping: boolean }` | Typing indicator |
| Read | `chat:read` | `{ messageIds: string[] }` | Mark messages as read |
| Escalate | `chat:escalate` | `{ reason?: string }` | Request human agent |
| Identify | `chat:identify` | `Record<string, unknown>` | Identify visitor with custom data |
| Preferences | `chat:set_preferences` | `Record<string, unknown>` | Set session preferences |
| TrackEvent | `chat:track_event` | `{ eventType, description?, data? }` | Track a custom event |
| Ping | `chat:ping` | -- | Keep-alive ping |
| Feedback | `chat:feedback` | `{ rating?: number, survey?: Record<string, unknown> }` | Submit session feedback |

## Server to Visitor Events

Emitted by the server to the visitor namespace.

| Event | Value | Payload | Description |
|-------|-------|---------|-------------|
| Connected | `chat:connected` | `{ sessionId, session, messages, agent?, preferences? }` | Session established |
| Message | `chat:message` | `{ message }` | New message from agent or AI |
| MessageStatus | `chat:message_status` | `{ messageId, status, tempId? }` | Delivery confirmation |
| Typing | `chat:typing` | `{ isTyping: boolean }` | Agent typing indicator |
| Status | `chat:status` | `{ status, agent?, queuePosition? }` | Session status change |
| AgentJoin | `chat:agent:join` | `{ agent: ChatAgentInfo }` | Agent joined the session |
| AgentLeave | `chat:agent:leave` | `{}` | Agent left the session (handed back to AI) |
| Error | `chat:error` | `{ code, message }` | Error notification |
| Pong | `chat:pong` | `{ timestamp: number }` | Ping response |

## Agent Events (Client to Server)

Emitted by the agent client on the agent namespace.

| Event | Value | Payload | Description |
|-------|-------|---------|-------------|
| Connect | `agent:connect` | `{ agentId, token? }` | Agent connects |
| AcceptChat | `agent:accept_chat` | `{ sessionId }` | Accept a waiting chat |
| SendMessage | `agent:send_message` | `{ sessionId, content, contentType?, metadata? }` | Send message to visitor |
| Typing | `agent:typing` | `{ sessionId, isTyping }` | Agent typing indicator |
| ResolveChat | `agent:resolve_chat` | `{ sessionId }` | Resolve/end a chat |
| TakeOver | `agent:take_over` | `{ sessionId }` | Take over from AI |
| HandBack | `agent:hand_back` | `{ sessionId }` | Hand session back to AI |
| SetMode | `agent:set_mode` | `{ sessionId, mode }` | Set session mode (AI/Manual) |
| GetSettings | `agent:get_settings` | -- | Request current settings |
| UpdateSettings | `agent:update_settings` | Settings object | Update global settings |
| SaveMemory | `agent:save_memory` | `{ sessionId, content, key?, category? }` | Save a memory note |
| DeleteMemory | `agent:delete_memory` | `{ sessionId, key }` | Delete a memory note |
| TransferChat | `agent:transfer_chat` | `{ sessionId, targetAgentId, note? }` | Transfer chat to another agent |

## Server to Agent Events

Emitted by the server to the agent namespace.

| Event | Value | Payload | Description |
|-------|-------|---------|-------------|
| Connected | `agent:connected` | `{ stats, waitingChats, assignedChats }` | Connection established with initial data |
| NewChat | `agent:new_chat` | Session summary | New chat waiting for an agent |
| ChatAssigned | `agent:chat_assigned` | `{ session, messages }` | Chat assigned to this agent |
| ChatEnded | `agent:chat_ended` | `{ sessionId }` | Chat resolved or transferred away |
| Message | `agent:message` | `{ sessionId, message }` | New message from visitor |
| VisitorTyping | `agent:visitor_typing` | `{ sessionId, isTyping }` | Visitor typing indicator |
| VisitorDisconnected | `agent:visitor_disconnected` | `{ sessionId }` | Visitor disconnected |
| VisitorReconnected | `agent:visitor_reconnected` | `{ sessionId }` | Visitor reconnected |
| StatsUpdate | `agent:stats_update` | Dashboard stats object | Real-time stats broadcast |
| ModeChanged | `agent:mode_changed` | `{ sessionId, mode, takenOverBy?, agentName? }` | Session mode changed |
| SettingsUpdated | `agent:settings_updated` | `{ settings }` | Settings changed |
| SessionEvent | `agent:session_event` | Session event data | Generic session event broadcast |
| ChatTransferred | `agent:chat_transferred` | `{ session, messages, transferNote? }` | Chat transferred to this agent |

## Error Codes (Socket)

These error codes are emitted via `chat:error` (visitor) or `agent:error` (agent):

| Code | Context | Description |
|------|---------|-------------|
| `AUTH_FAILED` | Visitor/Agent | Authentication rejected by adapter |
| `NO_SESSION` | Visitor | Message sent before connecting |
| `CAPACITY_FULL` | Agent | Agent at max concurrent chats |
| `AI_DISABLED` | Agent | Hand-back attempted but AI mode is not enabled |
| `RATE_LIMIT_EXCEEDED` | Visitor | Too many messages per minute |

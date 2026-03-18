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
| FetchSupportPersons | `chat:fetch_support_persons` | `{ channel?, filters? }` | Request list of available support agents. Only handled when `visitorAgentSelection` setting is enabled. |
| SetPreferredAgent | `chat:set_preferred_agent` | `{ agentId: string }` | Select a preferred agent for the session. Only handled when `visitorAgentSelection` is enabled. Agent must be active and have `visibility: 'public'`. |

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
| SupportPersons | `chat:support_persons` | `{ agents: ChatAgentInfo[] }` | List of available public agents, returned in response to `FetchSupportPersons` |
| AgentDisconnected | `chat:agent_disconnected` | `{ sessionId, agentId, agentName? }` | Assigned agent disconnected. Emitted to each visitor whose agent went offline. |

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
| SendAiMessage | `agent:send_ai_message` | `{ sessionId, content? }` | Trigger AI-generated message for a session. Requires `generateAiResponse` adapter. Creates messages with `senderType: 'ai'`. |
| UpdateStatus | `agent:update_status` | `{ status: AgentStatus }` | Update the agent's availability status (available, busy, away, offline). Triggers a stats broadcast to all agents. Agents with `busy` or `away` status are excluded from capacity checks. |
| LabelMessage | `agent:label_message` | `{ sessionId, messageId, trainingQuality }` | Label a message for training quality (`good`, `bad`, `needs_review`). Only handled when `options.labelingEnabled` is true, silently ignored otherwise. |
| LabelSession | `agent:label_session` | `{ sessionId, trainingQuality }` | Label an entire session for training quality. Stores the label in session metadata. Only handled when `options.labelingEnabled` is true. |

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
| VisitorReconnected | `agent:visitor_reconnected` | `{ sessionId }` | Visitor reconnected after a disconnect (only fires for actual reconnects within the reconnect window, not silent resumes like page refreshes) |
| EscalationNeeded | `agent:escalation_needed` | `{ sessionId, visitorId, reason?, session }` | AI escalated the conversation to a human agent. Broadcast to all connected agents. |
| StatsUpdate | `agent:stats_update` | Dashboard stats object | Real-time stats broadcast |
| ModeChanged | `agent:mode_changed` | `{ sessionId, mode, takenOverBy?, agentName? }` | Session mode changed |
| SettingsUpdated | `agent:settings_updated` | `{ settings }` | Settings changed |
| SessionEvent | `agent:session_event` | Session event data | Generic session event broadcast |
| ChatTransferred | `agent:chat_transferred` | `{ session, messages, transferNote? }` | Chat transferred to this agent |

## AI Typing Simulation and Message Status Flow

When `options.aiTypingSimulation` is enabled, the AI response flow emits delivery and read status events to create a realistic messaging experience. The full sequence is:

1. **Delivered** -- visitor messages are marked as `delivered` and `MessageStatus` events are emitted to the visitor
2. **Delivery delay** -- a random pause (configurable via `options.aiSimulation.deliveryDelay`)
3. **Read** -- visitor messages are marked as `read` and `MessageStatus` events are emitted
4. **Read delay** -- scales with total message length (configurable via `options.aiSimulation.readDelay`)
5. **Pre-typing delay** -- pause before the typing indicator appears (configurable via `options.aiSimulation.preTypingDelay`)
6. **Typing ON** -- typing indicator emitted to visitor
7. **AI generates response** -- the actual AI call happens here
8. **Typing OFF** -- typing indicator cleared
9. **For each response message:**
   - Bubble delay between messages (configurable via `options.aiSimulation.bubbleDelay`)
   - Typing ON, character-based delay, Typing OFF
   - Message sent to visitor

When `aiTypingSimulation` is false, messages are sent immediately with no delays.

## Error Codes (Socket)

These error codes are emitted via `chat:error` (visitor) or `agent:error` (agent):

| Code | Context | Description |
|------|---------|-------------|
| `AUTH_FAILED` | Visitor/Agent | Authentication rejected by adapter |
| `NO_SESSION` | Visitor | Message sent before connecting |
| `CAPACITY_FULL` | Agent | Agent at max concurrent chats |
| `AI_DISABLED` | Agent | Hand-back attempted but AI mode is not enabled |
| `RATE_LIMIT_EXCEEDED` | Visitor | Too many messages per minute |
| `AGENT_UNAVAILABLE` | Visitor | Preferred agent not available (inactive, not public, or not found) |

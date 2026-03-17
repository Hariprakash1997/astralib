# @astralibx/chat-types

Shared TypeScript type definitions, enums, and socket event contracts for the astralib chat ecosystem. This is a pure types package with zero runtime dependencies.

## Installation

```bash
npm install @astralibx/chat-types
```

## Usage

```ts
import {
  ChatSessionStatus,
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
  SessionMode,
  AgentStatus,
  VisitorEvent,
  ServerToVisitorEvent,
  AgentEvent,
  ServerToAgentEvent,
} from '@astralibx/chat-types';

import type {
  ChatMessage,
  ChatSessionSummary,
  ChatAgentInfo,
  ChatWidgetConfig,
  ConnectPayload,
  ConnectedPayload,
  AiResponseInput,
  AiResponseOutput,
} from '@astralibx/chat-types';
```

## Exports

### Enums

| Enum | Values |
|------|--------|
| `ChatSessionStatus` | new, active, waiting_agent, with_agent, resolved, abandoned |
| `ChatSenderType` | visitor, agent, ai, system |
| `ChatContentType` | text, image, file, card, system |
| `ChatMessageStatus` | sending, sent, delivered, read, failed |
| `SessionMode` | ai, manual |
| `AgentStatus` | available, busy, away, offline |

### Event Constants

| Constant | Direction | Prefix |
|----------|-----------|--------|
| `VisitorEvent` | Visitor to Server | `chat:` |
| `ServerToVisitorEvent` | Server to Visitor | `chat:` |
| `AgentEvent` | Agent to Server | `agent:` |
| `ServerToAgentEvent` | Server to Agent | `agent:` |

### Type Categories

**Message types** -- `ChatMessage`, `MessagePayload`, `MessageReceivedPayload`, `MessageStatusPayload`

**Session types** -- `ChatSessionSummary`, `VisitorContext`, `ChatUserInfo`, `SessionStats`, `ChatFeedback`

**Agent types** -- `ChatAgentInfo`, `AgentIdentity`, `DashboardStats`

**Event payloads** -- `ConnectPayload`, `ConnectedPayload`, `TypingPayload`, `StatusPayload`, `AgentConnectedPayload`, `TransferChatPayload`, `ChatTransferredPayload`, `SaveMemoryPayload`, `EscalatePayload`, `TrackEventPayload`, `ChatErrorPayload`, `ModeChangedPayload`, `FeedbackPayload`

**Config types** -- `ChatWidgetConfig`, `ChatWidgetFeatures`, `ChatBranding`, `OfflineConfig`, `PostChatConfig`, `FormField`, `FormFieldValidation`, `ChatTranslations`

**Flow types** -- `PreChatFlowConfig`, `FlowStep`, `WelcomeStep`, `FAQStep`, `FAQCategory`, `FAQItem`, `GuidedQuestionsStep`, `GuidedQuestion`, `GuidedOption`, `FormStep`, `AgentSelectorStep`, `CustomHTMLStep`

**Adapter types** -- `AssignAgentContext`, `AiResponseInput`, `AiResponseOutput`, `MemoryHint`, `VisitorIdentity`, `AgentIdentity`, `ChatTrackingEvent`, `ChatMetric`, `ErrorContext`

## Links

- [Source](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types)
- [Repository](https://github.com/Hariprakash1997/astralib)

## License

MIT

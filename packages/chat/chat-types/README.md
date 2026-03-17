# @astralibx/chat-types

[![npm version](https://img.shields.io/npm/v/@astralibx/chat-types.svg)](https://www.npmjs.com/package/@astralibx/chat-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Shared TypeScript type definitions, enums, and socket event contracts for the astralib chat ecosystem. This is a pure types package with zero runtime dependencies.

## Install

```bash
npm install @astralibx/chat-types
```

## Quick Start

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

## Features

- **Enums** -- Session status, sender type, content type, message status, session mode, agent status. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#enums)
- **Socket event constants** -- Typed `as const` objects for all visitor-server and agent-server event channels. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#event-constants)
- **Message types** -- `ChatMessage`, `MessagePayload`, `MessageReceivedPayload`, `MessageStatusPayload`. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#message-types)
- **Session types** -- `ChatSessionSummary`, `VisitorContext`, `ChatUserInfo`, `SessionStats`, `ChatFeedback`. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#session-types)
- **Agent types** -- `ChatAgentInfo`, `AgentIdentity`, `DashboardStats`. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#agent-types)
- **Event payload types** -- 13 payload interfaces for all socket events (connect, typing, status, transfer, escalate, feedback, etc.). [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#event-payload-types)
- **Config types** -- Widget configuration, features, branding, offline mode, post-chat surveys, translations. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#config-types)
- **Flow types** -- Pre-chat flow configuration with 6 step types: welcome, FAQ, guided questions, form, agent selector, custom HTML. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#flow-types)
- **Adapter types** -- Contracts for agent assignment, AI response, visitor identity, event tracking, metrics, and error context. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md#adapter-types)

## Reference

[Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/docs/types.md) -- Full type, enum, and constant reference

## Links

- [Source](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types)
- [Repository](https://github.com/Hariprakash1997/astralib)

## License

MIT

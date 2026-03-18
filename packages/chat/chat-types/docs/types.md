# Types Reference

Full type, enum, and constant reference for `@astralibx/chat-types`.

## Enums

### ChatSessionStatus

| Key | Value |
|-----|-------|
| `New` | `'new'` |
| `Active` | `'active'` |
| `WaitingAgent` | `'waiting_agent'` |
| `WithAgent` | `'with_agent'` |
| `Resolved` | `'resolved'` |
| `Abandoned` | `'abandoned'` |

### ChatSenderType

| Key | Value |
|-----|-------|
| `Visitor` | `'visitor'` |
| `Agent` | `'agent'` |
| `AI` | `'ai'` |
| `System` | `'system'` |

### ChatContentType

| Key | Value |
|-----|-------|
| `Text` | `'text'` |
| `Image` | `'image'` |
| `File` | `'file'` |
| `Card` | `'card'` |
| `System` | `'system'` |

### ChatMessageStatus

| Key | Value |
|-----|-------|
| `Sending` | `'sending'` |
| `Sent` | `'sent'` |
| `Delivered` | `'delivered'` |
| `Read` | `'read'` |
| `Failed` | `'failed'` |

### SessionMode

| Key | Value |
|-----|-------|
| `AI` | `'ai'` |
| `Manual` | `'manual'` |

### AgentStatus

| Key | Value |
|-----|-------|
| `Available` | `'available'` |
| `Busy` | `'busy'` |
| `Away` | `'away'` |
| `Offline` | `'offline'` |

## Event Constants

All event constants are `as const` objects with string literal values.

### VisitorEvent (Visitor to Server)

| Key | Value |
|-----|-------|
| `Connect` | `'chat:connect'` |
| `Message` | `'chat:message'` |
| `Typing` | `'chat:typing'` |
| `Read` | `'chat:read'` |
| `Escalate` | `'chat:escalate'` |
| `Identify` | `'chat:identify'` |
| `Preferences` | `'chat:set_preferences'` |
| `TrackEvent` | `'chat:track_event'` |
| `Ping` | `'chat:ping'` |
| `Feedback` | `'chat:feedback'` |
| `FetchSupportPersons` | `'chat:fetch_support_persons'` |
| `SetPreferredAgent` | `'chat:set_preferred_agent'` |

### ServerToVisitorEvent (Server to Visitor)

| Key | Value |
|-----|-------|
| `Connected` | `'chat:connected'` |
| `Message` | `'chat:message'` |
| `MessageStatus` | `'chat:message_status'` |
| `Typing` | `'chat:typing'` |
| `Status` | `'chat:status'` |
| `AgentJoin` | `'chat:agent:join'` |
| `AgentLeave` | `'chat:agent:leave'` |
| `Error` | `'chat:error'` |
| `Pong` | `'chat:pong'` |
| `SupportPersons` | `'chat:support_persons'` |
| `AgentDisconnected` | `'chat:agent_disconnected'` |

### AgentEvent (Agent to Server)

| Key | Value |
|-----|-------|
| `Connect` | `'agent:connect'` |
| `AcceptChat` | `'agent:accept_chat'` |
| `SendMessage` | `'agent:send_message'` |
| `Typing` | `'agent:typing'` |
| `ResolveChat` | `'agent:resolve_chat'` |
| `TakeOver` | `'agent:take_over'` |
| `HandBack` | `'agent:hand_back'` |
| `SetMode` | `'agent:set_mode'` |
| `GetSettings` | `'agent:get_settings'` |
| `UpdateSettings` | `'agent:update_settings'` |
| `SaveMemory` | `'agent:save_memory'` |
| `DeleteMemory` | `'agent:delete_memory'` |
| `TransferChat` | `'agent:transfer_chat'` |
| `SendAiMessage` | `'agent:send_ai_message'` |
| `UpdateStatus` | `'agent:update_status'` |
| `LabelMessage` | `'agent:label_message'` |
| `LabelSession` | `'agent:label_session'` |

### ServerToAgentEvent (Server to Agent)

| Key | Value |
|-----|-------|
| `Connected` | `'agent:connected'` |
| `NewChat` | `'agent:new_chat'` |
| `ChatAssigned` | `'agent:chat_assigned'` |
| `ChatEnded` | `'agent:chat_ended'` |
| `Message` | `'agent:message'` |
| `VisitorTyping` | `'agent:visitor_typing'` |
| `VisitorDisconnected` | `'agent:visitor_disconnected'` |
| `VisitorReconnected` | `'agent:visitor_reconnected'` |
| `StatsUpdate` | `'agent:stats_update'` |
| `ModeChanged` | `'agent:mode_changed'` |
| `SettingsUpdated` | `'agent:settings_updated'` |
| `SessionEvent` | `'agent:session_event'` |
| `ChatTransferred` | `'agent:chat_transferred'` |
| `EscalationNeeded` | `'agent:escalation_needed'` |

## Message Types

### ChatMessage

| Field | Type | Required |
|-------|------|----------|
| `_id` | `string` | Yes |
| `messageId` | `string` | Yes |
| `sessionId` | `string` | Yes |
| `senderType` | `ChatSenderType` | Yes |
| `senderName` | `string` | No |
| `content` | `string` | Yes |
| `contentType` | `ChatContentType` | Yes |
| `status` | `ChatMessageStatus` | Yes |
| `metadata` | `Record<string, unknown>` | No |
| `createdAt` | `Date` | Yes |
| `deliveredAt` | `Date` | No |
| `readAt` | `Date` | No |

### MessagePayload

| Field | Type | Required |
|-------|------|----------|
| `content` | `string` | Yes |
| `contentType` | `ChatContentType` | No |
| `tempId` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### MessageReceivedPayload

| Field | Type | Required |
|-------|------|----------|
| `message` | `ChatMessage` | Yes |
| `tempId` | `string` | No |

### MessageStatusPayload

| Field | Type | Required |
|-------|------|----------|
| `messageId` | `string` | Yes |
| `status` | `ChatMessageStatus` | Yes |
| `deliveredAt` | `Date` | No |
| `readAt` | `Date` | No |

## Session Types

### ChatSessionSummary

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `status` | `ChatSessionStatus` | Yes |
| `mode` | `SessionMode` | Yes |
| `visitorId` | `string` | Yes |
| `visitorName` | `string` | No |
| `agentId` | `string` | No |
| `agentName` | `string` | No |
| `messageCount` | `number` | Yes |
| `lastMessageAt` | `Date` | No |
| `startedAt` | `Date` | Yes |
| `endedAt` | `Date` | No |
| `channel` | `string` | No |
| `queuePosition` | `number` | No |
| `metadata` | `Record<string, unknown>` | No |

### VisitorContext

| Field | Type | Required |
|-------|------|----------|
| `visitorId` | `string` | Yes |
| `fingerprint` | `string` | No |
| `channel` | `string` | Yes |
| `userAgent` | `string` | No |
| `page` | `string` | No |
| `referrer` | `string` | No |
| `user` | `ChatUserInfo` | No |
| `metadata` | `Record<string, unknown>` | No |

### ChatUserInfo

| Field | Type | Required |
|-------|------|----------|
| `userId` | `string` | No |
| `name` | `string` | No |
| `email` | `string` | No |
| `avatar` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### SessionStats

| Field | Type | Required |
|-------|------|----------|
| `totalMessages` | `number` | Yes |
| `visitorMessages` | `number` | Yes |
| `agentMessages` | `number` | Yes |
| `aiMessages` | `number` | Yes |
| `durationMs` | `number` | Yes |

### ChatFeedback

| Field | Type | Required |
|-------|------|----------|
| `rating` | `number` | No |
| `survey` | `Record<string, unknown>` | No |
| `submittedAt` | `Date` | No |

## Agent Types

### ChatAgentInfo

| Field | Type | Required |
|-------|------|----------|
| `agentId` | `string` | Yes |
| `name` | `string` | Yes |
| `avatar` | `string` | No |
| `role` | `string` | No |
| `status` | `AgentStatus` | Yes |
| `isAI` | `boolean` | Yes |

### AgentIdentity

| Field | Type | Required |
|-------|------|----------|
| `adminUserId` | `string` | Yes |
| `displayName` | `string` | Yes |
| `avatar` | `string` | No |
| `permissions` | `string[]` | No |

### DashboardStats

| Field | Type | Required |
|-------|------|----------|
| `activeSessions` | `number` | Yes |
| `waitingSessions` | `number` | Yes |
| `resolvedToday` | `number` | Yes |
| `totalAgents` | `number` | Yes |
| `activeAgents` | `number` | Yes |

## Event Payload Types

### ConnectPayload

| Field | Type | Required |
|-------|------|----------|
| `context` | `VisitorContext` | Yes |
| `existingSessionId` | `string` | No |

### ConnectedPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `session` | `ChatSessionSummary` | Yes |
| `messages` | `ChatMessage[]` | Yes |
| `agent` | `ChatAgentInfo` | No |
| `preferences` | `Record<string, unknown>` | No |

### TypingPayload

| Field | Type | Required |
|-------|------|----------|
| `isTyping` | `boolean` | Yes |
| `sessionId` | `string` | No |

### StatusPayload

| Field | Type | Required |
|-------|------|----------|
| `status` | `ChatSessionStatus` | Yes |
| `agent` | `ChatAgentInfo` | No |
| `queuePosition` | `number` | No |

### AgentConnectedPayload

| Field | Type | Required |
|-------|------|----------|
| `stats` | `DashboardStats` | Yes |
| `waitingChats` | `ChatSessionSummary[]` | Yes |
| `assignedChats` | `ChatSessionSummary[]` | Yes |

### TransferChatPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `targetAgentId` | `string` | Yes |
| `note` | `string` | No |

### ChatTransferredPayload

| Field | Type | Required |
|-------|------|----------|
| `session` | `ChatSessionSummary` | Yes |
| `messages` | `ChatMessage[]` | Yes |
| `transferNote` | `string` | No |

### SaveMemoryPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `content` | `string` | Yes |
| `key` | `string` | No |
| `category` | `string` | No |

### EscalatePayload

| Field | Type | Required |
|-------|------|----------|
| `reason` | `string` | No |

### TrackEventPayload

| Field | Type | Required |
|-------|------|----------|
| `eventType` | `string` | Yes |
| `description` | `string` | No |
| `data` | `Record<string, unknown>` | No |

### ChatErrorPayload

| Field | Type | Required |
|-------|------|----------|
| `code` | `string` | Yes |
| `message` | `string` | Yes |

### ModeChangedPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `mode` | `SessionMode` | Yes |
| `takenOverBy` | `string` | No |
| `agentName` | `string` | No |

### FeedbackPayload

| Field | Type | Required |
|-------|------|----------|
| `rating` | `number` | No |
| `survey` | `Record<string, unknown>` | No |

### FetchSupportPersonsPayload

| Field | Type | Required |
|-------|------|----------|
| `channel` | `string` | No |
| `filters` | `Record<string, unknown>` | No |

### SupportPersonsPayload

| Field | Type | Required |
|-------|------|----------|
| `agents` | `ChatAgentInfo[]` | Yes |

### SetPreferredAgentPayload

| Field | Type | Required |
|-------|------|----------|
| `agentId` | `string` | Yes |

### SendAiMessagePayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `content` | `string` | No |

### EscalationNeededPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `visitorId` | `string` | Yes |
| `reason` | `string` | No |
| `session` | `ChatSessionSummary` | Yes |

### AgentDisconnectedPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `agentId` | `string` | Yes |
| `agentName` | `string` | No |

### LabelMessagePayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `messageId` | `string` | Yes |
| `trainingQuality` | `'good' \| 'bad' \| 'needs_review'` | Yes |

### LabelSessionPayload

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `trainingQuality` | `'good' \| 'bad' \| 'needs_review'` | Yes |

### UpdateStatusPayload

| Field | Type | Required |
|-------|------|----------|
| `status` | `AgentStatus` | Yes |

## Config Types

### ChatWidgetConfig

| Field | Type | Required |
|-------|------|----------|
| `socketUrl` | `string` | Yes |
| `channel` | `string` | Yes |
| `theme` | `'light' \| 'dark'` | No |
| `position` | `'bottom-right' \| 'bottom-left'` | No |
| `locale` | `string` | No |
| `translations` | `Partial<ChatTranslations>` | No |
| `preChatFlow` | `PreChatFlowConfig` | No |
| `features` | `ChatWidgetFeatures` | No |
| `branding` | `ChatBranding` | No |
| `user` | `ChatUserInfo` | No |
| `offline` | `OfflineConfig` | No |
| `postChat` | `PostChatConfig` | No |
| `configEndpoint` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### ChatWidgetFeatures

| Field | Type | Required |
|-------|------|----------|
| `soundNotifications` | `boolean` | No |
| `desktopNotifications` | `boolean` | No |
| `typingIndicator` | `boolean` | No |
| `readReceipts` | `boolean` | No |
| `autoOpen` | `boolean` | No |
| `autoOpenDelayMs` | `number` | No |
| `liveChatEnabled` | `boolean` | No |

### ChatBranding

| Field | Type | Required |
|-------|------|----------|
| `primaryColor` | `string` | No |
| `companyName` | `string` | No |
| `logoUrl` | `string` | No |

### OfflineConfig

| Field | Type | Required |
|-------|------|----------|
| `mode` | `'form' \| 'message' \| 'hide'` | Yes |
| `formFields` | `FormField[]` | No |
| `offlineMessage` | `string` | No |
| `offlineTitle` | `string` | No |

### PostChatConfig

| Field | Type | Required |
|-------|------|----------|
| `enabled` | `boolean` | Yes |
| `type` | `'rating' \| 'survey'` | Yes |
| `ratingQuestion` | `string` | No |
| `surveyFields` | `FormField[]` | No |
| `thankYouMessage` | `string` | No |

### ChatTranslations

| Field | Type | Required |
|-------|------|----------|
| `welcomeTitle` | `string` | Yes |
| `welcomeSubtitle` | `string` | Yes |
| `inputPlaceholder` | `string` | Yes |
| `sendButton` | `string` | Yes |
| `endChatButton` | `string` | Yes |
| `[key: string]` | `string` | -- |

## Flow Types

### PreChatFlowConfig

| Field | Type | Required |
|-------|------|----------|
| `enabled` | `boolean` | Yes |
| `steps` | `FlowStep[]` | Yes |
| `skipToChat` | `boolean` | No |
| `completionAction` | `'chat' \| 'close' \| 'url'` | Yes |
| `completionUrl` | `string` | No |

### FlowStep (union type)

`WelcomeStep | FAQStep | GuidedQuestionsStep | FormStep | AgentSelectorStep | CustomHTMLStep`

### WelcomeStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'welcome'` | Yes |
| `title` | `string` | Yes |
| `subtitle` | `string` | No |
| `agentAvatar` | `string` | No |
| `agentName` | `string` | No |
| `showOnlineStatus` | `boolean` | No |
| `ctaText` | `string` | No |

### FAQStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'faq'` | Yes |
| `title` | `string` | No |
| `searchEnabled` | `boolean` | No |
| `categories` | `FAQCategory[]` | No |
| `items` | `FAQItem[]` | Yes |
| `feedbackEnabled` | `boolean` | No |
| `showChatPrompt` | `boolean` | No |
| `chatPromptText` | `string` | No |

### FAQCategory

| Field | Type | Required |
|-------|------|----------|
| `key` | `string` | Yes |
| `label` | `string` | Yes |
| `icon` | `string` | No |

### FAQItem

| Field | Type | Required |
|-------|------|----------|
| `question` | `string` | Yes |
| `answer` | `string` | Yes |
| `category` | `string` | No |
| `tags` | `string[]` | No |
| `order` | `number` | No |

### GuidedQuestionsStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'guided'` | Yes |
| `questions` | `GuidedQuestion[]` | Yes |
| `mode` | `'sequential' \| 'conversational'` | Yes |
| `typingDelayMs` | `number` | No |

### GuidedQuestion

| Field | Type | Required |
|-------|------|----------|
| `key` | `string` | Yes |
| `text` | `string` | Yes |
| `options` | `GuidedOption[]` | Yes |
| `allowFreeText` | `boolean` | No |
| `multiSelect` | `boolean` | No |

### GuidedOption

| Field | Type | Required |
|-------|------|----------|
| `value` | `string` | Yes |
| `label` | `string` | Yes |
| `icon` | `string` | No |
| `description` | `string` | No |
| `nextQuestion` | `string` | No |
| `skipToStep` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### FormStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'form'` | Yes |
| `title` | `string` | No |
| `fields` | `FormField[]` | Yes |
| `submitText` | `string` | No |

### FormField

| Field | Type | Required |
|-------|------|----------|
| `key` | `string` | Yes |
| `label` | `string` | Yes |
| `type` | `'text' \| 'email' \| 'phone' \| 'select' \| 'multiselect' \| 'textarea' \| 'radio' \| 'checkbox'` | Yes |
| `placeholder` | `string` | No |
| `options` | `{ value: string; label: string }[]` | No |
| `required` | `boolean` | No |
| `validation` | `FormFieldValidation` | No |

### FormFieldValidation

| Field | Type | Required |
|-------|------|----------|
| `pattern` | `string` | No |
| `minLength` | `number` | No |
| `maxLength` | `number` | No |
| `errorMessage` | `string` | No |

### AgentSelectorStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'agent-selector'` | Yes |
| `title` | `string` | No |
| `showAvailability` | `boolean` | No |
| `showSpecialty` | `boolean` | No |
| `autoAssign` | `boolean` | No |
| `autoAssignText` | `string` | No |

### CustomHTMLStep

| Field | Type | Required |
|-------|------|----------|
| `type` | `'custom'` | Yes |
| `html` | `string` | Yes |
| `ctaText` | `string` | No |

## Adapter Types

### AssignAgentContext

| Field | Type | Required |
|-------|------|----------|
| `visitorId` | `string` | Yes |
| `channel` | `string` | Yes |
| `preferences` | `Record<string, unknown>` | No |
| `metadata` | `Record<string, unknown>` | No |

### AiResponseInput

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `visitorId` | `string` | Yes |
| `messages` | `ChatMessage[]` | Yes |
| `agent` | `ChatAgentInfo` | Yes |
| `visitorContext` | `VisitorContext` | Yes |
| `conversationSummary` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### AiResponseOutput

| Field | Type | Required |
|-------|------|----------|
| `messages` | `string[]` | Yes |
| `conversationSummary` | `string` | No |
| `shouldEscalate` | `boolean` | No |
| `escalationReason` | `string` | No |
| `extracted` | `Record<string, unknown>` | No |
| `memoryHints` | `MemoryHint[]` | No |
| `metadata` | `Record<string, unknown>` | No |

### MemoryHint

| Field | Type | Required |
|-------|------|----------|
| `key` | `string` | Yes |
| `content` | `string` | Yes |
| `category` | `string` | No |
| `confidence` | `number` | Yes |

### VisitorIdentity

| Field | Type | Required |
|-------|------|----------|
| `userId` | `string` | Yes |
| `name` | `string` | No |
| `email` | `string` | No |
| `avatar` | `string` | No |
| `metadata` | `Record<string, unknown>` | No |

### ChatTrackingEvent

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | Yes |
| `visitorId` | `string` | Yes |
| `eventType` | `string` | Yes |
| `description` | `string` | No |
| `data` | `Record<string, unknown>` | No |
| `channel` | `string` | Yes |
| `timestamp` | `Date` | Yes |

### ChatMetric

| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | Yes |
| `value` | `number` | Yes |
| `labels` | `Record<string, string>` | Yes |

### ErrorContext

| Field | Type | Required |
|-------|------|----------|
| `sessionId` | `string` | No |
| `visitorId` | `string` | No |
| `agentId` | `string` | No |
| `event` | `string` | No |
| `[key: string]` | `unknown` | -- |

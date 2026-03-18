# Components

All components are Lit web components. Import the package entry point to register all custom elements, or import individual components by path.

## Dashboard

| Component | Tag | Description |
|---|---|---|
| `AlxChatDashboard` | `alx-chat-dashboard` | Full dashboard with hash-based tab routing |

The dashboard is the main entry point. It renders all other components in a tabbed layout with automatic hash-based routing.

```html
<alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
```

## Sessions

| Component | Tag | Description |
|---|---|---|
| `AlxChatSessionList` | `alx-chat-session-list` | Paginated session list with filters |
| `AlxChatSessionMessages` | `alx-chat-session-messages` | Message thread viewer with cursor pagination |
| `AlxChatSessionDetail` | `alx-chat-session-detail` | Session metadata and visitor info panel |

## Agents

| Component | Tag | Description |
|---|---|---|
| `AlxChatAgentList` | `alx-chat-agent-list` | Agent table with status and actions |
| `AlxChatAgentForm` | `alx-chat-agent-form` | Create/edit agent drawer |
| `AlxChatAgentDashboard` | `alx-chat-agent-dashboard` | Real-time agent chat interface (Socket.IO) |

The agent dashboard (`<alx-chat-agent-dashboard>`) connects to the Socket.IO agent namespace for real-time chat. It requires `socket.io-client` as a peer dependency.

The component:
- Connects to `socketUrl + agentNamespace` from AlxChatConfig
- Three-pane layout: session list (left), messages (center), details (right)
- Receives new chats, messages, typing indicators in real-time
- Canned response autocomplete: type `/` in the message input
- Transfer and resolve actions in the header

If `socket.io-client` is not installed, the component renders without real-time features.

## Memory

| Component | Tag | Description |
|---|---|---|
| `AlxChatMemoryList` | `alx-chat-memory-list` | Memory entries with filters and bulk actions |
| `AlxChatMemoryForm` | `alx-chat-memory-form` | Create/edit memory drawer |

## Prompts

| Component | Tag | Description |
|---|---|---|
| `AlxChatPromptList` | `alx-chat-prompt-list` | Prompt template list |
| `AlxChatPromptEditor` | `alx-chat-prompt-editor` | Visual prompt section editor |

## Knowledge

| Component | Tag | Description |
|---|---|---|
| `AlxChatKnowledgeList` | `alx-chat-knowledge-list` | Knowledge base CRUD |
| `AlxChatKnowledgeForm` | `alx-chat-knowledge-form` | Create/edit knowledge drawer |

## Content

| Component | Tag | Description |
|---|---|---|
| `AlxChatFaqEditor` | `alx-chat-faq-editor` | FAQ management with reordering |
| `AlxChatFlowEditor` | `alx-chat-flow-editor` | Pre-chat flow configurator |
| `AlxChatCannedResponseList` | `alx-chat-canned-response-list` | Canned response CRUD |

## Analytics

| Component | Tag | Description |
|---|---|---|
| `AlxChatStats` | `alx-chat-stats` | Dashboard statistics cards (auto-refresh) |
| `AlxChatFeedbackStats` | `alx-chat-feedback-stats` | Rating distribution and average |
| `AlxChatOfflineMessages` | `alx-chat-offline-messages` | Offline message inbox |

## Settings

| Component | Tag | Description |
|---|---|---|
| `AlxChatSettings` | `alx-chat-settings` | Global chat settings |

## Usage

### Full dashboard

```html
<alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
```

### Individual components

```html
<alx-chat-session-list></alx-chat-session-list>
<alx-chat-agent-dashboard></alx-chat-agent-dashboard>
```

### Using Components Independently

All components can be used independently without the dashboard wrapper. Each component fetches its own data via the internal HttpClient.

Components are self-contained -- they do not communicate with each other. If you need coordination (e.g., selecting a session in a list updates a detail panel), wire it yourself via event listeners:

```html
<alx-chat-session-list @session-selected=${(e) => {
  document.querySelector('alx-chat-session-detail').sessionId = e.detail.sessionId;
}}>
</alx-chat-session-list>
<alx-chat-session-detail></alx-chat-session-detail>
```

### Density attribute

All components support a `density` attribute for compact layouts:

```html
<alx-chat-session-list density="compact"></alx-chat-session-list>
```

| Density | Padding | Gap | Font Size | Row Height |
|---------|---------|-----|-----------|------------|
| default | `0.5rem` | `0.75rem` | `0.8125rem` | `2.25rem` |
| `compact` | `0.3rem` | `0.4rem` | `0.75rem` | `1.625rem` |

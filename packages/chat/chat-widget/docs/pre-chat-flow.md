# Pre-Chat Flow

The widget includes a configurable pre-chat funnel that visitors pass through before entering live chat. Steps are optional and order is configurable.

## Basic Setup

```ts
widget.configure({
  socketUrl: 'https://chat.example.com',
  channel: 'website',
  preChatFlow: {
    enabled: true,
    skipToChat: true,
    completionAction: 'chat',
    steps: [
      // ... step definitions
    ],
  },
});
```

| Key | Type | Description |
|-----|------|-------------|
| `enabled` | `boolean` | Enable the pre-chat flow |
| `skipToChat` | `boolean` | Allow visitors to skip directly to chat |
| `completionAction` | `'chat' \| 'close'` | Action after completing all steps |
| `steps` | `array` | Ordered list of step definitions |

## Step Types

### Welcome Step

Introductory screen with optional online status indicator.

```ts
{
  type: 'welcome',
  title: 'Hi there!',
  subtitle: 'How can we help you today?',
  showOnlineStatus: true,
}
```

| Key | Type | Description |
|-----|------|-------------|
| `type` | `'welcome'` | Step type identifier |
| `title` | `string` | Heading text |
| `subtitle` | `string` | Subheading text |
| `showOnlineStatus` | `boolean` | Show agent online/offline status |

### FAQ Step

Searchable FAQ section with categories and feedback collection.

```ts
{
  type: 'faq',
  searchEnabled: true,
  feedbackEnabled: true,
  categories: [
    { key: 'billing', label: 'Billing', icon: '...' },
    { key: 'technical', label: 'Technical', icon: '...' },
  ],
  items: [
    {
      question: 'How do I reset my password?',
      answer: 'Go to Settings > Security...',
      category: 'technical',
    },
  ],
}
```

| Key | Type | Description |
|-----|------|-------------|
| `type` | `'faq'` | Step type identifier |
| `searchEnabled` | `boolean` | Enable FAQ search |
| `feedbackEnabled` | `boolean` | Enable helpful/not helpful feedback on answers |
| `showChatPrompt` | `boolean` | Show a prompt to start live chat (set `false` for FAQ-only mode) |
| `categories` | `array` | Category definitions with `key`, `label`, and `icon` |
| `items` | `array` | FAQ entries with `question`, `answer`, and `category` |

### Guided Step

Sequential or branching question flow with routing logic.

```ts
{
  type: 'guided',
  mode: 'sequential',
  questions: [
    {
      key: 'topic',
      text: 'What do you need help with?',
      options: [
        { value: 'billing', label: 'Billing', nextQuestion: 'billing_type' },
        { value: 'technical', label: 'Technical', skipToStep: 'chat' },
      ],
    },
  ],
}
```

| Key | Type | Description |
|-----|------|-------------|
| `type` | `'guided'` | Step type identifier |
| `mode` | `'sequential'` | Question presentation mode |
| `questions` | `array` | Question definitions |
| `questions[].key` | `string` | Unique question identifier |
| `questions[].text` | `string` | Question text |
| `questions[].options` | `array` | Answer options |
| `questions[].options[].value` | `string` | Option value |
| `questions[].options[].label` | `string` | Option display label |
| `questions[].options[].nextQuestion` | `string` | Key of the next question to show |
| `questions[].options[].skipToStep` | `string` | Skip to a named step (e.g., `'chat'`) |

### Form Step

Collect visitor information before starting chat.

```ts
{
  type: 'form',
  title: 'Quick info before we connect you',
  fields: [
    { key: 'name', label: 'Your Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
  ],
}
```

| Key | Type | Description |
|-----|------|-------------|
| `type` | `'form'` | Step type identifier |
| `title` | `string` | Form heading |
| `fields` | `array` | Form field definitions |
| `fields[].key` | `string` | Field identifier |
| `fields[].label` | `string` | Field label |
| `fields[].type` | `'text' \| 'email' \| 'textarea'` | Input type |
| `fields[].required` | `boolean` | Whether the field is required |

### Agent Selector Step

Let visitors choose an agent or auto-assign based on availability.

```ts
{
  type: 'agent-selector',
  title: 'Choose who to talk to',
  showAvailability: true,
  autoAssign: true,
}
```

| Key | Type | Description |
|-----|------|-------------|
| `type` | `'agent-selector'` | Step type identifier |
| `title` | `string` | Selector heading |
| `showAvailability` | `boolean` | Show agent online/offline status |
| `autoAssign` | `boolean` | Auto-assign if only one agent is available |

## FAQ-Only Mode (No Live Chat)

Use the pre-chat flow as a standalone help center without live chat:

```ts
widget.configure({
  preChatFlow: {
    enabled: true,
    completionAction: 'close',
    skipToChat: false,
    steps: [
      { type: 'welcome', title: 'Help Center' },
      { type: 'faq', items: [...], showChatPrompt: false },
    ],
  },
});
```

Set `completionAction: 'close'` and `skipToChat: false` to prevent visitors from entering live chat. Set `showChatPrompt: false` on the FAQ step to hide the chat prompt.

# Prompt Templates

Templates are composed of ordered sections that build the final system prompt sent to the AI provider.

## Creating a Template

```ts
await ai.prompts.create({
  name: 'Sales Agent',
  isDefault: true,
  sections: [
    { key: 'identity', label: 'Identity', content: 'You are {{agentName}}.', position: 1, isEnabled: true, isSystem: false, variables: ['agentName'] },
    { key: 'memory_injection', label: 'Memories', content: '', position: 2, isEnabled: true, isSystem: true },
    { key: 'knowledge_injection', label: 'Knowledge', content: '', position: 3, isEnabled: true, isSystem: true },
    { key: 'conversation_history', label: 'History', content: '', position: 4, isEnabled: true, isSystem: true },
    { key: 'rules', label: 'Rules', content: 'Never discuss pricing.', position: 5, isEnabled: true, isSystem: false },
  ],
});
```

## Section Types

### System Sections

System sections are auto-populated by chat-ai during response generation. Their `content` field is ignored -- the library fills them at runtime.

| Key | What gets injected |
|-----|--------------------|
| `memory_injection` | Relevant memories based on scope and search strategy |
| `knowledge_injection` | Knowledge entries matching the conversation context |
| `conversation_history` | Recent conversation messages |

### User Sections

User sections contain your custom content. They support Handlebars-style variables.

```ts
{
  key: 'identity',
  label: 'Identity',
  content: 'You are {{agentName}}, a {{role}} at {{company}}.',
  position: 1,
  isEnabled: true,
  isSystem: false,
  variables: ['agentName', 'role', 'company'],
}
```

Variables are resolved at render time from the context passed to `generateResponse`.

## Section Properties

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Unique identifier for the section |
| `label` | `string` | Display name |
| `content` | `string` | Template content (ignored for system sections) |
| `position` | `number` | Order in the final prompt (ascending) |
| `isEnabled` | `boolean` | Whether to include this section |
| `isSystem` | `boolean` | Whether the library auto-populates this section |
| `variables` | `string[]` | Handlebars variables used in content |

## Default Template

Set a template as the default for all conversations:

```ts
// REST
POST /prompts/:templateId/default

// Programmatic
await ai.prompts.setDefault(templateId);
```

Only one template can be default at a time.

## Preview

Preview a rendered prompt without sending it to the AI:

```ts
// REST
POST /prompts/preview

// Programmatic
await ai.prompts.preview({ templateId, variables: { agentName: 'Alice' } });
```

## Ordering

Sections are assembled in `position` order (ascending). Disabled sections (`isEnabled: false`) are skipped entirely.

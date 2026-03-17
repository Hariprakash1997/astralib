# Error Handling

chat-ai uses typed error classes with codes for every failure scenario.

## Error Classes

### NoProviderConfiguredError

Thrown when `ai.generateResponse()` is called but no `chat.generate` function was provided in the config.

```ts
const ai = createChatAI({
  db: { connection },
  // No chat config
});

ai.generateResponse(); // throws NoProviderConfiguredError
```

This is expected in "no provider mode" where you only use memory, prompt, and knowledge management without AI generation.

## Error Handling Pattern

All errors are standard JavaScript Error subclasses with additional properties:

```ts
try {
  await ai.generateResponse(context);
} catch (err) {
  if (err instanceof NoProviderConfiguredError) {
    // No AI provider configured
  }
  // Handle other errors
}
```

## REST API Errors

REST routes return standard HTTP error responses. Validation errors return `400`, not-found errors return `404`, and internal errors return `500`.

# Webhooks

Webhooks let you receive HTTP POST notifications when events occur in the chat engine. Register a webhook URL, subscribe to events, and your endpoint receives a JSON payload with HMAC signature verification.

## Available Events

| Event | Constant | Trigger |
|-------|----------|---------|
| `chat.started` | `WEBHOOK_EVENT.ChatStarted` | New chat session created |
| `chat.ended` | `WEBHOOK_EVENT.ChatEnded` | Session resolved or closed |
| `chat.escalated` | `WEBHOOK_EVENT.ChatEscalated` | Visitor escalated from AI to human agent |
| `message.sent` | `WEBHOOK_EVENT.MessageSent` | Agent or AI sends a message |
| `message.received` | `WEBHOOK_EVENT.MessageReceived` | Visitor sends a message |
| `agent.assigned` | `WEBHOOK_EVENT.AgentAssigned` | Agent assigned to a session |
| `agent.transferred` | `WEBHOOK_EVENT.AgentTransferred` | Session transferred between agents |
| `rating.submitted` | `WEBHOOK_EVENT.RatingSubmitted` | Visitor submits a rating/feedback |

## API

All webhook routes are under `/webhooks` on the engine router.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhooks` | List all registered webhooks |
| `POST` | `/webhooks` | Register a new webhook |
| `PUT` | `/webhooks/:id` | Update a webhook |
| `DELETE` | `/webhooks/:id` | Remove a webhook |
| `POST` | `/webhooks/retry` | Retry all failed deliveries |

### Register a Webhook

```ts
// POST /webhooks
const response = await fetch('/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ...' },
  body: JSON.stringify({
    url: 'https://myapp.com/webhooks/chat',
    events: ['chat.started', 'chat.ended', 'message.received'],
    secret: 'whsec_my-signing-secret', // optional, enables HMAC signatures
    description: 'Main chat webhook',
  }),
});
```

## Payload Structure

Every webhook delivery is a POST request with this JSON body:

```json
{
  "event": "chat.started",
  "payload": {
    "sessionId": "abc-123",
    "visitorId": "visitor-456",
    "channel": "web"
  },
  "timestamp": "2026-03-20T10:30:00.000Z"
}
```

**Headers sent with every delivery:**

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Webhook-Event` | Event name (e.g., `chat.started`) |
| `X-Webhook-Signature` | HMAC-SHA256 hex digest (only if `secret` is set) |

## HMAC Signature Verification

When you register a webhook with a `secret`, every delivery includes an `X-Webhook-Signature` header. The signature is an HMAC-SHA256 hex digest of the raw JSON body using your secret as the key.

**Verification example (Node.js):**

```ts
import crypto from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';

const WEBHOOK_SECRET = 'whsec_my-signing-secret';

// Use express.raw() or capture raw body in verify callback
app.use('/webhooks', express.json({
  verify: (req, res, buf) => {
    (req as any).rawBody = buf;
  }
}));

function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-webhook-signature'] as string;
  if (!signature) return false;

  // Then verify with raw body
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update((req as any).rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

app.post('/webhooks/chat', (req: Request, res: Response) => {
  if (!verifyWebhookSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, payload } = req.body;
  console.log(`Received ${event}:`, payload);

  res.status(200).json({ ok: true });
});
```

**Important:** Always verify signatures against the raw request body bytes, not `JSON.stringify(req.body)`. If your framework parses and re-serializes the body, whitespace or key ordering differences will cause the signature to not match. The `verify` callback on `express.json()` captures the raw buffer before parsing.

## Retry Logic

- Deliveries that fail (non-2xx response or network error) are stored as failed deliveries on the webhook document.
- Each failed delivery is retried up to **3 times**.
- After 3 failed attempts, the delivery is dropped and a warning is logged.
- Only the last 50 failed deliveries are retained per webhook to prevent unbounded growth.
- Call `POST /webhooks/retry` to manually trigger a retry cycle for all failed deliveries.
- Delivery timeout is **10 seconds** per request.

## Disabling a Webhook

Update the webhook with `isActive: false` to pause deliveries without deleting it:

```ts
// PUT /webhooks/:id
await fetch(`/webhooks/${webhookId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ...' },
  body: JSON.stringify({ isActive: false }),
});
```

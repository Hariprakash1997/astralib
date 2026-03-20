# Adapters

Adapters are callback functions passed in the `adapters` config object. They let you plug in custom logic for agent assignment, AI responses, authentication, visitor identification, file storage, and event tracking.

All adapters are optional. Omit the entire `adapters` object for solo mode (no agents, no AI).

## `assignAgent`

Determines which agent should handle a new or escalated session. Return an agent info object to assign immediately, or `null` to queue the session.

```ts
assignAgent: async (context: AssignAgentContext) => Promise<ChatAgentInfo | null>
```

**Context fields:**

| Field | Type | Description |
|-------|------|-------------|
| `context.visitorId` | `string` | Visitor identifier |
| `context.channel` | `string` | Channel the session originated from |
| `context.preferences` | `Record<string, unknown>` | Visitor preferences/metadata |

**Called when:**
- A new session is created (if `autoAssignEnabled` is true in settings)
- A visitor escalates from AI to human agent

**Example -- least-busy agent selection:**

```ts
adapters: {
  assignAgent: async (context) => {
    const agents = await agentService.list();
    const online = agents.filter(a => a.isOnline && a.isActive);
    if (online.length === 0) return null; // queue the session

    // Pick the agent with the fewest active chats
    const sorted = online.sort((a, b) => a.activeChats - b.activeChats);
    const best = sorted[0];

    if (best.activeChats >= best.maxConcurrentChats) return null; // all at capacity

    return {
      agentId: best._id.toString(),
      displayName: best.name,
      avatar: best.avatar,
    };
  },
}
```

**Error handling:** If the adapter throws, the session is created without an agent (queued). The error is logged and the `onError` hook fires.

## `generateAiResponse`

Generates an AI response for a visitor message. Only called when the session is in AI mode and AI is enabled (globally or per-agent).

```ts
generateAiResponse: async (input: AiResponseInput) => Promise<AiResponseOutput>
```

The engine handles debouncing (`aiDebounceMs`) and typing simulation (`aiTypingSimulation`, `aiTypingSpeedCpm`) automatically. You only need to call your AI provider and return the response.

**Example -- OpenAI integration:**

```ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

adapters: {
  generateAiResponse: async (input) => {
    const messages = input.history.map(msg => ({
      role: msg.senderType === 'visitor' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: input.systemPrompt || 'You are a helpful support agent.' },
        ...messages,
        { role: 'user', content: input.message },
      ],
      max_tokens: 500,
    });

    return {
      content: completion.choices[0].message.content || 'Sorry, I could not generate a response.',
    };
  },
}
```

**Example -- Groq integration:**

```ts
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

adapters: {
  generateAiResponse: async (input) => {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: input.systemPrompt || 'You are a helpful support agent.' },
        { role: 'user', content: input.message },
      ],
    });

    return { content: completion.choices[0].message.content || '' };
  },
}
```

**Error handling:** If the adapter throws, the AI response is skipped and the `onAiRequest` hook fires with `stage: 'failed'`. The visitor sees no response (not an error message).

## `authenticateAgent`

Validates an agent's WebSocket connection token. Return an `AgentIdentity` on success or `null` to reject the connection.

```ts
authenticateAgent: async (token: string) => Promise<AgentIdentity | null>
```

**Called when:** An agent connects to the agent WebSocket namespace. The token is taken from the `auth.token` field of the socket handshake.

If this adapter is not provided, agent connections are accepted without authentication.

**Example -- JWT authentication:**

```ts
import jwt from 'jsonwebtoken';

adapters: {
  authenticateAgent: async (token) => {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        sub: string;
        name: string;
        role: string;
      };
      return {
        adminUserId: payload.sub,
        displayName: payload.name,
      };
    } catch {
      return null; // invalid token — reject connection
    }
  },
}
```

## `authenticateVisitor`

Validates a visitor's WebSocket connection. Return `true` to allow or `false` to reject (socket is disconnected).

```ts
authenticateVisitor: async (context: VisitorContext) => Promise<boolean>
```

**Example -- origin check:**

```ts
adapters: {
  authenticateVisitor: async (context) => {
    const allowedOrigins = ['https://myapp.com', 'https://staging.myapp.com'];
    return allowedOrigins.includes(context.origin || '');
  },
}
```

## `authenticateRequest`

Protects REST admin routes. Wraps all routes except `GET /widget-config`, `GET /capabilities`, and `POST /offline-messages`. Return a user object on success or `null` to reject with 401.

```ts
authenticateRequest: async (req: any) => Promise<{ userId: string; permissions?: string[] } | null>
```

**Example:**

```ts
adapters: {
  authenticateRequest: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const user = await verifyToken(token);
    return user ? { userId: user.id, permissions: user.permissions } : null;
  },
}
```

## `resolveUserIdentity`

Resolves a visitor to a known user identity during WebSocket connection. Called during the visitor connect flow, before session creation.

```ts
resolveUserIdentity: async (visitorContext: VisitorContext) =>
  Promise<{ userId: string; userCategory?: string } | string | null>
```

**Return values:**
- `{ userId, userCategory }` -- identified user with optional category
- `string` -- shorthand for `{ userId: value }`
- `null` -- anonymous visitor (no identity resolved)

**Example:**

```ts
adapters: {
  resolveUserIdentity: async (context) => {
    // Check if visitor has an auth cookie or token
    const token = context.metadata?.authToken as string;
    if (!token) return null; // anonymous

    const user = await userService.findByToken(token);
    if (!user) return null;

    return {
      userId: user.id,
      userCategory: user.plan, // 'free', 'pro', 'enterprise'
    };
  },
}
```

## `identifyVisitor`

Maps a visitor to a known user identity. Called when the visitor emits the `chat:identify` event (client-side identification, e.g., after login).

```ts
identifyVisitor: async (visitorId: string, identifyData: Record<string, unknown>) =>
  Promise<VisitorIdentity | null>
```

**Example:**

```ts
adapters: {
  identifyVisitor: async (visitorId, identifyData) => {
    const email = identifyData.email as string;
    if (!email) return null;

    const user = await userService.findByEmail(email);
    if (!user) return null;

    return {
      userId: user.id,
      displayName: user.name,
      email: user.email,
      metadata: { plan: user.plan },
    };
  },
}
```

## `trackEvent`

Called when a visitor emits a `chat:track_event` event. Use this to record analytics or forward events to an external service.

```ts
trackEvent: async (event: ChatTrackingEvent) => Promise<void>
```

**Event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Session identifier |
| `visitorId` | `string` | Visitor identifier |
| `eventType` | `string` | Custom event type |
| `description` | `string?` | Optional description |
| `data` | `Record<string, unknown>?` | Optional event data |
| `channel` | `string` | Session channel |
| `timestamp` | `Date` | Event timestamp |

**Example:**

```ts
adapters: {
  trackEvent: async (event) => {
    await analyticsService.track({
      event: event.eventType,
      userId: event.visitorId,
      properties: {
        sessionId: event.sessionId,
        channel: event.channel,
        ...event.data,
      },
      timestamp: event.timestamp,
    });
  },
}
```

## `fileStorage`

Handles file upload, deletion, and signed URL generation. Required for the file sharing feature and the `POST /sessions/:sessionId/upload` route.

```ts
fileStorage: {
  upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
}
```

| Method | Required | Description |
|--------|----------|-------------|
| `upload` | Yes | Store the file and return a public or signed URL |
| `delete` | Yes | Delete a previously uploaded file |
| `getSignedUrl` | No | Generate a time-limited signed URL for private files |

See [File Uploads](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/file-uploads.md) for full S3, GCS, and local disk examples.

**Example -- S3 adapter:**

```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'my-chat-uploads';

adapters: {
  fileStorage: {
    async upload(file, fileName, mimeType) {
      const key = `chat-uploads/${crypto.randomUUID()}-${fileName}`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file,
        ContentType: mimeType,
      }));
      return `https://${BUCKET}.s3.amazonaws.com/${key}`;
    },

    async delete(fileUrl) {
      const key = new URL(fileUrl).pathname.slice(1);
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    },

    async getSignedUrl(fileUrl, expiresIn = 3600) {
      const key = new URL(fileUrl).pathname.slice(1);
      const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      return getSignedUrl(s3, command, { expiresIn });
    },
  },
}
```

## `uploadFile`

Handles avatar uploads for agents. Simpler than `fileStorage` -- receives a file object and returns a URL. Used by `POST /agents/:agentId/avatar`.

```ts
uploadFile: async (file: { buffer: Buffer; mimetype: string; originalname: string }) => Promise<string>
```

## `enrichSessionContext`

Enriches the session context returned by `GET /sessions/:sessionId/context`. Called after the engine builds the default context object.

```ts
enrichSessionContext: async (context: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Example:**

```ts
adapters: {
  enrichSessionContext: async (context) => {
    const userId = context.visitorId as string;
    const crmData = await crm.getCustomer(userId);
    return { ...context, customer: crmData };
  },
}
```

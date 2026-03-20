# Full-Stack Example

Complete working example with all `@astralibx/chat-*` packages wired together: server (Express + Socket.IO + chat-engine + chat-ai), visitor widget, and admin dashboard.

---

## Environment Variables

```bash
# .env
MONGODB_URI=mongodb://localhost:27017/myapp
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=gsk_...
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

---

## Server

```ts
// server.ts
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { createChatEngine } from '@astralibx/chat-engine';
import { createChatAI } from '@astralibx/chat-ai';
import Groq from 'groq-sdk';

const app = express();
app.use(express.json());

// --- 1. Connect to databases ---
const connection = mongoose.createConnection(process.env.MONGODB_URI!);
const redis = new Redis(process.env.REDIS_URL!);

// --- 2. Create chat AI (optional -- skip for human-only setup) ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ai = createChatAI({
  db: { connection },
  chat: {
    generate: async (systemPrompt, userMessage, history) => {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
      });
      return { content: res.choices[0].message.content!, model: 'llama-3.3-70b' };
    },
  },
});

// --- 3. Create chat engine ---
const engine = createChatEngine({
  db: { connection, collectionPrefix: '' },
  redis: { connection: redis, keyPrefix: 'myapp:chat:' },
  socket: {
    cors: { origin: [process.env.CORS_ORIGIN!], credentials: true },
  },
  adapters: {
    // Assign the least busy online agent, or null to queue
    assignAgent: async (_context) => {
      const agent = await engine.agents.findLeastBusy();
      return agent ? engine.agents.toAgentInfo(agent) : null;
    },

    // Wire AI response generation
    generateAiResponse: ai.generateResponse,

    // Authenticate agent socket connections via JWT
    authenticateAgent: async (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; name: string };
        return { adminUserId: payload.id, displayName: payload.name };
      } catch {
        return null;
      }
    },

    // Protect REST admin routes
    authenticateRequest: async (req) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return null;
      try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { id: string };
        return { userId: payload.id };
      } catch {
        return null;
      }
    },

    // File storage (S3 example stub -- replace with real implementation)
    fileStorage: {
      async upload(file, fileName, mimeType) {
        // Upload to S3/GCS and return the URL
        return `https://cdn.example.com/uploads/${fileName}`;
      },
      async delete(fileUrl) {
        // Delete from storage
      },
    },
  },
  hooks: {
    onSessionCreated: (session) => {
      console.log(`[Chat] New session: ${session.sessionId} from ${session.channel}`);
    },
    onEscalation: (sessionId, reason) => {
      console.log(`[Chat] Escalation: ${sessionId} -- ${reason}`);
      // notifySlack(`Chat ${sessionId} needs a human agent: ${reason}`);
    },
    onError: (error, context) => {
      console.error('[Chat] Error:', error.message, context);
    },

    // Wire memory hooks to chat-ai
    onSaveMemory: async (payload) => {
      await ai.memories.create({
        scope: 'visitor',
        scopeId: payload.visitorId,
        content: payload.content,
        key: payload.key,
        category: payload.category || 'agent_notes',
        source: 'agent',
      });
    },
    onDeleteMemory: async (payload) => {
      await ai.memories.delete(payload.memoryId);
    },
  },
});

// --- 4. Mount routes ---
app.use('/api/chat', engine.routes);
app.use('/api/chat-ai', ai.routes);

// --- 5. Attach gateway and start ---
const httpServer = createServer(app);
engine.attach(httpServer);

httpServer.listen(Number(process.env.PORT) || 3000, () => {
  console.log(`Chat server running on port ${process.env.PORT || 3000}`);
});

// --- 6. Graceful shutdown ---
process.on('SIGTERM', async () => {
  await engine.destroy();
  await connection.close();
  redis.disconnect();
  process.exit(0);
});
```

---

## Visitor Widget (HTML)

Embed this on any page where visitors should see the chat bubble.

```html
<!-- visitor.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
</head>
<body>
  <h1>Welcome to My App</h1>

  <!-- Chat widget -->
  <script type="module">
    import '@astralibx/chat-widget';
  </script>

  <alx-chat-widget
    socket-url="http://localhost:3000"
    channel="website"
    theme="auto"
    position="bottom-right"
  ></alx-chat-widget>

  <!-- Optional: programmatic config for pre-chat flow -->
  <script type="module">
    const widget = document.querySelector('alx-chat-widget');

    widget.configure({
      socketUrl: 'http://localhost:3000',
      channel: 'website',
      branding: {
        primaryColor: '#2563EB',
        companyName: 'My App',
        logoUrl: '/logo.png',
      },
      features: {
        soundNotifications: true,
        typingIndicator: true,
        readReceipts: true,
      },
      preChatFlow: {
        enabled: true,
        skipToChat: true,
        completionAction: 'chat',
        steps: [
          {
            type: 'welcome',
            title: 'Hi there!',
            subtitle: 'How can we help you today?',
            showOnlineStatus: true,
            starters: ['Track my order', 'Billing question', 'Technical issue'],
          },
          {
            type: 'form',
            title: 'Quick info',
            fields: [
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'email', label: 'Email', type: 'email', required: true },
            ],
          },
        ],
      },
    });

    // Track widget events
    widget.addEventListener('chat:session-started', (e) => {
      console.log('Chat started:', e.detail);
    });
  </script>
</body>
</html>
```

---

## Admin Dashboard (HTML)

The admin dashboard for support agents and managers.

```html
<!-- admin.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chat Admin</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    alx-chat-dashboard { display: block; height: 100vh; }
  </style>
</head>
<body>
  <script type="module">
    import { AlxChatConfig } from '@astralibx/chat-ui';

    // Get auth token from your login flow
    const authToken = localStorage.getItem('authToken');

    AlxChatConfig.setup({
      chatEngineApi: '/api/chat',
      chatAiApi: '/api/chat-ai',
      socketUrl: 'ws://localhost:3000',
      agentNamespace: '/agent',
      authToken: `Bearer ${authToken}`,
      theme: 'dark',
    });

    // Handle auth expiry
    window.addEventListener('alx-chat-auth-error', () => {
      window.location.href = '/login';
    });

    import '@astralibx/chat-ui';
  </script>

  <alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
</body>
</html>
```

---

## Initial Setup (after first deploy)

After the server is running, create your first agent and prompt template via the REST API:

```bash
# Create default AI agent
curl -X POST http://localhost:3000/api/chat/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Assistant",
    "role": "Support",
    "isAI": true,
    "isDefault": true,
    "visibility": "internal"
  }'

# Create default prompt template
curl -X POST http://localhost:3000/api/chat-ai/prompts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Agent",
    "isDefault": true,
    "sections": [
      { "key": "identity", "label": "Identity", "content": "You are a helpful support agent.", "position": 1, "isEnabled": true, "isSystem": false },
      { "key": "memory_injection", "label": "Memories", "content": "", "position": 2, "isEnabled": true, "isSystem": true },
      { "key": "knowledge_injection", "label": "Knowledge", "content": "", "position": 3, "isEnabled": true, "isSystem": true },
      { "key": "conversation_history", "label": "History", "content": "", "position": 4, "isEnabled": true, "isSystem": true }
    ]
  }'

# Seed a global memory
curl -X POST http://localhost:3000/api/chat-ai/memories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "global",
    "key": "business_hours",
    "content": "We are available Monday-Friday, 9 AM - 6 PM EST.",
    "category": "general",
    "priority": 90,
    "source": "admin"
  }'
```

Or use the admin dashboard at `/admin.html` to manage agents, prompts, memories, and settings through the UI.

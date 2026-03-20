# Testing Guide

Practical patterns for testing `@astralibx/chat-*` packages with Vitest.

---

## 1. Testing Custom Adapters

Adapters are plain async functions -- test them in isolation by mocking their dependencies.

**Example: testing an `assignAgent` adapter**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Your adapter logic, extracted into a testable function
async function assignLeastBusy(
  agentService: { list: () => Promise<Agent[]> },
): Promise<{ agentId: string; displayName: string } | null> {
  const agents = await agentService.list();
  const online = agents.filter((a) => a.isOnline && a.isActive);
  if (online.length === 0) return null;

  const sorted = online.sort((a, b) => a.activeChats - b.activeChats);
  const best = sorted[0];
  if (best.activeChats >= best.maxConcurrentChats) return null;

  return { agentId: best.id, displayName: best.name };
}

describe('assignLeastBusy adapter', () => {
  const mockAgentService = { list: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  it('should return the agent with fewest active chats', async () => {
    mockAgentService.list.mockResolvedValue([
      { id: 'a1', name: 'Alice', isOnline: true, isActive: true, activeChats: 3, maxConcurrentChats: 5 },
      { id: 'a2', name: 'Bob', isOnline: true, isActive: true, activeChats: 1, maxConcurrentChats: 5 },
    ]);

    const result = await assignLeastBusy(mockAgentService);
    expect(result).toEqual({ agentId: 'a2', displayName: 'Bob' });
  });

  it('should return null when no agents are online', async () => {
    mockAgentService.list.mockResolvedValue([
      { id: 'a1', name: 'Alice', isOnline: false, isActive: true, activeChats: 0, maxConcurrentChats: 5 },
    ]);

    const result = await assignLeastBusy(mockAgentService);
    expect(result).toBeNull();
  });

  it('should return null when all agents are at capacity', async () => {
    mockAgentService.list.mockResolvedValue([
      { id: 'a1', name: 'Alice', isOnline: true, isActive: true, activeChats: 5, maxConcurrentChats: 5 },
    ]);

    const result = await assignLeastBusy(mockAgentService);
    expect(result).toBeNull();
  });
});
```

**Key pattern:** Extract adapter logic into standalone functions. Pass dependencies (services, clients) as arguments so you can inject mocks.

---

## 2. Testing Hooks

Hooks are fire-and-forget callbacks. Verify they are called with the right arguments by passing `vi.fn()` spies.

**Example: verifying `onSessionCreated` hook**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '@astralibx/chat-engine/services/session.service';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';
import { DEFAULT_OPTIONS } from '@astralibx/chat-engine/types/config.types';

function createMockSessionModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    distinct: vi.fn().mockResolvedValue([]),
  } as any;
}

function createMockMessageModel() {
  return {
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }) }) }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as any;
}

describe('Session hooks', () => {
  let hooks: Record<string, ReturnType<typeof vi.fn>>;
  let service: SessionService;
  let sessionModel: any;

  beforeEach(() => {
    sessionModel = createMockSessionModel();
    hooks = {
      onSessionCreated: vi.fn(),
      onSessionResolved: vi.fn(),
      onSessionAbandoned: vi.fn(),
    };
    service = new SessionService(
      sessionModel,
      createMockMessageModel(),
      DEFAULT_OPTIONS,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      hooks,
    );
  });

  it('should call onSessionCreated after creating a session', async () => {
    const mockSession = { sessionId: 'sess-1', visitorId: 'vis-1', status: ChatSessionStatus.New, mode: SessionMode.AI };
    sessionModel.create.mockResolvedValue(mockSession);

    await service.create({ visitorId: 'vis-1', channel: 'web' }, SessionMode.AI);

    expect(hooks.onSessionCreated).toHaveBeenCalledTimes(1);
    expect(hooks.onSessionCreated).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1' }),
    );
  });

  it('should not block if async hook throws', async () => {
    hooks.onSessionCreated.mockRejectedValue(new Error('hook failure'));
    sessionModel.create.mockResolvedValue({ sessionId: 'sess-2', visitorId: 'vis-1' });

    // Should not throw even though the hook rejects
    await expect(service.create({ visitorId: 'vis-1', channel: 'web' }, SessionMode.AI)).resolves.toBeDefined();
  });
});
```

**Key pattern:** Hooks are passed in the constructor of each service. Create `vi.fn()` spies, pass them as the hooks object, and assert calls after the action.

---

## 3. Integration Testing with mongodb-memory-server

For full flow testing, use `mongodb-memory-server` to spin up an in-memory MongoDB and create a real engine instance.

**Example: connect, send message, resolve**

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createChatEngine } from '@astralibx/chat-engine';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';

// Mock socket.io -- we are testing service logic, not sockets
vi.mock('socket.io', () => {
  const ns = { on: vi.fn(), use: vi.fn(), emit: vi.fn() };
  return { Server: vi.fn(() => ({ of: vi.fn(() => ns), close: vi.fn((cb: () => void) => cb()) })) };
});

let mongod: MongoMemoryServer;
let connection: mongoose.Connection;
let engine: ReturnType<typeof createChatEngine>;

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  rpush: vi.fn().mockResolvedValue(1),
  lrange: vi.fn().mockResolvedValue([]),
  pexpire: vi.fn().mockResolvedValue(1),
  status: 'ready',
} as any;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  connection = await mongoose.createConnection(mongod.getUri()).asPromise();

  engine = createChatEngine({
    db: { connection },
    redis: { connection: mockRedis },
    socket: { cors: { origin: '*' } },
    adapters: {
      assignAgent: vi.fn().mockResolvedValue(null),
    },
  });
});

afterAll(async () => {
  await engine.destroy();
  await connection.close();
  await mongod.stop();
});

describe('Full chat flow', () => {
  let sessionId: string;

  it('should create a session', async () => {
    const session = await engine.sessions.create(
      { visitorId: 'vis-integration-1', channel: 'web' },
      SessionMode.AI,
    );

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe(ChatSessionStatus.New);
    sessionId = session.sessionId;
  });

  it('should send a visitor message', async () => {
    const message = await engine.messages.create({
      sessionId,
      senderType: 'visitor',
      content: 'Hello, I need help',
      contentType: 'text',
    });

    expect(message.content).toBe('Hello, I need help');
  });

  it('should resolve the session', async () => {
    await engine.sessions.resolve(sessionId);

    const resolved = await engine.sessions.findById(sessionId);
    expect(resolved?.status).toBe(ChatSessionStatus.Resolved);
  });
});
```

**Setup notes:**
- Install `mongodb-memory-server` as a dev dependency
- Mock Socket.IO at the top of the file -- integration tests focus on service + DB logic
- Mock Redis with `vi.fn()` stubs (or use `ioredis-mock` for Redis-specific tests)
- Call `engine.destroy()` in `afterAll` to clean up timers and workers

---

## 4. Socket.IO Mock Patterns

The existing test suite mocks Socket.IO to avoid starting a real server. Here is the pattern used throughout `chat-engine`:

```ts
import { vi } from 'vitest';

// Place this at the top of the test file, before any imports that use socket.io
vi.mock('socket.io', () => {
  const mockNamespace = {
    on: vi.fn(),
    use: vi.fn(),
    emit: vi.fn(),
  };

  return {
    Server: vi.fn().mockImplementation(() => ({
      of: vi.fn().mockReturnValue(mockNamespace),
      close: vi.fn((cb: () => void) => cb()),
    })),
  };
});
```

To test gateway handlers that interact with individual sockets, create a mock socket:

```ts
function createMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'socket-1',
    handshake: { auth: { token: 'test-token' }, query: {}, headers: {} },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
    data: {},
    ...overrides,
  };
}

// Usage in tests
const socket = createMockSocket({ data: { visitorId: 'vis-1', sessionId: 'sess-1' } });
```

**Key pattern:** Mock `socket.io` via `vi.mock()` at the module level. Individual sockets are plain objects with `vi.fn()` methods. This avoids network I/O while testing handler logic.

---

## 5. Widget Testing (Lit Components)

The `chat-widget` package uses Lit web components. Test them with `@open-wc/testing`:

```ts
import { fixture, html, expect } from '@open-wc/testing';
import '../src/alx-chat-widget'; // registers the custom element

describe('alx-chat-widget', () => {
  it('should render with default attributes', async () => {
    const el = await fixture(html`
      <alx-chat-widget socket-url="http://localhost:3000" channel="web"></alx-chat-widget>
    `);

    expect(el).to.exist;
    expect(el.getAttribute('channel')).to.equal('web');
  });

  it('should show the launcher button', async () => {
    const el = await fixture(html`
      <alx-chat-widget socket-url="http://localhost:3000"></alx-chat-widget>
    `);

    const launcher = el.shadowRoot?.querySelector('.launcher');
    expect(launcher).to.exist;
  });
});
```

**Dependencies:** `@open-wc/testing`, `@web/test-runner` (for running Lit tests in a browser environment).

---

## Running Tests

All chat packages use Vitest. From any package directory:

```bash
# Run all tests
npx vitest run

# Run in watch mode
npx vitest

# Run a specific file
npx vitest run src/__tests__/session.service.spec.ts

# Run with coverage
npx vitest run --coverage
```

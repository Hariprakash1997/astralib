import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';

// ── Dynamic import after vi.mock setup ────────────────────────────────────────
// We avoid heavy mocking of express internals by just checking the router is created

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makePipelineService() {
  return {
    list: vi.fn().mockResolvedValue([{ pipelineId: 'p-1', name: 'Test' }]),
    create: vi.fn().mockResolvedValue({ pipelineId: 'p-new' }),
    get: vi.fn().mockResolvedValue({ pipelineId: 'p-1' }),
    update: vi.fn().mockResolvedValue({ pipelineId: 'p-1' }),
    delete: vi.fn().mockResolvedValue(undefined),
    addStage: vi.fn().mockResolvedValue({ pipelineId: 'p-1', stages: [] }),
    updateStage: vi.fn().mockResolvedValue({ pipelineId: 'p-1' }),
    removeStage: vi.fn().mockResolvedValue(undefined),
    reorderStages: vi.fn().mockResolvedValue({ pipelineId: 'p-1' }),
  };
}

function makeCallLogService() {
  return {
    list: vi.fn().mockResolvedValue({ callLogs: [], total: 0, page: 1, limit: 20 }),
    create: vi.fn().mockResolvedValue({ callLogId: 'cl-new' }),
    get: vi.fn().mockResolvedValue({ callLogId: 'cl-1' }),
    update: vi.fn().mockResolvedValue({ callLogId: 'cl-1' }),
    getByContact: vi.fn().mockResolvedValue([]),
  };
}

function makeLifecycleService() {
  return {
    changeStage: vi.fn().mockResolvedValue({ callLogId: 'cl-1' }),
    assign: vi.fn().mockResolvedValue({ callLogId: 'cl-1' }),
    close: vi.fn().mockResolvedValue({ callLogId: 'cl-1', isClosed: true }),
    reopen: vi.fn().mockResolvedValue({ callLogId: 'cl-1', isClosed: false }),
    getFollowUpsDue: vi.fn().mockResolvedValue([]),
    bulkChangeStage: vi.fn().mockResolvedValue({ succeeded: [], failed: [], total: 0 }),
    softDelete: vi.fn().mockResolvedValue({ callLogId: 'cl-1', isDeleted: true }),
  };
}

function makeTimelineService() {
  return {
    addNote: vi.fn().mockResolvedValue({ entryId: 'e-1', type: 'note', content: 'test', createdAt: new Date() }),
    getTimeline: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, limit: 50 }),
    getContactTimeline: vi.fn().mockResolvedValue([]),
  };
}

function makeAnalyticsService() {
  return {
    getAgentStats: vi.fn().mockResolvedValue({ agentId: 'a-1', totalCalls: 0 }),
    getAgentLeaderboard: vi.fn().mockResolvedValue([]),
    getPipelineStats: vi.fn().mockResolvedValue({ pipelineId: 'p-1' }),
    getPipelineFunnel: vi.fn().mockResolvedValue({ pipelineId: 'p-1', stages: [] }),
    getTeamStats: vi.fn().mockResolvedValue({ totalCalls: 0 }),
    getDailyReport: vi.fn().mockResolvedValue([]),
    getWeeklyTrends: vi.fn().mockResolvedValue([]),
    getOverallReport: vi.fn().mockResolvedValue({ totalCalls: 0 }),
  };
}

function makeSettingsService() {
  return {
    get: vi.fn().mockResolvedValue({ maxCallsPerAgent: 10 }),
    update: vi.fn().mockResolvedValue({ maxCallsPerAgent: 15 }),
  };
}

function makeExportService() {
  return {
    exportCallLog: vi.fn().mockResolvedValue('{"callLogId":"cl-1"}'),
    exportCallLogs: vi.fn().mockResolvedValue('[]'),
    exportPipelineReport: vi.fn().mockResolvedValue('{}'),
  };
}

async function buildApp(
  authenticateRequest?: (req: express.Request) => Promise<{ adminUserId: string; displayName: string } | null>,
) {
  const { createRoutes } = await import('../../routes/index.js');

  const services = {
    pipelines: makePipelineService() as unknown as Parameters<typeof createRoutes>[0]['pipelines'],
    callLogs: makeCallLogService() as unknown as Parameters<typeof createRoutes>[0]['callLogs'],
    lifecycle: makeLifecycleService() as unknown as Parameters<typeof createRoutes>[0]['lifecycle'],
    timeline: makeTimelineService() as unknown as Parameters<typeof createRoutes>[0]['timeline'],
    analytics: makeAnalyticsService() as unknown as Parameters<typeof createRoutes>[0]['analytics'],
    pipelineAnalytics: {
      getPipelineStats: vi.fn().mockResolvedValue({}),
      getPipelineFunnel: vi.fn().mockResolvedValue({}),
      getChannelDistribution: vi.fn().mockResolvedValue([]),
      getOutcomeDistribution: vi.fn().mockResolvedValue([]),
      getFollowUpStats: vi.fn().mockResolvedValue({}),
    } as unknown as Parameters<typeof createRoutes>[0]['pipelineAnalytics'],
    settings: makeSettingsService() as unknown as Parameters<typeof createRoutes>[0]['settings'],
    export: makeExportService() as unknown as Parameters<typeof createRoutes>[0]['export'],
  };

  const app: Express = express();
  app.use(express.json());
  app.use('/api', createRoutes(services, { authenticateRequest, logger: mockLogger }));
  return { app, services };
}

async function buildAppWithOptions(opts: {
  authenticateRequest?: (req: express.Request) => Promise<{ adminUserId: string; displayName: string; role?: string } | null>;
  enableAgentScoping?: boolean;
}) {
  const { createRoutes } = await import('../../routes/index.js');

  const services = {
    pipelines: makePipelineService() as unknown as Parameters<typeof createRoutes>[0]['pipelines'],
    callLogs: makeCallLogService() as unknown as Parameters<typeof createRoutes>[0]['callLogs'],
    lifecycle: makeLifecycleService() as unknown as Parameters<typeof createRoutes>[0]['lifecycle'],
    timeline: makeTimelineService() as unknown as Parameters<typeof createRoutes>[0]['timeline'],
    analytics: makeAnalyticsService() as unknown as Parameters<typeof createRoutes>[0]['analytics'],
    pipelineAnalytics: {
      getPipelineStats: vi.fn().mockResolvedValue({}),
      getPipelineFunnel: vi.fn().mockResolvedValue({}),
      getChannelDistribution: vi.fn().mockResolvedValue([]),
      getOutcomeDistribution: vi.fn().mockResolvedValue([]),
      getFollowUpStats: vi.fn().mockResolvedValue({}),
    } as unknown as Parameters<typeof createRoutes>[0]['pipelineAnalytics'],
    settings: makeSettingsService() as unknown as Parameters<typeof createRoutes>[0]['settings'],
    export: makeExportService() as unknown as Parameters<typeof createRoutes>[0]['export'],
  };

  const app: Express = express();
  app.use(express.json());
  app.use('/api', createRoutes(services, {
    authenticateRequest: opts.authenticateRequest as ((req: express.Request) => Promise<{ adminUserId: string; displayName: string } | null>) | undefined,
    logger: mockLogger,
    enableAgentScoping: opts.enableAgentScoping,
  }));
  return { app, services };
}

// ── Minimal request helper ────────────────────────────────────────────────────

async function request(
  app: Express,
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = Object.assign(
      {},
      {
        method,
        url,
        headers: { 'content-type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    // Use express's internal listen-less test approach via supertest-like manual invocation
    // We rely on the fact that express apps expose a `handle` method
    const mockReq = {
      method,
      url,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ?? {},
      query: {},
      params: {},
      on: vi.fn(),
      pipe: vi.fn(),
      socket: { remoteAddress: '127.0.0.1' },
    };
    const chunks: Buffer[] = [];
    let statusCode = 200;
    const mockRes = {
      statusCode: 200,
      status(code: number) { statusCode = code; this.statusCode = code; return this; },
      json(data: unknown) { resolve({ status: statusCode, body: data }); return this; },
      send(data: unknown) {
        let parsed = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch { /* keep as string */ }
        }
        resolve({ status: statusCode, body: parsed });
        return this;
      },
      setHeader: vi.fn().mockReturnThis(),
      getHeader: vi.fn(),
      end() { resolve({ status: statusCode, body: undefined }); return this; },
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      write: vi.fn(),
      removeListener: vi.fn(),
    };

    // Parse query string from URL
    const urlObj = new URL(url, 'http://localhost');
    const queryObj: Record<string, string> = {};
    urlObj.searchParams.forEach((v, k) => { queryObj[k] = v; });
    mockReq.query = queryObj as unknown as typeof mockReq.query;

    (app as unknown as { handle: (req: unknown, res: unknown, next: () => void) => void }).handle(
      mockReq,
      mockRes,
      () => resolve({ status: 404, body: { message: 'Not Found' } }),
    );
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createRoutes()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth middleware', () => {
    it('rejects unauthenticated requests when authenticateRequest returns null', async () => {
      const { app } = await buildApp(async () => null);
      const result = await request(app, 'GET', '/api/pipelines');
      expect(result.status).toBe(401);
    });

    it('allows requests when authenticateRequest returns a user', async () => {
      const { app, services } = await buildApp(async () => ({
        adminUserId: 'admin-1',
        displayName: 'Admin',
      }));
      const result = await request(app, 'GET', '/api/pipelines');
      expect(result.status).toBe(200);
      expect(services.pipelines.list).toHaveBeenCalledTimes(1);
    });

    it('allows all requests when no authenticateRequest is provided', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/pipelines');
      expect(result.status).toBe(200);
      expect(services.pipelines.list).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when authenticateRequest throws', async () => {
      const { app } = await buildApp(async () => {
        throw new Error('Auth service down');
      });
      const result = await request(app, 'GET', '/api/pipelines');
      expect(result.status).toBe(401);
    });
  });

  describe('pipeline routes', () => {
    it('GET /pipelines — lists pipelines', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/pipelines');
      expect(result.status).toBe(200);
      expect(services.pipelines.list).toHaveBeenCalledTimes(1);
    });

    it('GET /pipelines/:id — gets a specific pipeline', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/pipelines/p-1');
      expect(result.status).toBe(200);
      expect(services.pipelines.get).toHaveBeenCalledWith('p-1');
    });
  });

  describe('call-log routes — static vs parameterized ordering', () => {
    it('GET /follow-ups is NOT captured by /:id', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/follow-ups');
      expect(result.status).toBe(200);
      // Should call getFollowUpsDue on lifecycle service, not get on callLogs
      expect(services.lifecycle.getFollowUpsDue).toHaveBeenCalledTimes(1);
      expect(services.callLogs.get).not.toHaveBeenCalled();
    });

    it('GET /:id is reached for a UUID-like id', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/cl-123');
      expect(result.status).toBe(200);
      expect(services.callLogs.get).toHaveBeenCalledWith('cl-123');
    });

    it('PUT /-/bulk/stage is NOT captured by /:id', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'PUT', '/api/-/bulk/stage', {
        callLogIds: ['cl-1'],
        newStageId: 's-2',
        agentId: 'a-1',
      });
      expect(result.status).toBe(200);
      expect(services.lifecycle.bulkChangeStage).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings routes', () => {
    it('GET /settings returns settings', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/settings');
      expect(result.status).toBe(200);
      expect(services.settings.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('analytics routes', () => {
    it('GET /analytics/agent-leaderboard returns rankings', async () => {
      const { app, services } = await buildApp();
      const result = await request(app, 'GET', '/api/analytics/agent-leaderboard');
      expect(result.status).toBe(200);
      expect(services.analytics.getAgentLeaderboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /:id — soft delete', () => {
    it('calls lifecycle.softDelete and returns result', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'DELETE', '/api/cl-123');
      expect(result.status).toBe(200);
      expect(services.lifecycle.softDelete).toHaveBeenCalledWith('cl-123', undefined, undefined);
    });

    it('returns 404 on AlxCallLogError (not found)', async () => {
      const { CallLogNotFoundError } = await import('../../errors/index.js');
      const { app, services } = await buildAppWithOptions({});
      (services.lifecycle.softDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new CallLogNotFoundError('cl-404'),
      );
      const result = await request(app, 'DELETE', '/api/cl-404');
      expect(result.status).toBe(404);
    });

    it('passes agentId and agentName from req.user to softDelete', async () => {
      const { app, services } = await buildAppWithOptions({
        authenticateRequest: async () => ({ adminUserId: 'agent-42', displayName: 'Agent Smith', role: 'agent' }),
      });
      const result = await request(app, 'DELETE', '/api/cl-123');
      expect(result.status).toBe(200);
      expect(services.lifecycle.softDelete).toHaveBeenCalledWith('cl-123', 'agent-42', 'Agent Smith');
    });
  });

  describe('GET / — new query params', () => {
    it('passes channel filter to callLogs.list', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'GET', '/api?channel=whatsapp');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'whatsapp' }),
      );
    });

    it('passes outcome filter to callLogs.list', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'GET', '/api?outcome=interested');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'interested' }),
      );
    });

    it('passes isFollowUp=true filter to callLogs.list', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'GET', '/api?isFollowUp=true');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.objectContaining({ isFollowUp: true }),
      );
    });

    it('excludes deleted by default (no includeDeleted param)', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'GET', '/api');
      expect(result.status).toBe(200);
      // includeDeleted should NOT be set to true — the service defaults exclude deleted
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ includeDeleted: true }),
      );
    });

    it('passes includeDeleted=true when query param is set', async () => {
      const { app, services } = await buildAppWithOptions({});
      const result = await request(app, 'GET', '/api?includeDeleted=true');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.objectContaining({ includeDeleted: true }),
      );
    });
  });

  describe('agent scoping', () => {
    it('non-owner GET / has agentId injected from user', async () => {
      const { app, services } = await buildAppWithOptions({
        authenticateRequest: async () => ({ adminUserId: 'agent-7', displayName: 'Bob', role: 'agent' }),
        enableAgentScoping: true,
      });
      const result = await request(app, 'GET', '/api');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-7' }),
      );
    });

    it('owner GET / does NOT have agentId injected', async () => {
      const { app, services } = await buildAppWithOptions({
        authenticateRequest: async () => ({ adminUserId: 'owner-1', displayName: 'Owner', role: 'owner' }),
        enableAgentScoping: true,
      });
      const result = await request(app, 'GET', '/api');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ agentId: expect.any(String) }),
      );
    });

    it('when enableAgentScoping is disabled, no agentId is injected for non-owner', async () => {
      const { app, services } = await buildAppWithOptions({
        authenticateRequest: async () => ({ adminUserId: 'agent-7', displayName: 'Bob', role: 'agent' }),
        enableAgentScoping: false,
      });
      const result = await request(app, 'GET', '/api');
      expect(result.status).toBe(200);
      expect(services.callLogs.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ agentId: expect.any(String) }),
      );
    });
  });
});

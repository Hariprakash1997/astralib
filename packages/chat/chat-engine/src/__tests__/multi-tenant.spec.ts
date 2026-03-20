import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { AgentService } from '../services/agent.service';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';
import type { ChatSessionModel } from '../schemas/chat-session.schema';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import type { ChatSettingsModel } from '../schemas/chat-settings.schema';
import type { ChatAgentModel } from '../schemas/chat-agent.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';
import { withTenantFilter, withTenantId } from '../utils/helpers';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockSessionModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    distinct: vi.fn().mockResolvedValue([]),
  } as unknown as ChatSessionModel;
}

function createMockMessageModel() {
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as ChatMessageModel;
}

function createMockSettingsModel() {
  return {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  } as unknown as ChatSettingsModel;
}

function createMockAgentModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as ChatAgentModel;
}

// ── Helper utility tests ──────────────────────────────────────────────────

describe('withTenantFilter()', () => {
  it('should add tenantId to query when provided', () => {
    const query = { status: 'active' };
    const result = withTenantFilter(query, 'tenant-1');
    expect(result).toEqual({ status: 'active', tenantId: 'tenant-1' });
  });

  it('should not modify query when tenantId is undefined', () => {
    const query = { status: 'active' };
    const result = withTenantFilter(query, undefined);
    expect(result).toEqual({ status: 'active' });
    expect(result).not.toHaveProperty('tenantId');
  });

  it('should return the same object reference (mutation)', () => {
    const query = { status: 'active' };
    const result = withTenantFilter(query, 'tenant-1');
    expect(result).toBe(query);
  });
});

describe('withTenantId()', () => {
  it('should set tenantId on create data when provided', () => {
    const data = { name: 'Test' };
    const result = withTenantId(data, 'tenant-1');
    expect(result).toEqual({ name: 'Test', tenantId: 'tenant-1' });
  });

  it('should not set tenantId when undefined (single-tenant)', () => {
    const data = { name: 'Test' };
    const result = withTenantId(data, undefined);
    expect(result).toEqual({ name: 'Test' });
    expect(result).not.toHaveProperty('tenantId');
  });
});

// ── SessionService with tenantId ──────────────────────────────────────

describe('SessionService — multi-tenant', () => {
  const tenantId = 'tenant-alpha';
  let service: SessionService;
  let sessionModel: ChatSessionModel;
  let messageModel: ChatMessageModel;
  let logger: LogAdapter;

  beforeEach(() => {
    sessionModel = createMockSessionModel();
    messageModel = createMockMessageModel();
    logger = createMockLogger();
    service = new SessionService(sessionModel, messageModel, DEFAULT_OPTIONS, logger, undefined, tenantId);
  });

  it('should include tenantId when creating a session', async () => {
    const session = {
      sessionId: 'sess-1',
      visitorId: 'vis-1',
      status: ChatSessionStatus.New,
      mode: SessionMode.AI,
      save: vi.fn(),
    };
    (sessionModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    await service.create({ visitorId: 'vis-1', channel: 'web' }, SessionMode.AI);

    expect(sessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('should include tenantId in findById query', async () => {
    (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await service.findById('sess-1');

    expect(sessionModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', tenantId }),
    );
  });

  it('should include tenantId in submitFeedback update', async () => {
    const feedback = { rating: 5 };
    await service.submitFeedback('sess-1', feedback);

    expect(sessionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', tenantId }),
      expect.any(Object),
    );
  });

  it('should include tenantId in getUserHistory query', async () => {
    const limitFn = vi.fn().mockResolvedValue([]);
    const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
    (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });

    await service.getUserHistory('vis-1');

    expect(sessionModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: 'vis-1', tenantId }),
    );
  });

  it('should include tenantId in mergeAnonymousSessions', async () => {
    (sessionModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 0 });

    await service.mergeAnonymousSessions('anon-1', 'user-1');

    expect(sessionModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: 'anon-1', tenantId }),
      expect.any(Object),
    );
  });
});

// ── SessionService without tenantId ───────────────────────────────────

describe('SessionService — single-tenant', () => {
  let service: SessionService;
  let sessionModel: ChatSessionModel;
  let messageModel: ChatMessageModel;
  let logger: LogAdapter;

  beforeEach(() => {
    sessionModel = createMockSessionModel();
    messageModel = createMockMessageModel();
    logger = createMockLogger();
    service = new SessionService(sessionModel, messageModel, DEFAULT_OPTIONS, logger);
  });

  it('should not include tenantId in queries when not configured', async () => {
    (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await service.findById('sess-1');

    expect(sessionModel.findOne).toHaveBeenCalledWith({ sessionId: 'sess-1' });
  });
});

// ── SettingsService with tenantId ─────────────────────────────────────

describe('SettingsService — multi-tenant', () => {
  const tenantId = 'tenant-beta';
  let service: SettingsService;
  let settingsModel: ChatSettingsModel;
  let logger: LogAdapter;

  beforeEach(() => {
    settingsModel = createMockSettingsModel();
    logger = createMockLogger();
    service = new SettingsService(settingsModel, logger, tenantId);
  });

  it('should scope settings lookup by tenantId', async () => {
    const settings = {
      key: 'global',
      tenantId,
      availableUserCategories: [],
      businessHours: { enabled: false },
      aiMode: 'agent-wise',
      aiCharacter: { globalCharacter: null },
      showAiTag: true,
      ratingConfig: { enabled: false, ratingType: 'thumbs', followUpOptions: {} },
    };
    (settingsModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(settings);

    await service.get();

    expect(settingsModel.findOne).toHaveBeenCalledWith({ key: 'global', tenantId });
  });

  it('should create default settings with tenantId when none exist', async () => {
    (settingsModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (settingsModel.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: 'global',
      tenantId,
    });

    await service.get();

    expect(settingsModel.create).toHaveBeenCalledWith({ key: 'global', tenantId });
  });

  it('should scope update operations by tenantId', async () => {
    (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: 'global',
      tenantId,
    });

    await service.update({ autoAssignEnabled: true });

    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'global', tenantId },
      expect.any(Object),
      expect.any(Object),
    );
  });
});

// ── AgentService with tenantId ────────────────────────────────────────

describe('AgentService — multi-tenant', () => {
  const tenantId = 'tenant-gamma';
  let service: AgentService;
  let agentModel: ChatAgentModel;
  let logger: LogAdapter;

  beforeEach(() => {
    agentModel = createMockAgentModel();
    logger = createMockLogger();
    service = new AgentService(agentModel, DEFAULT_OPTIONS, logger, tenantId);
  });

  it('should include tenantId when creating an agent', async () => {
    const agent = { _id: { toString: () => 'a1' }, name: 'Agent' };
    (agentModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

    await service.create({ name: 'Agent' });

    expect(agentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('should include tenantId in list() query', async () => {
    await service.list();

    expect(agentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('should include tenantId in getOnlineAgents() query', async () => {
    (agentModel.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await service.getOnlineAgents();

    expect(agentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ isOnline: true, isActive: true, tenantId }),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineService } from '../../services/pipeline.service.js';
import {
  PipelineNotFoundError,
  StageNotFoundError,
  StageInUseError,
  InvalidPipelineError,
} from '../../errors/index.js';
import type { IPipelineStage } from '@astralibx/call-log-types';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeStage(overrides: Partial<IPipelineStage> = {}): IPipelineStage & { toObject?: () => IPipelineStage } {
  const s: IPipelineStage = {
    stageId: 'stage-1',
    name: 'New',
    color: '#000',
    order: 1,
    isDefault: true,
    isTerminal: false,
    ...overrides,
  };
  return { ...s, toObject: () => ({ ...s }) };
}

function makeValidStages(): (IPipelineStage & { toObject?: () => IPipelineStage })[] {
  return [
    makeStage({ stageId: 'stage-1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
    makeStage({ stageId: 'stage-2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
  ];
}

function makePipelineDoc(overrides: Record<string, unknown> = {}) {
  const stages = makeValidStages();
  const doc = {
    pipelineId: 'pipe-1',
    name: 'Test Pipeline',
    stages,
    isActive: true,
    isDeleted: false,
    isDefault: false,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return doc;
}

function makePipelineModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(doc),
    findOneAndUpdate: vi.fn().mockResolvedValue(doc),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  };
}

function makeCallLogModel(count = 0) {
  return {
    countDocuments: vi.fn().mockResolvedValue(count),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PipelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a pipeline with generated UUIDs', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      const result = await service.create({
        name: 'Test Pipeline',
        stages: [
          { name: 'New', color: '#000', order: 1, isDefault: true, isTerminal: false },
          { name: 'Closed', color: '#111', order: 2, isDefault: false, isTerminal: true },
        ],
        createdBy: 'user-1',
      });

      expect(Pipeline.create).toHaveBeenCalled();
      const createArg = Pipeline.create.mock.calls[0][0];
      expect(createArg.pipelineId).toMatch(/^[0-9a-f-]{36}$/);
      expect(createArg.stages[0].stageId).toMatch(/^[0-9a-f-]{36}$/);
      expect(createArg.stages[1].stageId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result).toBeDefined();
    });

    it('throws InvalidPipelineError when stages are invalid (no default)', async () => {
      const Pipeline = makePipelineModel();
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.create({
        name: 'Bad Pipeline',
        stages: [
          { name: 'New', color: '#000', order: 1, isDefault: false, isTerminal: true },
        ],
        createdBy: 'user-1',
      })).rejects.toThrow(InvalidPipelineError);
    });

    it('throws InvalidPipelineError when stages are invalid (no terminal)', async () => {
      const Pipeline = makePipelineModel();
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.create({
        name: 'Bad Pipeline',
        stages: [
          { name: 'New', color: '#000', order: 1, isDefault: true, isTerminal: false },
        ],
        createdBy: 'user-1',
      })).rejects.toThrow(InvalidPipelineError);
    });

    it('unsets other default pipelines when isDefault=true', async () => {
      const pipelineDoc = makePipelineDoc({ isDefault: true });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.create({
        name: 'Default Pipeline',
        stages: [
          { name: 'New', color: '#000', order: 1, isDefault: true, isTerminal: false },
          { name: 'Closed', color: '#111', order: 2, isDefault: false, isTerminal: true },
        ],
        createdBy: 'user-1',
        isDefault: true,
      });

      expect(Pipeline.updateMany).toHaveBeenCalledWith(
        { isDefault: true },
        { $set: { isDefault: false } },
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates pipeline fields', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.update('pipe-1', { name: 'Updated Name' });

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1', isDeleted: false },
        { $set: { name: 'Updated Name' } },
        { new: true },
      );
    });

    it('throws PipelineNotFoundError when pipeline does not exist', async () => {
      const Pipeline = makePipelineModel(null);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.update('unknown-id', { name: 'X' })).rejects.toThrow(PipelineNotFoundError);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('soft-deletes a pipeline with no active calls', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.delete('pipe-1');

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1' },
        { $set: { isDeleted: true, isActive: false } },
      );
    });

    it('includes tenantFilter in write filter when tenantId is set', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger, 'tenant-1');

      await service.delete('pipe-1');

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1', tenantId: 'tenant-1' },
        { $set: { isDeleted: true, isActive: false } },
      );
    });

    it('throws InvalidPipelineError when active calls exist', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(3);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.delete('pipe-1')).rejects.toThrow(InvalidPipelineError);
    });

    it('throws PipelineNotFoundError when pipeline does not exist', async () => {
      const Pipeline = makePipelineModel(null);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.delete('unknown-id')).rejects.toThrow(PipelineNotFoundError);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns non-deleted pipelines', async () => {
      const Pipeline = makePipelineModel();
      Pipeline.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([makePipelineDoc()]) });
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      const result = await service.list();

      expect(Pipeline.find).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: false }));
      expect(result).toHaveLength(1);
    });

    it('filters by isActive when provided', async () => {
      const Pipeline = makePipelineModel();
      Pipeline.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.list({ isActive: true });

      expect(Pipeline.find).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, isActive: true }),
      );
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns the pipeline when found', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      const result = await service.get('pipe-1');
      expect(result.pipelineId).toBe('pipe-1');
    });

    it('throws PipelineNotFoundError when not found', async () => {
      const Pipeline = makePipelineModel(null);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.get('missing')).rejects.toThrow(PipelineNotFoundError);
    });
  });

  // ── addStage ──────────────────────────────────────────────────────────────

  describe('addStage()', () => {
    it('adds a new stage to a pipeline', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      Pipeline.findOneAndUpdate.mockResolvedValue(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      const result = await service.addStage('pipe-1', {
        name: 'InProgress',
        color: '#ff0',
        order: 2,
        isDefault: false,
        isTerminal: false,
      });

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1' },
        expect.objectContaining({ $push: expect.objectContaining({ stages: expect.objectContaining({ stageId: expect.any(String) }) }) }),
        { new: true },
      );
      expect(result).toBeDefined();
    });

    it('throws InvalidPipelineError if resulting stages are invalid', async () => {
      // Pipeline with 1 stage that is default+terminal, trying to add duplicate name
      const stages = [
        makeStage({ stageId: 's1', name: 'Existing', order: 1, isDefault: true, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      // Adding a stage with duplicate name
      await expect(service.addStage('pipe-1', {
        name: 'Existing', // duplicate name
        color: '#f00',
        order: 2,
        isDefault: false,
        isTerminal: false,
      })).rejects.toThrow(InvalidPipelineError);
    });

    it('throws PipelineNotFoundError when pipeline not found', async () => {
      const Pipeline = makePipelineModel(null);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.addStage('no-pipe', {
        name: 'New Stage',
        color: '#000',
        order: 1,
        isDefault: false,
        isTerminal: false,
      })).rejects.toThrow(PipelineNotFoundError);
    });
  });

  // ── removeStage ───────────────────────────────────────────────────────────

  describe('removeStage()', () => {
    it('removes a stage with no active calls', async () => {
      // 3 stages: default+non-terminal, middle (the one we remove), terminal
      const stages = [
        makeStage({ stageId: 's1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
        makeStage({ stageId: 's2', name: 'InProgress', order: 2, isDefault: false, isTerminal: false }),
        makeStage({ stageId: 's3', name: 'Closed', order: 3, isDefault: false, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      Pipeline.findOneAndUpdate.mockResolvedValue(pipelineDoc);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      const result = await service.removeStage('pipe-1', 's2');

      expect(CallLog.countDocuments).toHaveBeenCalledWith({
        pipelineId: 'pipe-1',
        currentStageId: 's2',
        isClosed: false,
      });
      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1' },
        { $pull: { stages: { stageId: 's2' } } },
        { new: true },
      );
      expect(result).toBeDefined();
    });

    it('throws StageInUseError when active calls are in the stage', async () => {
      const stages = [
        makeStage({ stageId: 's1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
        makeStage({ stageId: 's2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(2);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.removeStage('pipe-1', 's2')).rejects.toThrow(StageInUseError);
    });

    it('throws StageNotFoundError when stage does not exist', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.removeStage('pipe-1', 'nonexistent')).rejects.toThrow(StageNotFoundError);
    });

    it('throws InvalidPipelineError when removing leaves pipeline invalid', async () => {
      // Single stage — removing it leaves empty stages
      const stages = [
        makeStage({ stageId: 's1', name: 'Only', order: 1, isDefault: true, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel(0);
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.removeStage('pipe-1', 's1')).rejects.toThrow(InvalidPipelineError);
    });
  });

  // ── updateStage ───────────────────────────────────────────────────────────

  describe('updateStage()', () => {
    it('updates a stage field', async () => {
      const stages = makeValidStages();
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      Pipeline.findOneAndUpdate.mockResolvedValue(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.updateStage('pipe-1', 'stage-1', { name: 'Updated' });

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1' },
        { $set: { 'stages.0.name': 'Updated' } },
        { new: true },
      );
    });

    it('throws StageNotFoundError for unknown stage', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.updateStage('pipe-1', 'no-stage', { name: 'X' })).rejects.toThrow(StageNotFoundError);
    });

    it('throws InvalidPipelineError if update creates duplicate stage names', async () => {
      const stages = [
        makeStage({ stageId: 's1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
        makeStage({ stageId: 's2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      // Renaming s1 to 'Closed' creates a duplicate
      await expect(service.updateStage('pipe-1', 's1', { name: 'Closed' })).rejects.toThrow(InvalidPipelineError);
    });
  });

  // ── reorderStages ─────────────────────────────────────────────────────────

  describe('reorderStages()', () => {
    it('reorders stages by setting order fields based on index', async () => {
      const stages = [
        makeStage({ stageId: 's1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
        makeStage({ stageId: 's2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      Pipeline.findOneAndUpdate.mockResolvedValue(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await service.reorderStages('pipe-1', ['s1', 's2']);

      expect(Pipeline.findOneAndUpdate).toHaveBeenCalledWith(
        { pipelineId: 'pipe-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ stages: expect.any(Array) }),
        }),
        { new: true },
      );
      const setArg = Pipeline.findOneAndUpdate.mock.calls[0][1].$set.stages;
      expect(setArg[0].stageId).toBe('s1');
      expect(setArg[0].order).toBe(1);
      expect(setArg[1].stageId).toBe('s2');
      expect(setArg[1].order).toBe(2);
    });

    it('throws StageNotFoundError for unknown stageId in reorder list', async () => {
      const pipelineDoc = makePipelineDoc();
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      await expect(service.reorderStages('pipe-1', ['stage-1', 'unknown'])).rejects.toThrow(StageNotFoundError);
    });

    it('throws InvalidPipelineError when not all stage IDs are provided', async () => {
      const stages = [
        makeStage({ stageId: 's1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
        makeStage({ stageId: 's2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
      ];
      const pipelineDoc = makePipelineDoc({ stages });
      const Pipeline = makePipelineModel(pipelineDoc);
      const CallLog = makeCallLogModel();
      const service = new PipelineService(Pipeline as any, CallLog as any, mockLogger);

      // Only 1 ID provided but pipeline has 2 stages
      await expect(service.reorderStages('pipe-1', ['s1'])).rejects.toThrow(InvalidPipelineError);
    });
  });
});

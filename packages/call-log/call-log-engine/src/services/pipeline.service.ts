import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { IPipelineStage } from '@astralibx/call-log-types';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import {
  PipelineNotFoundError,
  StageNotFoundError,
  StageInUseError,
  InvalidPipelineError,
} from '../errors/index.js';
import { validatePipelineStages } from '../validation/pipeline.validator.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreatePipelineInput {
  name: string;
  description?: string;
  stages: Omit<IPipelineStage, 'stageId'>[];
  isDefault?: boolean;
  createdBy: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePipelineInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PipelineService {
  constructor(
    private Pipeline: Model<IPipelineDocument>,
    private CallLog: Model<ICallLogDocument>,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get tenantFilter(): Record<string, unknown> {
    if (this.tenantId) return { tenantId: this.tenantId };
    return {};
  }

  async create(data: CreatePipelineInput): Promise<IPipelineDocument> {
    // Assign UUIDs to each stage
    const stages: IPipelineStage[] = data.stages.map((s) => ({
      ...s,
      stageId: crypto.randomUUID(),
    }));

    validatePipelineStages(stages);

    const pipelineId = crypto.randomUUID();

    // If this is marked as default, unset others
    if (data.isDefault) {
      await this.Pipeline.updateMany(
        { ...this.tenantFilter, isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    const pipeline = await this.Pipeline.create({
      pipelineId,
      name: data.name,
      description: data.description,
      stages,
      isDefault: data.isDefault ?? false,
      isActive: true,
      isDeleted: false,
      createdBy: data.createdBy,
      ...(data.tenantId ? { tenantId: data.tenantId } : this.tenantId ? { tenantId: this.tenantId } : {}),
      metadata: data.metadata,
    });

    this.logger.info('Pipeline created', { pipelineId, name: data.name });
    return pipeline;
  }

  async update(pipelineId: string, data: UpdatePipelineInput): Promise<IPipelineDocument> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false, ...this.tenantFilter });
    if (!pipeline) throw new PipelineNotFoundError(pipelineId);

    // If setting as default, unset others
    if (data.isDefault) {
      await this.Pipeline.updateMany(
        { ...this.tenantFilter, isDefault: true, pipelineId: { $ne: pipelineId } },
        { $set: { isDefault: false } },
      );
    }

    const updated = await this.Pipeline.findOneAndUpdate(
      { pipelineId, isDeleted: false },
      { $set: data },
      { new: true },
    );

    if (!updated) throw new PipelineNotFoundError(pipelineId);
    this.logger.info('Pipeline updated', { pipelineId, fields: Object.keys(data) });
    return updated;
  }

  async delete(pipelineId: string): Promise<void> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false, ...this.tenantFilter });
    if (!pipeline) throw new PipelineNotFoundError(pipelineId);

    const activeCallCount = await this.CallLog.countDocuments({ pipelineId, isClosed: false });
    if (activeCallCount > 0) {
      throw new InvalidPipelineError(`Cannot delete pipeline with ${activeCallCount} active (non-closed) calls`, pipelineId);
    }

    await this.Pipeline.findOneAndUpdate(
      { pipelineId, ...this.tenantFilter },
      { $set: { isDeleted: true, isActive: false } },
    );

    this.logger.info('Pipeline deleted', { pipelineId });
  }

  async list(filter?: { isActive?: boolean }): Promise<IPipelineDocument[]> {
    const query: Record<string, unknown> = { isDeleted: false, ...this.tenantFilter };
    if (filter?.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    return this.Pipeline.find(query).sort({ createdAt: 1 });
  }

  async get(pipelineId: string): Promise<IPipelineDocument> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false, ...this.tenantFilter });
    if (!pipeline) throw new PipelineNotFoundError(pipelineId);
    return pipeline;
  }

  async addStage(pipelineId: string, stage: Omit<IPipelineStage, 'stageId'>): Promise<IPipelineDocument> {
    const pipeline = await this.get(pipelineId);

    const newStage: IPipelineStage = {
      ...stage,
      stageId: crypto.randomUUID(),
    };

    const updatedStages = [...pipeline.stages, newStage];
    validatePipelineStages(updatedStages, pipelineId);

    const updated = await this.Pipeline.findOneAndUpdate(
      { pipelineId },
      { $push: { stages: newStage } },
      { new: true },
    );

    if (!updated) throw new PipelineNotFoundError(pipelineId);
    this.logger.info('Stage added to pipeline', { pipelineId, stageId: newStage.stageId });
    return updated;
  }

  async removeStage(pipelineId: string, stageId: string): Promise<IPipelineDocument> {
    const pipeline = await this.get(pipelineId);

    const stageExists = pipeline.stages.some((s) => s.stageId === stageId);
    if (!stageExists) throw new StageNotFoundError(pipelineId, stageId);

    const activeCallCount = await this.CallLog.countDocuments({ pipelineId, currentStageId: stageId, isClosed: false });
    if (activeCallCount > 0) {
      throw new StageInUseError(pipelineId, stageId, activeCallCount);
    }

    const updatedStages = pipeline.stages.filter((s) => s.stageId !== stageId);
    validatePipelineStages(updatedStages, pipelineId);

    const updated = await this.Pipeline.findOneAndUpdate(
      { pipelineId },
      { $pull: { stages: { stageId } } },
      { new: true },
    );

    if (!updated) throw new PipelineNotFoundError(pipelineId);
    this.logger.info('Stage removed from pipeline', { pipelineId, stageId });
    return updated;
  }

  async updateStage(
    pipelineId: string,
    stageId: string,
    data: Partial<IPipelineStage>,
  ): Promise<IPipelineDocument> {
    const pipeline = await this.get(pipelineId);

    const stageIndex = pipeline.stages.findIndex((s) => s.stageId === stageId);
    if (stageIndex === -1) throw new StageNotFoundError(pipelineId, stageId);

    // Build updated stages array for validation
    const updatedStages = pipeline.stages.map((s) => {
      const plain = (s as unknown as { toObject?(): IPipelineStage }).toObject?.() ?? s;
      if (s.stageId === stageId) {
        return { ...plain, ...data, stageId };
      }
      return plain;
    }) as IPipelineStage[];

    validatePipelineStages(updatedStages, pipelineId);

    // Build dotted path $set for the specific stage array element
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'stageId') {
        setFields[`stages.${stageIndex}.${key}`] = value;
      }
    }

    const updated = await this.Pipeline.findOneAndUpdate(
      { pipelineId },
      { $set: setFields },
      { new: true },
    );

    if (!updated) throw new PipelineNotFoundError(pipelineId);
    this.logger.info('Stage updated in pipeline', { pipelineId, stageId, fields: Object.keys(data) });
    return updated;
  }

  async reorderStages(pipelineId: string, stageIds: string[]): Promise<IPipelineDocument> {
    const pipeline = await this.get(pipelineId);

    // Validate all stageIds exist
    const existingIds = new Set(pipeline.stages.map((s) => s.stageId));
    for (const id of stageIds) {
      if (!existingIds.has(id)) throw new StageNotFoundError(pipelineId, id);
    }

    if (stageIds.length !== pipeline.stages.length) {
      throw new InvalidPipelineError(
        `reorderStages must include all ${pipeline.stages.length} stage IDs`,
        pipelineId,
      );
    }

    // Build reordered stages with updated order fields
    const stageMap = new Map(pipeline.stages.map((s) => [s.stageId, s]));
    const reorderedStages: IPipelineStage[] = stageIds.map((id, index) => {
      const s = stageMap.get(id)!;
      const plain = (s as unknown as { toObject?(): IPipelineStage }).toObject?.() ?? s;
      return { ...plain, order: index + 1 };
    });

    validatePipelineStages(reorderedStages, pipelineId);

    const updated = await this.Pipeline.findOneAndUpdate(
      { pipelineId },
      { $set: { stages: reorderedStages } },
      { new: true },
    );

    if (!updated) throw new PipelineNotFoundError(pipelineId);
    this.logger.info('Stages reordered in pipeline', { pipelineId });
    return updated;
  }
}

export interface IPipelineStage {
  stageId: string;
  name: string;
  color: string;
  order: number;
  isTerminal: boolean;
  isDefault: boolean;
}

export interface IPipeline {
  pipelineId: string;
  name: string;
  description?: string;
  stages: IPipelineStage[];
  isActive: boolean;
  isDeleted: boolean;
  isDefault: boolean;
  createdBy: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

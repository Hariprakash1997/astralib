import type { ModeOverride, AgentVisibility } from '../constants/index.js';

// ── Agent ────────────────────────────────────────────────────────────

export interface CreateAgentInput {
  name: string;
  avatar?: string;
  role?: string;
  isAI?: boolean;
  aiConfig?: Record<string, unknown>;
  promptTemplateId?: string;
  maxConcurrentChats?: number;
  modeOverride?: ModeOverride | null;
  aiEnabled?: boolean;
  autoAccept?: boolean;
  visibility?: AgentVisibility;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
  // Hierarchy
  level?: number;
  parentId?: string | null;
  teamId?: string | null;
}

export type UpdateAgentInput = Partial<Pick<CreateAgentInput,
  | 'name'
  | 'avatar'
  | 'role'
  | 'isAI'
  | 'aiConfig'
  | 'promptTemplateId'
  | 'maxConcurrentChats'
  | 'modeOverride'
  | 'aiEnabled'
  | 'autoAccept'
  | 'visibility'
  | 'isDefault'
  | 'metadata'
  | 'level'
  | 'parentId'
  | 'teamId'
>>;

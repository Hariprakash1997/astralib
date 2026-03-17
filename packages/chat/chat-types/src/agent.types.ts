import { AgentStatus } from './enums';

export interface ChatAgentInfo {
  agentId: string;
  name: string;
  avatar?: string;
  role?: string;
  status: AgentStatus;
  isAI: boolean;
}

export interface AgentIdentity {
  adminUserId: string;
  displayName: string;
  avatar?: string;
  permissions?: string[];
}

export interface DashboardStats {
  activeSessions: number;
  waitingSessions: number;
  resolvedToday: number;
  totalAgents: number;
  activeAgents: number;
}

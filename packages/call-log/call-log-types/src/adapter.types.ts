export interface AgentInfo {
  agentId: string;
  displayName: string;
  avatar?: string;
  teamId?: string;
}

export interface ContactInfo {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}

export interface AuthResult {
  adminUserId: string;
  displayName: string;
  role?: string;
}

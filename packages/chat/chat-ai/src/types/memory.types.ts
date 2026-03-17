export type MemoryScope = 'global' | 'agent' | 'visitor' | 'channel';
export type MemorySource = 'admin' | 'agent' | 'ai' | 'import';

export interface ChatMemory {
  memoryId: string;
  scope: MemoryScope;
  scopeId?: string;
  key: string;
  content: string;
  category?: string;
  tags?: string[];
  priority: number;
  isActive: boolean;
  source: MemorySource;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateMemoryInput {
  scope: MemoryScope;
  scopeId?: string;
  key: string;
  content: string;
  category?: string;
  tags?: string[];
  priority?: number;
  isActive?: boolean;
  source?: MemorySource;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateMemoryInput {
  key?: string;
  content?: string;
  category?: string;
  tags?: string[];
  priority?: number;
  isActive?: boolean;
  source?: MemorySource;
  metadata?: Record<string, unknown>;
}

export interface MemoryListQuery {
  scope?: MemoryScope;
  scopeId?: string;
  category?: string;
  source?: MemorySource;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface MemorySearchScope {
  visitorId?: string;
  agentId?: string;
  channel?: string;
}

export interface MemoryContext {
  visitorId: string;
  agentId?: string;
  channel?: string;
  query?: string;
  maxMemories?: number;
  maxTokens?: number;
}

export interface MemoryBackendBuiltin {
  type: 'builtin';
}

export interface MemoryBackendMem0 {
  type: 'mem0';
  client: any;
  scopeMapping?: {
    visitor?: (scopeId: string) => Record<string, unknown>;
    agent?: (scopeId: string) => Record<string, unknown>;
    global?: () => Record<string, unknown>;
    channel?: (scopeId: string) => Record<string, unknown>;
  };
}

export interface MemoryBackendCustom {
  type: 'custom';
  create: (input: CreateMemoryInput) => Promise<ChatMemory>;
  update: (id: string, input: UpdateMemoryInput) => Promise<ChatMemory>;
  delete: (id: string) => Promise<void>;
  list: (query: MemoryListQuery) => Promise<{ memories: ChatMemory[]; total: number }>;
  search: (query: string, scope: MemorySearchScope) => Promise<ChatMemory[]>;
  getByVisitor: (visitorId: string) => Promise<ChatMemory[]>;
}

export type MemoryBackendConfig = MemoryBackendBuiltin | MemoryBackendMem0 | MemoryBackendCustom;

export type MemorySearchStrategy = 'priority' | 'text' | 'custom';

export interface MemorySearchConfig {
  strategy: MemorySearchStrategy;
  customSearch?: (query: string, scope: MemorySearchScope) => Promise<ChatMemory[]>;
  maxMemories?: number;
  maxTokens?: number;
}

export interface MemoryBackend {
  create(input: CreateMemoryInput, embedding?: number[]): Promise<ChatMemory>;
  update(memoryId: string, input: UpdateMemoryInput, embedding?: number[]): Promise<ChatMemory>;
  delete(memoryId: string): Promise<void>;
  bulkDelete(memoryIds: string[]): Promise<{ deleted: number }>;
  findById(memoryId: string): Promise<ChatMemory | null>;
  findByKey(scope: MemoryScope, scopeId: string | null, key: string): Promise<ChatMemory | null>;
  list(query: MemoryListQuery): Promise<{ memories: ChatMemory[]; total: number }>;
  listByScope(scope: MemoryScope, scopeId?: string): Promise<ChatMemory[]>;
  listByCategory(category: string): Promise<ChatMemory[]>;
  listByVisitor(visitorId: string): Promise<ChatMemory[]>;
  getCategories(): Promise<string[]>;
  search(query: string, scope: MemorySearchScope): Promise<ChatMemory[]>;
  import(memories: CreateMemoryInput[]): Promise<{ imported: number; skipped: number }>;
  export(query?: MemoryListQuery): Promise<ChatMemory[]>;
}

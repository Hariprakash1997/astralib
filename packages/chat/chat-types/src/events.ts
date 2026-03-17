import { ChatMessage, MessagePayload, MessageReceivedPayload, MessageStatusPayload } from './message.types';
import { ChatSessionSummary, VisitorContext, ChatUserInfo, ChatFeedback } from './session.types';
import { ChatAgentInfo, AgentIdentity, DashboardStats } from './agent.types';
import { ChatSessionStatus, SessionMode } from './enums';

// Visitor -> Server
export const VisitorEvent = {
  Connect: 'chat:connect',
  Message: 'chat:message',
  Typing: 'chat:typing',
  Read: 'chat:read',
  Escalate: 'chat:escalate',
  Identify: 'chat:identify',
  Preferences: 'chat:set_preferences',
  TrackEvent: 'chat:track_event',
  Ping: 'chat:ping',
  Feedback: 'chat:feedback',
} as const;

// Server -> Visitor
export const ServerToVisitorEvent = {
  Connected: 'chat:connected',
  Message: 'chat:message',
  MessageStatus: 'chat:message_status',
  Typing: 'chat:typing',
  Status: 'chat:status',
  AgentJoin: 'chat:agent:join',
  AgentLeave: 'chat:agent:leave',
  Error: 'chat:error',
  Pong: 'chat:pong',
} as const;

// Agent -> Server
export const AgentEvent = {
  Connect: 'agent:connect',
  AcceptChat: 'agent:accept_chat',
  SendMessage: 'agent:send_message',
  Typing: 'agent:typing',
  ResolveChat: 'agent:resolve_chat',
  TakeOver: 'agent:take_over',
  HandBack: 'agent:hand_back',
  SetMode: 'agent:set_mode',
  GetSettings: 'agent:get_settings',
  UpdateSettings: 'agent:update_settings',
  SaveMemory: 'agent:save_memory',
  DeleteMemory: 'agent:delete_memory',
  TransferChat: 'agent:transfer_chat',
} as const;

// Server -> Agent
export const ServerToAgentEvent = {
  Connected: 'agent:connected',
  NewChat: 'agent:new_chat',
  ChatAssigned: 'agent:chat_assigned',
  ChatEnded: 'agent:chat_ended',
  Message: 'agent:message',
  VisitorTyping: 'agent:visitor_typing',
  VisitorDisconnected: 'agent:visitor_disconnected',
  VisitorReconnected: 'agent:visitor_reconnected',
  StatsUpdate: 'agent:stats_update',
  ModeChanged: 'agent:mode_changed',
  SettingsUpdated: 'agent:settings_updated',
  SessionEvent: 'agent:session_event',
  ChatTransferred: 'agent:chat_transferred',
} as const;

// Event payload interfaces
export interface ConnectPayload {
  context: VisitorContext;
  existingSessionId?: string;
}

export interface ConnectedPayload {
  sessionId: string;
  session: ChatSessionSummary;
  messages: ChatMessage[];
  agent?: ChatAgentInfo;
  preferences?: Record<string, unknown>;
}

export interface TypingPayload {
  isTyping: boolean;
  sessionId?: string;
}

export interface StatusPayload {
  status: ChatSessionStatus;
  agent?: ChatAgentInfo;
  queuePosition?: number;
}

export interface AgentConnectedPayload {
  stats: DashboardStats;
  waitingChats: ChatSessionSummary[];
  assignedChats: ChatSessionSummary[];
}

export interface TransferChatPayload {
  sessionId: string;
  targetAgentId: string;
  note?: string;
}

export interface ChatTransferredPayload {
  session: ChatSessionSummary;
  messages: ChatMessage[];
  transferNote?: string;
}

export interface SaveMemoryPayload {
  sessionId: string;
  content: string;
  key?: string;
  category?: string;
}

export interface EscalatePayload {
  reason?: string;
}

export interface TrackEventPayload {
  eventType: string;
  description?: string;
  data?: Record<string, unknown>;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export interface ModeChangedPayload {
  sessionId: string;
  mode: SessionMode;
  takenOverBy?: string;
  agentName?: string;
}

export interface FeedbackPayload {
  rating?: number;
  survey?: Record<string, unknown>;
}

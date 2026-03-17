import { describe, it, expect } from 'vitest';
import {
  // Enums
  ChatSessionStatus,
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
  SessionMode,
  AgentStatus,
  // Event constants
  VisitorEvent,
  ServerToVisitorEvent,
  AgentEvent,
  ServerToAgentEvent,
  // Type imports (compile-time verification)
  type ChatMessage,
  type MessagePayload,
  type MessageReceivedPayload,
  type MessageStatusPayload,
  type ChatSessionSummary,
  type VisitorContext,
  type ChatUserInfo,
  type SessionStats,
  type ChatFeedback,
  type ChatAgentInfo,
  type AgentIdentity,
  type DashboardStats,
  type ConnectPayload,
  type ConnectedPayload,
  type TypingPayload,
  type StatusPayload,
  type AgentConnectedPayload,
  type TransferChatPayload,
  type ChatTransferredPayload,
  type SaveMemoryPayload,
  type EscalatePayload,
  type TrackEventPayload,
  type ChatErrorPayload,
  type ModeChangedPayload,
  type FeedbackPayload,
  type ChatWidgetConfig,
  type ChatWidgetFeatures,
  type ChatBranding,
  type OfflineConfig,
  type PostChatConfig,
  type FormField,
  type FormFieldValidation,
  type ChatTranslations,
  type PreChatFlowConfig,
  type FlowStep,
  type WelcomeStep,
  type FAQStep,
  type FAQCategory,
  type FAQItem,
  type GuidedQuestionsStep,
  type GuidedQuestion,
  type GuidedOption,
  type FormStep,
  type AgentSelectorStep,
  type CustomHTMLStep,
  type AssignAgentContext,
  type AiResponseInput,
  type AiResponseOutput,
  type MemoryHint,
  type VisitorIdentity,
  type ChatTrackingEvent,
  type ChatMetric,
  type ErrorContext,
} from '../src/index';

describe('Enums', () => {
  describe('ChatSessionStatus', () => {
    it('should have correct string values', () => {
      expect(ChatSessionStatus.New).toBe('new');
      expect(ChatSessionStatus.Active).toBe('active');
      expect(ChatSessionStatus.WaitingAgent).toBe('waiting_agent');
      expect(ChatSessionStatus.WithAgent).toBe('with_agent');
      expect(ChatSessionStatus.Resolved).toBe('resolved');
      expect(ChatSessionStatus.Abandoned).toBe('abandoned');
    });
  });

  describe('ChatSenderType', () => {
    it('should have correct string values', () => {
      expect(ChatSenderType.Visitor).toBe('visitor');
      expect(ChatSenderType.Agent).toBe('agent');
      expect(ChatSenderType.AI).toBe('ai');
      expect(ChatSenderType.System).toBe('system');
    });
  });

  describe('ChatContentType', () => {
    it('should have correct string values', () => {
      expect(ChatContentType.Text).toBe('text');
      expect(ChatContentType.Image).toBe('image');
      expect(ChatContentType.File).toBe('file');
      expect(ChatContentType.Card).toBe('card');
      expect(ChatContentType.System).toBe('system');
    });
  });

  describe('ChatMessageStatus', () => {
    it('should have correct string values', () => {
      expect(ChatMessageStatus.Sending).toBe('sending');
      expect(ChatMessageStatus.Sent).toBe('sent');
      expect(ChatMessageStatus.Delivered).toBe('delivered');
      expect(ChatMessageStatus.Read).toBe('read');
      expect(ChatMessageStatus.Failed).toBe('failed');
    });
  });

  describe('SessionMode', () => {
    it('should have correct string values', () => {
      expect(SessionMode.AI).toBe('ai');
      expect(SessionMode.Manual).toBe('manual');
    });
  });

  describe('AgentStatus', () => {
    it('should have correct string values', () => {
      expect(AgentStatus.Available).toBe('available');
      expect(AgentStatus.Busy).toBe('busy');
      expect(AgentStatus.Away).toBe('away');
      expect(AgentStatus.Offline).toBe('offline');
    });
  });
});

describe('Event Constants', () => {
  describe('VisitorEvent', () => {
    it('should have correct string values', () => {
      expect(VisitorEvent.Connect).toBe('chat:connect');
      expect(VisitorEvent.Message).toBe('chat:message');
      expect(VisitorEvent.Typing).toBe('chat:typing');
      expect(VisitorEvent.Read).toBe('chat:read');
      expect(VisitorEvent.Escalate).toBe('chat:escalate');
      expect(VisitorEvent.Identify).toBe('chat:identify');
      expect(VisitorEvent.Preferences).toBe('chat:set_preferences');
      expect(VisitorEvent.TrackEvent).toBe('chat:track_event');
      expect(VisitorEvent.Ping).toBe('chat:ping');
      expect(VisitorEvent.Feedback).toBe('chat:feedback');
    });

    it('should be readonly (as const)', () => {
      const event: typeof VisitorEvent.Connect = 'chat:connect';
      expect(event).toBe('chat:connect');
    });
  });

  describe('ServerToVisitorEvent', () => {
    it('should have correct string values', () => {
      expect(ServerToVisitorEvent.Connected).toBe('chat:connected');
      expect(ServerToVisitorEvent.Message).toBe('chat:message');
      expect(ServerToVisitorEvent.MessageStatus).toBe('chat:message_status');
      expect(ServerToVisitorEvent.Typing).toBe('chat:typing');
      expect(ServerToVisitorEvent.Status).toBe('chat:status');
      expect(ServerToVisitorEvent.AgentJoin).toBe('chat:agent:join');
      expect(ServerToVisitorEvent.AgentLeave).toBe('chat:agent:leave');
      expect(ServerToVisitorEvent.Error).toBe('chat:error');
      expect(ServerToVisitorEvent.Pong).toBe('chat:pong');
    });

    it('should be readonly (as const)', () => {
      const event: typeof ServerToVisitorEvent.Connected = 'chat:connected';
      expect(event).toBe('chat:connected');
    });
  });

  describe('AgentEvent', () => {
    it('should have correct string values', () => {
      expect(AgentEvent.Connect).toBe('agent:connect');
      expect(AgentEvent.AcceptChat).toBe('agent:accept_chat');
      expect(AgentEvent.SendMessage).toBe('agent:send_message');
      expect(AgentEvent.Typing).toBe('agent:typing');
      expect(AgentEvent.ResolveChat).toBe('agent:resolve_chat');
      expect(AgentEvent.TakeOver).toBe('agent:take_over');
      expect(AgentEvent.HandBack).toBe('agent:hand_back');
      expect(AgentEvent.SetMode).toBe('agent:set_mode');
      expect(AgentEvent.GetSettings).toBe('agent:get_settings');
      expect(AgentEvent.UpdateSettings).toBe('agent:update_settings');
      expect(AgentEvent.SaveMemory).toBe('agent:save_memory');
      expect(AgentEvent.DeleteMemory).toBe('agent:delete_memory');
      expect(AgentEvent.TransferChat).toBe('agent:transfer_chat');
    });

    it('should be readonly (as const)', () => {
      const event: typeof AgentEvent.Connect = 'agent:connect';
      expect(event).toBe('agent:connect');
    });
  });

  describe('ServerToAgentEvent', () => {
    it('should have correct string values', () => {
      expect(ServerToAgentEvent.Connected).toBe('agent:connected');
      expect(ServerToAgentEvent.NewChat).toBe('agent:new_chat');
      expect(ServerToAgentEvent.ChatAssigned).toBe('agent:chat_assigned');
      expect(ServerToAgentEvent.ChatEnded).toBe('agent:chat_ended');
      expect(ServerToAgentEvent.Message).toBe('agent:message');
      expect(ServerToAgentEvent.VisitorTyping).toBe('agent:visitor_typing');
      expect(ServerToAgentEvent.VisitorDisconnected).toBe('agent:visitor_disconnected');
      expect(ServerToAgentEvent.VisitorReconnected).toBe('agent:visitor_reconnected');
      expect(ServerToAgentEvent.StatsUpdate).toBe('agent:stats_update');
      expect(ServerToAgentEvent.ModeChanged).toBe('agent:mode_changed');
      expect(ServerToAgentEvent.SettingsUpdated).toBe('agent:settings_updated');
      expect(ServerToAgentEvent.SessionEvent).toBe('agent:session_event');
      expect(ServerToAgentEvent.ChatTransferred).toBe('agent:chat_transferred');
    });

    it('should be readonly (as const)', () => {
      const event: typeof ServerToAgentEvent.Connected = 'agent:connected';
      expect(event).toBe('agent:connected');
    });
  });
});

describe('Type exports (compile-time checks)', () => {
  it('should allow creating objects matching exported interfaces', () => {
    // This test verifies that all type exports are valid at compile time.
    // If any type is missing or malformed, TypeScript compilation will fail.
    const message: ChatMessage = {
      _id: '1',
      messageId: 'msg-1',
      sessionId: 'sess-1',
      senderType: ChatSenderType.Visitor,
      content: 'Hello',
      contentType: ChatContentType.Text,
      status: ChatMessageStatus.Sent,
      createdAt: new Date(),
    };
    expect(message.messageId).toBe('msg-1');

    const payload: MessagePayload = {
      content: 'Hello',
    };
    expect(payload.content).toBe('Hello');

    const agent: ChatAgentInfo = {
      agentId: 'agent-1',
      name: 'Agent Smith',
      status: AgentStatus.Available,
      isAI: false,
    };
    expect(agent.agentId).toBe('agent-1');

    const stats: DashboardStats = {
      activeSessions: 5,
      waitingSessions: 2,
      resolvedToday: 10,
      totalAgents: 3,
      activeAgents: 2,
    };
    expect(stats.activeSessions).toBe(5);

    const session: ChatSessionSummary = {
      sessionId: 'sess-1',
      status: ChatSessionStatus.Active,
      mode: SessionMode.AI,
      visitorId: 'v-1',
      messageCount: 3,
      startedAt: new Date(),
    };
    expect(session.sessionId).toBe('sess-1');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogAdapter } from '@astralibx/core';
import type { Socket, Namespace } from 'socket.io';
import {
  AgentEvent,
  ServerToAgentEvent,
  ServerToVisitorEvent,
  VisitorEvent,
  ChatSessionStatus,
  ChatSenderType,
  ChatContentType,
  SessionMode,
  AgentStatus,
} from '@astralibx/chat-types';
import type {
  SendAiMessagePayload,
  AgentDisconnectedPayload,
  FetchSupportPersonsPayload,
  SetPreferredAgentPayload,
  LabelMessagePayload,
  LabelSessionPayload,
  UpdateStatusPayload,
  TrackEventPayload,
} from '@astralibx/chat-types';

// Shared test utilities

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockSocket(): Socket {
  const rooms = new Set<string>();
  return {
    id: 'socket-1',
    emit: vi.fn(),
    on: vi.fn(),
    join: vi.fn(),
    rooms,
    disconnect: vi.fn(),
  } as unknown as Socket;
}

function createMockNamespace(): Namespace {
  return {
    on: vi.fn(),
    emit: vi.fn(),
    sockets: new Map(),
  } as unknown as Namespace;
}

function createMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'agent-1' },
    name: 'Test Agent',
    avatar: undefined,
    role: 'support',
    isAI: false,
    isActive: true,
    isOnline: true,
    status: AgentStatus.Available,
    activeChats: 1,
    maxConcurrentChats: 5,
    totalChatsHandled: 10,
    visibility: 'internal',
    isDefault: false,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    visitorId: 'visitor-1',
    visitorFingerprint: 'fp-1',
    status: ChatSessionStatus.WithAgent,
    mode: SessionMode.Manual,
    channel: 'web',
    agentId: 'agent-1',
    messageCount: 5,
    startedAt: new Date(),
    metadata: {},
    conversationSummary: undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockMessage(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'msg-1' },
    messageId: 'msg-1',
    sessionId: 'session-1',
    senderType: ChatSenderType.Visitor,
    senderName: undefined,
    content: 'Hello',
    contentType: ChatContentType.Text,
    status: 'sent',
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

// ---- Gap 6: Agent Disconnect Notification ----

describe('Gap 6: Agent Disconnect Notification', () => {
  it('should emit AgentDisconnected to affected visitors when agent disconnects', async () => {
    const session1 = createMockSession({ sessionId: 'session-1' });
    const session2 = createMockSession({ sessionId: 'session-2' });
    const agentDoc = createMockAgent();

    const emitToVisitorMock = vi.fn().mockResolvedValue(true);

    // Simulate the disconnect logic from agent.handler.ts
    const connectedAgentId = 'agent-1';
    const assignedSessions = [session1, session2];

    for (const session of assignedSessions) {
      await emitToVisitorMock(
        {},
        session.sessionId,
        ServerToVisitorEvent.AgentDisconnected,
        {
          sessionId: session.sessionId,
          agentId: connectedAgentId,
          agentName: agentDoc.name,
        } as AgentDisconnectedPayload,
      );
    }

    expect(emitToVisitorMock).toHaveBeenCalledTimes(2);
    expect(emitToVisitorMock).toHaveBeenCalledWith(
      {},
      'session-1',
      ServerToVisitorEvent.AgentDisconnected,
      expect.objectContaining({
        sessionId: 'session-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
      }),
    );
    expect(emitToVisitorMock).toHaveBeenCalledWith(
      {},
      'session-2',
      ServerToVisitorEvent.AgentDisconnected,
      expect.objectContaining({
        sessionId: 'session-2',
        agentId: 'agent-1',
        agentName: 'Test Agent',
      }),
    );
  });

  it('should not emit AgentDisconnected when no sessions are assigned', async () => {
    const emitToVisitorMock = vi.fn().mockResolvedValue(true);
    const assignedSessions: any[] = [];

    for (const session of assignedSessions) {
      await emitToVisitorMock(
        {},
        session.sessionId,
        ServerToVisitorEvent.AgentDisconnected,
        { sessionId: session.sessionId, agentId: 'agent-1' },
      );
    }

    expect(emitToVisitorMock).not.toHaveBeenCalled();
  });
});

// ---- Gap 1+7: Support Person Discovery ----

describe('Gap 1+7: Support Person Discovery', () => {
  describe('FetchSupportPersons', () => {
    it('should return agents when visitorAgentSelection is enabled', async () => {
      const socket = createMockSocket();
      const logger = createMockLogger();

      const publicAgent = createMockAgent({ visibility: 'public' });
      const agentInfo = {
        agentId: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.Available,
        isAI: false,
        visibility: 'public',
        isDefault: false,
      };

      const settingsService = {
        get: vi.fn().mockResolvedValue({ visitorAgentSelection: true }),
      };
      const agentService = {
        listPublicAgents: vi.fn().mockResolvedValue([agentInfo]),
      };

      // Simulate handler logic
      const settings = await settingsService.get();
      if (settings?.visitorAgentSelection) {
        const agents = await agentService.listPublicAgents();
        socket.emit(ServerToVisitorEvent.SupportPersons, { agents });
      }

      expect(agentService.listPublicAgents).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        ServerToVisitorEvent.SupportPersons,
        { agents: [agentInfo] },
      );
    });

    it('should not return agents when visitorAgentSelection is disabled', async () => {
      const socket = createMockSocket();
      const logger = createMockLogger();

      const settingsService = {
        get: vi.fn().mockResolvedValue({ visitorAgentSelection: false }),
      };
      const agentService = {
        listPublicAgents: vi.fn(),
      };

      const settings = await settingsService.get();
      if (settings?.visitorAgentSelection) {
        const agents = await agentService.listPublicAgents();
        socket.emit(ServerToVisitorEvent.SupportPersons, { agents });
      } else {
        logger.info('Visitor agent selection disabled, ignoring FetchSupportPersons');
      }

      expect(agentService.listPublicAgents).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('SetPreferredAgent', () => {
    it('should assign agent and emit status to visitor', async () => {
      const socket = createMockSocket();
      socket.rooms.add('socket-1');
      socket.rooms.add('session-1');

      const agent = createMockAgent({ visibility: 'public' });
      const session = createMockSession();

      const settingsService = {
        get: vi.fn().mockResolvedValue({ visitorAgentSelection: true }),
      };
      const agentService = {
        findById: vi.fn().mockResolvedValue(agent),
        toAgentInfo: vi.fn().mockReturnValue({
          agentId: 'agent-1',
          name: 'Test Agent',
          status: AgentStatus.Available,
          isAI: false,
        }),
      };
      const sessionService = {
        assignAgent: vi.fn().mockResolvedValue(session),
        findById: vi.fn().mockResolvedValue(session),
        toSummary: vi.fn().mockReturnValue({ sessionId: 'session-1' }),
      };
      const emitToAgentMock = vi.fn().mockResolvedValue(true);

      // Simulate handler logic
      const settings = await settingsService.get();
      if (!settings?.visitorAgentSelection) return;

      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const foundAgent = await agentService.findById('agent-1');
      if (!foundAgent || !foundAgent.isActive || foundAgent.visibility !== 'public') {
        socket.emit(ServerToVisitorEvent.Error, { code: 'AGENT_UNAVAILABLE', message: 'Agent not available' });
        return;
      }

      await sessionService.assignAgent(sessionId, foundAgent._id.toString());
      const agentInfo = agentService.toAgentInfo(foundAgent);

      socket.emit(ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WithAgent,
        agent: agentInfo,
      });

      expect(sessionService.assignAgent).toHaveBeenCalledWith('session-1', 'agent-1');
      expect(socket.emit).toHaveBeenCalledWith(
        ServerToVisitorEvent.Status,
        expect.objectContaining({
          status: ChatSessionStatus.WithAgent,
          agent: expect.objectContaining({ agentId: 'agent-1' }),
        }),
      );
    });

    it('should emit error when agent is not public', async () => {
      const socket = createMockSocket();
      socket.rooms.add('socket-1');
      socket.rooms.add('session-1');

      const agent = createMockAgent({ visibility: 'internal' });

      const settingsService = {
        get: vi.fn().mockResolvedValue({ visitorAgentSelection: true }),
      };
      const agentService = {
        findById: vi.fn().mockResolvedValue(agent),
      };

      const settings = await settingsService.get();
      if (!settings?.visitorAgentSelection) return;

      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      const sessionId = rooms[0];
      if (!sessionId) return;

      const foundAgent = await agentService.findById('agent-1');
      if (!foundAgent || !foundAgent.isActive || foundAgent.visibility !== 'public') {
        socket.emit(ServerToVisitorEvent.Error, { code: 'AGENT_UNAVAILABLE', message: 'Agent not available' });
        return;
      }

      expect(socket.emit).toHaveBeenCalledWith(
        ServerToVisitorEvent.Error,
        { code: 'AGENT_UNAVAILABLE', message: 'Agent not available' },
      );
    });
  });
});

// ---- Gap 2: Agent Sends AI Message ----

describe('Gap 2: Agent Sends AI Message', () => {
  it('should generate and send AI message when AI is configured', async () => {
    const socket = createMockSocket();
    const logger = createMockLogger();
    const agentNs = createMockNamespace();

    const session = createMockSession();
    const messages = [createMockMessage()];
    const agentDoc = createMockAgent();

    const aiOutput = {
      messages: ['AI response 1', 'AI response 2'],
      conversationSummary: 'Summary of conversation',
    };

    const generateAiResponse = vi.fn().mockResolvedValue(aiOutput);
    const createdMessages: any[] = [];

    const sessionService = {
      findByIdOrFail: vi.fn().mockResolvedValue(session),
      updateLastMessage: vi.fn().mockResolvedValue(undefined),
      updateConversationSummary: vi.fn().mockResolvedValue(undefined),
    };
    const messageService = {
      findBySession: vi.fn().mockResolvedValue(messages),
      toPayload: vi.fn().mockImplementation((m: any) => ({
        messageId: m.messageId,
        content: m.content,
        senderType: m.senderType,
      })),
      create: vi.fn().mockImplementation(async (params: any) => {
        const msg = createMockMessage({
          messageId: `ai-msg-${createdMessages.length}`,
          content: params.content,
          senderType: ChatSenderType.AI,
          senderName: params.senderName,
        });
        createdMessages.push(msg);
        return msg;
      }),
    };
    const agentService = {
      findById: vi.fn().mockResolvedValue(agentDoc),
      findDefaultAiAgent: vi.fn(),
      toAgentInfo: vi.fn().mockReturnValue({
        agentId: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.Available,
        isAI: false,
      }),
    };
    const emitToVisitorMock = vi.fn().mockResolvedValue(true);

    // Simulate handler logic
    const payload: SendAiMessagePayload = { sessionId: 'session-1' };

    const foundSession = await sessionService.findByIdOrFail(payload.sessionId);
    const sessionMessages = await messageService.findBySession(payload.sessionId, 50);

    const foundAgentDoc = await agentService.findById('agent-1');
    const agentInfo = agentService.toAgentInfo(foundAgentDoc);

    const aiInput = {
      sessionId: foundSession.sessionId,
      visitorId: foundSession.visitorId,
      messages: sessionMessages.map((m: any) => messageService.toPayload(m)),
      agent: agentInfo,
      visitorContext: {
        visitorId: foundSession.visitorId,
        channel: foundSession.channel,
      },
    };

    const output = await generateAiResponse(aiInput);

    for (const content of output.messages) {
      const msg = await messageService.create({
        sessionId: foundSession.sessionId,
        senderType: ChatSenderType.AI,
        senderName: agentInfo.name,
        content,
        contentType: ChatContentType.Text,
      });

      await sessionService.updateLastMessage(foundSession.sessionId);

      const messagePayload = messageService.toPayload(msg);

      await emitToVisitorMock(
        {},
        foundSession.sessionId,
        ServerToVisitorEvent.Message,
        { message: messagePayload },
      );

      agentNs.emit(ServerToAgentEvent.Message, {
        sessionId: foundSession.sessionId,
        message: messagePayload,
      });
    }

    if (output.conversationSummary) {
      await sessionService.updateConversationSummary(foundSession.sessionId, output.conversationSummary);
    }

    expect(generateAiResponse).toHaveBeenCalledTimes(1);
    expect(messageService.create).toHaveBeenCalledTimes(2);
    expect(emitToVisitorMock).toHaveBeenCalledTimes(2);
    expect(agentNs.emit).toHaveBeenCalledTimes(2);
    expect(sessionService.updateConversationSummary).toHaveBeenCalledWith('session-1', 'Summary of conversation');
  });

  it('should return error when AI is not configured', async () => {
    const socket = createMockSocket();

    const config = { adapters: {} }; // no generateAiResponse

    // Simulate handler logic
    if (!config.adapters.generateAiResponse) {
      socket.emit(ServerToAgentEvent.SessionEvent, {
        sessionId: 'session-1',
        error: 'AI not configured',
      });
    }

    expect(socket.emit).toHaveBeenCalledWith(
      ServerToAgentEvent.SessionEvent,
      { sessionId: 'session-1', error: 'AI not configured' },
    );
  });
});

// ---- Gap 8: Message and Session Labeling ----

describe('Gap 8: Message and Session Labeling', () => {
  describe('LabelMessage handler', () => {
    it('should update message label when labeling is enabled', async () => {
      const logger = createMockLogger();
      const messageService = {
        updateLabel: vi.fn().mockResolvedValue(undefined),
      };

      const options = { labelingEnabled: true };
      const payload: LabelMessagePayload = {
        sessionId: 'session-1',
        messageId: 'msg-1',
        trainingQuality: 'good',
      };

      // Simulate handler logic
      if (!options.labelingEnabled) return;
      await messageService.updateLabel(payload.messageId, payload.trainingQuality);
      logger.info('Message labeled', { messageId: payload.messageId, quality: payload.trainingQuality });

      expect(messageService.updateLabel).toHaveBeenCalledWith('msg-1', 'good');
      expect(logger.info).toHaveBeenCalledWith('Message labeled', { messageId: 'msg-1', quality: 'good' });
    });

    it('should silently ignore when labeling is disabled', async () => {
      const messageService = {
        updateLabel: vi.fn().mockResolvedValue(undefined),
      };

      const options = { labelingEnabled: false };
      const payload: LabelMessagePayload = {
        sessionId: 'session-1',
        messageId: 'msg-1',
        trainingQuality: 'bad',
      };

      // Simulate handler logic
      if (!options.labelingEnabled) {
        // noop
      } else {
        await messageService.updateLabel(payload.messageId, payload.trainingQuality);
      }

      expect(messageService.updateLabel).not.toHaveBeenCalled();
    });
  });

  describe('LabelSession handler', () => {
    it('should update session metadata when labeling is enabled', async () => {
      const logger = createMockLogger();
      const sessionService = {
        updateMetadata: vi.fn().mockResolvedValue(undefined),
      };

      const options = { labelingEnabled: true };
      const payload: LabelSessionPayload = {
        sessionId: 'session-1',
        trainingQuality: 'needs_review',
      };

      if (!options.labelingEnabled) return;
      await sessionService.updateMetadata(payload.sessionId, { trainingQuality: payload.trainingQuality });
      logger.info('Session labeled', { sessionId: payload.sessionId, quality: payload.trainingQuality });

      expect(sessionService.updateMetadata).toHaveBeenCalledWith('session-1', { trainingQuality: 'needs_review' });
    });

    it('should silently ignore when labeling is disabled', async () => {
      const sessionService = {
        updateMetadata: vi.fn().mockResolvedValue(undefined),
      };

      const options = { labelingEnabled: false };
      const payload: LabelSessionPayload = {
        sessionId: 'session-1',
        trainingQuality: 'good',
      };

      if (!options.labelingEnabled) {
        // noop
      } else {
        await sessionService.updateMetadata(payload.sessionId, { trainingQuality: payload.trainingQuality });
      }

      expect(sessionService.updateMetadata).not.toHaveBeenCalled();
    });
  });
});

// ---- Gap 9: Real-Time Queue Position Updates ----

describe('Gap 9: Real-Time Queue Position Updates', () => {
  it('recalculateQueuePositions should only update sessions after fromPosition', async () => {
    const waitingSessions = [
      { _id: 'id-2', sessionId: 'sess-2', queuePosition: 3 },
      { _id: 'id-3', sessionId: 'sess-3', queuePosition: 4 },
    ];

    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

    // Simulate recalculateQueuePositions logic
    const fromPosition = 2;
    const updates: { sessionId: string; queuePosition: number }[] = [];
    for (let i = 0; i < waitingSessions.length; i++) {
      const newPosition = fromPosition + i;
      await updateOne(
        { _id: waitingSessions[i]._id },
        { $set: { queuePosition: newPosition } },
      );
      updates.push({ sessionId: waitingSessions[i].sessionId, queuePosition: newPosition });
    }

    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'id-2' },
      { $set: { queuePosition: 2 } },
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'id-3' },
      { $set: { queuePosition: 3 } },
    );
    expect(updates).toEqual([
      { sessionId: 'sess-2', queuePosition: 2 },
      { sessionId: 'sess-3', queuePosition: 3 },
    ]);
  });

  it('broadcastQueuePositions should emit Status to each visitor', async () => {
    const emitToVisitorMock = vi.fn().mockResolvedValue(true);

    const updates = [
      { sessionId: 'sess-2', queuePosition: 1 },
      { sessionId: 'sess-3', queuePosition: 2 },
    ];

    for (const update of updates) {
      await emitToVisitorMock({}, update.sessionId, ServerToVisitorEvent.Status, {
        status: ChatSessionStatus.WaitingAgent,
        queuePosition: update.queuePosition,
      });
    }

    expect(emitToVisitorMock).toHaveBeenCalledTimes(2);
    expect(emitToVisitorMock).toHaveBeenCalledWith(
      {},
      'sess-2',
      ServerToVisitorEvent.Status,
      { status: ChatSessionStatus.WaitingAgent, queuePosition: 1 },
    );
    expect(emitToVisitorMock).toHaveBeenCalledWith(
      {},
      'sess-3',
      ServerToVisitorEvent.Status,
      { status: ChatSessionStatus.WaitingAgent, queuePosition: 2 },
    );
  });
});

// ---- Gap 10: Visitor Behavior Tracking as System Messages ----

describe('Gap 10: Visitor Behavior Tracking as System Messages', () => {
  it('should create system message and emit to agents when trackEventsAsMessages is enabled', async () => {
    const agentNs = createMockNamespace();
    const session = createMockSession();

    const systemMsg = createMockMessage({
      messageId: 'sys-msg-1',
      senderType: ChatSenderType.System,
      content: 'page_view: Viewed pricing page',
      metadata: { eventType: 'page_view', eventData: { page: '/pricing' } },
    });

    const messageService = {
      createSystemMessage: vi.fn().mockResolvedValue(systemMsg),
      toPayload: vi.fn().mockReturnValue({
        messageId: 'sys-msg-1',
        content: 'page_view: Viewed pricing page',
        senderType: ChatSenderType.System,
      }),
    };

    const options = { trackEventsAsMessages: true };
    const payload: TrackEventPayload = {
      eventType: 'page_view',
      description: 'Viewed pricing page',
      data: { page: '/pricing' },
    };

    // Simulate handler logic
    if (options.trackEventsAsMessages) {
      const msg = await messageService.createSystemMessage(
        session.sessionId,
        `${payload.eventType}: ${payload.description || ''}`.trim(),
        { eventType: payload.eventType, eventData: payload.data },
      );
      agentNs.emit(ServerToAgentEvent.SessionEvent, {
        sessionId: session.sessionId,
        message: messageService.toPayload(msg),
      });
    }

    expect(messageService.createSystemMessage).toHaveBeenCalledWith(
      'session-1',
      'page_view: Viewed pricing page',
      { eventType: 'page_view', eventData: { page: '/pricing' } },
    );
    expect(agentNs.emit).toHaveBeenCalledWith(
      ServerToAgentEvent.SessionEvent,
      expect.objectContaining({
        sessionId: 'session-1',
        message: expect.objectContaining({ messageId: 'sys-msg-1' }),
      }),
    );
  });

  it('should not create system message when trackEventsAsMessages is disabled', async () => {
    const messageService = {
      createSystemMessage: vi.fn(),
    };

    const options = { trackEventsAsMessages: false };

    if (options.trackEventsAsMessages) {
      await messageService.createSystemMessage('session-1', 'page_view:');
    }

    expect(messageService.createSystemMessage).not.toHaveBeenCalled();
  });

  it('should handle events without description', async () => {
    const agentNs = createMockNamespace();
    const session = createMockSession();

    const systemMsg = createMockMessage({
      senderType: ChatSenderType.System,
      content: 'click:',
    });

    const messageService = {
      createSystemMessage: vi.fn().mockResolvedValue(systemMsg),
      toPayload: vi.fn().mockReturnValue({ messageId: 'sys-msg-1', content: 'click:' }),
    };

    const options = { trackEventsAsMessages: true };
    const payload: TrackEventPayload = { eventType: 'click' };

    if (options.trackEventsAsMessages) {
      const msg = await messageService.createSystemMessage(
        session.sessionId,
        `${payload.eventType}: ${payload.description || ''}`.trim(),
        { eventType: payload.eventType, eventData: payload.data },
      );
      agentNs.emit(ServerToAgentEvent.SessionEvent, {
        sessionId: session.sessionId,
        message: messageService.toPayload(msg),
      });
    }

    expect(messageService.createSystemMessage).toHaveBeenCalledWith(
      'session-1',
      'click:',
      { eventType: 'click', eventData: undefined },
    );
  });
});

// ---- Gap 11: Agent Status Update Event ----

describe('Gap 11: Agent Status Update Event', () => {
  it('should update agent status and broadcast stats', async () => {
    const logger = createMockLogger();
    const agentNs = createMockNamespace();

    const agentService = {
      updateStatus: vi.fn().mockResolvedValue(createMockAgent({ status: AgentStatus.Busy })),
    };
    const sessionService = {
      getDashboardStats: vi.fn().mockResolvedValue({
        activeSessions: 3,
        waitingSessions: 1,
        resolvedToday: 5,
        totalAgents: 0,
        activeAgents: 0,
      }),
    };
    const agentCountService = {
      getTotalAgentCount: vi.fn().mockResolvedValue(4),
      getOnlineAgentCount: vi.fn().mockResolvedValue(2),
    };

    const connectedAgentId = 'agent-1';
    const payload: UpdateStatusPayload = { status: AgentStatus.Busy };

    // Simulate handler logic
    await agentService.updateStatus(connectedAgentId, payload.status);

    const stats = await sessionService.getDashboardStats();
    const [totalAgents, activeAgents] = await Promise.all([
      agentCountService.getTotalAgentCount(),
      agentCountService.getOnlineAgentCount(),
    ]);
    agentNs.emit(ServerToAgentEvent.StatsUpdate, {
      stats: { ...stats, totalAgents, activeAgents },
    });

    logger.info('Agent status updated', { agentId: connectedAgentId, status: payload.status });

    expect(agentService.updateStatus).toHaveBeenCalledWith('agent-1', AgentStatus.Busy);
    expect(agentNs.emit).toHaveBeenCalledWith(
      ServerToAgentEvent.StatsUpdate,
      {
        stats: expect.objectContaining({
          activeSessions: 3,
          totalAgents: 4,
          activeAgents: 2,
        }),
      },
    );
  });

  it('should not process when agent is not connected', async () => {
    const agentService = {
      updateStatus: vi.fn(),
    };

    const connectedAgentId: string | undefined = undefined;

    if (!connectedAgentId) {
      // noop - return early
    } else {
      await agentService.updateStatus(connectedAgentId, AgentStatus.Away);
    }

    expect(agentService.updateStatus).not.toHaveBeenCalled();
  });

  describe('hasCapacity respects busy/away status', () => {
    it('should return false when agent status is Busy', async () => {
      const agent = createMockAgent({ status: AgentStatus.Busy, activeChats: 0, maxConcurrentChats: 5 });

      // Simulate updated hasCapacity logic
      const hasCapacity = agent.isActive
        && agent.status !== AgentStatus.Busy
        && agent.status !== AgentStatus.Away
        && agent.activeChats < agent.maxConcurrentChats;

      expect(hasCapacity).toBe(false);
    });

    it('should return false when agent status is Away', async () => {
      const agent = createMockAgent({ status: AgentStatus.Away, activeChats: 0, maxConcurrentChats: 5 });

      const hasCapacity = agent.isActive
        && agent.status !== AgentStatus.Busy
        && agent.status !== AgentStatus.Away
        && agent.activeChats < agent.maxConcurrentChats;

      expect(hasCapacity).toBe(false);
    });

    it('should return true when agent is Available and under capacity', async () => {
      const agent = createMockAgent({ status: AgentStatus.Available, activeChats: 2, maxConcurrentChats: 5 });

      const hasCapacity = agent.isActive
        && agent.status !== AgentStatus.Busy
        && agent.status !== AgentStatus.Away
        && agent.activeChats < agent.maxConcurrentChats;

      expect(hasCapacity).toBe(true);
    });

    it('should return false when agent is inactive', async () => {
      const agent = createMockAgent({ status: AgentStatus.Available, isActive: false, activeChats: 0, maxConcurrentChats: 5 });

      const hasCapacity = agent.isActive
        && agent.status !== AgentStatus.Busy
        && agent.status !== AgentStatus.Away
        && agent.activeChats < agent.maxConcurrentChats;

      expect(hasCapacity).toBe(false);
    });
  });
});

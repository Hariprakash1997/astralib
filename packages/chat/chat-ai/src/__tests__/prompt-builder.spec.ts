import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilderService } from '../services/prompt-builder.service';
import type { PromptService } from '../services/prompt.service';
import type { MemoryService } from '../services/memory.service';
import type { KnowledgeService } from '../services/knowledge.service';
import type { LogAdapter } from '@astralibx/core';
import type { ChatPromptTemplate } from '../types/prompt.types';
import type { ChatMessage } from '@astralibx/chat-types';
import { ChatSenderType, ChatContentType, ChatMessageStatus } from '@astralibx/chat-types';

const mockLogger: LogAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createMockMessage(content: string, senderType: string = 'visitor'): ChatMessage {
  return {
    _id: '1',
    messageId: 'msg-1',
    sessionId: 'session-1',
    senderType: senderType as ChatSenderType,
    content,
    contentType: ChatContentType.Text,
    status: ChatMessageStatus.Delivered,
    createdAt: new Date(),
  };
}

const mockTemplate: ChatPromptTemplate = {
  templateId: 'tpl-1',
  name: 'Test',
  isDefault: true,
  isActive: true,
  sections: [
    {
      key: 'identity',
      label: 'Identity',
      content: 'You are {{agentName}}, a support agent for {{companyName}}.',
      position: 1,
      isEnabled: true,
      isSystem: false,
      variables: ['agentName', 'companyName'],
    },
    {
      key: 'memory_injection',
      label: 'Memories',
      content: '',
      position: 2,
      isEnabled: true,
      isSystem: true,
    },
    {
      key: 'knowledge_injection',
      label: 'Knowledge',
      content: '',
      position: 3,
      isEnabled: true,
      isSystem: true,
    },
    {
      key: 'conversation_history',
      label: 'History',
      content: '',
      position: 4,
      isEnabled: true,
      isSystem: true,
    },
    {
      key: 'rules',
      label: 'Rules',
      content: 'Never discuss pricing.',
      position: 5,
      isEnabled: true,
      isSystem: false,
    },
    {
      key: 'disabled_section',
      label: 'Disabled',
      content: 'This should not appear',
      position: 6,
      isEnabled: false,
      isSystem: false,
    },
  ],
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PromptBuilderService', () => {
  let builder: PromptBuilderService;
  let promptService: PromptService;
  let memoryService: MemoryService;
  let knowledgeService: KnowledgeService;

  beforeEach(() => {
    vi.clearAllMocks();

    promptService = {
      findById: vi.fn().mockResolvedValue(mockTemplate),
      findDefault: vi.fn().mockResolvedValue(mockTemplate),
    } as any;

    memoryService = {
      getRelevantMemories: vi.fn().mockResolvedValue([
        {
          memoryId: 'mem-1',
          scope: 'global',
          key: 'hours',
          content: 'Business hours are 9am-5pm',
          priority: 50,
          isActive: true,
          source: 'admin',
        },
      ]),
    } as any;

    knowledgeService = {
      getRelevantKnowledge: vi.fn().mockResolvedValue([
        {
          entryId: 'k-1',
          title: 'Return Policy',
          content: '30 day returns accepted.',
          priority: 50,
          isActive: true,
        },
      ]),
    } as any;

    builder = new PromptBuilderService(promptService, memoryService, knowledgeService, mockLogger);
  });

  it('should build a prompt with all sections', async () => {
    const result = await builder.buildPrompt({
      templateId: 'tpl-1',
      context: {
        agentName: 'Sarah',
        visitorId: 'v1',
        channel: 'web',
        message: 'What is your return policy?',
        recentMessages: [createMockMessage('What is your return policy?')],
        variables: { companyName: 'Acme Corp' },
      },
    });

    expect(result.systemPrompt).toContain('You are Sarah, a support agent for Acme Corp.');
    expect(result.systemPrompt).toContain('Business hours are 9am-5pm');
    expect(result.systemPrompt).toContain('Return Policy');
    expect(result.systemPrompt).toContain('30 day returns accepted.');
    expect(result.systemPrompt).toContain('Never discuss pricing.');
    expect(result.systemPrompt).not.toContain('This should not appear');
    expect(result.templateId).toBe('tpl-1');
    expect(result.userMessage).toBe('What is your return policy?');
    expect(result.resolvedVariables).toHaveProperty('agentName', 'Sarah');
    expect(result.resolvedVariables).toHaveProperty('companyName', 'Acme Corp');
  });

  it('should use default template when templateId not found', async () => {
    (promptService.findById as any).mockResolvedValue(null);

    const result = await builder.buildPrompt({
      templateId: 'nonexistent',
      context: {
        agentName: 'Sarah',
        visitorId: 'v1',
        channel: 'web',
        message: 'hello',
        recentMessages: [],
      },
    });

    expect(promptService.findDefault).toHaveBeenCalled();
    expect(result.systemPrompt).toContain('Sarah');
  });

  it('should return minimal prompt when no template exists', async () => {
    (promptService.findById as any).mockResolvedValue(null);
    (promptService.findDefault as any).mockResolvedValue(null);

    const result = await builder.buildPrompt({
      context: {
        agentName: 'Sarah',
        visitorId: 'v1',
        channel: 'web',
        message: 'hello',
        recentMessages: [],
      },
    });

    expect(result.systemPrompt).toBe('You are a helpful assistant.');
    expect(result.templateId).toBeNull();
  });

  it('should include conversation history', async () => {
    const result = await builder.buildPrompt({
      templateId: 'tpl-1',
      context: {
        agentName: 'Sarah',
        visitorId: 'v1',
        channel: 'web',
        message: 'follow up',
        recentMessages: [
          createMockMessage('Hello', 'visitor'),
          createMockMessage('Hi there!', 'ai'),
        ],
        conversationSummary: 'Visitor asked about pricing.',
      },
    });

    expect(result.systemPrompt).toContain('Conversation History');
    expect(result.systemPrompt).toContain('Visitor asked about pricing.');
    expect(result.systemPrompt).toContain('visitor: Hello');
    expect(result.systemPrompt).toContain('ai: Hi there!');
  });

  it('should skip empty system sections', async () => {
    (memoryService.getRelevantMemories as any).mockResolvedValue([]);
    (knowledgeService.getRelevantKnowledge as any).mockResolvedValue([]);

    const result = await builder.buildPrompt({
      templateId: 'tpl-1',
      context: {
        agentName: 'Sarah',
        visitorId: 'v1',
        channel: 'web',
        message: 'hello',
        recentMessages: [],
      },
    });

    expect(result.systemPrompt).not.toContain('Relevant Memories');
    expect(result.systemPrompt).not.toContain('Knowledge Base');
    expect(result.systemPrompt).not.toContain('Conversation History');
  });

  describe('parseResponse', () => {
    it('should parse JSON response', () => {
      const raw = JSON.stringify({
        messages: ['Hello!', 'How can I help?'],
        conversationSummary: 'Greeting exchange',
        shouldEscalate: false,
      });

      const result = builder.parseResponse(raw);
      expect(result.messages).toEqual(['Hello!', 'How can I help?']);
      expect(result.conversationSummary).toBe('Greeting exchange');
      expect(result.shouldEscalate).toBe(false);
    });

    it('should fallback to raw string for non-JSON', () => {
      const result = builder.parseResponse('Just a plain text response');
      expect(result.messages).toEqual(['Just a plain text response']);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should handle single message JSON', () => {
      const raw = JSON.stringify({ message: 'Single response' });
      const result = builder.parseResponse(raw);
      expect(result.messages).toEqual(['Single response']);
    });
  });
});

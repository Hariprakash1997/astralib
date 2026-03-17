import Handlebars from 'handlebars';
import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage } from '@astralibx/chat-types';
import type { MemoryService } from './memory.service';
import type { KnowledgeService } from './knowledge.service';
import type { PromptService } from './prompt.service';
import type {
  PromptBuildInput,
  PromptOutput,
  PromptSection,
  ParsedAIResponse,
} from '../types/prompt.types';

export class PromptBuilderService {
  constructor(
    private promptService: PromptService,
    private memoryService: MemoryService,
    private knowledgeService: KnowledgeService,
    private logger: LogAdapter,
  ) {}

  async buildPrompt(input: PromptBuildInput): Promise<PromptOutput> {
    const { context } = input;
    const resolvedVariables: Record<string, string> = {};

    // 1. Load template
    let template = null;
    if (input.templateId) {
      template = await this.promptService.findById(input.templateId);
    }
    if (!template) {
      template = await this.promptService.findDefault();
    }

    // If no template found, build a minimal prompt
    if (!template) {
      this.logger.info('No prompt template found, using minimal prompt');
      return {
        systemPrompt: 'You are a helpful assistant.',
        userMessage: context.message,
        templateId: null,
        resolvedVariables,
      };
    }

    // 2. Filter to enabled sections, sort by position
    const sections = template.sections
      .filter((s) => s.isEnabled)
      .sort((a, b) => a.position - b.position);

    // 3. Build each section
    const builtSections: string[] = [];

    for (const section of sections) {
      let content: string;

      if (section.isSystem) {
        content = await this.buildSystemSection(section, context);
      } else {
        content = this.buildUserSection(section, context, resolvedVariables);
      }

      if (content.trim()) {
        builtSections.push(content);
      }
    }

    // 4. Concatenate into system prompt
    const systemPrompt = builtSections.join('\n\n');

    return {
      systemPrompt,
      userMessage: context.message,
      templateId: template.templateId,
      resolvedVariables,
    };
  }

  private async buildSystemSection(
    section: PromptSection,
    context: {
      agentId?: string;
      visitorId: string;
      channel: string;
      message: string;
      recentMessages: ChatMessage[];
      conversationSummary?: string;
    },
  ): Promise<string> {
    switch (section.key) {
      case 'memory_injection': {
        const memories = await this.memoryService.getRelevantMemories({
          visitorId: context.visitorId,
          agentId: context.agentId,
          channel: context.channel,
          query: context.message,
        });

        if (memories.length === 0) return '';

        const memoryLines = memories.map(
          (m) => `- [${m.scope}${m.scopeId ? ':' + m.scopeId : ''}] ${m.key}: ${m.content}`,
        );

        return `## Relevant Memories\n${memoryLines.join('\n')}`;
      }

      case 'knowledge_injection': {
        const entries = await this.knowledgeService.getRelevantKnowledge(context.message);

        if (entries.length === 0) return '';

        const knowledgeLines = entries.map(
          (e) => `### ${e.title}\n${e.content}`,
        );

        return `## Knowledge Base\n${knowledgeLines.join('\n\n')}`;
      }

      case 'conversation_history': {
        if (context.recentMessages.length === 0 && !context.conversationSummary) {
          return '';
        }

        const parts: string[] = [];

        if (context.conversationSummary) {
          parts.push(`Summary: ${context.conversationSummary}`);
        }

        if (context.recentMessages.length > 0) {
          const historyLines = context.recentMessages.map(
            (m) => `${m.senderType}: ${m.content}`,
          );
          parts.push(historyLines.join('\n'));
        }

        return `## Conversation History\n${parts.join('\n\n')}`;
      }

      default:
        // Unknown system section, render as-is
        return section.content;
    }
  }

  private buildUserSection(
    section: PromptSection,
    context: {
      agentName: string;
      agentId?: string;
      visitorId: string;
      channel: string;
      variables?: Record<string, string>;
    },
    resolvedVariables: Record<string, string>,
  ): string {
    // Build template data from context + user variables
    const templateData: Record<string, string> = {
      agentName: context.agentName,
      agentId: context.agentId ?? '',
      visitorId: context.visitorId,
      channel: context.channel,
      ...context.variables,
    };

    try {
      const compiled = Handlebars.compile(section.content, { noEscape: true });
      const result = compiled(templateData);

      // Track resolved variables
      if (section.variables) {
        for (const v of section.variables) {
          if (templateData[v] !== undefined) {
            resolvedVariables[v] = templateData[v];
          }
        }
      }

      return result;
    } catch (err) {
      this.logger.error('Failed to render prompt section', {
        key: section.key,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return section.content;
    }
  }

  parseResponse(raw: string): ParsedAIResponse {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(raw);
      return {
        messages: Array.isArray(parsed.messages)
          ? parsed.messages
          : parsed.message
            ? [parsed.message]
            : [raw],
        conversationSummary: parsed.conversationSummary ?? parsed.summary,
        shouldEscalate: parsed.shouldEscalate ?? parsed.escalate ?? false,
        escalationReason: parsed.escalationReason,
        extracted: parsed.extracted ?? parsed.extractedData,
        metadata: parsed.metadata,
      };
    } catch {
      // Fallback: treat entire raw string as a single message
      return {
        messages: [raw],
        shouldEscalate: false,
      };
    }
  }
}

import type { LogAdapter } from '@astralibx/core';
import type { ChatSessionModel, ChatSessionDocument } from '../schemas/chat-session.schema.js';
import type { ChatMessageModel, ChatMessageDocument } from '../schemas/chat-message.schema.js';
import { SessionNotFoundError } from '../errors/index.js';

export type ExportFormat = 'json' | 'csv';

export interface ExportFilter {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  tags?: string[];
  status?: string;
}

export interface ExportedSession {
  session: ChatSessionDocument;
  messages: ChatMessageDocument[];
}

export class ExportService {
  constructor(
    private ChatSession: ChatSessionModel,
    private ChatMessage: ChatMessageModel,
    private logger: LogAdapter,
  ) {}

  async exportSession(sessionId: string, format: ExportFormat): Promise<string> {
    const session = await this.ChatSession.findOne({ sessionId });
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const messages = await this.ChatMessage
      .find({ sessionId })
      .sort({ createdAt: 1 });

    if (format === 'csv') {
      return this.toCSV([{ session, messages }]);
    }

    return JSON.stringify({
      session: session.toObject(),
      messages: messages.map(m => m.toObject()),
    }, null, 2);
  }

  async exportSessions(filter: ExportFilter, format: ExportFormat): Promise<string> {
    const query: Record<string, unknown> = {};

    if (filter.status) query.status = filter.status;
    if (filter.agentId) query.agentId = filter.agentId;
    if (filter.tags && filter.tags.length > 0) query.tags = { $in: filter.tags };

    if (filter.dateFrom || filter.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.dateFrom) dateFilter.$gte = new Date(filter.dateFrom);
      if (filter.dateTo) dateFilter.$lte = new Date(filter.dateTo);
      query.startedAt = dateFilter;
    }

    const sessions = await this.ChatSession.find(query).sort({ startedAt: -1 });
    const sessionIds = sessions.map(s => s.sessionId);

    const allMessages = await this.ChatMessage
      .find({ sessionId: { $in: sessionIds } })
      .sort({ createdAt: 1 });

    const messagesBySession = new Map<string, ChatMessageDocument[]>();
    for (const msg of allMessages) {
      const list = messagesBySession.get(msg.sessionId) || [];
      list.push(msg);
      messagesBySession.set(msg.sessionId, list);
    }

    const exported: ExportedSession[] = sessions.map(session => ({
      session,
      messages: messagesBySession.get(session.sessionId) || [],
    }));

    if (format === 'csv') {
      return this.toCSV(exported);
    }

    return JSON.stringify(
      exported.map(e => ({
        session: e.session.toObject(),
        messages: e.messages.map(m => m.toObject()),
      })),
      null,
      2,
    );
  }

  private toCSV(data: ExportedSession[]): string {
    const header = 'timestamp,sender,senderType,content,sessionId';
    const rows: string[] = [header];

    for (const { session, messages } of data) {
      for (const msg of messages) {
        const timestamp = msg.createdAt ? new Date(msg.createdAt).toISOString() : '';
        const sender = this.escapeCSV(msg.senderName || '');
        const senderType = msg.senderType || '';
        const content = this.escapeCSV(msg.content || '');
        const sid = session.sessionId;
        rows.push(`${timestamp},${sender},${senderType},${content},${sid}`);
      }
    }

    return rows.join('\n');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

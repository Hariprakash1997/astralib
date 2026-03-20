import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatMessage, ChatSessionSummary, DashboardStats, ChatAgentInfo } from '@astralibx/chat-types';
import {
  ChatSenderType, AgentEvent, ServerToAgentEvent, ChatSessionStatus,
  SessionMode, AgentStatus,
} from '@astralibx/chat-types';
import type {
  EscalationNeededPayload,
  SendAiMessagePayload,
  UpdateStatusPayload,
  LabelMessagePayload,
  WatchChatPayload,
  EscalateChatPayload,
} from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
} from '../../styles/shared.js';

interface CannedResponse {
  responseId?: string;
  _id?: string;
  title: string;
  content: string;
  shortcut?: string;
  category?: string;
}

export class AlxChatAgentDashboard extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .dashboard-layout {
        display: grid;
        grid-template-columns: 280px 1fr 300px;
        height: 600px;
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
        background: var(--alx-surface);
      }

      /* Left panel: session list */
      .panel-left {
        border-right: 1px solid var(--alx-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .panel-left-header {
        padding: 0.75rem;
        border-bottom: 1px solid var(--alx-border);
        font-weight: 600;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .session-sections {
        flex: 1;
        overflow-y: auto;
      }

      .section-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        padding: 0.5rem 0.75rem 0.25rem;
      }

      .session-item {
        display: flex;
        flex-direction: column;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
        transition: background 0.1s;
      }

      .session-item:hover {
        background: color-mix(in srgb, var(--alx-primary) 5%, transparent);
      }

      .session-item.active {
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        border-left: 3px solid var(--alx-primary);
      }

      .session-item-name {
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .session-item-meta {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      /* Center panel: chat */
      .panel-center {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .chat-header {
        padding: 0.75rem;
        border-bottom: 1px solid var(--alx-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .chat-header-info {
        display: flex;
        flex-direction: column;
      }

      .chat-header-name {
        font-weight: 600;
        font-size: 0.875rem;
      }

      .chat-header-status {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
      }

      .chat-header-status.online {
        color: var(--alx-success);
      }

      .chat-actions {
        display: flex;
        gap: 0.375rem;
      }

      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .msg {
        max-width: 75%;
        padding: 0.4rem 0.65rem;
        border-radius: 8px;
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      .msg.visitor {
        align-self: flex-start;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
      }

      .msg.agent, .msg.ai {
        align-self: flex-end;
        background: color-mix(in srgb, var(--alx-primary) 15%, var(--alx-surface));
        border: 1px solid color-mix(in srgb, var(--alx-primary) 30%, transparent);
      }

      .msg.system {
        align-self: center;
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        font-style: italic;
      }

      .msg-sender {
        font-size: 0.625rem;
        font-weight: 600;
        color: var(--alx-text-muted);
        margin-bottom: 0.1rem;
      }

      .msg-time {
        font-size: 0.5625rem;
        color: var(--alx-text-muted);
        text-align: right;
        margin-top: 0.15rem;
      }

      .typing-indicator {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        font-style: italic;
        padding: 0.25rem 0.75rem;
      }

      .chat-input-area {
        border-top: 1px solid var(--alx-border);
        padding: 0.5rem 0.75rem;
        display: flex;
        gap: 0.5rem;
        flex-shrink: 0;
        position: relative;
      }

      .chat-input-area input {
        flex: 1;
      }

      .canned-dropdown {
        position: absolute;
        bottom: 100%;
        left: 0.75rem;
        right: 0.75rem;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        box-shadow: var(--alx-shadow-md);
        max-height: 200px;
        overflow-y: auto;
        z-index: 10;
      }

      .canned-item {
        padding: 0.375rem 0.625rem;
        cursor: pointer;
        font-size: 0.8125rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
      }

      .canned-item:hover {
        background: color-mix(in srgb, var(--alx-primary) 8%, transparent);
      }

      .canned-item-title {
        font-weight: 500;
      }

      .canned-item-shortcut {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
      }

      /* Right panel: detail */
      .panel-right {
        border-left: 1px solid var(--alx-border);
        overflow-y: auto;
        padding: 0.75rem;
      }

      .no-selection {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }

      .detail-section {
        margin-bottom: 0.75rem;
      }

      .detail-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        margin-bottom: 0.35rem;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8125rem;
        padding: 0.15rem 0;
      }

      .detail-label { color: var(--alx-text-muted); font-size: 0.75rem; }
      .detail-value { font-weight: 500; }

      /* Status controls */
      .status-controls { display: flex; gap: 4px; }
      .status-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 4px 10px; border-radius: 6px;
        border: 1px solid var(--alx-border, #2d3748);
        background: transparent; color: var(--alx-text-muted, #9ca3af);
        font-size: 12px; cursor: pointer; transition: all 0.15s;
      }
      .status-btn.active {
        border-color: var(--alx-primary, #6366f1);
        color: var(--alx-text, #e4e4e7);
      }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; }
      .status-dot.available { background: #22c55e; }
      .status-dot.away { background: #f59e0b; }
      .status-dot.busy { background: #ef4444; }

      /* AI generate button */
      .action-btn {
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; border-radius: 6px;
        border: 1px solid var(--alx-border, #2d3748);
        background: transparent; color: var(--alx-text-muted, #9ca3af);
        cursor: pointer; transition: all 0.15s;
      }
      .action-btn:hover {
        border-color: var(--alx-primary, #6366f1);
        color: var(--alx-primary, #6366f1);
      }

      /* Label buttons */
      .label-actions { display: flex; gap: 4px; margin-top: 4px; }
      .label-btn {
        width: 24px; height: 24px; border-radius: 6px;
        border: 1px solid var(--alx-border, #2d3748);
        background: transparent; color: var(--alx-text-muted, #9ca3af);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      .label-btn:hover { border-color: var(--alx-primary, #6366f1); color: var(--alx-primary, #6366f1); }

      /* Tag chips on session cards */
      .session-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.15rem;
        margin-top: 0.2rem;
      }

      .tag-chip {
        display: inline-block;
        padding: 0.05rem 0.35rem;
        font-size: 0.5625rem;
        background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-primary) 25%, transparent);
        border-radius: 999px;
        color: var(--alx-text-muted);
      }

      /* User category badge */
      .category-badge {
        display: inline-block;
        padding: 0.05rem 0.35rem;
        font-size: 0.5625rem;
        background: color-mix(in srgb, var(--alx-info) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-info) 25%, transparent);
        border-radius: 999px;
        color: var(--alx-info);
        margin-top: 0.15rem;
      }

      /* Watching indicator for manager read-only chats */
      .watching-indicator {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        color: var(--alx-warning);
        font-style: italic;
        border-bottom: 1px solid var(--alx-border);
      }

      .send-disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      /* Transfer dialog overlay */
      .transfer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }

      .transfer-dialog {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        width: 380px;
        max-height: 480px;
        display: flex;
        flex-direction: column;
        box-shadow: var(--alx-shadow-md);
      }

      .transfer-dialog-header {
        padding: 0.75rem;
        border-bottom: 1px solid var(--alx-border);
        font-weight: 600;
        font-size: 0.875rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .transfer-dialog-body {
        padding: 0.75rem;
        overflow-y: auto;
        flex: 1;
      }

      .transfer-agent-list {
        margin-top: 0.5rem;
        max-height: 200px;
        overflow-y: auto;
      }

      .transfer-agent-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        cursor: pointer;
        border-radius: var(--alx-radius);
        border: 1px solid transparent;
        transition: background 0.1s;
      }

      .transfer-agent-item:hover {
        background: color-mix(in srgb, var(--alx-primary) 8%, transparent);
      }

      .transfer-agent-item.selected {
        border-color: var(--alx-primary);
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
      }

      .transfer-agent-name {
        font-size: 0.8125rem;
        font-weight: 500;
        flex: 1;
      }

      .transfer-agent-meta {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
      }

      .transfer-dialog-footer {
        padding: 0.75rem;
        border-top: 1px solid var(--alx-border);
        display: flex;
        gap: 0.375rem;
        justify-content: flex-end;
      }

      /* Notes section in detail panel */
      .note-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.375rem;
        padding: 0.25rem 0;
        font-size: 0.8125rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 30%, transparent);
      }

      .note-item:last-child { border-bottom: none; }

      .note-content { flex: 1; word-break: break-word; }

      .note-remove {
        background: none;
        border: none;
        color: var(--alx-text-muted);
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        line-height: 1;
        flex-shrink: 0;
      }

      .note-remove:hover { color: var(--alx-danger); }

      .note-add-row {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.375rem;
      }

      .note-add-row input { flex: 1; }

      /* Canned responses browse panel */
      .canned-browse-panel {
        position: absolute;
        bottom: 100%;
        left: 0.75rem;
        right: 0.75rem;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        box-shadow: var(--alx-shadow-md);
        max-height: 280px;
        display: flex;
        flex-direction: column;
        z-index: 10;
      }

      .canned-browse-header {
        padding: 0.5rem;
        border-bottom: 1px solid var(--alx-border);
        display: flex;
        gap: 0.375rem;
        align-items: center;
      }

      .canned-browse-header input { flex: 1; }

      .canned-browse-list {
        overflow-y: auto;
        flex: 1;
      }

      .canned-category-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        padding: 0.375rem 0.625rem 0.15rem;
        background: var(--alx-surface-alt);
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: String }) agentToken = '';
  @property({ type: Boolean }) isManager = false;

  @state() private socket: unknown = null;
  @state() private connected = false;
  @state() private waitingChats: ChatSessionSummary[] = [];
  @state() private assignedChats: ChatSessionSummary[] = [];
  @state() private watchedChats: ChatSessionSummary[] = [];
  @state() private selectedSessionId = '';
  @state() private messages: ChatMessage[] = [];
  @state() private messageInput = '';
  @state() private visitorTyping = false;
  @state() private visitorOnline = true;
  @state() private stats: DashboardStats | null = null;
  @state() private cannedResponses: CannedResponse[] = [];
  @state() private showCanned = false;
  @state() private filteredCanned: CannedResponse[] = [];
  @state() private agentStatus: string = AgentStatus.Available;
  // Transfer dialog state
  @state() private showTransferDialog = false;
  @state() private transferAgents: Array<{ agentId: string; name: string; status: string; level?: number }> = [];
  @state() private transferSearch = '';
  @state() private transferSelectedAgentId = '';
  @state() private transferNote = '';
  // Escalate state
  @state() private supervisorAgent: { agentId: string; name: string } | null = null;
  @state() private agentLevel: number = 1;
  // User category and notes state
  @state() private availableUserCategories: string[] = [];
  @state() private sessionNotes: Array<{ noteId?: string; _id?: string; content: string; createdAt?: string }> = [];
  @state() private newNoteText = '';
  // Canned responses browse panel
  @state() private showCannedBrowse = false;
  @state() private cannedBrowseSearch = '';

  private http!: HttpClient;
  private ownAgentId = '';

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.connectSocket();
    this.loadCannedResponses();
    this.loadAvailableAgents();
    this.loadUserCategories();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectSocket();
  }

  private async connectSocket() {
    // Clean up any existing socket before creating a new one
    this.disconnectSocket();

    const socketUrl = AlxChatConfig.getSocketUrl();
    const namespace = AlxChatConfig.getAgentNamespace();
    if (!socketUrl) return;

    try {
      // @ts-ignore -- socket.io-client is an optional peer dep, imported dynamically
      const { io } = await import('socket.io-client');
      const sock = io(socketUrl + namespace, {
        auth: { token: this.agentToken || AlxChatConfig.get().authToken },
        transports: ['websocket', 'polling'],
      }) as any;

      sock.on('connect', () => {
        this.connected = true;
        sock.emit(AgentEvent.Connect, {});
      });

      sock.on('disconnect', () => {
        this.connected = false;
      });

      sock.on(ServerToAgentEvent.Connected, (payload: any) => {
        this.stats = payload.stats;
        this.waitingChats = payload.waitingChats ?? [];
        this.assignedChats = payload.assignedChats ?? [];
        // Store own agentId from server response or fall back to auth config
        if (payload.agentId) {
          this.ownAgentId = payload.agentId;
        }
      });

      sock.on(ServerToAgentEvent.NewChat, (session: ChatSessionSummary) => {
        if (!this.waitingChats.find(s => s.sessionId === session.sessionId)) {
          this.waitingChats = [...this.waitingChats, session];
        }
      });

      sock.on(ServerToAgentEvent.ChatAssigned, (session: ChatSessionSummary) => {
        this.waitingChats = this.waitingChats.filter(s => s.sessionId !== session.sessionId);
        if (!this.assignedChats.find(s => s.sessionId === session.sessionId)) {
          this.assignedChats = [...this.assignedChats, session];
        }
      });

      sock.on(ServerToAgentEvent.ChatEnded, (data: { sessionId: string }) => {
        this.assignedChats = this.assignedChats.filter(s => s.sessionId !== data.sessionId);
        this.waitingChats = this.waitingChats.filter(s => s.sessionId !== data.sessionId);
        if (this.selectedSessionId === data.sessionId) {
          this.selectedSessionId = '';
          this.messages = [];
        }
      });

      sock.on(ServerToAgentEvent.Message, (payload: { message: ChatMessage }) => {
        if (payload.message.sessionId === this.selectedSessionId) {
          this.messages = [...this.messages, payload.message];
          this.scrollToBottom();
        }
      });

      sock.on(ServerToAgentEvent.VisitorTyping, (payload: { sessionId: string; isTyping: boolean }) => {
        if (payload.sessionId === this.selectedSessionId) {
          this.visitorTyping = payload.isTyping;
        }
      });

      sock.on(ServerToAgentEvent.VisitorDisconnected, (data: { sessionId: string }) => {
        if (data.sessionId === this.selectedSessionId) {
          this.visitorOnline = false;
        }
      });

      sock.on(ServerToAgentEvent.VisitorReconnected, (data: { sessionId: string }) => {
        if (data.sessionId === this.selectedSessionId) {
          this.visitorOnline = true;
        }
      });

      sock.on(ServerToAgentEvent.StatsUpdate, (stats: DashboardStats) => {
        this.stats = stats;
      });

      sock.on(ServerToAgentEvent.ChatTransferred, (payload: { session: ChatSessionSummary; messages: ChatMessage[] }) => {
        if (!this.assignedChats.find(s => s.sessionId === payload.session.sessionId)) {
          this.assignedChats = [...this.assignedChats, payload.session];
        }
      });

      sock.on(ServerToAgentEvent.WatchingChat, (payload: { session: ChatSessionSummary; messages: ChatMessage[] }) => {
        if (!this.watchedChats.find(s => s.sessionId === payload.session.sessionId)) {
          this.watchedChats = [...this.watchedChats, payload.session];
        }
        if (this.selectedSessionId === payload.session.sessionId) {
          this.messages = payload.messages ?? [];
          this.scrollToBottom();
        }
      });

      sock.on(ServerToAgentEvent.EscalationNeeded, (payload: EscalationNeededPayload) => {
        if (payload.session) {
          const exists = this.waitingChats.find(c => c.sessionId === payload.session.sessionId);
          if (!exists) {
            this.waitingChats = [...this.waitingChats, payload.session];
          }
        }
        this.requestUpdate();
      });

      this.socket = sock;
    } catch {
      // socket.io-client not available
    }
  }

  private disconnectSocket() {
    if (this.socket) {
      (this.socket as any).removeAllListeners();
      (this.socket as any).disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  private async loadCannedResponses() {
    try {
      const result = await this.http.get<CannedResponse[] | { data: CannedResponse[] }>('/canned-responses');
      this.cannedResponses = Array.isArray(result) ? result : (result as { data: CannedResponse[] }).data ?? [];
    } catch {
      // Non-critical
    }
  }

  private async loadAvailableAgents() {
    try {
      const result = await this.http.get<any>('/agents');
      const agents = Array.isArray(result) ? result : result.agents ?? [];
      this.transferAgents = agents.map((a: any) => ({
        agentId: a.agentId,
        name: a.name,
        status: a.status ?? 'offline',
        level: a.level,
      }));
      // Determine current agent's supervisor (parent with one level up)
      const currentAgent = agents.find((a: any) => a.agentId === this.getOwnAgentId());
      if (currentAgent) {
        this.agentLevel = currentAgent.level ?? 1;
        if (currentAgent.parentId) {
          const supervisor = agents.find((a: any) => a.agentId === currentAgent.parentId);
          if (supervisor) {
            this.supervisorAgent = { agentId: supervisor.agentId, name: supervisor.name };
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  private async loadUserCategories() {
    try {
      const result = await this.http.get<any>('/settings');
      const settings = result.settings ?? result;
      this.availableUserCategories = settings.availableUserCategories ?? [];
    } catch {
      // Non-critical
    }
  }

  private getOwnAgentId(): string {
    return this.ownAgentId;
  }

  private selectSession(sessionId: string) {
    this.selectedSessionId = sessionId;
    this.messages = [];
    this.visitorTyping = false;
    this.visitorOnline = true;
    this.sessionNotes = [];
    this.newNoteText = '';
    this.loadSessionMessages(sessionId);
    this.loadSessionNotes(sessionId);
  }

  private async loadSessionMessages(sessionId: string) {
    try {
      const result = await this.http.get<{ data: ChatMessage[]; hasMore: boolean }>(
        `/sessions/${sessionId}/messages`,
        { limit: 50 },
      );
      this.messages = result.data ?? [];
      this.scrollToBottom();
    } catch {
      // Fallback: empty
    }
  }

  private scrollToBottom() {
    this.updateComplete.then(() => {
      const area = this.shadowRoot?.querySelector('.messages-area');
      if (area) area.scrollTop = area.scrollHeight;
    });
  }

  private async loadSessionNotes(sessionId: string) {
    try {
      const result = await this.http.get<any>(`/sessions/${sessionId}/notes`);
      this.sessionNotes = Array.isArray(result) ? result : result.notes ?? [];
    } catch {
      // Non-critical
    }
  }

  private async addSessionNote() {
    if (!this.newNoteText.trim() || !this.selectedSessionId) return;
    try {
      await this.http.post(`/sessions/${this.selectedSessionId}/notes`, { content: this.newNoteText.trim() });
      this.newNoteText = '';
      await this.loadSessionNotes(this.selectedSessionId);
    } catch {
      // Non-critical
    }
  }

  private async deleteSessionNote(noteId: string) {
    if (!this.selectedSessionId) return;
    try {
      await this.http.delete(`/sessions/${this.selectedSessionId}/notes/${noteId}`);
      this.sessionNotes = this.sessionNotes.filter(n => (n.noteId ?? n._id) !== noteId);
    } catch {
      // Non-critical
    }
  }

  private async updateUserCategory(category: string) {
    if (!this.selectedSessionId) return;
    try {
      await this.http.put(`/sessions/${this.selectedSessionId}/user-category`, { userCategory: category });
      // Optimistic update
      const updateList = (list: ChatSessionSummary[]) =>
        list.map(s => s.sessionId === this.selectedSessionId ? { ...s, userCategory: category } as ChatSessionSummary : s);
      this.assignedChats = updateList(this.assignedChats) as ChatSessionSummary[];
      this.waitingChats = updateList(this.waitingChats) as ChatSessionSummary[];
    } catch {
      // Non-critical
    }
  }

  private acceptChat(sessionId: string) {
    if (this.socket) {
      (this.socket as any).emit(AgentEvent.AcceptChat, { sessionId });
    }
  }

  private sendMessage() {
    if (!this.messageInput.trim() || !this.selectedSessionId || !this.socket) return;
    (this.socket as any).emit(AgentEvent.SendMessage, {
      sessionId: this.selectedSessionId,
      content: this.messageInput,
    });
    this.messageInput = '';
    this.showCanned = false;
  }

  private resolveChat() {
    if (!this.selectedSessionId || !this.socket) return;
    (this.socket as any).emit(AgentEvent.ResolveChat, {
      sessionId: this.selectedSessionId,
    });
  }

  private toggleMode() {
    if (!this.selectedSessionId || !this.socket) return;
    const selected = this.getSelectedSession();
    if (!selected) return;
    const newMode = selected.mode === SessionMode.AI ? SessionMode.Manual : SessionMode.AI;
    (this.socket as any).emit(AgentEvent.SetMode, {
      sessionId: this.selectedSessionId,
      mode: newMode,
    });
    // Optimistic update
    const updateList = (list: ChatSessionSummary[]) =>
      list.map(s => s.sessionId === this.selectedSessionId ? { ...s, mode: newMode } : s);
    this.assignedChats = updateList(this.assignedChats) as ChatSessionSummary[];
    this.waitingChats = updateList(this.waitingChats) as ChatSessionSummary[];
  }

  private openTransferDialog() {
    if (!this.selectedSessionId) return;
    this.showTransferDialog = true;
    this.transferSearch = '';
    this.transferSelectedAgentId = '';
    this.transferNote = '';
    // Refresh available agents
    this.loadAvailableAgents();
  }

  private closeTransferDialog() {
    this.showTransferDialog = false;
    this.transferSearch = '';
    this.transferSelectedAgentId = '';
    this.transferNote = '';
  }

  private confirmTransfer() {
    if (!this.selectedSessionId || !this.transferSelectedAgentId || !this.socket) return;
    (this.socket as any).emit(AgentEvent.TransferChat, {
      sessionId: this.selectedSessionId,
      targetAgentId: this.transferSelectedAgentId,
      note: this.transferNote.trim() || undefined,
    });
    this.closeTransferDialog();
  }

  private escalateChat() {
    if (!this.selectedSessionId || !this.socket || !this.supervisorAgent) return;
    (this.socket as any).emit(AgentEvent.EscalateChat, {
      sessionId: this.selectedSessionId,
      targetAgentId: this.supervisorAgent.agentId,
    } as EscalateChatPayload);
  }

  private getFilteredTransferAgents() {
    const ownId = this.getOwnAgentId();
    const search = this.transferSearch.toLowerCase();
    return this.transferAgents.filter(a =>
      a.agentId !== ownId &&
      a.status !== 'offline' &&
      (!search || a.name.toLowerCase().includes(search))
    );
  }

  private onInputChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.messageInput = val;

    if (val.startsWith('/') && val.length > 1) {
      const query = val.slice(1).toLowerCase();
      this.filteredCanned = this.cannedResponses.filter(
        c => c.title.toLowerCase().includes(query) ||
             (c.shortcut && c.shortcut.toLowerCase().includes(query))
      );
      this.showCanned = this.filteredCanned.length > 0;
    } else {
      this.showCanned = false;
    }

    if (this.socket && this.selectedSessionId) {
      (this.socket as any).emit(AgentEvent.Typing, {
        sessionId: this.selectedSessionId,
        isTyping: val.length > 0,
      });
    }
  }

  private onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (this.showCanned && this.filteredCanned.length > 0) {
        this.selectCanned(this.filteredCanned[0]);
      } else {
        this.sendMessage();
      }
    }
    if (e.key === 'Escape') {
      this.showCanned = false;
    }
  }

  private selectCanned(resp: CannedResponse) {
    this.messageInput = resp.content;
    this.showCanned = false;
    this.showCannedBrowse = false;
  }

  private toggleCannedBrowse() {
    this.showCannedBrowse = !this.showCannedBrowse;
    this.cannedBrowseSearch = '';
    if (this.showCannedBrowse) {
      this.showCanned = false;
    }
  }

  private getGroupedCannedResponses(): Map<string, CannedResponse[]> {
    const search = this.cannedBrowseSearch.toLowerCase();
    const filtered = this.cannedResponses.filter(c =>
      !search || c.title.toLowerCase().includes(search) || c.content.toLowerCase().includes(search)
    );
    const groups = new Map<string, CannedResponse[]>();
    for (const resp of filtered) {
      const category = resp.category || 'General';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(resp);
    }
    return groups;
  }

  private async sendAiMessage(): Promise<void> {
    if (!this.selectedSessionId || !this.socket) return;
    (this.socket as any).emit(AgentEvent.SendAiMessage, {
      sessionId: this.selectedSessionId,
    } as SendAiMessagePayload);
  }

  private updateStatus(status: string): void {
    if (!this.socket) return;
    (this.socket as any).emit(AgentEvent.UpdateStatus, { status } as UpdateStatusPayload);
    this.agentStatus = status;
  }

  private labelMessage(messageId: string, quality: string): void {
    if (!this.socket || !this.selectedSessionId) return;
    (this.socket as any).emit(AgentEvent.LabelMessage, {
      sessionId: this.selectedSessionId,
      messageId,
      trainingQuality: quality,
    } as LabelMessagePayload);
  }

  private watchChat(sessionId: string) {
    if (!this.socket) return;
    (this.socket as any).emit(AgentEvent.WatchChat, { sessionId } as WatchChatPayload);
    this.selectSession(sessionId);
  }

  private isWatchingOnly(): boolean {
    if (!this.selectedSessionId) return false;
    // Chat is "watching" if it's not in assignedChats and not waiting for accept
    const isAssigned = this.assignedChats.some(s => s.sessionId === this.selectedSessionId);
    const isWaiting = this.waitingChats.some(s => s.sessionId === this.selectedSessionId);
    if (isAssigned) return false;
    if (isWaiting) return false;
    return true;
  }

  private getSelectedSession(): ChatSessionSummary | undefined {
    return [...this.assignedChats, ...this.waitingChats, ...this.watchedChats].find(
      s => s.sessionId === this.selectedSessionId
    );
  }

  private getStatusBadge(status: string) {
    const map: Record<string, { cls: string; label: string }> = {
      active: { cls: 'alx-badge-success', label: 'Active' },
      new: { cls: 'alx-badge-info', label: 'New' },
      waiting_agent: { cls: 'alx-badge-warning', label: 'Waiting' },
      with_agent: { cls: 'alx-badge-success', label: 'With Agent' },
      resolved: { cls: 'alx-badge-muted', label: 'Resolved' },
      abandoned: { cls: 'alx-badge-danger', label: 'Abandoned' },
    };
    return map[status] ?? { cls: 'alx-badge-muted', label: status };
  }

  private formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  render() {
    const selected = this.getSelectedSession();

    return html`
      <div class="dashboard-layout">
        <!-- Left: Session list -->
        <div class="panel-left">
          <div class="panel-left-header">
            <span>Chats</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="status-controls">
                <button class="status-btn ${this.agentStatus === AgentStatus.Available ? 'active' : ''}"
                  @click=${() => this.updateStatus(AgentStatus.Available)}>
                  <span class="status-dot available"></span> Available
                </button>
                <button class="status-btn ${this.agentStatus === AgentStatus.Away ? 'active' : ''}"
                  @click=${() => this.updateStatus(AgentStatus.Away)}>
                  <span class="status-dot away"></span> Away
                </button>
                <button class="status-btn ${this.agentStatus === AgentStatus.Busy ? 'active' : ''}"
                  @click=${() => this.updateStatus(AgentStatus.Busy)}>
                  <span class="status-dot busy"></span> Busy
                </button>
              </div>
              <span class="alx-badge ${this.connected ? 'alx-badge-success' : 'alx-badge-danger'}">
                ${this.connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <div class="session-sections">
            ${this.waitingChats.length > 0 ? html`
              <div class="section-title">Waiting (${this.waitingChats.length})</div>
              ${this.waitingChats.map(s => html`
                <div class="session-item ${s.sessionId === this.selectedSessionId ? 'active' : ''}"
                  @click=${() => this.selectSession(s.sessionId)}>
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="session-item-name">${s.visitorName || s.visitorId?.slice(0, 8)}</span>
                    <button class="alx-btn-sm alx-btn-success" @click=${(e: Event) => {
                      e.stopPropagation();
                      this.acceptChat(s.sessionId);
                    }}>Accept</button>
                  </div>
                  <span class="session-item-meta">${s.channel || 'web'} - ${s.messageCount} msgs</span>
                  ${s.tags && s.tags.length > 0 ? html`
                    <div class="session-tags">
                      ${s.tags.map(tag => html`<span class="tag-chip">${tag}</span>`)}
                    </div>
                  ` : nothing}
                  ${s.userCategory ? html`<span class="category-badge">${s.userCategory}</span>` : nothing}
                </div>
              `)}
            ` : ''}

            <div class="section-title">My Chats (${this.assignedChats.length})</div>
            ${this.assignedChats.length === 0 ? html`
              <div style="padding:0.75rem;color:var(--alx-text-muted);font-size:0.8125rem;">No active chats</div>
            ` : ''}
            ${this.assignedChats.map(s => html`
              <div class="session-item ${s.sessionId === this.selectedSessionId ? 'active' : ''}"
                @click=${() => this.selectSession(s.sessionId)}>
                <span class="session-item-name">${s.visitorName || s.visitorId?.slice(0, 8)}</span>
                <span class="session-item-meta">${s.channel || 'web'} - ${s.messageCount} msgs</span>
                ${s.tags && s.tags.length > 0 ? html`
                  <div class="session-tags">
                    ${s.tags.map(tag => html`<span class="tag-chip">${tag}</span>`)}
                  </div>
                ` : nothing}
                ${s.userCategory ? html`<span class="category-badge">${s.userCategory}</span>` : nothing}
              </div>
            `)}

            ${this.isManager && this.watchedChats.length > 0 ? html`
              <div class="section-title">Watching (${this.watchedChats.length})</div>
              ${this.watchedChats.map(s => html`
                <div class="session-item ${s.sessionId === this.selectedSessionId ? 'active' : ''}"
                  @click=${() => this.selectSession(s.sessionId)}>
                  <span class="session-item-name">${s.visitorName || s.visitorId?.slice(0, 8)}</span>
                  <span class="session-item-meta">${s.channel || 'web'} - ${s.messageCount} msgs</span>
                  ${s.tags && s.tags.length > 0 ? html`
                    <div class="session-tags">
                      ${s.tags.map(tag => html`<span class="tag-chip">${tag}</span>`)}
                    </div>
                  ` : nothing}
                  ${s.userCategory ? html`<span class="category-badge">${s.userCategory}</span>` : nothing}
                </div>
              `)}
            ` : nothing}
          </div>
        </div>

        <!-- Center: Chat area -->
        <div class="panel-center">
          ${!this.selectedSessionId ? html`
            <div class="no-selection">Select a chat to start messaging</div>
          ` : html`
            <div class="chat-header">
              <div class="chat-header-info">
                <span class="chat-header-name">${selected?.visitorName || selected?.visitorId?.slice(0, 12) || 'Visitor'}</span>
                <span class="chat-header-status ${this.visitorOnline ? 'online' : ''}">
                  ${this.visitorOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div class="chat-actions">
                <button class="alx-btn-sm" @click=${this.toggleMode}
                  title="Switch to ${selected?.mode === SessionMode.AI ? 'manual' : 'AI'} mode">
                  ${selected?.mode === SessionMode.AI ? 'Manual' : 'AI'} Mode
                </button>
                ${AlxChatConfig.capabilities.ai ? html`
                  <button class="action-btn" @click=${() => this.sendAiMessage()} title="Generate AI Response">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1v6M5 4l3-3 3 3M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="5" cy="10" r="1" fill="currentColor"/>
                      <circle cx="8" cy="10" r="1" fill="currentColor"/>
                      <circle cx="11" cy="10" r="1" fill="currentColor"/>
                    </svg>
                  </button>
                ` : nothing}
                <button class="alx-btn-sm" @click=${() => this.openTransferDialog()}>Transfer</button>
                ${this.supervisorAgent && this.agentLevel < 3 ? html`
                  <button class="alx-btn-sm" @click=${() => this.escalateChat()}
                    title="Escalate to ${this.supervisorAgent.name}">
                    Escalate to ${this.supervisorAgent.name}
                  </button>
                ` : nothing}
                <button class="alx-btn-sm alx-btn-success" @click=${this.resolveChat}>Resolve</button>
              </div>
            </div>

            <div class="messages-area">
              ${this.messages.map(msg => {
                const cls = msg.senderType === ChatSenderType.Visitor ? 'visitor'
                  : msg.senderType === ChatSenderType.System ? 'system'
                  : msg.senderType === ChatSenderType.AI ? 'ai' : 'agent';
                return html`
                  <div class="msg ${cls}">
                    ${msg.senderType !== ChatSenderType.System ? html`
                      <div class="msg-sender">${msg.senderName || msg.senderType}</div>
                    ` : nothing}
                    <div>${msg.content}</div>
                    <div class="msg-time">${this.formatTime(msg.createdAt)}</div>
                    ${msg.senderType === ChatSenderType.AI && AlxChatConfig.capabilities.labeling ? html`
                      <div class="label-actions">
                        <button class="label-btn" @click=${() => this.labelMessage(msg.messageId, 'good')} title="Good response">
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M4 6.5V12.5H2.5C1.95 12.5 1.5 12.05 1.5 11.5V7.5C1.5 6.95 1.95 6.5 2.5 6.5H4ZM5 6.5L7.5 1.5C8.05 1.5 8.5 1.95 8.5 2.5V5H11.5C12.05 5 12.5 5.45 12.5 6V7L10.5 12.5H5V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                        <button class="label-btn" @click=${() => this.labelMessage(msg.messageId, 'bad')} title="Bad response">
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="transform: scaleY(-1)">
                            <path d="M4 6.5V12.5H2.5C1.95 12.5 1.5 12.05 1.5 11.5V7.5C1.5 6.95 1.95 6.5 2.5 6.5H4ZM5 6.5L7.5 1.5C8.05 1.5 8.5 1.95 8.5 2.5V5H11.5C12.05 5 12.5 5.45 12.5 6V7L10.5 12.5H5V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    ` : nothing}
                  </div>
                `;
              })}
              ${this.visitorTyping ? html`
                <div class="typing-indicator">Visitor is typing...</div>
              ` : ''}
            </div>

            ${this.isWatchingOnly() ? html`
              <div class="watching-indicator">Watching &mdash; read-only view</div>
            ` : nothing}

            <div class="chat-input-area ${this.isWatchingOnly() ? 'send-disabled' : ''}">
              ${this.showCanned ? html`
                <div class="canned-dropdown">
                  ${this.filteredCanned.map(c => html`
                    <div class="canned-item" @click=${() => this.selectCanned(c)}>
                      <div class="canned-item-title">${c.title}</div>
                      ${c.shortcut ? html`<div class="canned-item-shortcut">/${c.shortcut}</div>` : ''}
                    </div>
                  `)}
                </div>
              ` : ''}
              ${this.showCannedBrowse ? html`
                <div class="canned-browse-panel">
                  <div class="canned-browse-header">
                    <input type="text" placeholder="Search responses..."
                      .value=${this.cannedBrowseSearch}
                      @input=${(e: Event) => this.cannedBrowseSearch = (e.target as HTMLInputElement).value} />
                    <button class="alx-btn-sm" @click=${() => this.showCannedBrowse = false}>Close</button>
                  </div>
                  <div class="canned-browse-list">
                    ${Array.from(this.getGroupedCannedResponses().entries()).map(([category, responses]) => html`
                      <div class="canned-category-title">${category}</div>
                      ${responses.map(c => html`
                        <div class="canned-item" @click=${() => this.selectCanned(c)}>
                          <div class="canned-item-title">${c.title}</div>
                          ${c.shortcut ? html`<div class="canned-item-shortcut">/${c.shortcut}</div>` : ''}
                        </div>
                      `)}
                    `)}
                    ${this.getGroupedCannedResponses().size === 0 ? html`
                      <div style="padding:0.75rem;text-align:center;color:var(--alx-text-muted);font-size:0.8125rem;">No responses found</div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}
              <button class="action-btn" @click=${() => this.toggleCannedBrowse()}
                ?disabled=${this.isWatchingOnly()}
                title="Browse canned responses">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 1H3C2.45 1 2 1.45 2 2V14L5 11H13C13.55 11 14 10.55 14 10V2C14 1.45 13.55 1 13 1Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5 5H11M5 7.5H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
              </button>
              <input type="text" placeholder="${this.isWatchingOnly() ? 'Read-only mode' : 'Type a message... (/ for canned responses)'}"
                .value=${this.messageInput}
                ?disabled=${this.isWatchingOnly()}
                @input=${this.onInputChange}
                @keydown=${this.onInputKeydown} />
              <button class="alx-btn-primary" @click=${this.sendMessage}
                ?disabled=${this.isWatchingOnly()}>Send</button>
            </div>
          `}
        </div>

        <!-- Right: Detail panel -->
        <div class="panel-right">
          ${!selected ? html`
            <div class="no-selection">Session details will appear here</div>
          ` : html`
            <div class="detail-section">
              <div class="detail-title">Session</div>
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">
                  <span class="alx-badge ${this.getStatusBadge(selected.status).cls}">
                    ${this.getStatusBadge(selected.status).label}
                  </span>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Mode</span>
                <span class="detail-value">${selected.mode}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Channel</span>
                <span class="detail-value">${selected.channel || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Messages</span>
                <span class="detail-value">${selected.messageCount}</span>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-title">Visitor</div>
              <div class="detail-row">
                <span class="detail-label">Name</span>
                <span class="detail-value">${selected.visitorName || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">ID</span>
                <span class="detail-value">${selected.visitorId?.slice(0, 16)}</span>
              </div>
              <div class="detail-row" style="flex-direction:column;align-items:flex-start;gap:0.25rem;">
                <span class="detail-label">Category</span>
                ${this.availableUserCategories.length > 0 ? html`
                  <select style="width:100%;font-size:0.8125rem;padding:0.25rem;background:var(--alx-surface-alt);border:1px solid var(--alx-border);border-radius:var(--alx-radius);color:var(--alx-text);"
                    @change=${(e: Event) => this.updateUserCategory((e.target as HTMLSelectElement).value)}>
                    <option value="" ?selected=${!selected.userCategory}>None</option>
                    ${this.availableUserCategories.map(cat => html`
                      <option value=${cat} ?selected=${selected.userCategory === cat}>${cat}</option>
                    `)}
                  </select>
                ` : html`
                  <span class="detail-value">${selected.userCategory ? html`<span class="category-badge">${selected.userCategory}</span>` : '-'}</span>
                `}
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-title">Notes</div>
              ${this.sessionNotes.map(note => html`
                <div class="note-item">
                  <span class="note-content">${note.content}</span>
                  <button class="note-remove" @click=${() => this.deleteSessionNote(note.noteId ?? note._id ?? '')}>x</button>
                </div>
              `)}
              ${this.sessionNotes.length === 0 ? html`
                <div style="font-size:0.75rem;color:var(--alx-text-muted);padding:0.25rem 0;">No notes yet</div>
              ` : ''}
              <div class="note-add-row">
                <input type="text" placeholder="Add a note..."
                  .value=${this.newNoteText}
                  @input=${(e: Event) => this.newNoteText = (e.target as HTMLInputElement).value}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addSessionNote(); }}} />
                <button class="alx-btn-sm" @click=${() => this.addSessionNote()}>Add</button>
              </div>
            </div>

            ${selected.tags && selected.tags.length > 0 ? html`
              <div class="detail-section">
                <div class="detail-title">Tags</div>
                <div class="session-tags" style="padding:0.25rem 0;">
                  ${selected.tags.map(tag => html`<span class="tag-chip" style="font-size:0.6875rem;padding:0.1rem 0.4rem;">${tag}</span>`)}
                </div>
              </div>
            ` : nothing}

            ${this.stats ? html`
              <div class="detail-section">
                <div class="detail-title">Dashboard Stats</div>
                <div class="detail-row">
                  <span class="detail-label">Active</span>
                  <span class="detail-value">${this.stats.activeSessions}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Waiting</span>
                  <span class="detail-value">${this.stats.waitingSessions}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Resolved Today</span>
                  <span class="detail-value">${this.stats.resolvedToday}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Agents Online</span>
                  <span class="detail-value">${this.stats.activeAgents}/${this.stats.totalAgents}</span>
                </div>
              </div>
            ` : ''}
          `}
        </div>
      </div>

      ${this.showTransferDialog ? html`
        <div class="transfer-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.closeTransferDialog(); }}>
          <div class="transfer-dialog">
            <div class="transfer-dialog-header">
              <span>Transfer Chat</span>
              <button class="alx-btn-sm" @click=${() => this.closeTransferDialog()}>Close</button>
            </div>
            <div class="transfer-dialog-body">
              <input type="text" placeholder="Search agents by name..."
                .value=${this.transferSearch}
                @input=${(e: Event) => this.transferSearch = (e.target as HTMLInputElement).value}
                style="width:100%;" />
              <div class="transfer-agent-list">
                ${(() => { const filtered = this.getFilteredTransferAgents(); return html`
                ${filtered.length === 0 ? html`
                  <div style="padding:0.75rem;text-align:center;color:var(--alx-text-muted);font-size:0.8125rem;">No available agents found</div>
                ` : ''}
                ${filtered.map(agent => html`
                  <div class="transfer-agent-item ${this.transferSelectedAgentId === agent.agentId ? 'selected' : ''}"
                    @click=${() => this.transferSelectedAgentId = agent.agentId}>
                    <span class="node-status ${agent.status}"></span>
                    <span class="transfer-agent-name">${agent.name}</span>
                    <span class="transfer-agent-meta">
                      ${agent.status}${agent.level ? ` / L${agent.level}` : ''}
                    </span>
                  </div>
                `)}
                `; })()}
              </div>
              <div style="margin-top:0.5rem;">
                <label style="font-size:0.75rem;color:var(--alx-text-muted);display:block;margin-bottom:0.25rem;">Transfer note (optional)</label>
                <input type="text" placeholder="Reason for transfer..."
                  .value=${this.transferNote}
                  @input=${(e: Event) => this.transferNote = (e.target as HTMLInputElement).value}
                  style="width:100%;" />
              </div>
            </div>
            <div class="transfer-dialog-footer">
              <button class="alx-btn-sm" @click=${() => this.closeTransferDialog()}>Cancel</button>
              <button class="alx-btn-primary alx-btn-sm" ?disabled=${!this.transferSelectedAgentId}
                @click=${() => this.confirmTransfer()}>Transfer</button>
            </div>
          </div>
        </div>
      ` : nothing}
    `;
  }
}

safeRegister('alx-chat-agent-dashboard', AlxChatAgentDashboard);

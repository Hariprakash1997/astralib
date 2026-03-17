import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatMessage, ChatSessionSummary, DashboardStats, ChatAgentInfo } from '@astralibx/chat-types';
import { ChatSenderType, AgentEvent, ServerToAgentEvent, ChatSessionStatus } from '@astralibx/chat-types';
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
    `,
  ];

  @property({ type: String }) agentToken = '';

  @state() private socket: unknown = null;
  @state() private connected = false;
  @state() private waitingChats: ChatSessionSummary[] = [];
  @state() private assignedChats: ChatSessionSummary[] = [];
  @state() private selectedSessionId = '';
  @state() private messages: ChatMessage[] = [];
  @state() private messageInput = '';
  @state() private visitorTyping = false;
  @state() private visitorOnline = true;
  @state() private stats: DashboardStats | null = null;
  @state() private cannedResponses: CannedResponse[] = [];
  @state() private showCanned = false;
  @state() private filteredCanned: CannedResponse[] = [];

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.connectSocket();
    this.loadCannedResponses();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectSocket();
  }

  private async connectSocket() {
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

      this.socket = sock;
    } catch {
      // socket.io-client not available
    }
  }

  private disconnectSocket() {
    if (this.socket) {
      (this.socket as any).disconnect();
      this.socket = null;
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

  private selectSession(sessionId: string) {
    this.selectedSessionId = sessionId;
    this.messages = [];
    this.visitorTyping = false;
    this.visitorOnline = true;
    this.loadSessionMessages(sessionId);
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
    const newMode = selected.mode === 'ai' ? 'manual' : 'ai';
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

  private transferChat() {
    if (!this.selectedSessionId) return;
    const targetAgentId = prompt('Enter target agent ID:');
    if (!targetAgentId) return;
    const note = prompt('Transfer note (optional):') || undefined;
    if (this.socket) {
      (this.socket as any).emit(AgentEvent.TransferChat, {
        sessionId: this.selectedSessionId,
        targetAgentId,
        note,
      });
    }
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
  }

  private getSelectedSession(): ChatSessionSummary | undefined {
    return [...this.assignedChats, ...this.waitingChats].find(
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
            <span class="alx-badge ${this.connected ? 'alx-badge-success' : 'alx-badge-danger'}">
              ${this.connected ? 'Online' : 'Offline'}
            </span>
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
              </div>
            `)}
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
                  title="Switch to ${selected?.mode === 'ai' ? 'manual' : 'AI'} mode">
                  ${selected?.mode === 'ai' ? 'Manual' : 'AI'} Mode
                </button>
                <button class="alx-btn-sm" @click=${this.transferChat}>Transfer</button>
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
                  </div>
                `;
              })}
              ${this.visitorTyping ? html`
                <div class="typing-indicator">Visitor is typing...</div>
              ` : ''}
            </div>

            <div class="chat-input-area">
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
              <input type="text" placeholder="Type a message... (/ for canned responses)"
                .value=${this.messageInput}
                @input=${this.onInputChange}
                @keydown=${this.onInputKeydown} />
              <button class="alx-btn-primary" @click=${this.sendMessage}>Send</button>
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
            </div>

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
    `;
  }
}

safeRegister('alx-chat-agent-dashboard', AlxChatAgentDashboard);

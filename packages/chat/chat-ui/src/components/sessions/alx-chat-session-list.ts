import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatSessionSummary } from '@astralibx/chat-types';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatTableStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatToolbarStyles,
  alxChatCardStyles,
} from '../../styles/shared.js';

export class AlxChatSessionList extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTableStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatToolbarStyles,
    alxChatCardStyles,
    css`
      :host { display: block; }
      .session-row { cursor: pointer; }
      .duration { font-variant-numeric: tabular-nums; }
    `,
  ];

  @property({ type: String }) status = '';
  @property({ type: String }) channel = '';
  @property({ type: String }) mode = '';

  @state() private sessions: ChatSessionSummary[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private search = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadSessions();
  }

  async loadSessions() {
    this.loading = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = {
        page: this.page,
        limit: 20,
      };
      if (this.status) params.status = this.status;
      if (this.channel) params.channel = this.channel;
      if (this.mode) params.mode = this.mode;
      if (this.search) params.search = this.search;
      if (this.dateFrom) params.dateFrom = this.dateFrom;
      if (this.dateTo) params.dateTo = this.dateTo;

      const result = await this.http.get<{
        data: ChatSessionSummary[];
        total: number;
        page: number;
        totalPages: number;
      }>('/sessions', params);
      this.sessions = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load sessions';
    } finally {
      this.loading = false;
    }
  }

  private getStatusBadge(status: ChatSessionStatus) {
    const map: Record<string, { cls: string; label: string }> = {
      [ChatSessionStatus.Active]: { cls: 'alx-badge-success', label: 'Active' },
      [ChatSessionStatus.New]: { cls: 'alx-badge-info', label: 'New' },
      [ChatSessionStatus.WaitingAgent]: { cls: 'alx-badge-warning', label: 'Waiting' },
      [ChatSessionStatus.WithAgent]: { cls: 'alx-badge-success', label: 'With Agent' },
      [ChatSessionStatus.Resolved]: { cls: 'alx-badge-muted', label: 'Resolved' },
      [ChatSessionStatus.Abandoned]: { cls: 'alx-badge-danger', label: 'Abandoned' },
    };
    return map[status] ?? { cls: 'alx-badge-muted', label: status };
  }

  private formatDuration(start: Date, end?: Date): string {
    const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  private formatTime(date?: Date): string {
    if (!date) return '-';
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private onRowClick(session: ChatSessionSummary) {
    this.dispatchEvent(new CustomEvent('session-select', {
      detail: { sessionId: session.sessionId, session },
      bubbles: true,
      composed: true,
    }));
  }

  private onSearch(e: Event) {
    this.search = (e.target as HTMLInputElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private onStatusFilter(e: Event) {
    this.status = (e.target as HTMLSelectElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private onChannelFilter(e: Event) {
    this.channel = (e.target as HTMLSelectElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private onModeFilter(e: Event) {
    this.mode = (e.target as HTMLSelectElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private onDateFromChange(e: Event) {
    this.dateFrom = (e.target as HTMLInputElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private onDateToChange(e: Event) {
    this.dateTo = (e.target as HTMLInputElement).value;
    this.page = 1;
    this.loadSessions();
  }

  private goPage(p: number) {
    this.page = p;
    this.loadSessions();
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Chat Sessions</h3>
          <button class="alx-btn-sm" @click=${() => this.loadSessions()}>Refresh</button>
        </div>

        <div class="toolbar">
          <input type="search" placeholder="Search visitor or session ID..."
            .value=${this.search} @input=${this.onSearch} />
          <select @change=${this.onStatusFilter} .value=${this.status}>
            <option value="">All Statuses</option>
            ${Object.values(ChatSessionStatus).map(s =>
              html`<option value=${s}>${s}</option>`
            )}
          </select>
          <select @change=${this.onModeFilter} .value=${this.mode}>
            <option value="">All Modes</option>
            ${Object.values(SessionMode).map(m =>
              html`<option value=${m}>${m}</option>`
            )}
          </select>
          <select @change=${this.onChannelFilter} .value=${this.channel}>
            <option value="">All Channels</option>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
          </select>
          <input type="date" .value=${this.dateFrom} @change=${this.onDateFromChange} />
          <input type="date" .value=${this.dateTo} @change=${this.onDateToChange} />
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.sessions.length === 0 && !this.error
          ? html`<div class="alx-empty">No sessions found</div>`
          : ''}

        ${!this.loading && this.sessions.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Channel</th>
                  <th>Messages</th>
                  <th>Last Activity</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${this.sessions.map(s => {
                  const badge = this.getStatusBadge(s.status);
                  return html`
                    <tr class="session-row" data-clickable @click=${() => this.onRowClick(s)}>
                      <td>${s.visitorName || s.visitorId?.slice(0, 8) || '-'}</td>
                      <td><span class="alx-badge ${badge.cls}">${badge.label}</span></td>
                      <td>${s.mode}</td>
                      <td>${s.channel || '-'}</td>
                      <td>${s.messageCount}</td>
                      <td>${this.formatTime(s.lastMessageAt)}</td>
                      <td class="duration">${this.formatDuration(s.startedAt, s.endedAt)}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>

          ${this.totalPages > 1 ? html`
            <div class="pagination">
              <button class="alx-btn-sm" ?disabled=${this.page <= 1}
                @click=${() => this.goPage(this.page - 1)}>Prev</button>
              <span class="text-muted text-small">Page ${this.page} of ${this.totalPages}</span>
              <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages}
                @click=${() => this.goPage(this.page + 1)}>Next</button>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-session-list', AlxChatSessionList);

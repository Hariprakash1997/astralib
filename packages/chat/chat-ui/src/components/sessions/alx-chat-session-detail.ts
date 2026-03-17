import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatSessionSummary, ChatFeedback } from '@astralibx/chat-types';
import { ChatSessionStatus } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
} from '../../styles/shared.js';

interface SessionDetail extends ChatSessionSummary {
  feedback?: ChatFeedback;
  conversationSummary?: string;
  preferences?: Record<string, unknown>;
}

export class AlxChatSessionDetail extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    css`
      :host { display: block; }

      .detail-section {
        margin-bottom: 1rem;
      }

      .detail-section-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        margin-bottom: 0.5rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 50%, transparent);
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.25rem 0;
        font-size: 0.8125rem;
      }

      .detail-label {
        color: var(--alx-text-muted);
        font-size: 0.75rem;
      }

      .detail-value {
        color: var(--alx-text);
        font-weight: 500;
        text-align: right;
      }

      .stars {
        display: inline-flex;
        gap: 2px;
      }

      .star {
        font-size: 1rem;
        color: var(--alx-border);
      }

      .star.filled {
        color: var(--alx-warning);
      }

      .summary-text {
        font-size: 0.8125rem;
        color: var(--alx-text);
        line-height: 1.5;
        padding: 0.5rem;
        background: var(--alx-bg);
        border-radius: var(--alx-radius);
        border: 1px solid var(--alx-border);
      }

      .no-data {
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
        font-style: italic;
        text-align: center;
        padding: 1.5rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: String }) sessionId = '';

  @state() private session: SessionDetail | null = null;
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    if (this.sessionId) this.loadSession();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('sessionId') && this.sessionId) {
      this.loadSession();
    }
  }

  async loadSession() {
    if (!this.sessionId) return;
    this.loading = true;
    this.error = '';
    try {
      this.session = await this.http.get<SessionDetail>(`/sessions/${this.sessionId}`);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load session';
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
    return new Date(date).toLocaleString();
  }

  private renderStars(rating?: number) {
    if (rating === undefined || rating === null) return html`<span class="text-muted">No rating</span>`;
    return html`
      <span class="stars">
        ${[1, 2, 3, 4, 5].map(i =>
          html`<span class="star ${i <= rating ? 'filled' : ''}">&#9733;</span>`
        )}
      </span>
    `;
  }

  render() {
    if (!this.sessionId) {
      return html`
        <div class="alx-card">
          <div class="no-data">Select a session to view details</div>
        </div>
      `;
    }

    if (this.loading) {
      return html`
        <div class="alx-card">
          <div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="alx-card">
          <div class="alx-error">${this.error}</div>
        </div>
      `;
    }

    if (!this.session) return html`<div class="alx-card"><div class="no-data">Session not found</div></div>`;

    const s = this.session;
    const badge = this.getStatusBadge(s.status);

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Session Detail</h3>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Session Info</div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value"><span class="alx-badge ${badge.cls}">${badge.label}</span></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mode</span>
            <span class="detail-value">${s.mode}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Channel</span>
            <span class="detail-value">${s.channel || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${this.formatDuration(s.startedAt, s.endedAt)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Messages</span>
            <span class="detail-value">${s.messageCount}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Started</span>
            <span class="detail-value">${this.formatTime(s.startedAt)}</span>
          </div>
          ${s.endedAt ? html`
            <div class="detail-row">
              <span class="detail-label">Ended</span>
              <span class="detail-value">${this.formatTime(s.endedAt)}</span>
            </div>
          ` : ''}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Visitor Info</div>
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <span class="detail-value">${s.visitorName || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Visitor ID</span>
            <span class="detail-value">${s.visitorId?.slice(0, 16) || '-'}</span>
          </div>
          ${s.agentName ? html`
            <div class="detail-row">
              <span class="detail-label">Agent</span>
              <span class="detail-value">${s.agentName}</span>
            </div>
          ` : ''}
        </div>

        ${s.preferences && Object.keys(s.preferences).length > 0 ? html`
          <div class="detail-section">
            <div class="detail-section-title">Preferences</div>
            ${Object.entries(s.preferences).map(([k, v]) => html`
              <div class="detail-row">
                <span class="detail-label">${k}</span>
                <span class="detail-value">${String(v)}</span>
              </div>
            `)}
          </div>
        ` : ''}

        <div class="detail-section">
          <div class="detail-section-title">Feedback</div>
          <div class="detail-row">
            <span class="detail-label">Rating</span>
            <span class="detail-value">${this.renderStars(s.feedback?.rating)}</span>
          </div>
          ${s.feedback?.submittedAt ? html`
            <div class="detail-row">
              <span class="detail-label">Submitted</span>
              <span class="detail-value">${this.formatTime(s.feedback.submittedAt)}</span>
            </div>
          ` : ''}
        </div>

        ${s.conversationSummary ? html`
          <div class="detail-section">
            <div class="detail-section-title">Conversation Summary</div>
            <div class="summary-text">${s.conversationSummary}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-session-detail', AlxChatSessionDetail);

import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { WebhookConfig } from '../../api/chat-api-client.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatBadgeStyles,
  alxChatTableStyles,
} from '../../styles/shared.js';

const WEBHOOK_EVENTS = [
  'chat.started',
  'chat.ended',
  'chat.escalated',
  'message.sent',
  'message.received',
  'agent.assigned',
  'agent.transferred',
  'rating.submitted',
];

export class AlxChatWebhooks extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatBadgeStyles,
    alxChatTableStyles,
    css`
      :host { display: block; }

      .webhook-list {
        margin-top: 0.5rem;
      }

      .webhook-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.625rem 0.75rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
      }

      .webhook-item:last-child { border-bottom: none; }

      .webhook-info {
        flex: 1;
        min-width: 0;
      }

      .webhook-url {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--alx-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .webhook-events {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      .webhook-actions {
        display: flex;
        gap: 0.375rem;
        flex-shrink: 0;
        margin-left: 0.75rem;
      }

      .create-form {
        padding: 0.75rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        margin-top: 0.75rem;
      }

      .form-group {
        margin-bottom: 0.625rem;
      }

      .form-group label {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--alx-text-muted);
        margin-bottom: 0.25rem;
      }

      .form-group input {
        width: 100%;
      }

      .event-checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .event-checkbox {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .event-checkbox input[type="checkbox"] {
        width: auto;
      }

      .form-actions {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.75rem;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private webhooks: WebhookConfig[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private success = '';
  @state() private showCreateForm = false;
  @state() private newUrl = '';
  @state() private newEvents: string[] = [];
  @state() private newSecret = '';
  @state() private newDescription = '';
  @state() private creating = false;
  @state() private confirmDeleteId: string | null = null;

  private api!: ChatApiClient;
  private _timers: ReturnType<typeof setTimeout>[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.loadWebhooks();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  }

  private async loadWebhooks() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.listWebhooks();
      this.webhooks = Array.isArray(result) ? result : (result as any).webhooks ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load webhooks';
    } finally {
      this.loading = false;
    }
  }

  private toggleEvent(event: string) {
    if (this.newEvents.includes(event)) {
      this.newEvents = this.newEvents.filter(e => e !== event);
    } else {
      this.newEvents = [...this.newEvents, event];
    }
  }

  private async createWebhook() {
    if (!this.newUrl.trim() || this.newEvents.length === 0) {
      this.error = 'URL and at least one event are required';
      return;
    }
    this.creating = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.createWebhook({
        url: this.newUrl.trim(),
        events: this.newEvents,
        secret: this.newSecret.trim() || undefined,
        description: this.newDescription.trim() || undefined,
      });
      this.success = 'Webhook created';
      this.showCreateForm = false;
      this.newUrl = '';
      this.newEvents = [];
      this.newSecret = '';
      this.newDescription = '';
      await this.loadWebhooks();
      this._timers.push(setTimeout(() => this.success = '', 3000));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to create webhook';
    } finally {
      this.creating = false;
    }
  }

  private async deleteWebhook(id: string) {
    this.error = '';
    this.success = '';
    try {
      await this.api.deleteWebhook(id);
      this.success = 'Webhook deleted';
      await this.loadWebhooks();
      this._timers.push(setTimeout(() => this.success = '', 3000));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete webhook';
    }
  }

  private getWebhookId(wh: WebhookConfig): string {
    return wh._id ?? wh.webhookId ?? '';
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Webhooks</h3>
          <button class="alx-btn-primary alx-btn-sm"
            @click=${() => this.showCreateForm = !this.showCreateForm}>
            ${this.showCreateForm ? 'Cancel' : 'New Webhook'}
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${this.showCreateForm ? html`
          <div class="create-form">
            <div class="form-group">
              <label>Webhook URL</label>
              <input type="url" placeholder="https://example.com/webhook"
                .value=${this.newUrl}
                @input=${(e: Event) => this.newUrl = (e.target as HTMLInputElement).value} />
            </div>
            <div class="form-group">
              <label>Description (optional)</label>
              <input type="text" placeholder="What this webhook is for"
                .value=${this.newDescription}
                @input=${(e: Event) => this.newDescription = (e.target as HTMLInputElement).value} />
            </div>
            <div class="form-group">
              <label>Events</label>
              <div class="event-checkboxes">
                ${WEBHOOK_EVENTS.map(event => html`
                  <label class="event-checkbox">
                    <input type="checkbox"
                      .checked=${this.newEvents.includes(event)}
                      @change=${() => this.toggleEvent(event)} />
                    ${event}
                  </label>
                `)}
              </div>
            </div>
            <div class="form-group">
              <label>Secret (optional)</label>
              <input type="text" placeholder="Signing secret for payload verification"
                .value=${this.newSecret}
                @input=${(e: Event) => this.newSecret = (e.target as HTMLInputElement).value} />
            </div>
            <div class="form-actions">
              <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.creating}
                @click=${this.createWebhook}>
                ${this.creating ? 'Creating...' : 'Create Webhook'}
              </button>
            </div>
          </div>
        ` : nothing}

        ${!this.loading ? html`
          <div class="webhook-list">
            ${this.webhooks.length === 0 ? html`
              <div class="empty-state">No webhooks configured. Create one to receive real-time notifications.</div>
            ` : ''}
            ${this.webhooks.map(wh => html`
              <div class="webhook-item">
                <div class="webhook-info">
                  <div class="webhook-url">${wh.url}</div>
                  <div class="webhook-events">
                    ${wh.events.join(', ')}
                    ${wh.description ? html` &mdash; ${wh.description}` : ''}
                  </div>
                </div>
                <div class="webhook-actions">
                  <span class="alx-badge ${wh.isActive !== false ? 'alx-badge-success' : 'alx-badge-muted'}">
                    ${wh.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                  ${this.confirmDeleteId === this.getWebhookId(wh) ? html`
                    <span style="font-size:0.75rem;color:var(--alx-text-muted);">Are you sure?</span>
                    <button class="alx-btn-sm alx-btn-danger"
                      @click=${() => { this.deleteWebhook(this.getWebhookId(wh)); this.confirmDeleteId = null; }}>Yes</button>
                    <button class="alx-btn-sm"
                      @click=${() => this.confirmDeleteId = null}>Cancel</button>
                  ` : html`
                    <button class="alx-btn-sm alx-btn-danger"
                      @click=${() => this.confirmDeleteId = this.getWebhookId(wh)}>Delete</button>
                  `}
                </div>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-webhooks', AlxChatWebhooks);

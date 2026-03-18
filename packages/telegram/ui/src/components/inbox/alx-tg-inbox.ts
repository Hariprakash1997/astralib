import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
} from '../../styles/shared.js';
import { TelegramInboxAPI } from '../../api/inbox.api.js';
import { TelegramAccountAPI } from '../../api/account.api.js';
import { iconSync, iconSearch, iconSend } from '../../utils/icons.js';

interface Conversation {
  _id: string;
  chatId: string;
  name?: string;
  username?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

interface Message {
  _id: string;
  text?: string;
  direction: 'in' | 'out';
  mediaType?: string;
  mediaUrl?: string;
  fileName?: string;
  createdAt?: string;
}

export class AlxTgInbox extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    css`
      :host {
        display: block;
      }
      .inbox-layout {
        display: grid;
        grid-template-columns: var(--alx-inbox-conv-width, 280px) 1fr;
        gap: 0;
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
        height: var(--alx-inbox-height, 500px);
      }

      /* Left panel — conversation list */
      .conv-panel {
        border-right: 1px solid var(--alx-border);
        display: flex;
        flex-direction: column;
        background: var(--alx-surface);
        overflow: hidden;
      }
      .conv-search {
        padding: 0.5rem;
        border-bottom: 1px solid var(--alx-border);
      }
      .conv-search input {
        width: 100%;
      }
      .conv-list {
        flex: 1;
        overflow-y: auto;
      }
      .conv-item {
        padding: 0.5rem 0.625rem;
        cursor: pointer;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
        transition: background 0.1s;
      }
      .conv-item:hover {
        background: color-mix(in srgb, var(--alx-primary) 4%, transparent);
      }
      .conv-item.active {
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        border-left: 3px solid var(--alx-primary);
      }
      .conv-name {
        font-weight: 500;
        font-size: 0.8125rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .conv-preview {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .conv-time {
        font-size: 0.6rem;
        color: var(--alx-text-muted);
      }
      .unread-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--alx-primary);
        color: #fff;
        font-size: 0.6rem;
        font-weight: 600;
      }

      /* Right panel — messages */
      .msg-panel {
        display: flex;
        flex-direction: column;
        background: var(--alx-bg);
        overflow: hidden;
      }
      .msg-header {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--alx-border);
        background: var(--alx-surface);
        font-weight: 600;
        font-size: 0.875rem;
      }
      .msg-list {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .msg-bubble {
        max-width: 75%;
        padding: 0.375rem 0.625rem;
        border-radius: var(--alx-radius, 8px);
        font-size: 0.8125rem;
        line-height: 1.45;
        word-break: break-word;
      }
      .msg-in {
        align-self: flex-start;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
      }
      .msg-out {
        align-self: flex-end;
        background: color-mix(in srgb, var(--alx-primary) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-primary) 25%, transparent);
      }
      .msg-time {
        font-size: 0.6rem;
        color: var(--alx-text-muted);
        margin-top: 0.1rem;
      }
      .msg-media {
        margin-bottom: 0.25rem;
      }
      .msg-media img {
        max-width: 200px;
        max-height: 200px;
        border-radius: 4px;
      }
      .msg-media-file {
        font-size: 0.7rem;
        color: var(--alx-info);
        padding: 0.25rem 0.5rem;
        background: color-mix(in srgb, var(--alx-info) 8%, transparent);
        border-radius: 4px;
      }
      .msg-empty {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }
      .msg-input {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-top: 1px solid var(--alx-border);
        background: var(--alx-surface);
      }
      .msg-input input {
        flex: 1;
      }

      .account-filter-select { width: 100%; font-size: 0.75rem; }
      .sync-btn { margin-top: 0.375rem; width: 100%; }
      .conv-empty { padding: 1rem; text-align: center; color: var(--alx-text-muted); font-size: 0.8rem; }

      @media (max-width: 640px) {
        .inbox-layout {
          grid-template-columns: 1fr;
          height: auto;
        }
        .conv-panel {
          border-right: none;
          border-bottom: 1px solid var(--alx-border);
          max-height: 250px;
        }
        .msg-panel {
          min-height: 300px;
        }
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: String, attribute: 'account-id' }) accountId = '';

  @state() private conversations: Conversation[] = [];
  @state() private messages: Message[] = [];
  @state() private selectedConvId = '';
  @state() private searchQuery = '';
  @state() private newMessage = '';
  @state() private loadingConvs = false;
  @state() private loadingMsgs = false;
  @state() private sending = false;
  @state() private error = '';
  @state() private accounts: Array<{ _id: string; phone: string; name?: string }> = [];
  @state() private accountFilter = '';

  private _api?: TelegramInboxAPI;
  private get api(): TelegramInboxAPI {
    if (!this._api) this._api = new TelegramInboxAPI();
    return this._api;
  }
  private _accountApi?: TelegramAccountAPI;
  private get accountApi(): TelegramAccountAPI {
    if (!this._accountApi) this._accountApi = new TelegramAccountAPI();
    return this._accountApi;
  }
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadConversations();
    this.loadAccounts();
  }

  async loadConversations(): Promise<void> {
    const gen = ++this._loadGeneration;
    this.loadingConvs = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (this.searchQuery) params['search'] = this.searchQuery;
      if (this.accountFilter) params['accountId'] = this.accountFilter;
      const res = await this.api.listConversations(params) as {
        conversations: Conversation[];
      };
      if (gen !== this._loadGeneration) return;
      this.conversations = res.conversations ?? [];
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load conversations';
    } finally {
      if (gen === this._loadGeneration) this.loadingConvs = false;
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      const res = await this.accountApi.listAccounts({ limit: 100, status: 'connected' }) as {
        accounts: Array<{ _id: string; phone: string; name?: string }>;
      };
      this.accounts = res.accounts ?? [];
    } catch {
      // Non-critical — account filter just won't show
    }
  }

  private async onSyncDialogs(): Promise<void> {
    const id = this.accountFilter || this.accountId;
    if (!id) return;
    try {
      const res = await this.api.syncDialogs(id) as { synced: number; total: number };
      this.loadConversations();
      this.dispatchEvent(new CustomEvent('alx-toast', {
        detail: { message: `Synced ${res.synced} dialogs` },
        bubbles: true, composed: true,
      }));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to sync dialogs';
    }
  }

  private onAccountFilter(e: Event): void {
    this.accountFilter = (e.target as HTMLSelectElement).value;
    this.loadConversations();
  }

  private async selectConversation(conv: Conversation): Promise<void> {
    this.selectedConvId = conv._id;
    this.loadingMsgs = true;
    try {
      const res = await this.api.getMessages(conv._id, { limit: 100 }) as {
        messages: Message[];
      };
      this.messages = res.messages ?? [];
      this.api.markAsRead(conv._id).catch(() => {});
      this.requestUpdate();
      await this.updateComplete;
      this._scrollToBottom();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load messages';
    } finally {
      this.loadingMsgs = false;
    }
  }

  private _scrollToBottom(): void {
    const list = this.shadowRoot?.querySelector('.msg-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  private async onSendMessage(): Promise<void> {
    if (!this.newMessage.trim() || !this.selectedConvId) return;
    this.sending = true;
    try {
      await this.api.sendMessage(this.selectedConvId, { text: this.newMessage });
      this.newMessage = '';
      // Reload messages
      const res = await this.api.getMessages(this.selectedConvId, { limit: 100 }) as {
        messages: Message[];
      };
      this.messages = res.messages ?? [];
      await this.updateComplete;
      this._scrollToBottom();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to send message';
    } finally {
      this.sending = false;
    }
  }

  private onSearchInput(e: Event): void {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this.loadConversations();
  }

  private onKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.onSendMessage();
  }

  private formatTime(d?: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  private formatDate(d?: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  private get selectedConvName(): string {
    const conv = this.conversations.find(c => c._id === this.selectedConvId);
    return conv?.name ?? conv?.username ?? conv?.chatId ?? '';
  }

  override render() {
    return html`
      ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

      <div class="inbox-layout">
        <!-- Conversation list -->
        <div class="conv-panel">
          <div class="conv-search">
            <input
              type="text"
              placeholder="Search conversations..."
              .value=${this.searchQuery}
              @input=${this.onSearchInput}
            />
            ${this.accountId || this.accountFilter ? html`
              <button class="alx-btn-sm sync-btn" @click=${this.onSyncDialogs}>
                ${iconSync(14)} Sync
              </button>
            ` : ''}
          </div>
          ${this.accounts.length > 0 ? html`
            <div style="padding:0 0.5rem 0.5rem;border-bottom:1px solid var(--alx-border)">
              <select class="account-filter-select" @change=${this.onAccountFilter}>
                <option value="">All Accounts</option>
                ${this.accounts.map(a => html`
                  <option value=${a._id} ?selected=${this.accountFilter === a._id}>
                    ${a.name || a.phone}
                  </option>
                `)}
              </select>
            </div>
          ` : ''}
          <div class="conv-list">
            ${this.loadingConvs
              ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
              : this.conversations.length === 0
                ? html`<div class="conv-empty">No conversations</div>`
                : this.conversations.map(c => html`
                    <div
                      class="conv-item ${this.selectedConvId === c._id ? 'active' : ''}"
                      @click=${() => this.selectConversation(c)}
                    >
                      <div class="conv-name">
                        <span>${c.name ?? c.username ?? c.chatId}</span>
                        <span>
                          ${(c.unreadCount ?? 0) > 0 ? html`<span class="unread-badge">${c.unreadCount}</span>` : html`<span class="conv-time">${this.formatDate(c.lastMessageAt)}</span>`}
                        </span>
                      </div>
                      <div class="conv-preview">${c.lastMessage ?? ''}</div>
                    </div>
                  `)}
          </div>
        </div>

        <!-- Message thread -->
        <div class="msg-panel">
          ${this.selectedConvId ? html`
            <div class="msg-header">${this.selectedConvName}</div>
            <div class="msg-list">
              ${this.loadingMsgs
                ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
                : this.messages.length === 0
                  ? html`<div class="msg-empty">No messages yet</div>`
                  : this.messages.map(m => html`
                      <div class="msg-bubble ${m.direction === 'in' ? 'msg-in' : 'msg-out'}">
                        ${m.mediaType ? html`
                          <div class="msg-media">
                            ${m.mediaType === 'photo' && m.mediaUrl
                              ? html`<img src=${m.mediaUrl} alt="Photo" />`
                              : html`<div class="msg-media-file">${m.fileName ?? m.mediaType}</div>`}
                          </div>
                        ` : ''}
                        ${m.text ? html`<div>${m.text}</div>` : ''}
                        <div class="msg-time">${this.formatTime(m.createdAt)}</div>
                      </div>
                    `)}
            </div>
            <div class="msg-input">
              <input
                type="text"
                placeholder="Type a message..."
                .value=${this.newMessage}
                @input=${(e: Event) => (this.newMessage = (e.target as HTMLInputElement).value)}
                @keypress=${this.onKeyPress}
                ?disabled=${this.sending}
              />
              <button class="alx-btn-primary" @click=${this.onSendMessage} ?disabled=${this.sending || !this.newMessage.trim()}>
                ${this.sending ? '...' : html`${iconSend(14)} Send`}
              </button>
            </div>
          ` : html`
            <div class="msg-empty">Select a conversation to view messages</div>
          `}
        </div>
      </div>
    `;
  }
}
safeRegister('alx-tg-inbox', AlxTgInbox);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-inbox': AlxTgInbox;
  }
}

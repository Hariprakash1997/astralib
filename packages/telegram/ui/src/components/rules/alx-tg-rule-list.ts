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
  alxToolbarStyles,
  alxToggleStyles,
} from '../../styles/shared.js';
import { TelegramRuleAPI } from '../../api/rule.api.js';

interface TgRule {
  _id: string;
  name: string;
  templateId?: string;
  templateName?: string;
  mode?: 'query' | 'list';
  active?: boolean;
  lastRun?: string;
  createdAt?: string;
}

export class AlxTgRuleList extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    alxToolbarStyles,
    alxToggleStyles,
    css`
      .action-group {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private rules: TgRule[] = [];
  @state() _total = 0;
  @state() private loading = false;
  @state() private error = '';

  private _api?: TelegramRuleAPI;
  private get api(): TelegramRuleAPI {
    if (!this._api) this._api = new TelegramRuleAPI();
    return this._api;
  }
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  async load(): Promise<void> {
    const gen = ++this._loadGeneration;
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.listRules({ page: this.page, limit: this.limit }) as {
        rules: TgRule[];
        total?: number;
      };
      if (gen !== this._loadGeneration) return;
      this.rules = res.rules ?? [];
      this._total = res.total ?? res.rules?.length ?? 0;
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load rules';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this._total / this.limit));
  }

  private onEdit(rule: TgRule): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-selected', {
        detail: rule,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onCreate(): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-create', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async onToggleActive(rule: TgRule): Promise<void> {
    try {
      if (rule.active) {
        await this.api.deactivateRule(rule._id);
      } else {
        await this.api.activateRule(rule._id);
      }
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to toggle rule';
    }
  }

  private async onClone(e: Event, rule: TgRule): Promise<void> {
    e.stopPropagation();
    try {
      const full = await this.api.getRule(rule._id);
      const { _id, createdAt, updatedAt, __v, lastRun, ...data } = full;
      data.name = `Copy of ${data.name || rule.name}`;
      data.active = false;
      await this.api.createRule(data);
      this.dispatchEvent(
        new CustomEvent('alx-rule-cloned', {
          detail: { name: data.name },
          bubbles: true,
          composed: true,
        }),
      );
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to clone rule';
    }
  }

  private async onDelete(e: Event, rule: TgRule): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await this.api.deleteRule(rule._id);
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete rule';
    }
  }

  private onPrev(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  private onNext(): void {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }

  private formatDate(d?: string): string {
    if (!d) return '--';
    try {
      return new Date(d).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return d;
    }
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Campaign Rules</h3>
        </div>

        <div class="toolbar">
          <span class="spacer"></span>
          <button @click=${() => this.load()}>Refresh</button>
          <button class="alx-btn-primary" @click=${this.onCreate}>+ Create</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.rules.length === 0
            ? html`<div class="alx-empty">
  <p>Create rules to automate your Telegram campaigns.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this.onCreate}>+ Create Rule</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>TEMPLATE</th>
                      <th>MODE</th>
                      <th>ACTIVE</th>
                      <th>LAST RUN</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rules.map(r => html`
                      <tr>
                        <td style="font-weight:500">${r.name}</td>
                        <td>${r.templateName ?? r.templateId ?? '--'}</td>
                        <td>
                          <span class="alx-badge ${r.mode === 'query' ? 'alx-badge-info' : 'alx-badge-muted'}">
                            ${r.mode ?? 'query'}
                          </span>
                        </td>
                        <td>
                          <label class="toggle">
                            <input type="checkbox" .checked=${r.active ?? false} @change=${() => this.onToggleActive(r)} />
                            <span class="toggle-slider"></span>
                          </label>
                        </td>
                        <td>${this.formatDate(r.lastRun)}</td>
                        <td>
                          <div class="action-group">
                            <button class="alx-btn-icon" title="Clone" @click=${(e: Event) => this.onClone(e, r)}>&#x2398;</button>
                            <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(r)}>&#9998;</button>
                            <button class="alx-btn-icon danger" title="Delete" @click=${(e: Event) => this.onDelete(e, r)}>&times;</button>
                          </div>
                        </td>
                      </tr>
                    `)}
                  </tbody>
                </table>

                <div class="pagination">
                  <button class="alx-btn-sm" ?disabled=${this.page <= 1} @click=${this.onPrev}>Prev</button>
                  <span class="text-small text-muted">Page ${this.page} of ${this.totalPages}</span>
                  <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages} @click=${this.onNext}>Next</button>
                </div>
              `}
      </div>
    `;
  }
}
safeRegister('alx-tg-rule-list', AlxTgRuleList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-rule-list': AlxTgRuleList;
  }
}

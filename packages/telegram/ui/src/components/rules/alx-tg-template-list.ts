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
} from '../../styles/shared.js';
import { TelegramRuleAPI } from '../../api/rule.api.js';

interface TgTemplate {
  _id: string;
  name: string;
  messages?: { text: string }[];
  variables?: string[];
  category?: string;
  createdAt?: string;
}

export class AlxTgTemplateList extends LitElement {
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
    css`
      .action-group {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }
      .var-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem;
      }
      .var-tag {
        display: inline-block;
        padding: 0.05rem 0.35rem;
        border-radius: 3px;
        font-size: 0.65rem;
        line-height: 1.5;
        background: color-mix(in srgb, var(--alx-info) 10%, transparent);
        color: var(--alx-info);
        white-space: nowrap;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private templates: TgTemplate[] = [];
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
      const res = await this.api.listTemplates({ page: this.page, limit: this.limit }) as {
        templates: TgTemplate[];
        total?: number;
      };
      if (gen !== this._loadGeneration) return;
      this.templates = res.templates ?? [];
      this._total = res.total ?? res.templates?.length ?? 0;
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load templates';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this._total / this.limit));
  }

  private onEdit(template: TgTemplate): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-selected', {
        detail: template,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onCreate(): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-create', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async onClone(e: Event, template: TgTemplate): Promise<void> {
    e.stopPropagation();
    try {
      const full = await this.api.getTemplate(template._id);
      const { _id, createdAt, updatedAt, __v, ...data } = full;
      data.name = `Copy of ${data.name || template.name}`;
      await this.api.createTemplate(data);
      this.dispatchEvent(
        new CustomEvent('alx-template-cloned', {
          detail: { name: data.name },
          bubbles: true,
          composed: true,
        }),
      );
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to clone template';
    }
  }

  private async onDelete(e: Event, template: TgTemplate): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await this.api.deleteTemplate(template._id);
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete template';
    }
  }

  private onPrev(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  private onNext(): void {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Message Templates</h3>
        </div>

        <div class="toolbar">
          <span class="spacer"></span>
          <button @click=${() => this.load()}>Refresh</button>
          <button class="alx-btn-primary" @click=${this.onCreate}>+ Create</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.templates.length === 0
            ? html`<div class="alx-empty">
  <p>Create message templates for your campaigns.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this.onCreate}>+ Create Template</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>MESSAGES</th>
                      <th>VARIABLES</th>
                      <th>CATEGORY</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.templates.map(t => html`
                      <tr>
                        <td style="font-weight:500">${t.name}</td>
                        <td>${t.messages?.length ?? 0}</td>
                        <td>
                          <div class="var-tags">
                            ${(t.variables ?? []).map(v => html`<span class="var-tag">{{${v}}}</span>`)}
                          </div>
                        </td>
                        <td>${t.category ?? '--'}</td>
                        <td>
                          <div class="action-group">
                            <button class="alx-btn-icon" title="Clone" @click=${(e: Event) => this.onClone(e, t)}>&#x2398;</button>
                            <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(t)}>&#9998;</button>
                            <button class="alx-btn-icon danger" title="Delete" @click=${(e: Event) => this.onDelete(e, t)}>&times;</button>
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
safeRegister('alx-tg-template-list', AlxTgTemplateList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-template-list': AlxTgTemplateList;
  }
}

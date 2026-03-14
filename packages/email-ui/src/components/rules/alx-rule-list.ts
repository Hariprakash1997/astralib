import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';
import type { PaginatedResponse } from '../../api/http-client.js';

interface RuleRow {
  _id: string;
  name: string;
  templateName?: string;
  templateId: string;
  isActive: boolean;
  lastRunAt: string | null;
  totalSent: number;
  totalSkipped: number;
}

@customElement('alx-rule-list')
export class AlxRuleList extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    css`
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .spacer {
        flex: 1;
      }

      tr[data-clickable] {
        cursor: pointer;
      }

      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 1rem;
      }

      .toggle {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
      }

      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .toggle-slider {
        position: absolute;
        inset: 0;
        background: var(--alx-border);
        border-radius: 20px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .toggle-slider::before {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        left: 3px;
        bottom: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
      }

      .toggle input:checked + .toggle-slider {
        background: var(--alx-success);
      }

      .toggle input:checked + .toggle-slider::before {
        transform: translateX(16px);
      }

      .stat {
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @state() private _rules: RuleRow[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }
  private readonly _limit = 20;
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadRules();
  }

  private async _loadRules(): Promise<void> {
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const res = await this._api.listRules({
        page: this._page,
        limit: this._limit,
      }) as PaginatedResponse<RuleRow>;
      if (gen !== this._loadGeneration) return;
      this._rules = res.data;
      this._totalPages = res.totalPages;
      this._total = res.total;
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load rules';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private _onRowClick(rule: RuleRow): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-selected', {
        detail: rule,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _onToggleActive(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      await this._api.toggleRule(rule._id);
      await this._loadRules();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to toggle rule';
    }
  }

  private _onCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-create', { bubbles: true, composed: true }),
    );
  }

  private async _onDryRun(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      const result = await this._api.dryRun(rule._id);
      this.dispatchEvent(
        new CustomEvent('alx-rule-dry-run', {
          detail: { ruleId: rule._id, result },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Dry run failed';
    }
  }

  private _goToPage(page: number): void {
    this._page = page;
    this._loadRules();
  }

  private _formatDate(dateStr: string | null): string {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString();
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Email Rules</h3>
        </div>

        <div class="toolbar">
          <span class="spacer"></span>
          <button class="alx-btn-primary" @click=${this._onCreateClick}>+ Create Rule</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._rules.length === 0
            ? html`<div class="alx-empty">No rules found</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Template</th>
                      <th>Active</th>
                      <th>Last Run</th>
                      <th>Sent</th>
                      <th>Skipped</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._rules.map(
                      (r) => html`
                        <tr data-clickable @click=${() => this._onRowClick(r)}>
                          <td>${r.name}</td>
                          <td>${r.templateName ?? r.templateId}</td>
                          <td>
                            <label class="toggle" @click=${(e: Event) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                .checked=${r.isActive}
                                @change=${(e: Event) => this._onToggleActive(r, e)}
                              />
                              <span class="toggle-slider"></span>
                            </label>
                          </td>
                          <td class="text-muted text-small">${this._formatDate(r.lastRunAt)}</td>
                          <td class="stat">${r.totalSent}</td>
                          <td class="stat">${r.totalSkipped}</td>
                          <td>
                            <button
                              class="alx-btn-sm"
                              @click=${(e: Event) => this._onDryRun(r, e)}
                            >
                              Dry Run
                            </button>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>

                <div class="pagination">
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this._page <= 1}
                    @click=${() => this._goToPage(this._page - 1)}
                  >
                    Prev
                  </button>
                  <span class="text-muted text-small">
                    Page ${this._page} of ${this._totalPages} (${this._total} total)
                  </span>
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this._page >= this._totalPages}
                    @click=${() => this._goToPage(this._page + 1)}
                  >
                    Next
                  </button>
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-rule-list': AlxRuleList;
  }
}

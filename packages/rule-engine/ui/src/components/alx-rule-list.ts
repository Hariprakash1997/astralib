import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { formatDate } from '../utils/format.js';
import { alxBaseStyles } from '../styles/theme.js';
import {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
  alxToolbarStyles,
  alxToggleStyles,
  alxTooltipStyles,
} from '../styles/shared.js';
import { RuleEngineAPI } from '../api/rule-engine.api.js';


interface RuleRow {
  _id: string;
  name: string;
  templateName?: string;
  templateId?: string | { _id: string; name: string; slug?: string };
  ruleType?: string;
  platform?: string;
  isActive: boolean;
  lastRunAt: string | null;
  totalSent: number;
  totalSkipped: number;
}

export class AlxRuleList extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    alxToolbarStyles,
    alxToggleStyles,
    alxTooltipStyles,
    css`
      .stat {
        font-variant-numeric: tabular-nums;
      }

      .action-group {
        display: flex;
        gap: 0.35rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .dry-run-result {
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--alx-success, #16a34a);
        white-space: nowrap;
      }

      .dry-run-result.has-errors {
        color: var(--alx-warning, #d97706);
      }
    `,
  ];

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property({ type: Array }) platforms: string[] = [];
  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _rules: RuleRow[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _togglingId = '';
  @state() private _dryRunResult: { ruleId: string; matched: number; sample: string[]; errors: string[] } | null = null;
  @state() private _dryRunLoading = '';
  @state() private _deletingId = '';
  @state() private _cloningId = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _filterPlatform = '';

  private _apiInstance?: RuleEngineAPI;
  private readonly _limit = 20;
  private _loadGeneration = 0;

  private get _api(): RuleEngineAPI {
    if (this.api) return this.api;
    if (!this._apiInstance && this.baseUrl) {
      this._apiInstance = RuleEngineAPI.create(this.baseUrl);
    }
    return this._apiInstance!;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.api && this.baseUrl && !this._apiInstance) {
      this._apiInstance = RuleEngineAPI.create(this.baseUrl);
    }
    this._loadRules();
  }

  async load(): Promise<void> {
    return this._loadRules();
  }

  private async _loadRules(): Promise<void> {
    if (!this._api) return;
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._filterPlatform) params['platform'] = this._filterPlatform;

      const res = await this._api.listRules(params) as { rules: RuleRow[]; total?: number };
      if (gen !== this._loadGeneration) return;
      this._rules = res.rules ?? [];
      this._total = res.total ?? res.rules?.length ?? 0;
      this._totalPages = Math.max(1, Math.ceil(this._total / this._limit));
      if (this._page > this._totalPages) {
        this._page = this._totalPages;
      }
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load rules';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private async _onToggleActive(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    this._togglingId = rule._id;
    try {
      await this._api.toggleRule(rule._id);
      await this._loadRules();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to toggle rule';
    } finally {
      this._togglingId = '';
    }
  }

  private _onEditClick(rule: RuleRow, e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('alx-rule-edit', {
        detail: { ruleId: rule._id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-created', { bubbles: true, composed: true }),
    );
  }

  private async _onDryRun(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    this._dryRunLoading = rule._id;
    this._dryRunResult = null;
    try {
      const result = await this._api.dryRun(rule._id);
      const data = result?.data ?? result;
      this._dryRunResult = {
        ruleId: rule._id,
        matched: data.matchedCount ?? data.matched ?? 0,
        sample: data.sample ?? [],
        errors: data.errors ?? [],
      };
      this.dispatchEvent(
        new CustomEvent('alx-rule-dry-run', {
          detail: { ruleId: rule._id, result },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Dry run failed';
    } finally {
      this._dryRunLoading = '';
    }
  }

  private async _onCloneRule(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    this._cloningId = rule._id;
    try {
      await this._api.cloneRule(rule._id);
      await this._loadRules();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to clone rule';
    } finally {
      this._cloningId = '';
    }
  }

  private async _onDeleteRule(rule: RuleRow, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    this._deletingId = rule._id;
    try {
      await this._api.deleteRule(rule._id);
      this.dispatchEvent(new CustomEvent('alx-rule-deleted', { detail: { _id: rule._id }, bubbles: true, composed: true }));
      await this._loadRules();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to delete rule';
    } finally {
      this._deletingId = '';
    }
  }

  private _onFilterChange(): void {
    this._page = 1;
    this._loadRules();
  }

  private _goToPage(page: number): void {
    this._page = page;
    this._loadRules();
  }

  private _renderPlatformFilter() {
    if (this.platforms.length === 0) return nothing;
    return html`
      <select
        aria-label="Platform"
        .value=${this._filterPlatform}
        @change=${(e: Event) => {
          this._filterPlatform = (e.target as HTMLSelectElement).value;
          this._onFilterChange();
        }}
      >
        <option value="">All Platforms</option>
        ${this.platforms.map((p) => html`<option value=${p} ?selected=${this._filterPlatform === p}>${p}</option>`)}
      </select>
    `;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Rules</h3>
        </div>

        <div class="toolbar">
          ${this._renderPlatformFilter()}
          <span class="spacer"></span>
          <button class="alx-btn-primary" @click=${this._onCreateClick}>+ New Rule</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._rules.length === 0
            ? html`<div class="alx-empty">
  <p>Rules connect templates to recipients and automate sends.</p>
  <p>Create templates first, then set up rules.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this._onCreateClick}>+ New Rule</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Template</th>
                      <th>Platform</th>
                      <th>Status</th>
                      <th>Last Run</th>
                      <th>Total Sent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._rules.map(
                      (r) => html`
                        <tr>
                          <td>${r.name}</td>
                          <td>${r.templateName ?? (typeof r.templateId === 'object' && r.templateId ? r.templateId.name : r.templateId ?? '--')}</td>
                          <td>${r.platform ?? '--'}</td>
                          <td>
                            <label class="toggle">
                              <input
                                type="checkbox"
                                .checked=${r.isActive}
                                ?disabled=${this._togglingId === r._id}
                                @change=${(e: Event) => this._onToggleActive(r, e)}
                              />
                              <span class="toggle-slider"></span>
                            </label>
                          </td>
                          <td class="text-muted text-small">${r.lastRunAt ? formatDate(r.lastRunAt) : '--'}</td>
                          <td class="stat">${r.totalSent ?? 0}</td>
                          <td>
                            <div class="action-group">
                              <button
                                class="alx-btn-sm"
                                @click=${(e: Event) => this._onEditClick(r, e)}
                              >
                                Edit
                              </button>
                              <button
                                class="alx-btn-sm"
                                @click=${(e: Event) => this._onDryRun(r, e)}
                                ?disabled=${this._dryRunLoading === r._id}
                              >
                                ${this._dryRunLoading === r._id ? 'Running...' : 'Dry Run'}
                              </button>
                              ${this._dryRunResult?.ruleId === r._id ? html`
                                <span class="dry-run-result ${this._dryRunResult.errors.length ? 'has-errors' : ''}">
                                  ${this._dryRunResult.matched} matched${this._dryRunResult.errors.length ? `, ${this._dryRunResult.errors.length} error(s)` : ''}
                                </span>
                              ` : nothing}
                              <button
                                class="alx-btn-sm"
                                ?disabled=${this._cloningId === r._id}
                                @click=${(e: Event) => this._onCloneRule(r, e)}
                              >
                                ${this._cloningId === r._id ? '...' : 'Clone'}
                              </button>
                              <button
                                class="alx-btn-sm alx-btn-danger"
                                ?disabled=${this._deletingId === r._id}
                                @click=${(e: Event) => this._onDeleteRule(r, e)}
                              >
                                ${this._deletingId === r._id ? '...' : 'Delete'}
                              </button>
                            </div>
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
safeRegister('alx-rule-list', AlxRuleList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-rule-list': AlxRuleList;
  }
}

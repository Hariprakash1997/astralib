import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
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


interface TemplateRow {
  _id: string;
  name: string;
  slug: string;
  category?: string;
  platform?: string;
  isActive: boolean;
  version?: number;
}

export class AlxTemplateList extends LitElement {
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
      .action-group {
        display: flex;
        gap: 0.35rem;
        align-items: center;
      }
      .toggle-label { font-size: 0.7rem; color: var(--alx-text-muted); margin-left: 0.25rem; }
    `,
  ];

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property({ type: Array }) platforms: string[] = [];
  @property({ type: Array }) categories: string[] = [];
  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _templates: TemplateRow[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _togglingId = '';
  @state() private _deletingId = '';
  @state() private _cloningId = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _filterCategory = '';
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
    this._loadTemplates();
  }

  async load(): Promise<void> {
    return this._loadTemplates();
  }

  private async _loadTemplates(): Promise<void> {
    if (!this._api) return;
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._filterCategory) params['category'] = this._filterCategory;
      if (this._filterPlatform) params['platform'] = this._filterPlatform;

      const res = await this._api.listTemplates(params) as { templates: TemplateRow[]; total?: number };
      if (gen !== this._loadGeneration) return;
      this._templates = res.templates ?? [];
      this._total = res.total ?? res.templates?.length ?? 0;
      this._totalPages = Math.max(1, Math.ceil(this._total / this._limit));
      if (this._page > this._totalPages) {
        this._page = this._totalPages;
      }
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load templates';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private async _onToggleActive(template: TemplateRow, e: Event): Promise<void> {
    e.stopPropagation();
    this._togglingId = template._id;
    try {
      await this._api.toggleTemplate(template._id);
      await this._loadTemplates();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to toggle template';
    } finally {
      this._togglingId = '';
    }
  }

  private _onEditClick(template: TemplateRow, e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('alx-template-edit', {
        detail: { templateId: template._id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _onClone(template: TemplateRow, e: Event): Promise<void> {
    e.stopPropagation();
    this._cloningId = template._id;
    try {
      await this._api.cloneTemplate(template._id);
      await this._loadTemplates();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to clone template';
    } finally {
      this._cloningId = '';
    }
  }

  private async _onDelete(template: TemplateRow, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    this._deletingId = template._id;
    try {
      await this._api.deleteTemplate(template._id);
      this.dispatchEvent(
        new CustomEvent('alx-template-deleted', {
          detail: { _id: template._id },
          bubbles: true,
          composed: true,
        }),
      );
      await this._loadTemplates();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to delete template';
    } finally {
      this._deletingId = '';
    }
  }

  private _onCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-created', { bubbles: true, composed: true }),
    );
  }

  private _onFilterChange(): void {
    this._page = 1;
    this._loadTemplates();
  }

  private _goToPage(page: number): void {
    this._page = page;
    this._loadTemplates();
  }

  private _renderFilterSelect(
    label: string,
    value: string,
    options: string[],
    onChange: (val: string) => void,
  ) {
    if (options.length === 0) return nothing;
    return html`
      <select
        aria-label=${label}
        .value=${value}
        @change=${(e: Event) => {
          onChange((e.target as HTMLSelectElement).value);
          this._onFilterChange();
        }}
      >
        <option value="">All ${label}</option>
        ${options.map((o) => html`<option value=${o} ?selected=${value === o}>${o}</option>`)}
      </select>
    `;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Templates</h3>
        </div>

        <div class="toolbar">
          ${this._renderFilterSelect(
            'Categories',
            this._filterCategory,
            this.categories,
            (v) => { this._filterCategory = v; },
          )}
          ${this._renderFilterSelect(
            'Platforms',
            this._filterPlatform,
            this.platforms,
            (v) => { this._filterPlatform = v; },
          )}
          <span class="spacer"></span>
          <button class="alx-btn-primary" @click=${this._onCreateClick}>+ New Template</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._templates.length === 0
            ? html`<div class="alx-empty">
  <p>Templates define the content sent to recipients.</p>
  <p>Create a template before setting up rules.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this._onCreateClick}>+ New Template</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th title="Unique identifier for this template">ID</th>
                      <th>Category</th>
                      <th>Platform</th>
                      <th>Status</th>
                      <th>Version</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._templates.map(
                      (t) => html`
                        <tr>
                          <td>${t.name}</td>
                          <td><code>${t.slug}</code></td>
                          <td>${t.category ?? '--'}</td>
                          <td>${t.platform ?? '--'}</td>
                          <td>
                            <label class="toggle">
                              <input
                                type="checkbox"
                                .checked=${t.isActive}
                                ?disabled=${this._togglingId === t._id}
                                @change=${(e: Event) => this._onToggleActive(t, e)}
                              />
                              <span class="toggle-slider"></span>
                            </label>
                            <span class="toggle-label">${t.isActive ? 'Active' : 'Inactive'}</span>
                          </td>
                          <td class="text-muted text-small">${t.version != null ? `v${t.version}` : '--'}</td>
                          <td>
                            <div class="action-group">
                              <button
                                class="alx-btn-sm"
                                @click=${(e: Event) => this._onEditClick(t, e)}
                              >
                                Edit
                              </button>
                              <button
                                class="alx-btn-sm"
                                ?disabled=${this._cloningId === t._id}
                                @click=${(e: Event) => this._onClone(t, e)}
                              >
                                ${this._cloningId === t._id ? '...' : 'Clone'}
                              </button>
                              <button
                                class="alx-btn-sm alx-btn-danger"
                                ?disabled=${this._deletingId === t._id}
                                @click=${(e: Event) => this._onDelete(t, e)}
                              >
                                ${this._deletingId === t._id ? '...' : 'Delete'}
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
safeRegister('alx-template-list', AlxTemplateList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-template-list': AlxTemplateList;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
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
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';


interface TemplateRow {
  _id: string;
  name: string;
  slug: string;
  category: string;
  audience: string;
  platform: string;
  isActive: boolean;
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
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: String }) categories = '';
  @property({ type: String }) audiences = '';
  @property({ type: String }) platforms = '';

  @state() private _templates: TemplateRow[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _filterCategory = '';
  @state() private _filterAudience = '';
  @state() private _filterPlatform = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }
  private readonly _limit = 20;
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadTemplates();
  }

  private _parseJsonAttr(val: string): string[] {
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }

  private async _loadTemplates(): Promise<void> {
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._filterCategory) params['category'] = this._filterCategory;
      if (this._filterAudience) params['audience'] = this._filterAudience;
      if (this._filterPlatform) params['platform'] = this._filterPlatform;

      const res = await this._api.listTemplates(params) as { templates: TemplateRow[]; total?: number };
      if (gen !== this._loadGeneration) return;
      this._templates = res.templates ?? [];
      this._total = res.total ?? res.templates?.length ?? 0;
      this._totalPages = Math.max(1, Math.ceil(this._total / this._limit));
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load templates';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private _onRowClick(template: TemplateRow): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-selected', {
        detail: template,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _onToggleActive(template: TemplateRow, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      await this._api.updateTemplate(template._id, { isActive: !template.isActive });
      await this._loadTemplates();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to toggle template';
    }
  }

  private async _onDelete(template: TemplateRow, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
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
    }
  }

  private _onCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-create', { bubbles: true, composed: true }),
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
          <h3>Email Templates</h3>
        </div>

        <div class="toolbar">
          ${this._renderFilterSelect(
            'Categories',
            this._filterCategory,
            this._parseJsonAttr(this.categories),
            (v) => (this._filterCategory = v),
          )}
          ${this._renderFilterSelect(
            'Audiences',
            this._filterAudience,
            this._parseJsonAttr(this.audiences),
            (v) => (this._filterAudience = v),
          )}
          ${this._renderFilterSelect(
            'Platforms',
            this._filterPlatform,
            this._parseJsonAttr(this.platforms),
            (v) => (this._filterPlatform = v),
          )}
          <span class="spacer"></span>
          <button class="alx-btn-primary" @click=${this._onCreateClick}>+ Create Template</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._templates.length === 0
            ? html`<div class="alx-empty">
  <p>Templates define email content — subject, body, and variables.</p>
  <p>Create a template before setting up rules.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this._onCreateClick}>+ Create Template</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th>Category</th>
                      <th>Audience</th>
                      <th>Platform</th>
                      <th>Active</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._templates.map(
                      (t) => html`
                        <tr data-clickable @click=${() => this._onRowClick(t)}>
                          <td>${t.name}</td>
                          <td><code>${t.slug}</code></td>
                          <td>${t.category}</td>
                          <td>${t.audience}</td>
                          <td>${t.platform}</td>
                          <td>
                            <label class="toggle" @click=${(e: Event) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                .checked=${t.isActive}
                                @change=${(e: Event) => this._onToggleActive(t, e)}
                              />
                              <span class="toggle-slider"></span>
                            </label>
                          </td>
                          <td>
                            <button class="alx-btn-icon danger" title="Delete" @click=${(e: Event) => this._onDelete(t, e)}>&times;</button>
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

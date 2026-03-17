import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxToolbarStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface Draft {
  _id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: string;
}

export class AlxApprovalQueue extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxToolbarStyles,
    css`
      .bulk-actions {
        display: flex;
        gap: 0.5rem;
      }
      .select-cell {
        width: 40px;
      }
      input[type='checkbox'] {
        width: auto;
        cursor: pointer;
      }
      .selected-count {
        font-size: 0.85rem;
        color: var(--alx-text-muted);
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private drafts: Draft[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private selectedIds = new Set<string>();
  @state() private actionLoading = false;

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const res = (await this.api.listDrafts({ status: 'pending' } as Record<string, unknown>)) as {
        items: Draft[];
        total?: number;
      };
      this.drafts = res.items ?? [];
      this.selectedIds = new Set();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load drafts';
    } finally {
      this.loading = false;
    }
  }

  private toggleSelect(id: string): void {
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds = next;
  }

  private toggleAll(): void {
    if (this.selectedIds.size === this.drafts.length) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.drafts.map((d) => d._id));
    }
  }

  private async onApprove(id: string): Promise<void> {
    this.actionLoading = true;
    try {
      await this.api.approveDraft(id);
      this.dispatchEvent(
        new CustomEvent('alx-draft-approved', {
          detail: { id },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Approve failed';
    } finally {
      this.actionLoading = false;
    }
  }

  private async onReject(id: string): Promise<void> {
    this.actionLoading = true;
    try {
      await this.api.rejectDraft(id);
      this.dispatchEvent(
        new CustomEvent('alx-draft-rejected', {
          detail: { id },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Reject failed';
    } finally {
      this.actionLoading = false;
    }
  }

  private async onBulkApprove(): Promise<void> {
    if (this.selectedIds.size === 0) return;
    this.actionLoading = true;
    try {
      await this.api.bulkApprove([...this.selectedIds]);
      this.dispatchEvent(
        new CustomEvent('alx-draft-approved', {
          detail: { ids: [...this.selectedIds] },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Bulk approve failed';
    } finally {
      this.actionLoading = false;
    }
  }

  private async onBulkReject(): Promise<void> {
    if (this.selectedIds.size === 0) return;
    this.actionLoading = true;
    try {
      const ids = [...this.selectedIds];
      const results = await Promise.allSettled(ids.map(id => this.api.rejectDraft(id)));
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.error = `${failures.length} of ${ids.length} rejections failed`;
      }
      this.dispatchEvent(
        new CustomEvent('alx-draft-rejected', {
          detail: { ids },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Bulk reject failed';
    } finally {
      this.actionLoading = false;
    }
  }

  private onView(draft: Draft): void {
    this.dispatchEvent(
      new CustomEvent('alx-draft-view', {
        detail: draft,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Approval Queue</h3>
        </div>

        <div class="toolbar">
          ${this.selectedIds.size > 0
            ? html`
                <span class="selected-count">${this.selectedIds.size} selected</span>
                <div class="bulk-actions">
                  <button
                    class="alx-btn-sm alx-btn-success"
                    ?disabled=${this.actionLoading}
                    @click=${this.onBulkApprove}
                  >
                    Approve Selected
                  </button>
                  <button
                    class="alx-btn-sm alx-btn-danger"
                    ?disabled=${this.actionLoading}
                    @click=${this.onBulkReject}
                  >
                    Reject Selected
                  </button>
                </div>
              `
            : ''}
          <span class="spacer"></span>
          <button @click=${() => this.load()}>Refresh</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.drafts.length === 0
            ? html`<div class="alx-empty">No pending drafts</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th class="select-cell">
                        <input
                          type="checkbox"
                          .checked=${this.selectedIds.size === this.drafts.length && this.drafts.length > 0}
                          @change=${this.toggleAll}
                        />
                      </th>
                      <th>To</th>
                      <th>Subject</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.drafts.map(
                      (d) => html`
                        <tr>
                          <td class="select-cell">
                            <input
                              type="checkbox"
                              .checked=${this.selectedIds.has(d._id)}
                              @change=${() => this.toggleSelect(d._id)}
                            />
                          </td>
                          <td>${d.to}</td>
                          <td>${d.subject}</td>
                          <td>${this.formatDate(d.createdAt)}</td>
                          <td>
                            <span class="alx-badge alx-badge-warning">${d.status}</span>
                          </td>
                          <td>
                            <button class="alx-btn-sm" @click=${() => this.onView(d)}>View</button>
                            <button
                              class="alx-btn-sm alx-btn-success"
                              ?disabled=${this.actionLoading}
                              @click=${() => this.onApprove(d._id)}
                            >
                              Approve
                            </button>
                            <button
                              class="alx-btn-sm alx-btn-danger"
                              ?disabled=${this.actionLoading}
                              @click=${() => this.onReject(d._id)}
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              `}
      </div>
    `;
  }
}
safeRegister('alx-approval-queue', AlxApprovalQueue);

declare global {
  interface HTMLElementTagNameMap {
    'alx-approval-queue': AlxApprovalQueue;
  }
}

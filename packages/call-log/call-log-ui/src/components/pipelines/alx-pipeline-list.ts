import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import type { IPipeline } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxPipelineList extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.875rem; }
    th { font-weight: 600; color: var(--alx-text-muted, #64748b); }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-muted { background: #f1f5f9; color: #64748b; }
    .badge-primary { background: #dbeafe; color: #1e40af; }
    .actions { display: flex; gap: 0.5rem; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button.danger { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .error { color: #dc2626; padding: 0.5rem; }
    .loading { color: var(--alx-text-muted, #64748b); padding: 0.5rem; }
    .empty { color: var(--alx-text-muted, #64748b); padding: 1rem; text-align: center; }
  `;

  @state() private pipelines: IPipeline[] = [];
  @state() private loading = false;
  @state() private error = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    this.loadPipelines();
  }

  async loadPipelines() {
    this.loading = true;
    this.error = '';
    try {
      this.pipelines = await this.api.listPipelines();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load pipelines';
    } finally {
      this.loading = false;
    }
  }

  private onEdit(pipeline: IPipeline) {
    this.dispatchEvent(new CustomEvent('pipeline-edit', {
      detail: { pipelineId: pipeline.pipelineId, pipeline },
      bubbles: true, composed: true,
    }));
  }

  private async onDelete(pipeline: IPipeline) {
    if (!confirm(`Delete pipeline "${pipeline.name}"?`)) return;
    try {
      await this.api.deletePipeline(pipeline.pipelineId);
      await this.loadPipelines();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Delete failed';
    }
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('pipeline-add', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="card">
        <div class="card-header">
          <h3>Pipelines</h3>
          <div class="actions">
            <button @click=${() => this.loadPipelines()}>Refresh</button>
            <button class="primary" @click=${this.onAdd}>+ New Pipeline</button>
          </div>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="loading">Loading...</div>` : ''}

        ${!this.loading && this.pipelines.length === 0 && !this.error
          ? html`<div class="empty">No pipelines found</div>`
          : ''}

        ${!this.loading && this.pipelines.length > 0 ? html`
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Stages</th>
                <th>Status</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.pipelines.map(p => html`
                <tr>
                  <td>${p.name}</td>
                  <td>${p.stages.length}</td>
                  <td>
                    <span class="badge ${p.isActive ? 'badge-success' : 'badge-muted'}">
                      ${p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    ${p.isDefault ? html`<span class="badge badge-primary">Default</span>` : ''}
                  </td>
                  <td>
                    <div class="actions">
                      <button @click=${() => this.onEdit(p)}>Edit</button>
                      <button class="danger" @click=${() => this.onDelete(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-pipeline-list', AlxPipelineList);

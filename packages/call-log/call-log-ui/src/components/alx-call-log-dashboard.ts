import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { IPipeline } from '@astralibx/call-log-types';
import { safeRegister } from '../utils/safe-register.js';
import { CallLogApiClient } from '../api/call-log-api-client.js';

// Import all components to ensure registration
import './alx-agent-dashboard.js';
import './pipelines/alx-pipeline-list.js';
import './pipelines/alx-pipeline-board.js';
import './pipelines/alx-pipeline-stage-editor.js';
import './call-logs/alx-call-log-list.js';
import './call-logs/alx-call-log-detail.js';
import './call-logs/alx-call-log-form.js';
import './timeline/alx-call-timeline.js';
import './timeline/alx-contact-timeline.js';
import './analytics/alx-call-analytics-dashboard.js';
import './analytics/alx-pipeline-funnel.js';
import './analytics/alx-agent-leaderboard.js';
import './settings/alx-call-log-settings.js';

const ALL_TABS = [
  { key: 'mycalls', label: 'My Calls' },
  { key: 'pipelines', label: 'Pipelines' },
  { key: 'calls', label: 'Calls' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof ALL_TABS)[number]['key'];

export class AlxCallLogDashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--alx-bg, #f8fafc);
      min-height: 100%;
      padding: 1rem;
      box-sizing: border-box;
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .dashboard-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--alx-text, #0f172a);
    }

    .controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .ctrl-btn {
      padding: 0.2rem 0.5rem;
      font-size: 0.7rem;
      background: var(--alx-surface, #fff);
      color: var(--alx-text-muted, #64748b);
      border: 1px solid var(--alx-border, #e2e8f0);
      border-radius: 5px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
    }

    .ctrl-btn.active {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
    }

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--alx-border, #e2e8f0);
      margin-bottom: 1rem;
    }

    .tab {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      color: var(--alx-text-muted, #64748b);
      font-family: inherit;
      transition: all 0.15s;
    }

    .tab:hover { color: var(--alx-text, #0f172a); }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

    .tab-content { min-height: 400px; }

    .pipeline-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .calls-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .analytics-grid {
      display: grid;
      gap: 1rem;
    }

    .analytics-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .subtabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--alx-border, #e2e8f0);
      margin-bottom: 0.75rem;
    }

    .subtab {
      padding: 0.375rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      color: var(--alx-text-muted, #64748b);
      font-family: inherit;
    }

    .subtab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
  `;

  @property({ type: String }) defaultTab: TabKey = 'mycalls';
  @property({ type: String, reflect: true }) theme: 'light' | 'dark' = 'dark';
  @property({ type: String }) agentId = '';

  @state() private activeTab: TabKey = 'mycalls';
  @state() private pipelineSubTab: 'board' | 'list' | 'stages' = 'board';
  @state() private analyticsSubTab: 'overview' | 'funnel' | 'agents' = 'overview';
  @state() private selectedPipelineId = '';
  @state() private selectedCallLogId = '';
  @state() private callFormOpen = false;
  @state() private callFormId = '';
  @state() private pipelineFormOpen = false;
  @state() private pipelines: IPipeline[] = [];
  @state() private pipelinesLoaded = false;

  private api = new CallLogApiClient();

  private static readonly LIGHT_VARS: Record<string, string> = {
    '--alx-bg': '#f8fafc',
    '--alx-surface': '#ffffff',
    '--alx-surface-alt': '#f1f5f9',
    '--alx-border': '#e2e8f0',
    '--alx-text': '#0f172a',
    '--alx-text-muted': '#64748b',
  };

  private static readonly DARK_VARS: Record<string, string> = {
    '--alx-bg': '#0f1117',
    '--alx-surface': '#181a20',
    '--alx-surface-alt': '#1e2028',
    '--alx-border': '#2a2d37',
    '--alx-text': '#e1e4ea',
    '--alx-text-muted': '#8b8fa3',
  };

  private applyTheme(): void {
    const vars = this.theme === 'light' ? AlxCallLogDashboard.LIGHT_VARS : AlxCallLogDashboard.DARK_VARS;
    for (const [p, v] of Object.entries(vars)) this.style.setProperty(p, v);
  }

  connectedCallback() {
    super.connectedCallback();
    this.activeTab = this.defaultTab;
    this.applyTheme();
  }

  willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('theme')) this.applyTheme();
  }

  private setTab(tab: TabKey) {
    this.activeTab = tab;
    if (tab === 'pipelines' && !this.pipelinesLoaded) this.loadPipelines();
  }

  private async loadPipelines() {
    try {
      this.pipelines = await this.api.listPipelines({ isActive: true });
      this.pipelinesLoaded = true;
      if (!this.selectedPipelineId && this.pipelines.length > 0) {
        this.selectedPipelineId = this.pipelines[0]!.pipelineId;
      }
    } catch {
      // non-fatal
    }
  }

  private onCallLogSelect(e: CustomEvent) {
    this.selectedCallLogId = e.detail.callLogId;
  }

  private onCallLogAdd() {
    this.callFormId = '';
    this.callFormOpen = true;
  }

  private onCallLogEdit(e: CustomEvent) {
    this.callFormId = e.detail.callLogId;
    this.callFormOpen = true;
  }

  private onCallLogSaved() {
    this.callFormOpen = false;
    const list = this.shadowRoot?.querySelector('alx-call-log-list');
    if (list) (list as any).loadCallLogs();
  }

  private onPipelineEdit(e: CustomEvent) {
    this.selectedPipelineId = e.detail.pipelineId;
    this.pipelineSubTab = 'stages';
  }

  private renderPipelinesTab() {
    return html`
      <div class="subtabs">
        ${(['board', 'list', 'stages'] as const).map(s => html`
          <button class="subtab ${this.pipelineSubTab === s ? 'active' : ''}" @click=${() => this.pipelineSubTab = s}>
            ${s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        `)}
      </div>

      ${this.pipelineSubTab === 'board' ? html`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <label style="font-size:0.8rem;font-weight:500;color:var(--alx-text-muted,#64748b);">Pipeline:</label>
          <select style="padding:0.3rem 0.5rem;border:1px solid var(--alx-border,#e2e8f0);border-radius:6px;font-size:0.8rem;font-family:inherit;background:var(--alx-surface,#fff);"
            .value=${this.selectedPipelineId}
            @change=${(e: Event) => this.selectedPipelineId = (e.target as HTMLSelectElement).value}>
            <option value="">— Select Pipeline —</option>
            ${this.pipelines.map(p => html`<option value=${p.pipelineId}>${p.name}</option>`)}
          </select>
        </div>
        ${this.selectedPipelineId
          ? html`<alx-pipeline-board .pipelineId=${this.selectedPipelineId} @call-log-select=${this.onCallLogSelect}></alx-pipeline-board>`
          : html`<div style="padding:1rem;color:#94a3b8;font-size:0.875rem;">Select a pipeline to view the Kanban board.</div>`}
      ` : nothing}

      ${this.pipelineSubTab === 'list' ? html`
        <alx-pipeline-list
          @pipeline-edit=${this.onPipelineEdit}
          @pipeline-add=${() => { this.selectedPipelineId = ''; this.pipelineSubTab = 'stages'; }}
        ></alx-pipeline-list>
      ` : nothing}

      ${this.pipelineSubTab === 'stages' ? html`
        <alx-pipeline-stage-editor .pipelineId=${this.selectedPipelineId}></alx-pipeline-stage-editor>
      ` : nothing}
    `;
  }

  private renderCallsTab() {
    return html`
      <div class="calls-layout">
        <alx-call-log-list
          @call-log-select=${this.onCallLogSelect}
          @call-log-add=${this.onCallLogAdd}
        ></alx-call-log-list>
        <alx-call-log-detail
          .callLogId=${this.selectedCallLogId}
          @call-log-edit=${this.onCallLogEdit}
        ></alx-call-log-detail>
      </div>
      <alx-call-log-form
        .open=${this.callFormOpen}
        .callLogId=${this.callFormId}
        @call-log-saved=${this.onCallLogSaved}
        @drawer-close=${() => this.callFormOpen = false}
      ></alx-call-log-form>
    `;
  }

  private renderAnalyticsTab() {
    return html`
      <div class="subtabs">
        ${(['overview', 'funnel', 'agents'] as const).map(s => html`
          <button class="subtab ${this.analyticsSubTab === s ? 'active' : ''}" @click=${() => this.analyticsSubTab = s}>
            ${s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        `)}
      </div>

      ${this.analyticsSubTab === 'overview' ? html`<alx-call-analytics-dashboard></alx-call-analytics-dashboard>` : nothing}
      ${this.analyticsSubTab === 'funnel' ? html`<alx-pipeline-funnel></alx-pipeline-funnel>` : nothing}
      ${this.analyticsSubTab === 'agents' ? html`<alx-agent-leaderboard></alx-agent-leaderboard>` : nothing}
    `;
  }

  render() {
    return html`
      <div class="dashboard-header">
        <span class="dashboard-title">Call Log Dashboard</span>
        <div class="controls">
          <span style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Theme</span>
          <button class="ctrl-btn ${this.theme === 'light' ? 'active' : ''}" @click=${() => this.theme = 'light'}>Light</button>
          <button class="ctrl-btn ${this.theme === 'dark' ? 'active' : ''}" @click=${() => this.theme = 'dark'}>Dark</button>
        </div>
      </div>

      <div class="tabs">
        ${ALL_TABS.map(t => html`
          <button class="tab ${this.activeTab === t.key ? 'active' : ''}" @click=${() => this.setTab(t.key)}>
            ${t.label}
          </button>
        `)}
      </div>

      <div class="tab-content">
        ${this.activeTab === 'mycalls' ? html`<alx-agent-dashboard .agentId=${this.agentId} @call-log-select=${this.onCallLogSelect}></alx-agent-dashboard>` : nothing}
        ${this.activeTab === 'pipelines' ? this.renderPipelinesTab() : nothing}
        ${this.activeTab === 'calls' ? this.renderCallsTab() : nothing}
        ${this.activeTab === 'analytics' ? this.renderAnalyticsTab() : nothing}
        ${this.activeTab === 'settings' ? html`<alx-call-log-settings></alx-call-log-settings>` : nothing}
      </div>
    `;
  }
}

safeRegister('alx-call-log-dashboard', AlxCallLogDashboard);

import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatTabStyles,
  alxChatDrawerStyles,
  alxChatButtonStyles,
} from '../../styles/shared.js';

// Import all components to ensure registration
import '../sessions/alx-chat-session-list.js';
import '../sessions/alx-chat-session-messages.js';
import '../sessions/alx-chat-session-detail.js';
import '../agents/alx-chat-agent-list.js';
import '../agents/alx-chat-agent-form.js';
import '../agents/alx-chat-agent-dashboard.js';
import '../memory/alx-chat-memory-list.js';
import '../memory/alx-chat-memory-form.js';
import '../prompts/alx-chat-prompt-list.js';
import '../prompts/alx-chat-prompt-editor.js';
import '../knowledge/alx-chat-knowledge-list.js';
import '../knowledge/alx-chat-knowledge-form.js';
import '../content/alx-chat-faq-editor.js';
import '../content/alx-chat-flow-editor.js';
import '../content/alx-chat-canned-response-list.js';
import '../analytics/alx-chat-stats.js';
import '../analytics/alx-chat-feedback-stats.js';
import '../analytics/alx-chat-offline-messages.js';
import '../settings/alx-chat-settings.js';

const ALL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'agents', label: 'Agents' },
  { key: 'memory', label: 'Memory' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'content', label: 'Content' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof ALL_TABS)[number]['key'];

/** Capability-gated tabs — keys that require a specific capability to be true. */
const TAB_CAPABILITY_MAP: Partial<Record<TabKey, keyof typeof AlxChatConfig.capabilities>> = {
  agents: 'agents',
  memory: 'memory',
  prompts: 'prompts',
  knowledge: 'knowledge',
};

function getVisibleTabs(): Array<{ key: TabKey; label: string }> {
  const caps = AlxChatConfig.capabilities;
  return ALL_TABS.filter(t => {
    const requiredCap = TAB_CAPABILITY_MAP[t.key];
    if (!requiredCap) return true;
    return caps[requiredCap];
  });
}

export class AlxChatDashboard extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTabStyles,
    alxChatDrawerStyles,
    alxChatButtonStyles,
    css`
      :host {
        display: block;
        background: var(--alx-bg);
        min-height: 100%;
        padding: 1rem;
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
        color: var(--alx-text);
      }

      .controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .control-group {
        display: flex;
        gap: 0.2rem;
        align-items: center;
      }

      .control-label {
        font-size: 0.6rem;
        color: var(--alx-text-muted);
        margin-right: 0.15rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-weight: 500;
      }

      .ctrl-btn {
        padding: 0.2rem 0.45rem;
        font-size: 0.65rem;
        background: var(--alx-surface);
        color: var(--alx-text-muted);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        cursor: pointer;
        font-family: inherit;
        font-weight: 500;
        transition: all 0.15s;
      }

      .ctrl-btn:hover {
        border-color: var(--alx-primary);
        color: var(--alx-primary);
      }

      .ctrl-btn.active {
        background: var(--alx-primary);
        color: #fff;
        border-color: var(--alx-primary);
      }

      .tab-content {
        min-height: 400px;
      }

      .sessions-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-top: 1rem;
      }

      .overview-grid {
        display: grid;
        gap: 1rem;
      }

      .overview-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .content-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--alx-border);
        margin-bottom: 0.75rem;
      }

      .content-tab {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--alx-text-muted);
        cursor: pointer;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all 0.15s;
      }

      .content-tab:hover { color: var(--alx-text); }
      .content-tab.active {
        color: var(--alx-primary);
        border-bottom-color: var(--alx-primary);
      }
    `,
  ];

  @property({ type: String }) defaultTab: TabKey = 'overview';
  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: String, reflect: true }) theme: 'light' | 'dark' = 'dark';

  @state() private activeTab: TabKey = 'overview';
  @state() private selectedSessionId = '';
  @state() private agentFormOpen = false;
  @state() private agentFormId = '';
  @state() private memoryFormOpen = false;
  @state() private memoryFormId = '';
  @state() private promptEditorOpen = false;
  @state() private promptEditorId = '';
  @state() private knowledgeFormOpen = false;
  @state() private knowledgeFormId = '';
  @state() private contentSubTab: 'faq' | 'flow' | 'canned' = 'faq';

  private boundHashHandler = () => this.handleHash();

  connectedCallback() {
    super.connectedCallback();
    this.activeTab = this.defaultTab;
    this.handleHash();
    window.addEventListener('hashchange', this.boundHashHandler);
    AlxChatConfig.fetchCapabilities().then(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.boundHashHandler);
  }

  private handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && getVisibleTabs().some(t => t.key === hash)) {
      this.activeTab = hash as TabKey;
    }
  }

  private setTab(tab: TabKey) {
    this.activeTab = tab;
    window.location.hash = tab;
  }

  private onSessionSelect(e: CustomEvent) {
    this.selectedSessionId = e.detail.sessionId;
  }

  private onAgentAdd() {
    this.agentFormId = '';
    this.agentFormOpen = true;
  }

  private onAgentEdit(e: CustomEvent) {
    this.agentFormId = e.detail.agentId;
    this.agentFormOpen = true;
  }

  private onAgentSaved() {
    this.agentFormOpen = false;
    const list = this.shadowRoot?.querySelector('alx-chat-agent-list');
    if (list) (list as any).loadAgents();
  }

  private onMemoryAdd() {
    this.memoryFormId = '';
    this.memoryFormOpen = true;
  }

  private onMemoryEdit(e: CustomEvent) {
    this.memoryFormId = e.detail.memoryId;
    this.memoryFormOpen = true;
  }

  private onMemorySaved() {
    this.memoryFormOpen = false;
    const list = this.shadowRoot?.querySelector('alx-chat-memory-list');
    if (list) (list as any).loadMemories();
  }

  private onPromptAdd() {
    this.promptEditorId = '';
    this.promptEditorOpen = true;
  }

  private onPromptEdit(e: CustomEvent) {
    this.promptEditorId = e.detail.promptId;
    this.promptEditorOpen = true;
  }

  private onPromptSaved() {
    this.promptEditorOpen = false;
    const list = this.shadowRoot?.querySelector('alx-chat-prompt-list');
    if (list) (list as any).loadPrompts();
  }

  private onKnowledgeAdd() {
    this.knowledgeFormId = '';
    this.knowledgeFormOpen = true;
  }

  private onKnowledgeEdit(e: CustomEvent) {
    this.knowledgeFormId = e.detail.knowledgeId;
    this.knowledgeFormOpen = true;
  }

  private onKnowledgeSaved() {
    this.knowledgeFormOpen = false;
    const list = this.shadowRoot?.querySelector('alx-chat-knowledge-list');
    if (list) (list as any).loadEntries();
  }

  private static readonly LIGHT_VARS: Record<string, string> = {
    '--alx-bg': '#f8fafc',
    '--alx-surface': '#ffffff',
    '--alx-surface-alt': '#f1f5f9',
    '--alx-border': '#e2e8f0',
    '--alx-text': '#0f172a',
    '--alx-text-muted': '#64748b',
    '--alx-shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    '--alx-shadow-md': '0 4px 12px rgba(0,0,0,0.08)',
  };

  private static readonly DARK_VARS: Record<string, string> = {
    '--alx-bg': '#0f1117',
    '--alx-surface': '#181a20',
    '--alx-surface-alt': '#1e2028',
    '--alx-border': '#2a2d37',
    '--alx-text': '#e1e4ea',
    '--alx-text-muted': '#8b8fa3',
    '--alx-shadow-sm': '0 1px 3px rgba(0,0,0,0.3)',
    '--alx-shadow-md': '0 4px 12px rgba(0,0,0,0.4)',
  };

  private _applyTheme(): void {
    const vars = this.theme === 'light' ? AlxChatDashboard.LIGHT_VARS : AlxChatDashboard.DARK_VARS;
    for (const [prop, val] of Object.entries(vars)) {
      this.style.setProperty(prop, val);
    }
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('theme')) {
      this._applyTheme();
    }
  }

  private _toggleDensity(): void {
    this.density = this.density === 'default' ? 'compact' : 'default';
  }

  private _setTheme(mode: 'light' | 'dark'): void {
    this.theme = mode;
  }

  private _renderControls() {
    return html`
      <div class="controls">
        <div class="control-group">
          <span class="control-label">Density</span>
          <button class="ctrl-btn ${this.density === 'default' ? 'active' : ''}" @click=${() => this.density = 'default'}>Default</button>
          <button class="ctrl-btn ${this.density === 'compact' ? 'active' : ''}" @click=${() => this.density = 'compact'}>Compact</button>
        </div>
        <div class="control-group">
          <span class="control-label">Theme</span>
          <button class="ctrl-btn ${this.theme === 'light' ? 'active' : ''}" @click=${() => this._setTheme('light')}>Light</button>
          <button class="ctrl-btn ${this.theme === 'dark' ? 'active' : ''}" @click=${() => this._setTheme('dark')}>Dark</button>
        </div>
      </div>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case 'overview':
        return html`
          <div class="overview-grid">
            <alx-chat-stats .density=${this.density}></alx-chat-stats>
            <div class="overview-row">
              <alx-chat-feedback-stats .density=${this.density}></alx-chat-feedback-stats>
              <alx-chat-offline-messages .density=${this.density}></alx-chat-offline-messages>
            </div>
          </div>
        `;

      case 'sessions':
        return html`
          <alx-chat-session-list .density=${this.density} @session-select=${this.onSessionSelect}></alx-chat-session-list>
          ${this.selectedSessionId ? html`
            <div class="sessions-layout">
              <alx-chat-session-messages .density=${this.density} .sessionId=${this.selectedSessionId}></alx-chat-session-messages>
              <alx-chat-session-detail .density=${this.density} .sessionId=${this.selectedSessionId}></alx-chat-session-detail>
            </div>
          ` : nothing}
        `;

      case 'agents':
        return html`
          <alx-chat-agent-list
            .density=${this.density}
            @agent-add=${this.onAgentAdd}
            @agent-edit=${this.onAgentEdit}
          ></alx-chat-agent-list>
          <div style="margin-top:1rem;">
            <alx-chat-agent-dashboard .density=${this.density}></alx-chat-agent-dashboard>
          </div>
          <alx-chat-agent-form
            .density=${this.density}
            .open=${this.agentFormOpen}
            .agentId=${this.agentFormId}
            @agent-saved=${this.onAgentSaved}
            @drawer-close=${() => this.agentFormOpen = false}
          ></alx-chat-agent-form>
        `;

      case 'memory':
        return html`
          <alx-chat-memory-list
            .density=${this.density}
            @memory-add=${this.onMemoryAdd}
            @memory-edit=${this.onMemoryEdit}
          ></alx-chat-memory-list>
          <alx-chat-memory-form
            .density=${this.density}
            .open=${this.memoryFormOpen}
            .memoryId=${this.memoryFormId}
            @memory-saved=${this.onMemorySaved}
            @drawer-close=${() => this.memoryFormOpen = false}
          ></alx-chat-memory-form>
        `;

      case 'prompts':
        return html`
          <alx-chat-prompt-list
            .density=${this.density}
            @prompt-add=${this.onPromptAdd}
            @prompt-edit=${this.onPromptEdit}
          ></alx-chat-prompt-list>
          <alx-chat-prompt-editor
            .density=${this.density}
            .open=${this.promptEditorOpen}
            .promptId=${this.promptEditorId}
            @prompt-saved=${this.onPromptSaved}
            @drawer-close=${() => this.promptEditorOpen = false}
          ></alx-chat-prompt-editor>
        `;

      case 'knowledge':
        return html`
          <alx-chat-knowledge-list
            .density=${this.density}
            @knowledge-add=${this.onKnowledgeAdd}
            @knowledge-edit=${this.onKnowledgeEdit}
          ></alx-chat-knowledge-list>
          <alx-chat-knowledge-form
            .density=${this.density}
            .open=${this.knowledgeFormOpen}
            .knowledgeId=${this.knowledgeFormId}
            @knowledge-saved=${this.onKnowledgeSaved}
            @drawer-close=${() => this.knowledgeFormOpen = false}
          ></alx-chat-knowledge-form>
        `;

      case 'content':
        return html`
          <div class="content-tabs">
            <button class="content-tab ${this.contentSubTab === 'faq' ? 'active' : ''}"
              @click=${() => this.contentSubTab = 'faq'}>FAQ</button>
            <button class="content-tab ${this.contentSubTab === 'flow' ? 'active' : ''}"
              @click=${() => this.contentSubTab = 'flow'}>Pre-Chat Flow</button>
            <button class="content-tab ${this.contentSubTab === 'canned' ? 'active' : ''}"
              @click=${() => this.contentSubTab = 'canned'}>Canned Responses</button>
          </div>
          ${this.contentSubTab === 'faq' ? html`<alx-chat-faq-editor .density=${this.density}></alx-chat-faq-editor>` : nothing}
          ${this.contentSubTab === 'flow' ? html`<alx-chat-flow-editor .density=${this.density}></alx-chat-flow-editor>` : nothing}
          ${this.contentSubTab === 'canned' ? html`<alx-chat-canned-response-list .density=${this.density}></alx-chat-canned-response-list>` : nothing}
        `;

      case 'settings':
        return html`<alx-chat-settings .density=${this.density}></alx-chat-settings>`;

      default:
        return nothing;
    }
  }

  render() {
    return html`
      <div class="dashboard-header">
        <span class="dashboard-title">Chat Dashboard</span>
        ${this._renderControls()}
      </div>

      <div class="tabs">
        ${getVisibleTabs().map(t => html`
          <button class="tab ${this.activeTab === t.key ? 'active' : ''}"
            @click=${() => this.setTab(t.key)}>${t.label}</button>
        `)}
      </div>

      <div class="tab-content">
        ${this.renderTabContent()}
      </div>
    `;
  }
}

safeRegister('alx-chat-dashboard', AlxChatDashboard);

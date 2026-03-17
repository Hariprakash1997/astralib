import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatTabStyles,
  alxChatDrawerStyles,
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

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'agents', label: 'Agents' },
  { key: 'memory', label: 'Memory' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'content', label: 'Content' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export class AlxChatDashboard extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTabStyles,
    alxChatDrawerStyles,
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.boundHashHandler);
  }

  private handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && TABS.some(t => t.key === hash)) {
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

  private renderTabContent() {
    switch (this.activeTab) {
      case 'overview':
        return html`
          <div class="overview-grid">
            <alx-chat-stats></alx-chat-stats>
            <div class="overview-row">
              <alx-chat-feedback-stats></alx-chat-feedback-stats>
              <alx-chat-offline-messages></alx-chat-offline-messages>
            </div>
          </div>
        `;

      case 'sessions':
        return html`
          <alx-chat-session-list @session-select=${this.onSessionSelect}></alx-chat-session-list>
          ${this.selectedSessionId ? html`
            <div class="sessions-layout">
              <alx-chat-session-messages .sessionId=${this.selectedSessionId}></alx-chat-session-messages>
              <alx-chat-session-detail .sessionId=${this.selectedSessionId}></alx-chat-session-detail>
            </div>
          ` : nothing}
        `;

      case 'agents':
        return html`
          <alx-chat-agent-list
            @agent-add=${this.onAgentAdd}
            @agent-edit=${this.onAgentEdit}
          ></alx-chat-agent-list>
          <div style="margin-top:1rem;">
            <alx-chat-agent-dashboard></alx-chat-agent-dashboard>
          </div>
          <alx-chat-agent-form
            .open=${this.agentFormOpen}
            .agentId=${this.agentFormId}
            @agent-saved=${this.onAgentSaved}
            @drawer-close=${() => this.agentFormOpen = false}
          ></alx-chat-agent-form>
        `;

      case 'memory':
        return html`
          <alx-chat-memory-list
            @memory-add=${this.onMemoryAdd}
            @memory-edit=${this.onMemoryEdit}
          ></alx-chat-memory-list>
          <alx-chat-memory-form
            .open=${this.memoryFormOpen}
            .memoryId=${this.memoryFormId}
            @memory-saved=${this.onMemorySaved}
            @drawer-close=${() => this.memoryFormOpen = false}
          ></alx-chat-memory-form>
        `;

      case 'prompts':
        return html`
          <alx-chat-prompt-list
            @prompt-add=${this.onPromptAdd}
            @prompt-edit=${this.onPromptEdit}
          ></alx-chat-prompt-list>
          <alx-chat-prompt-editor
            .open=${this.promptEditorOpen}
            .promptId=${this.promptEditorId}
            @prompt-saved=${this.onPromptSaved}
            @drawer-close=${() => this.promptEditorOpen = false}
          ></alx-chat-prompt-editor>
        `;

      case 'knowledge':
        return html`
          <alx-chat-knowledge-list
            @knowledge-add=${this.onKnowledgeAdd}
            @knowledge-edit=${this.onKnowledgeEdit}
          ></alx-chat-knowledge-list>
          <alx-chat-knowledge-form
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
          ${this.contentSubTab === 'faq' ? html`<alx-chat-faq-editor></alx-chat-faq-editor>` : nothing}
          ${this.contentSubTab === 'flow' ? html`<alx-chat-flow-editor></alx-chat-flow-editor>` : nothing}
          ${this.contentSubTab === 'canned' ? html`<alx-chat-canned-response-list></alx-chat-canned-response-list>` : nothing}
        `;

      case 'settings':
        return html`<alx-chat-settings></alx-chat-settings>`;

      default:
        return nothing;
    }
  }

  render() {
    return html`
      <div class="dashboard-header">
        <span class="dashboard-title">Chat Dashboard</span>
      </div>

      <div class="tabs">
        ${TABS.map(t => html`
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

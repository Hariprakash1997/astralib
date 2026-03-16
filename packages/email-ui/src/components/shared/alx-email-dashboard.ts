import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxButtonStyles } from '../../styles/shared.js';

// Import all components so they register
import '../account/index.js';
import '../rules/index.js';
import '../analytics/index.js';
import './alx-drawer.js';

type TabId = 'accounts' | 'templates' | 'rules' | 'runs' | 'analytics' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'templates', label: 'Templates' },
  { id: 'rules', label: 'Rules' },
  { id: 'runs', label: 'Run History' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

export class AlxEmailDashboard extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    css`
      :host {
        display: block;
        font-family: var(--alx-font-family, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        color: var(--alx-text);
        background: var(--alx-bg);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }

      .tabs {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }

      .tab {
        padding: 0.35rem 0.65rem;
        background: var(--alx-surface);
        color: var(--alx-text-muted);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 500;
        font-family: inherit;
        transition: all 0.15s ease;
      }

      .tab:hover {
        border-color: var(--alx-primary);
        color: var(--alx-primary);
      }

      .tab.active {
        background: var(--alx-primary);
        color: #fff;
        border-color: var(--alx-primary);
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

      .panel {
        display: none;
      }

      .panel.active {
        display: block;
      }

      .settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        align-items: start;
      }

      @media (max-width: 768px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }
      }

      .analytics-stack > * + * {
        margin-top: 1rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: String, reflect: true }) theme: 'light' | 'dark' = 'light';
  @property({ attribute: 'default-tab' }) defaultTab: TabId = 'accounts';
  @property({ attribute: 'hide-tabs' }) hideTabs = '';

  @state() private _activeTab: TabId = 'accounts';
  @state() private _drawerOpen = false;
  @state() private _drawerHeading = '';
  @state() private _drawerType: 'account' | 'template' | 'rule' | null = null;
  @state() private _editId = '';

  private _hashListening = false;

  private static readonly DARK_VARS: Record<string, string> = {
    '--alx-primary': '#d4af37',
    '--alx-danger': '#ef4444',
    '--alx-success': '#22c55e',
    '--alx-warning': '#f59e0b',
    '--alx-info': '#3b82f6',
    '--alx-bg': '#111',
    '--alx-surface': '#1a1a1a',
    '--alx-border': '#333',
    '--alx-text': '#ccc',
    '--alx-text-muted': '#888',
    '--alx-shadow': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    '--alx-shadow-sm': '0 1px 2px rgba(0,0,0,0.2)',
  };

  private _applyTheme(): void {
    if (this.theme === 'dark') {
      for (const [prop, val] of Object.entries(AlxEmailDashboard.DARK_VARS)) {
        this.style.setProperty(prop, val);
      }
    } else {
      // Remove inline overrides so external CSS (consumer's light theme) takes effect
      for (const prop of Object.keys(AlxEmailDashboard.DARK_VARS)) {
        this.style.removeProperty(prop);
      }
    }
  }

  private get _hiddenTabs(): Set<string> {
    return new Set(this.hideTabs.split(',').map(s => s.trim()).filter(Boolean));
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('theme')) {
      this._applyTheme();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._applyTheme();
    this._activeTab = this._parseHash() || this.defaultTab;
    if (!this._hashListening) {
      window.addEventListener('hashchange', this._onHashChange);
      this._hashListening = true;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this._onHashChange);
    this._hashListening = false;
  }

  // --- Hash routing ---

  private _onHashChange = (): void => {
    const tab = this._parseHash();
    if (tab) this._activeTab = tab;
  };

  private _parseHash(): TabId | null {
    const hash = window.location.hash.replace('#', '');
    const tab = hash.split('/')[0] as TabId;
    if (TABS.some(t => t.id === tab)) return tab;
    return null;
  }

  private _setTab(tab: TabId): void {
    this._activeTab = tab;
    window.location.hash = tab;
  }

  // --- Drawer ---

  private _openDrawer(type: 'account' | 'template' | 'rule', heading: string, id?: string): void {
    this._drawerType = type;
    this._drawerHeading = heading;
    this._editId = id || '';
    this._drawerOpen = true;
  }

  private _closeDrawer(): void {
    this._drawerOpen = false;
    this._drawerType = null;
    this._editId = '';
  }

  // --- Event handlers ---

  private _onAccountSelected = (e: Event): void => {
    const id = (e as CustomEvent).detail?._id || (e as CustomEvent).detail?.id;
    if (id) this._openDrawer('account', 'Edit Account', id);
  };

  private _onAccountCreate = (): void => {
    this._openDrawer('account', 'Create Account');
  };

  private _onTemplateSelected = (e: Event): void => {
    const id = (e as CustomEvent).detail?._id || (e as CustomEvent).detail?.id;
    if (id) this._openDrawer('template', 'Edit Template', id);
  };

  private _onTemplateCreate = (): void => {
    this._openDrawer('template', 'Create Template');
  };

  private _onRuleSelected = (e: Event): void => {
    const id = (e as CustomEvent).detail?._id || (e as CustomEvent).detail?.id;
    if (id) this._openDrawer('rule', 'Edit Rule', id);
  };

  private _onRuleCreate = (): void => {
    this._openDrawer('rule', 'Create Rule');
  };

  private _onSaved = (): void => {
    this._closeDrawer();
    this._refreshCurrentList();
  };

  private _onDeleted = (): void => {
    this._closeDrawer();
    this._refreshCurrentList();
  };

  private _onCancelled = (): void => {
    this._closeDrawer();
  };

  private _refreshCurrentList(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const accountList = root.querySelector('alx-account-list') as any;
    const templateList = root.querySelector('alx-template-list') as any;
    const ruleList = root.querySelector('alx-rule-list') as any;
    accountList?.load?.();
    templateList?.load?.();
    ruleList?.load?.();
  }

  // --- Density ---

  private _setDensity(mode: 'default' | 'compact'): void {
    this.density = mode;
  }

  // --- Render ---

  private _renderTabs() {
    const visibleTabs = TABS.filter(t => !this._hiddenTabs.has(t.id));
    return html`
      <div class="tabs">
        ${visibleTabs.map(t => html`
          <button
            class="tab ${this._activeTab === t.id ? 'active' : ''}"
            @click=${() => this._setTab(t.id)}
          >${t.label}</button>
        `)}
      </div>
    `;
  }

  private _setTheme(mode: 'light' | 'dark'): void {
    this.theme = mode;
  }

  private _renderControls() {
    return html`
      <div class="controls">
        <div class="control-group">
          <span class="control-label">Density</span>
          <button class="ctrl-btn ${this.density === 'default' ? 'active' : ''}" @click=${() => this._setDensity('default')}>Default</button>
          <button class="ctrl-btn ${this.density === 'compact' ? 'active' : ''}" @click=${() => this._setDensity('compact')}>Compact</button>
        </div>
        <div class="control-group">
          <span class="control-label">Theme</span>
          <button class="ctrl-btn ${this.theme === 'light' ? 'active' : ''}" @click=${() => this._setTheme('light')}>Light</button>
          <button class="ctrl-btn ${this.theme === 'dark' ? 'active' : ''}" @click=${() => this._setTheme('dark')}>Dark</button>
        </div>
      </div>
    `;
  }

  private _renderDrawer() {
    return html`
      <alx-drawer
        ?open=${this._drawerOpen}
        heading=${this._drawerHeading}
        .density=${this.density}
        @alx-drawer-closed=${this._closeDrawer}
      >
        <alx-account-form
          style="display:${this._drawerType === 'account' ? 'block' : 'none'}"
          hide-header
          .density=${this.density}
          account-id=${this._drawerType === 'account' ? this._editId : ''}
          @alx-account-saved=${this._onSaved}
          @alx-account-deleted=${this._onDeleted}
          @alx-account-cancelled=${this._onCancelled}
        ></alx-account-form>
        <alx-template-editor
          style="display:${this._drawerType === 'template' ? 'block' : 'none'}"
          hide-header
          .density=${this.density}
          template-id=${this._drawerType === 'template' ? this._editId : ''}
          @alx-template-saved=${this._onSaved}
          @alx-template-deleted=${this._onDeleted}
        ></alx-template-editor>
        <alx-rule-editor
          style="display:${this._drawerType === 'rule' ? 'block' : 'none'}"
          hide-header
          .density=${this.density}
          rule-id=${this._drawerType === 'rule' ? this._editId : ''}
          @alx-rule-saved=${this._onSaved}
          @alx-rule-deleted=${this._onDeleted}
        ></alx-rule-editor>
      </alx-drawer>
    `;
  }

  override render() {
    return html`
      <div class="header">
        ${this._renderTabs()}
        ${this._renderControls()}
      </div>

      <div class="panel ${this._activeTab === 'accounts' ? 'active' : ''}">
        <alx-account-list
          .density=${this.density}
          @alx-account-selected=${this._onAccountSelected}
          @alx-account-create=${this._onAccountCreate}
        ></alx-account-list>
      </div>

      <div class="panel ${this._activeTab === 'templates' ? 'active' : ''}">
        <alx-template-list
          .density=${this.density}
          @alx-template-selected=${this._onTemplateSelected}
          @alx-template-create=${this._onTemplateCreate}
        ></alx-template-list>
      </div>

      <div class="panel ${this._activeTab === 'rules' ? 'active' : ''}">
        <alx-rule-list
          .density=${this.density}
          @alx-rule-selected=${this._onRuleSelected}
          @alx-rule-create=${this._onRuleCreate}
        ></alx-rule-list>
      </div>

      <div class="panel ${this._activeTab === 'runs' ? 'active' : ''}">
        <alx-run-history .density=${this.density}></alx-run-history>
      </div>

      <div class="panel ${this._activeTab === 'analytics' ? 'active' : ''}">
        <div class="analytics-stack">
          <alx-analytics-overview .density=${this.density}></alx-analytics-overview>
          <alx-analytics-timeline .density=${this.density}></alx-analytics-timeline>
          <alx-analytics-channels .density=${this.density}></alx-analytics-channels>
        </div>
      </div>

      <div class="panel ${this._activeTab === 'settings' ? 'active' : ''}">
        <div class="settings-grid">
          <alx-throttle-settings .density=${this.density}></alx-throttle-settings>
          <alx-global-settings .density=${this.density}></alx-global-settings>
        </div>
      </div>

      ${this._renderDrawer()}
    `;
  }
}
safeRegister('alx-email-dashboard', AlxEmailDashboard);

declare global {
  interface HTMLElementTagNameMap {
    'alx-email-dashboard': AlxEmailDashboard;
  }
}

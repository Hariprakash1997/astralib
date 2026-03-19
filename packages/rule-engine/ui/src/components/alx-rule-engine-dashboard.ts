import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { RuleEngineAPI } from '../api/rule-engine.api.js';
// Import all components to register them
import './alx-template-list.js';
import './alx-template-editor.js';
import './alx-rule-list.js';
import './alx-rule-editor.js';
import './alx-run-history.js';
import './alx-send-log.js';
import './alx-throttle-settings.js';
import './alx-drawer.js';

export class AlxRuleEngineDashboard extends LitElement {
  static override styles = css`
    :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--alx-border, #e5e7eb); margin-bottom: 16px; }
    .tab { padding: 10px 20px; border: none; background: none; cursor: pointer; font-size: 14px; color: var(--alx-text-muted, #6b7280); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
    .tab.active { color: var(--alx-primary, #4f46e5); border-bottom-color: var(--alx-primary, #4f46e5); font-weight: 600; }
    .tab:hover:not(.active) { color: var(--alx-text, #374151); }
    .tab-content { min-height: 400px; }
  `;

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property({ type: Array }) platforms: string[] = [];
  @property({ type: Array }) audiences: string[] = [];
  @property({ type: Array }) categories: string[] = [];
  @property({ attribute: false }) templateSlot?: (props: any) => any;

  @state() private _activeTab = 'templates';
  @state() private _drawerOpen = false;
  @state() private _drawerTitle = '';
  @state() private _editingTemplateId?: string;
  @state() private _editingRuleId?: string;

  private _openTemplateEditor(templateId?: string) {
    this._editingTemplateId = templateId;
    this._drawerTitle = templateId ? 'Edit Template' : 'New Template';
    this._drawerOpen = true;
  }

  private _openRuleEditor(ruleId?: string) {
    this._editingRuleId = ruleId;
    this._drawerTitle = ruleId ? 'Edit Rule' : 'New Rule';
    this._drawerOpen = true;
  }

  private _closeDrawer() {
    this._drawerOpen = false;
    this._editingTemplateId = undefined;
    this._editingRuleId = undefined;
  }

  override render() {
    return html`
      <div class="tab-bar">
        ${['templates', 'rules', 'history', 'sends', 'settings'].map(tab => html`
          <button class="tab ${this._activeTab === tab ? 'active' : ''}"
            @click=${() => { this._activeTab = tab; }}>
            ${tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        `)}
      </div>

      <div class="tab-content">
        ${this._activeTab === 'templates' ? html`
          <alx-template-list
            .baseUrl=${this.baseUrl}
            .api=${this.api}
            .platforms=${this.platforms}
            .categories=${this.categories}
            @alx-template-edit=${(e: CustomEvent) => this._openTemplateEditor(e.detail.templateId)}
            @alx-template-created=${() => this._openTemplateEditor()}
          ></alx-template-list>
        ` : nothing}
        ${this._activeTab === 'rules' ? html`
          <alx-rule-list
            .baseUrl=${this.baseUrl}
            .api=${this.api}
            .platforms=${this.platforms}
            @alx-rule-edit=${(e: CustomEvent) => this._openRuleEditor(e.detail.ruleId)}
            @alx-rule-created=${() => this._openRuleEditor()}
          ></alx-rule-list>
        ` : nothing}
        ${this._activeTab === 'history' ? html`
          <alx-run-history .baseUrl=${this.baseUrl} .api=${this.api}></alx-run-history>
        ` : nothing}
        ${this._activeTab === 'sends' ? html`
          <alx-send-log .baseUrl=${this.baseUrl} .api=${this.api}></alx-send-log>
        ` : nothing}
        ${this._activeTab === 'settings' ? html`
          <alx-throttle-settings .baseUrl=${this.baseUrl} .api=${this.api}></alx-throttle-settings>
        ` : nothing}
      </div>

      <alx-drawer .open=${this._drawerOpen} .heading=${this._drawerTitle} @alx-drawer-closed=${this._closeDrawer}>
        ${this._editingTemplateId !== undefined || this._drawerTitle === 'New Template' ? html`
          <alx-template-editor
            .baseUrl=${this.baseUrl}
            .api=${this.api}
            .templateId=${this._editingTemplateId}
            .platforms=${this.platforms}
            .audiences=${this.audiences}
            .categories=${this.categories}
            @alx-template-saved=${() => { this._closeDrawer(); }}
            @alx-template-cancelled=${this._closeDrawer}
          ></alx-template-editor>
        ` : nothing}
        ${this._editingRuleId !== undefined || this._drawerTitle === 'New Rule' ? html`
          <alx-rule-editor
            .baseUrl=${this.baseUrl}
            .api=${this.api}
            .ruleId=${this._editingRuleId}
            .platforms=${this.platforms}
            .audiences=${this.audiences}
            @alx-rule-saved=${() => { this._closeDrawer(); }}
            @alx-rule-cancel=${this._closeDrawer}
          ></alx-rule-editor>
        ` : nothing}
      </alx-drawer>
    `;
  }
}

safeRegister('alx-rule-engine-dashboard', AlxRuleEngineDashboard);

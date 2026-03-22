import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import type { ICallLogSettings, IPriorityConfig } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallLogSettings extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    h4 { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; }
    .form { display: flex; flex-direction: column; gap: 0.75rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
    input[type=text], input[type=number] { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.875rem; font-family: inherit; }
    .checkbox-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
    .tag { display: flex; align-items: center; gap: 0.25rem; background: #f1f5f9; color: #334155; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
    .tag button { padding: 0; border: none; background: none; cursor: pointer; color: #94a3b8; font-size: 0.8rem; }
    .add-row { display: flex; gap: 0.5rem; }
    .add-row input { flex: 1; }
    button { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button.sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 0.8rem; background: #fee2e2; padding: 0.4rem; border-radius: 4px; }
    .success { color: #166534; font-size: 0.8rem; background: #dcfce7; padding: 0.4rem; border-radius: 4px; }
    .loading { color: var(--alx-text-muted, #64748b); padding: 0.5rem; }
    .priority-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 0.5rem; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.8rem; }
    .priority-row:last-child { border-bottom: none; }
    input[type=color] { width: 36px; height: 28px; padding: 0.1rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 4px; cursor: pointer; }
    input[type=number].sm { width: 56px; }
  `;

  @state() private settings: ICallLogSettings | null = null;
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  // editable state
  @state() private tags: string[] = [];
  @state() private categories: string[] = [];
  @state() private followUpDays = 3;
  @state() private reminderEnabled = true;
  @state() private timelinePageSize = 50;
  @state() private maxConcurrent = 10;

  // input buffers
  @state() private newTag = '';
  @state() private newCategory = '';

  // priority levels
  @state() private priorityLevels: IPriorityConfig[] = [];

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      this.settings = await this.api.getSettings();
      this.tags = [...(this.settings.availableTags ?? [])];
      this.categories = [...(this.settings.availableCategories ?? [])];
      this.followUpDays = this.settings.defaultFollowUpDays ?? 3;
      this.reminderEnabled = this.settings.followUpReminderEnabled ?? true;
      this.timelinePageSize = this.settings.timelinePageSize ?? 50;
      this.maxConcurrent = this.settings.maxConcurrentCalls ?? 10;
      this.priorityLevels = (this.settings.priorityLevels ?? []).map(p => ({ ...p }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.updateSettings({
        availableTags: this.tags,
        availableCategories: this.categories,
        defaultFollowUpDays: this.followUpDays,
        followUpReminderEnabled: this.reminderEnabled,
        timelinePageSize: this.timelinePageSize,
        maxConcurrentCalls: this.maxConcurrent,
        priorityLevels: this.priorityLevels,
      } as Partial<ICallLogSettings>);
      this.success = 'Settings saved successfully.';
      setTimeout(() => { this.success = ''; }, 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  private addTag() {
    const t = this.newTag.trim();
    if (!t || this.tags.includes(t)) return;
    this.tags = [...this.tags, t];
    this.newTag = '';
  }

  private removeTag(tag: string) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  private addCategory() {
    const c = this.newCategory.trim();
    if (!c || this.categories.includes(c)) return;
    this.categories = [...this.categories, c];
    this.newCategory = '';
  }

  private removeCategory(cat: string) {
    this.categories = this.categories.filter(c => c !== cat);
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading settings...</div>`;

    return html`
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      ${this.success ? html`<div class="success">${this.success}</div>` : ''}

      <!-- Tags -->
      <div class="card">
        <h4>Available Tags</h4>
        <div class="tag-list">
          ${this.tags.map(t => html`
            <span class="tag">
              ${t}
              <button @click=${() => this.removeTag(t)}>&times;</button>
            </span>
          `)}
          ${this.tags.length === 0 ? html`<span style="font-size:0.8rem;color:#94a3b8;">No tags defined</span>` : nothing}
        </div>
        <div class="add-row">
          <input type="text" placeholder="New tag..." .value=${this.newTag}
            @input=${(e: Event) => this.newTag = (e.target as HTMLInputElement).value}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.addTag(); }} />
          <button class="sm" @click=${this.addTag}>Add</button>
        </div>
      </div>

      <!-- Categories -->
      <div class="card">
        <h4>Available Categories</h4>
        <div class="tag-list">
          ${this.categories.map(c => html`
            <span class="tag">
              ${c}
              <button @click=${() => this.removeCategory(c)}>&times;</button>
            </span>
          `)}
          ${this.categories.length === 0 ? html`<span style="font-size:0.8rem;color:#94a3b8;">No categories defined</span>` : nothing}
        </div>
        <div class="add-row">
          <input type="text" placeholder="New category..." .value=${this.newCategory}
            @input=${(e: Event) => this.newCategory = (e.target as HTMLInputElement).value}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.addCategory(); }} />
          <button class="sm" @click=${this.addCategory}>Add</button>
        </div>
      </div>

      <!-- Numeric settings -->
      <div class="card">
        <h4>General Settings</h4>
        <div class="form">
          <div class="form-row">
            <label>Default Follow-Up Days
              <input type="number" min="1" .value=${String(this.followUpDays)}
                @input=${(e: Event) => this.followUpDays = parseInt((e.target as HTMLInputElement).value || '3', 10)} />
            </label>
            <label>Timeline Page Size
              <input type="number" min="10" max="200" .value=${String(this.timelinePageSize)}
                @input=${(e: Event) => this.timelinePageSize = parseInt((e.target as HTMLInputElement).value || '50', 10)} />
            </label>
          </div>
          <div class="form-row">
            <label>Max Concurrent Calls
              <input type="number" min="1" .value=${String(this.maxConcurrent)}
                @input=${(e: Event) => this.maxConcurrent = parseInt((e.target as HTMLInputElement).value || '10', 10)} />
            </label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="reminder" .checked=${this.reminderEnabled}
              @change=${(e: Event) => this.reminderEnabled = (e.target as HTMLInputElement).checked} />
            <label for="reminder">Enable follow-up reminders</label>
          </div>
        </div>
      </div>

      <!-- Priority Levels -->
      <div class="card">
        <h4>Priority Levels</h4>
        ${this.priorityLevels.length === 0
          ? html`<span style="font-size:0.8rem;color:#94a3b8;">No priority levels defined</span>`
          : this.priorityLevels.map((p, i) => html`
            <div class="priority-row">
              <label style="display:flex;flex-direction:column;gap:0.2rem;font-size:0.8rem;">
                <span style="font-size:0.7rem;color:#94a3b8;">Label</span>
                <input type="text" .value=${p.label}
                  @input=${(e: Event) => {
                    const updated = [...this.priorityLevels];
                    updated[i] = { ...updated[i]!, label: (e.target as HTMLInputElement).value };
                    this.priorityLevels = updated;
                  }} />
              </label>
              <label style="display:flex;flex-direction:column;gap:0.2rem;align-items:center;font-size:0.7rem;color:#94a3b8;">
                Color
                <input type="color" .value=${p.color}
                  @input=${(e: Event) => {
                    const updated = [...this.priorityLevels];
                    updated[i] = { ...updated[i]!, color: (e.target as HTMLInputElement).value };
                    this.priorityLevels = updated;
                  }} />
              </label>
              <label style="display:flex;flex-direction:column;gap:0.2rem;align-items:center;font-size:0.7rem;color:#94a3b8;">
                Order
                <input type="number" class="sm" min="0" .value=${String(p.order)}
                  @input=${(e: Event) => {
                    const updated = [...this.priorityLevels];
                    updated[i] = { ...updated[i]!, order: parseInt((e.target as HTMLInputElement).value || '0', 10) };
                    this.priorityLevels = updated;
                  }} />
              </label>
              <span style="font-size:0.75rem;font-weight:500;color:#334155;padding:0.2rem 0.4rem;background:#f1f5f9;border-radius:4px;">${p.value}</span>
            </div>
          `)}
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button class="primary" ?disabled=${this.saving} @click=${this.onSave}>
          ${this.saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    `;
  }
}

safeRegister('alx-call-log-settings', AlxCallLogSettings);

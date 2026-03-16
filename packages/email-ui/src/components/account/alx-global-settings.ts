import { LitElement, html } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';
import type { Settings } from './alx-global-settings.types.js';
import { globalSettingsStyles } from './alx-global-settings.styles.js';

export class AlxGlobalSettings extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    globalSettingsStyles,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private settings: Settings = {};
  @state() private loading = false;
  @state() private error = '';
  @state() private saving: Record<string, boolean> = {};
  @state() private openSections = new Set<string>(['timezone']);

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
      this.settings = ((await this.api.getSettings()) as Settings) ?? {};
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      this.loading = false;
    }
  }

  private toggleSection(name: string): void {
    const next = new Set(this.openSections);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.openSections = next;
  }

  private async saveSection(section: string, data: Record<string, unknown>): Promise<void> {
    this.saving = { ...this.saving, [section]: true };
    try {
      await this.api.updateSettings(data);
      this.dispatchEvent(
        new CustomEvent('alx-settings-saved', {
          detail: { section, data },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      this.saving = { ...this.saving, [section]: false };
    }
  }

  private renderSection(name: string, title: string, content: unknown) {
    const isOpen = this.openSections.has(name);
    return html`
      <div class="section">
        <div class="section-header" @click=${() => this.toggleSection(name)}>
          <span class="section-title">${title}</span>
          <span class="section-toggle">${isOpen ? '\u25B2' : '\u25BC'}</span>
        </div>
        <div class="section-body ${isOpen ? 'open' : ''}">
          ${content}
        </div>
      </div>
    `;
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>General</h3>
        </div>

        <div class="info-banner">System-wide configuration. Changes apply to all accounts and rules.</div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        ${this.renderSection(
          'timezone',
          'Timezone & General',
          html`
            <div class="section-desc">All scheduled runs, date filters, and timestamps use this timezone.</div>
            <div class="field-row">
              <div class="field-group">
                <label>Timezone</label>
                <input
                  type="text"
                  .value=${this.settings.timezone ?? 'UTC'}
                  @input=${(e: Event) => {
                    this.settings = { ...this.settings, timezone: (e.target as HTMLInputElement).value };
                  }}
                  placeholder="e.g. America/New_York"
                />
              </div>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Dev Mode</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  .checked=${this.settings.devMode ?? false}
                  @change=${(e: Event) => {
                    this.settings = { ...this.settings, devMode: (e.target as HTMLInputElement).checked };
                  }}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="section-actions">
              <button
                class="alx-btn-primary alx-btn-sm"
                ?disabled=${this.saving['timezone']}
                @click=${() => this.saveSection('timezone', { timezone: this.settings.timezone, devMode: this.settings.devMode })}
              >
                ${this.saving['timezone'] ? 'Saving...' : 'Save'}
              </button>
            </div>
          `,
        )}

        ${this.renderSection(
          'imap',
          'IMAP Configuration',
          html`
            <div class="section-desc">Automatically checks for bounced emails via IMAP. Adjusts account health scores.</div>
            <div class="toggle-row">
              <span class="toggle-label">IMAP Bounce Checking</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  .checked=${this.settings.imap?.enabled ?? false}
                  @change=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      imap: { ...this.settings.imap, enabled: (e.target as HTMLInputElement).checked },
                    };
                  }}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label>Poll Interval (minutes)</label>
                <input
                  type="number"
                  .value=${String(this.settings.imap?.pollIntervalMinutes ?? 15)}
                  @input=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      imap: { ...this.settings.imap, pollIntervalMinutes: Number((e.target as HTMLInputElement).value) },
                    };
                  }}
                  min="1"
                />
              </div>
            </div>
            <div class="section-actions">
              <button
                class="alx-btn-primary alx-btn-sm"
                ?disabled=${this.saving['imap']}
                @click=${() => this.saveSection('imap', { imap: this.settings.imap })}
              >
                ${this.saving['imap'] ? 'Saving...' : 'Save'}
              </button>
            </div>
          `,
        )}

        ${this.renderSection(
          'approval',
          'Approval Workflow',
          html`
            <div class="section-desc">When enabled, emails wait in a queue for manual approval before sending.</div>
            <div class="toggle-row">
              <span class="toggle-label">Require Approval</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  .checked=${this.settings.approval?.enabled ?? false}
                  @change=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      approval: { ...this.settings.approval, enabled: (e.target as HTMLInputElement).checked },
                    };
                  }}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label>Auto-approve After (minutes, 0 = disabled)</label>
                <input
                  type="number"
                  .value=${String(this.settings.approval?.autoApproveAfterMinutes ?? 0)}
                  @input=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      approval: {
                        ...this.settings.approval,
                        autoApproveAfterMinutes: Number((e.target as HTMLInputElement).value),
                      },
                    };
                  }}
                  min="0"
                />
              </div>
            </div>
            <div class="section-actions">
              <button
                class="alx-btn-primary alx-btn-sm"
                ?disabled=${this.saving['approval']}
                @click=${() => this.saveSection('approval', { approval: this.settings.approval })}
              >
                ${this.saving['approval'] ? 'Saving...' : 'Save'}
              </button>
            </div>
          `,
        )}

        ${this.renderSection(
          'queue',
          'Queue Tuning',
          html`
            <div class="section-desc">Background job processor tuning. Only change if you understand the impact.</div>
            <div class="field-row">
              <div class="field-group">
                <label>Concurrency</label>
                <input
                  type="number"
                  .value=${String(this.settings.queue?.concurrency ?? 5)}
                  @input=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      queue: { ...this.settings.queue, concurrency: Number((e.target as HTMLInputElement).value) },
                    };
                  }}
                  min="1"
                />
              </div>
              <div class="field-group">
                <label>Retry Attempts</label>
                <input
                  type="number"
                  .value=${String(this.settings.queue?.retryAttempts ?? 3)}
                  @input=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      queue: { ...this.settings.queue, retryAttempts: Number((e.target as HTMLInputElement).value) },
                    };
                  }}
                  min="0"
                />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label>Retry Delay (ms)</label>
                <input
                  type="number"
                  .value=${String(this.settings.queue?.retryDelayMs ?? 5000)}
                  @input=${(e: Event) => {
                    this.settings = {
                      ...this.settings,
                      queue: { ...this.settings.queue, retryDelayMs: Number((e.target as HTMLInputElement).value) },
                    };
                  }}
                  min="100"
                  step="100"
                />
              </div>
            </div>
            <div class="section-actions">
              <button
                class="alx-btn-primary alx-btn-sm"
                ?disabled=${this.saving['queue']}
                @click=${() => this.saveSection('queue', { queue: this.settings.queue })}
              >
                ${this.saving['queue'] ? 'Saving...' : 'Save'}
              </button>
            </div>
          `,
        )}
      </div>
    `;
  }
}
safeRegister('alx-global-settings', AlxGlobalSettings);

declare global {
  interface HTMLElementTagNameMap {
    'alx-global-settings': AlxGlobalSettings;
  }
}

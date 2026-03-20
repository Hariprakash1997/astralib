import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { BusinessHours, BusinessHoursSchedule } from '../../api/chat-api-client.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SCHEDULE: BusinessHoursSchedule[] = [
  { day: 0, open: '09:00', close: '18:00', isOpen: false },
  { day: 1, open: '09:00', close: '18:00', isOpen: true },
  { day: 2, open: '09:00', close: '18:00', isOpen: true },
  { day: 3, open: '09:00', close: '18:00', isOpen: true },
  { day: 4, open: '09:00', close: '18:00', isOpen: true },
  { day: 5, open: '09:00', close: '18:00', isOpen: true },
  { day: 6, open: '09:00', close: '18:00', isOpen: false },
];

export class AlxChatBusinessHours extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }

      .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
      }

      .setting-row:last-child { border-bottom: none; }

      .setting-info { flex: 1; }

      .setting-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--alx-text);
      }

      .setting-desc {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      .schedule-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0.5rem;
      }

      .schedule-table th {
        text-align: left;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        padding: 0.375rem 0.5rem;
        border-bottom: 1px solid var(--alx-border);
      }

      .schedule-table td {
        padding: 0.375rem 0.5rem;
        font-size: 0.8125rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
      }

      .schedule-table input[type="time"] {
        width: 110px;
        font-size: 0.8125rem;
        padding: 0.25rem 0.375rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        color: var(--alx-text);
      }

      .schedule-table input[type="time"]:disabled {
        opacity: 0.4;
      }

      .day-name {
        font-weight: 500;
        min-width: 90px;
      }

      .holiday-section {
        padding: 0.75rem 0;
      }

      .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.375rem;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        font-size: 0.75rem;
        background: color-mix(in srgb, var(--alx-warning) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-warning) 30%, transparent);
        border-radius: 999px;
        color: var(--alx-text);
      }

      .chip-remove {
        background: none;
        border: none;
        color: var(--alx-text-muted);
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        line-height: 1;
      }

      .chip-remove:hover { color: var(--alx-danger); }

      .add-row {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.5rem;
      }

      .add-row input { flex: 1; }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private businessHours: BusinessHours = {
    enabled: false,
    timezone: 'UTC',
    schedule: [...DEFAULT_SCHEDULE],
    holidayDates: [],
    outsideHoursMessage: '',
    outsideHoursBehavior: 'offline-message',
  };
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';
  @state() private newHoliday = '';

  private api!: ChatApiClient;
  private _timers: ReturnType<typeof setTimeout>[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.loadSettings();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  }

  private async loadSettings() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.getBusinessHours();
      if (result.businessHours) {
        this.businessHours = {
          ...this.businessHours,
          ...result.businessHours,
          schedule: result.businessHours.schedule?.length ? result.businessHours.schedule : [...DEFAULT_SCHEDULE],
        };
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load business hours';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.updateBusinessHours(this.businessHours);
      this.success = 'Business hours saved';
      this._timers.push(setTimeout(() => this.success = '', 3000));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save business hours';
    } finally {
      this.saving = false;
    }
  }

  private updateSchedule(dayIndex: number, field: keyof BusinessHoursSchedule, value: unknown) {
    const schedule = this.businessHours.schedule.map(s =>
      s.day === dayIndex ? { ...s, [field]: value } : s
    );
    this.businessHours = { ...this.businessHours, schedule };
  }

  private addHoliday() {
    const val = this.newHoliday.trim();
    if (!val) return;
    if (this.businessHours.holidayDates.includes(val)) return;
    this.businessHours = {
      ...this.businessHours,
      holidayDates: [...this.businessHours.holidayDates, val].sort(),
    };
    this.newHoliday = '';
  }

  private removeHoliday(index: number) {
    const dates = [...this.businessHours.holidayDates];
    dates.splice(index, 1);
    this.businessHours = { ...this.businessHours, holidayDates: dates };
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Business Hours</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Enable Business Hours</div>
              <div class="setting-desc">Restrict chat availability based on schedule</div>
            </div>
            <label class="toggle">
              <input type="checkbox" .checked=${this.businessHours.enabled}
                @change=${(e: Event) => this.businessHours = { ...this.businessHours, enabled: (e.target as HTMLInputElement).checked }} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          ${this.businessHours.enabled ? html`
            <div class="setting-row" style="flex-direction:column;align-items:flex-start;">
              <div class="setting-info">
                <div class="setting-label">Timezone</div>
                <div class="setting-desc">All times are in this timezone</div>
              </div>
              <input type="text" .value=${this.businessHours.timezone}
                @input=${(e: Event) => this.businessHours = { ...this.businessHours, timezone: (e.target as HTMLInputElement).value }}
                placeholder="e.g. America/New_York" style="margin-top:0.375rem;width:100%;" />
            </div>

            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Open</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                ${this.businessHours.schedule.map(s => html`
                  <tr>
                    <td class="day-name">${DAY_NAMES[s.day]}</td>
                    <td>
                      <label class="toggle" style="transform:scale(0.8);">
                        <input type="checkbox" .checked=${s.isOpen}
                          @change=${(e: Event) => this.updateSchedule(s.day, 'isOpen', (e.target as HTMLInputElement).checked)} />
                        <span class="toggle-slider"></span>
                      </label>
                    </td>
                    <td>
                      <input type="time" .value=${s.open} ?disabled=${!s.isOpen}
                        @change=${(e: Event) => this.updateSchedule(s.day, 'open', (e.target as HTMLInputElement).value)} />
                    </td>
                    <td>
                      <input type="time" .value=${s.close} ?disabled=${!s.isOpen}
                        @change=${(e: Event) => this.updateSchedule(s.day, 'close', (e.target as HTMLInputElement).value)} />
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>

            <div class="setting-row" style="flex-direction:column;align-items:flex-start;">
              <div class="setting-info">
                <div class="setting-label">Outside Hours Behavior</div>
                <div class="setting-desc">What happens when visitors arrive outside business hours</div>
              </div>
              <select
                .value=${this.businessHours.outsideHoursBehavior}
                @change=${(e: Event) => this.businessHours = { ...this.businessHours, outsideHoursBehavior: (e.target as HTMLSelectElement).value as any }}
                style="margin-top:0.375rem;width:100%;padding:0.375rem;font-size:0.8125rem;background:var(--alx-surface-alt);border:1px solid var(--alx-border);border-radius:var(--alx-radius);color:var(--alx-text);">
                <option value="offline-message">Show offline message</option>
                <option value="faq-only">Show FAQ only</option>
                <option value="hide-widget">Hide chat widget</option>
              </select>
            </div>

            ${this.businessHours.outsideHoursBehavior === 'offline-message' ? html`
              <div class="setting-row" style="flex-direction:column;align-items:flex-start;">
                <div class="setting-info">
                  <div class="setting-label">Offline Message</div>
                  <div class="setting-desc">Message shown to visitors outside business hours</div>
                </div>
                <textarea
                  .value=${this.businessHours.outsideHoursMessage ?? ''}
                  @input=${(e: Event) => this.businessHours = { ...this.businessHours, outsideHoursMessage: (e.target as HTMLTextAreaElement).value }}
                  placeholder="We're currently offline. Please leave a message and we'll get back to you."
                  style="margin-top:0.375rem;width:100%;min-height:60px;padding:0.375rem;font-size:0.8125rem;background:var(--alx-surface-alt);border:1px solid var(--alx-border);border-radius:var(--alx-radius);color:var(--alx-text);resize:vertical;font-family:inherit;box-sizing:border-box;"
                ></textarea>
              </div>
            ` : nothing}

            <div class="holiday-section">
              <div class="setting-label">Holiday Dates</div>
              <div class="setting-desc">Dates when chat is offline regardless of schedule. Format: YYYY-MM-DD (e.g., 2026-12-25)</div>
              <div class="chip-list">
                ${this.businessHours.holidayDates.map((date, i) => html`
                  <span class="chip">
                    ${date}
                    <button class="chip-remove" @click=${() => this.removeHoliday(i)}>x</button>
                  </span>
                `)}
              </div>
              <div class="add-row">
                <input type="date" .value=${this.newHoliday}
                  @input=${(e: Event) => this.newHoliday = (e.target as HTMLInputElement).value} />
                <button class="alx-btn-sm" @click=${this.addHoliday}>Add Holiday</button>
              </div>
            </div>
          ` : nothing}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-business-hours', AlxChatBusinessHours);

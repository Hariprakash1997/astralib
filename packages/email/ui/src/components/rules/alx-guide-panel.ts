import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxCardStyles,
} from '../../styles/shared.js';

interface GuideSection {
  title: string;
  content: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Getting Started',
    content: `The Rule Engine automates email sending based on configurable rules and templates.

<strong>Setup flow:</strong>
1. Create email templates with MJML/Handlebars markup
2. Define rules that match target users using conditions
3. Configure throttle settings to control send frequency
4. Activate rules and monitor via run history

Templates use Handlebars variables (e.g. <code>{{firstName}}</code>) that are populated at send time from your user data.`,
  },
  {
    title: 'Templates',
    content: `Templates define the email content sent by rules.

<strong>Fields:</strong>
- <strong>Name/Slug:</strong> Human-readable name and unique identifier
- <strong>Category:</strong> Groups templates (e.g. marketing, transactional, onboarding)
- <strong>Audience:</strong> Target audience type (e.g. clients, therapists, leads)
- <strong>Platform:</strong> Which platform this template belongs to
- <strong>Subject:</strong> Email subject line (supports Handlebars variables)
- <strong>Body:</strong> MJML markup with Handlebars variables for dynamic content
- <strong>Text Body:</strong> Plain text fallback for email clients that don't render HTML
- <strong>Variables:</strong> List of variable names used in the template

Use the <strong>Preview</strong> button to see rendered HTML before saving.`,
  },
  {
    title: 'Rules',
    content: `Rules define <em>who</em> gets <em>which</em> template and <em>when</em>.

<strong>Target Conditions:</strong>
Each rule has conditions that filter eligible recipients. Conditions use field paths, operators, and values:
- <code>status equals active</code>
- <code>createdAt gt 2024-01-01</code>
- <code>tags contains vip</code>

<strong>Behavior settings:</strong>
- <strong>Send Once:</strong> Only send to each user once per rule
- <strong>Resend After Days:</strong> Re-send after N days (null = never)
- <strong>Max Per Run:</strong> Cap how many emails one rule execution can send
- <strong>Auto Approve:</strong> Send immediately vs. queue for manual approval
- <strong>Email Type:</strong> Marketing or transactional (affects unsubscribe handling)
- <strong>Bypass Throttle:</strong> Skip global throttle limits (use sparingly)

Use <strong>Dry Run</strong> to see which users would be matched without actually sending.`,
  },
  {
    title: 'Collections',
    content: `Collections let developers register MongoDB collection schemas so the admin UI can show real field names instead of free-text inputs.

<strong>When configured:</strong>
- <strong>Rule Editor:</strong> A "Collection" dropdown appears in the targeting section. Selecting a collection replaces free-text field inputs with dropdowns showing actual field paths (e.g. <code>address.city</code>, <code>orders[].amount</code>). Operators auto-filter by field type — boolean fields only show <code>eq</code>/<code>neq</code>, number fields include <code>gt</code>/<code>lt</code>, etc.
- <strong>Template Editor:</strong> "Insert Variable" buttons appear next to subject, body, and text fields. Clicking opens a picker showing fields grouped by collection. Clicking a field inserts <code>{{collection.fieldPath}}</code> at the cursor and auto-adds it to the variables list.
- <strong>Validation:</strong> When saving a rule with a collection selected, the backend validates that condition fields exist and operators are compatible with the field type.
- <strong>Adapter Context:</strong> During rule execution, <code>queryUsers</code> receives the collection schema as an optional third argument, so your adapter can use it for smarter queries.

<strong>When not configured:</strong> Everything falls back to free-text inputs — no breaking changes.`,
  },
  {
    title: 'Throttling',
    content: `Throttle settings prevent email fatigue by limiting how often any single user receives emails.

<strong>Settings:</strong>
- <strong>Max Per User Per Day:</strong> Hard cap on daily emails to one recipient
- <strong>Max Per User Per Week:</strong> Rolling 7-day window limit
- <strong>Min Gap Days:</strong> Minimum days between consecutive sends to the same user

These apply globally across all rules. Individual rules can bypass throttling via the <code>bypassThrottle</code> flag (recommended only for critical transactional emails).`,
  },
  {
    title: 'Hooks',
    content: `The rule engine emits lifecycle hooks that your application can listen to:

- <strong>onSend:</strong> Fires after each email is sent (or fails). Statuses: <code>sent</code>, <code>error</code>, <code>skipped</code>, <code>invalid</code>, <code>throttled</code>
- <strong>onRunComplete:</strong> Fires after a full rule execution cycle with aggregate stats

Use hooks to integrate with your own analytics, logging, or alerting systems.

<strong>Example:</strong>
<code>ruleEngine.on('send', (event) => { analytics.record(event); });</code>`,
  },
];

export class AlxGuidePanel extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxCardStyles,
    css`
      .toggle-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 0.5rem 1rem;
        color: var(--alx-text);
        cursor: pointer;
        font-size: 0.875rem;
        width: 100%;
        text-align: left;
      }

      .toggle-btn:hover {
        border-color: var(--alx-primary);
      }

      .panel {
        margin-top: 0.5rem;
      }

      .section {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        margin-bottom: 0.5rem;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 0.75rem;
        background: var(--alx-surface);
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--alx-text);
        border: none;
        width: 100%;
        text-align: left;
      }

      .section-header:hover {
        background: color-mix(in srgb, var(--alx-primary) 8%, var(--alx-surface));
      }

      .expand-icon {
        display: inline-block;
        transition: transform 0.2s;
        font-size: 0.7rem;
      }

      .expand-icon.open {
        transform: rotate(90deg);
      }

      .section-body {
        padding: 0.75rem 1rem;
        font-size: 0.85rem;
        line-height: 1.7;
        color: var(--alx-text);
        border-top: 1px solid var(--alx-border);
      }

      .section-body code {
        background: color-mix(in srgb, var(--alx-primary) 12%, transparent);
        color: var(--alx-primary);
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        font-family: 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.8rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _visible = false;
  @state() private _openSections = new Set<number>();

  private _togglePanel(): void {
    this._visible = !this._visible;
  }

  private _toggleSection(index: number): void {
    const next = new Set(this._openSections);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._openSections = next;
  }

  override render() {
    return html`
      <div>
        <button class="toggle-btn" @click=${this._togglePanel}>
          <span class="expand-icon ${this._visible ? 'open' : ''}">&#9654;</span>
          Rule Engine Guide
        </button>

        ${this._visible
          ? html`
              <div class="panel">
                ${GUIDE_SECTIONS.map(
                  (section, i) => html`
                    <div class="section">
                      <button class="section-header" @click=${() => this._toggleSection(i)}>
                        <span
                          class="expand-icon ${this._openSections.has(i) ? 'open' : ''}"
                          >&#9654;</span
                        >
                        ${section.title}
                      </button>
                      ${this._openSections.has(i)
                        ? html`<div class="section-body">${unsafeHTML(section.content)}</div>`
                        : ''}
                    </div>
                  `,
                )}
              </div>
            `
          : ''}
      </div>
    `;
  }
}
safeRegister('alx-guide-panel', AlxGuidePanel);

declare global {
  interface HTMLElementTagNameMap {
    'alx-guide-panel': AlxGuidePanel;
  }
}

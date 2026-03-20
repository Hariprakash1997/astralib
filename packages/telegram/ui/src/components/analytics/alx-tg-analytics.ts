import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxCardStyles, alxLoadingStyles, alxToolbarStyles } from '../../styles/shared.js';
import { AlxTelegramConfig } from '../../config.js';

// Core's <alx-send-log> is registered by the dashboard's `import '@astralibx/rule-engine-ui'`.

export class AlxTgAnalytics extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxToolbarStyles,
    css`
      :host { display: block; }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _ruleEngineUrl = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this._ruleEngineUrl = AlxTelegramConfig.getApiUrl('ruleEngine');
  }

  override render() {
    return html`
      <alx-send-log
        .baseUrl=${this._ruleEngineUrl}
        .density=${this.density}
      ></alx-send-log>
    `;
  }
}
safeRegister('alx-tg-analytics', AlxTgAnalytics);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-analytics': AlxTgAnalytics;
  }
}

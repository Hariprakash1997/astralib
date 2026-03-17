import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ChatAgentInfo } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-agent-selector> -- Agent selection UI.
 *
 * Displays a grid/list of available agents for the visitor to choose from.
 * Optionally shows availability status and specialty/role.
 */
export class AlxChatAgentSelector extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .selector-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .selector-header {
        padding: 24px 20px 16px;
        flex-shrink: 0;
      }

      .selector-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--alx-chat-text);
      }

      .agents-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .agent-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border: 2px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius);
        background: var(--alx-chat-surface);
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        text-align: left;
        font-family: var(--alx-chat-font);
      }

      .agent-card:hover {
        border-color: var(--alx-chat-primary);
        background: var(--alx-chat-surface-hover);
        transform: translateY(-1px);
        box-shadow: var(--alx-chat-shadow-sm);
      }

      .agent-card:active {
        transform: translateY(0);
      }

      .agent-card.selected {
        border-color: var(--alx-chat-primary);
        background: color-mix(in srgb, var(--alx-chat-primary) 8%, var(--alx-chat-surface));
      }

      .agent-avatar {
        position: relative;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--alx-chat-border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
      }

      .agent-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .agent-avatar svg {
        width: 24px;
        height: 24px;
        fill: var(--alx-chat-text-muted);
      }

      .availability-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--alx-chat-surface);
      }

      .availability-dot.available {
        background: var(--alx-chat-success);
      }

      .availability-dot.busy {
        background: var(--alx-chat-warning);
      }

      .availability-dot.away,
      .availability-dot.offline {
        background: var(--alx-chat-text-muted);
      }

      .agent-info {
        flex: 1;
        min-width: 0;
      }

      .agent-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--alx-chat-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .agent-role {
        font-size: 12px;
        color: var(--alx-chat-text-muted);
        margin-top: 2px;
      }

      .agent-status-label {
        font-size: 11px;
        color: var(--alx-chat-success);
        margin-top: 2px;
      }

      .agent-status-label.offline {
        color: var(--alx-chat-text-muted);
      }

      .select-arrow {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        color: var(--alx-chat-text-muted);
        transition: color 0.2s ease;
      }

      .agent-card:hover .select-arrow {
        color: var(--alx-chat-primary);
      }

      .select-arrow svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .auto-assign-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border: 2px dashed var(--alx-chat-border);
        border-radius: var(--alx-chat-radius);
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        text-align: left;
        font-family: var(--alx-chat-font);
        color: var(--alx-chat-text-muted);
      }

      .auto-assign-card:hover {
        border-color: var(--alx-chat-primary);
        color: var(--alx-chat-text);
      }

      .auto-assign-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .auto-assign-icon svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .auto-assign-label {
        font-size: 14px;
        font-weight: 500;
      }

      .skip-link {
        display: block;
        text-align: center;
        padding: 12px 20px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s ease;
        flex-shrink: 0;
      }

      .skip-link:hover {
        color: var(--alx-chat-text);
      }
    `,
  ];

  @property() title = 'Choose who to talk to';
  @property({ type: Array }) agents: ChatAgentInfo[] = [];
  @property({ type: Boolean }) showAvailability = true;
  @property({ type: Boolean }) showSpecialty = true;
  @property({ type: Boolean }) autoAssign = true;
  @property() autoAssignText = 'Connect me with anyone available';
  @property({ type: Boolean }) canSkipToChat = false;

  @state() private selectedAgentId: string | null = null;

  render() {
    const statusLabels: Record<string, string> = {
      available: 'Available',
      busy: 'Busy',
      away: 'Away',
      offline: 'Offline',
    };

    return html`
      <div class="selector-container">
        <div class="selector-header">
          <h2 class="selector-title">${this.title}</h2>
        </div>

        <div class="agents-list">
          ${this.agents.map(
            (agent) => html`
              <button
                class=${classMap({
                  'agent-card': true,
                  selected: this.selectedAgentId === agent.agentId,
                })}
                @click=${() => this.handleAgentSelect(agent)}
              >
                <div class="agent-avatar">
                  ${agent.avatar
                    ? html`<img src=${agent.avatar} alt=${agent.name} />`
                    : html`
                        <svg viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      `}
                  ${this.showAvailability
                    ? html`<span class=${classMap({
                        'availability-dot': true,
                        [agent.status]: true,
                      })}></span>`
                    : nothing}
                </div>
                <div class="agent-info">
                  <div class="agent-name">${agent.name}</div>
                  ${this.showSpecialty && agent.role
                    ? html`<div class="agent-role">${agent.role}</div>`
                    : nothing}
                  ${this.showAvailability
                    ? html`<div class=${classMap({
                        'agent-status-label': true,
                        offline: agent.status === 'offline' || agent.status === 'away',
                      })}>${statusLabels[agent.status] ?? 'Unknown'}</div>`
                    : nothing}
                </div>
                <span class="select-arrow">
                  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </button>
            `,
          )}

          ${this.autoAssign
            ? html`
                <button class="auto-assign-card" @click=${this.handleAutoAssign}>
                  <span class="auto-assign-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </span>
                  <span class="auto-assign-label">${this.autoAssignText}</span>
                </button>
              `
            : nothing}
        </div>

        ${this.canSkipToChat
          ? html`<button class="skip-link" @click=${this.handleSkip}>Skip to chat</button>`
          : nothing}
      </div>
    `;
  }

  private handleAgentSelect(agent: ChatAgentInfo) {
    this.selectedAgentId = agent.agentId;

    this.dispatchEvent(
      new CustomEvent('agent-selected', {
        detail: { agentId: agent.agentId, agent },
        bubbles: true,
        composed: true,
      }),
    );

    this.dispatchEvent(
      new CustomEvent('step-complete', {
        detail: { agentId: agent.agentId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleAutoAssign() {
    this.dispatchEvent(
      new CustomEvent('agent-selected', {
        detail: { agentId: null, autoAssign: true },
        bubbles: true,
        composed: true,
      }),
    );

    this.dispatchEvent(
      new CustomEvent('step-complete', {
        detail: { autoAssign: true },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('skip-to-chat', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-agent-selector', AlxChatAgentSelector);

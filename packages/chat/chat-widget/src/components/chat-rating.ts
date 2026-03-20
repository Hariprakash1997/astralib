import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-rating> -- Two-step inline rating component.
 *
 * Step 1: Show rating selector (thumbs, stars, or emoji).
 * Step 2: After selection, show follow-up option chips.
 * Dispatches 'rating-submitted' with the collected feedback.
 */
export class AlxChatRating extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .rating-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px 24px;
        height: 100%;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
      }

      .rating-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }

      .rating-icon svg {
        color: var(--alx-chat-primary);
      }

      .question {
        font-size: 17px;
        font-weight: 600;
        color: var(--alx-chat-text);
        margin-bottom: 24px;
        max-width: 280px;
        line-height: 1.4;
      }

      /* -- Thumbs -- */
      .thumbs-row {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }

      .thumb-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        border: 2px solid var(--alx-chat-border);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transition: transform 0.2s var(--alx-chat-spring-bounce),
                    border-color 0.2s, background 0.2s;
      }

      .thumb-btn:hover {
        transform: scale(1.1);
        border-color: var(--alx-chat-primary);
      }

      .thumb-btn.selected {
        border-color: var(--alx-chat-primary);
        background: var(--alx-chat-primary-light);
      }

      /* -- Stars -- */
      .stars-row {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
      }

      .star-btn {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        transition: transform 0.2s var(--alx-chat-spring-bounce);
      }

      .star-btn:hover {
        transform: scale(1.2);
      }

      .star-btn:active {
        transform: scale(0.95);
      }

      .star-btn .star-empty {
        color: var(--alx-chat-border);
      }

      .star-btn .star-filled {
        color: #fbbf24;
        filter: drop-shadow(0 1px 2px rgba(251, 191, 36, 0.4));
      }

      /* -- Emoji -- */
      .emoji-row {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }

      .emoji-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        border: 2px solid var(--alx-chat-border);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        transition: transform 0.2s var(--alx-chat-spring-bounce),
                    border-color 0.2s, background 0.2s;
      }

      .emoji-btn:hover {
        transform: scale(1.15);
        border-color: var(--alx-chat-primary);
      }

      .emoji-btn.selected {
        border-color: var(--alx-chat-primary);
        background: var(--alx-chat-primary-light);
        transform: scale(1.1);
      }

      .followup-heading {
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
      }

      /* -- Follow-up chips -- */
      .followup-section {
        animation: alx-fadeInUp 0.25s var(--alx-chat-spring-smooth);
        width: 100%;
        max-width: 300px;
      }

      .followup-label {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        margin-bottom: 12px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
      }

      .chip {
        padding: 6px 14px;
        border-radius: 16px;
        border: 1px solid var(--alx-chat-border);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        font-size: 13px;
        font-family: var(--alx-chat-font);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }

      .chip:hover {
        border-color: var(--alx-chat-primary);
      }

      .chip.selected {
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        border-color: var(--alx-chat-primary);
      }

      /* -- Comment -- */
      .comment-wrapper {
        width: 100%;
        max-width: 300px;
        margin-bottom: 16px;
      }

      .comment-input {
        width: 100%;
        padding: 10px 14px;
        border: 1.5px solid var(--alx-chat-border);
        border-radius: 12px;
        background: var(--alx-chat-bg);
        color: var(--alx-chat-text);
        font-size: 13px;
        font-family: var(--alx-chat-font);
        resize: none;
        outline: none;
        min-height: 60px;
        box-sizing: border-box;
      }

      .comment-input:focus {
        border-color: var(--alx-chat-primary);
      }

      .comment-input::placeholder {
        color: var(--alx-chat-text-muted);
        opacity: 0.7;
      }

      /* -- Actions -- */
      .submit-btn {
        padding: 12px 32px;
        border: none;
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }

      .submit-btn:hover {
        background: var(--alx-chat-primary-hover);
      }

      .submit-btn:active {
        transform: scale(0.97);
      }

      .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .skip-btn {
        margin-top: 12px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s;
      }

      .skip-btn:hover {
        color: var(--alx-chat-text);
      }

      .thank-you {
        animation: alx-scaleIn 0.4s var(--alx-chat-spring-bounce);
      }

      .thank-you-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--alx-chat-success, #22c55e) 15%, var(--alx-chat-surface));
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .thank-you-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--alx-chat-text);
        max-width: 260px;
        line-height: 1.4;
      }
    `,
  ];

  @property() ratingType: 'thumbs' | 'stars' | 'emoji' = 'thumbs';
  @property() question = 'How was your experience?';
  @property({ attribute: false }) followUpOptions: Record<string, string[]> = {};
  @property() thankYouMessage = 'Thank you for your feedback!';

  @state() private selectedValue: number | null = null;
  @state() private hoverValue = 0;
  @state() private followUpSelections: string[] = [];
  @state() private comment = '';
  @state() private step: 'rate' | 'followup' | 'done' = 'rate';

  private emojiLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Amazing'];
  private emojis = ['\u{1F622}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F929}'];

  render() {
    if (this.step === 'done') {
      return this.renderThankYou();
    }

    return html`
      <div class="rating-container">
        <div class="rating-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 4C8.477 4 4 7.925 4 12.75c0 2.76 1.57 5.22 4.025 6.82-.15 1.46-.8 2.83-1.775 3.93a.5.5 0 00.375.85c2.25-.15 4.2-1.05 5.55-2.15.6.08 1.2.13 1.825.13 5.523 0 10-3.925 10-8.75S19.523 4 14 4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M14 10c-.8-1.5-2.5-2-3.5-1s-1.1 2.9 3.5 5.5c4.6-2.6 4.5-4.5 3.5-5.5s-2.7-.5-3.5 1z" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>

        ${this.step === 'rate' ? html`
          <div class="question">${this.question}</div>
          ${this.renderRatingStep()}
          <button class="skip-btn" @click=${this.handleSkip}>
            No thanks
          </button>
        ` : nothing}

        ${this.step === 'followup' ? html`
          <div class="question followup-heading">Tell us more (optional)</div>
          ${this.renderFollowUpStep()}
        ` : nothing}
      </div>
    `;
  }

  private renderRatingStep() {
    switch (this.ratingType) {
      case 'thumbs':
        return this.renderThumbs();
      case 'stars':
        return this.renderStars();
      case 'emoji':
        return this.renderEmoji();
      default:
        return this.renderStars();
    }
  }

  private renderThumbs() {
    return html`
      <div class="thumbs-row">
        <button
          class="thumb-btn ${this.selectedValue === 0 ? 'selected' : ''}"
          @click=${() => this.selectRating(0)}
          aria-label="Thumbs down"
        >
          \u{1F44E}
        </button>
        <button
          class="thumb-btn ${this.selectedValue === 1 ? 'selected' : ''}"
          @click=${() => this.selectRating(1)}
          aria-label="Thumbs up"
        >
          \u{1F44D}
        </button>
      </div>
    `;
  }

  private renderStars() {
    const activeRating = this.hoverValue || this.selectedValue || 0;

    return html`
      <div class="stars-row">
        ${[1, 2, 3, 4, 5].map(n => {
          const filled = n <= activeRating;
          return html`
            <button
              class="star-btn"
              @mouseenter=${() => { this.hoverValue = n; }}
              @mouseleave=${() => { this.hoverValue = 0; }}
              @click=${() => this.selectRating(n)}
              aria-label="${n} star${n > 1 ? 's' : ''}"
            >
              ${filled
                ? html`
                  <svg class="star-filled" width="36" height="36" viewBox="0 0 36 36">
                    <polygon points="18,4 22.5,13.5 33,15 25.5,22.5 27,33 18,28 9,33 10.5,22.5 3,15 13.5,13.5"
                      fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
                  </svg>
                `
                : html`
                  <svg class="star-empty" width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <polygon points="18,4 22.5,13.5 33,15 25.5,22.5 27,33 18,28 9,33 10.5,22.5 3,15 13.5,13.5"
                      stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
                  </svg>
                `
              }
            </button>
          `;
        })}
      </div>
    `;
  }

  private renderEmoji() {
    return html`
      <div class="emoji-row">
        ${this.emojis.map((emoji, i) => {
          const value = i + 1;
          return html`
            <button
              class="emoji-btn ${this.selectedValue === value ? 'selected' : ''}"
              @click=${() => this.selectRating(value)}
              aria-label="${this.emojiLabels[i]}"
              title="${this.emojiLabels[i]}"
            >
              ${emoji}
            </button>
          `;
        })}
      </div>
    `;
  }

  private renderFollowUpStep() {
    const key = String(this.selectedValue ?? '');
    const options = this.followUpOptions[key] || [];

    return html`
      <div class="followup-section">
        ${options.length > 0 ? html`
          <div class="followup-label">What could be improved?</div>
          <div class="chips">
            ${options.map(opt => html`
              <button
                class="chip ${this.followUpSelections.includes(opt) ? 'selected' : ''}"
                @click=${() => this.toggleFollowUp(opt)}
              >
                ${opt}
              </button>
            `)}
          </div>
        ` : nothing}

        <div class="comment-wrapper">
          <textarea
            class="comment-input"
            placeholder="Any additional feedback? (optional)"
            .value=${this.comment}
            @input=${(e: Event) => { this.comment = (e.target as HTMLTextAreaElement).value; }}
          ></textarea>
        </div>

        <button class="submit-btn" @click=${this.handleSubmit}>
          Submit
        </button>
        <button class="skip-btn" @click=${this.handleSkipFollowUp}>
          Skip
        </button>
      </div>
    `;
  }

  private renderThankYou() {
    return html`
      <div class="rating-container thank-you">
        <div class="thank-you-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <polyline points="8 16 14 22 24 10" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="thank-you-text">${this.thankYouMessage}</div>
      </div>
    `;
  }

  private selectRating(value: number) {
    this.selectedValue = value;
    // Always go to follow-up step for optional comment (and follow-up chips if configured)
    this.step = 'followup';
  }

  private toggleFollowUp(opt: string) {
    if (this.followUpSelections.includes(opt)) {
      this.followUpSelections = this.followUpSelections.filter(s => s !== opt);
    } else {
      this.followUpSelections = [...this.followUpSelections, opt];
    }
  }

  private handleSkipFollowUp() {
    // Clear any accidental follow-up selections so only the rating value is sent
    this.followUpSelections = [];
    this.comment = '';
    this.handleSubmit();
  }

  private handleSubmit() {
    this.step = 'done';

    this.dispatchEvent(
      new CustomEvent('rating-submitted', {
        detail: {
          ratingType: this.ratingType,
          ratingValue: this.selectedValue,
          followUpSelections: this.followUpSelections.length > 0 ? this.followUpSelections : undefined,
          comment: this.comment.trim() || undefined,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('rating-submitted', {
        detail: { skipped: true },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

safeRegister('alx-chat-rating', AlxChatRating);

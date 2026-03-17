import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { FormField } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-prechat-form.js';

/**
 * <alx-chat-feedback> -- Post-chat feedback screen.
 *
 * Shown after a chat session ends. Supports star rating or
 * survey (form fields) mode.
 */
export class AlxChatFeedback extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .feedback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px 24px;
        height: 100%;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .feedback-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }

      .feedback-icon svg {
        width: 28px;
        height: 28px;
        fill: none;
        stroke: var(--alx-chat-primary);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .feedback-question {
        font-size: 17px;
        font-weight: 600;
        color: var(--alx-chat-text);
        margin-bottom: 24px;
        line-height: 1.4;
        max-width: 280px;
      }

      .star-rating {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
      }

      .star-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        transition: transform 0.15s ease;
      }

      .star-btn:hover {
        transform: scale(1.2);
      }

      .star-btn:active {
        transform: scale(0.95);
      }

      .star-btn svg {
        width: 36px;
        height: 36px;
        transition: all 0.2s ease;
      }

      .star-btn .star-empty {
        fill: none;
        stroke: var(--alx-chat-border);
        stroke-width: 2;
      }

      .star-btn .star-filled {
        fill: #fbbf24;
        stroke: #f59e0b;
        stroke-width: 1;
      }

      .star-btn:hover .star-empty {
        stroke: #fbbf24;
      }

      .rating-label {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        margin-bottom: 24px;
        height: 20px;
      }

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
        transition: background 0.2s ease;
      }

      .submit-btn:hover {
        background: var(--alx-chat-primary-hover);
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
        transition: color 0.2s ease;
      }

      .skip-btn:hover {
        color: var(--alx-chat-text);
      }

      .thank-you {
        animation: scaleIn 0.4s ease;
      }

      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .thank-you-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--alx-chat-success) 15%, var(--alx-chat-surface));
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .thank-you-icon svg {
        width: 32px;
        height: 32px;
        fill: none;
        stroke: var(--alx-chat-success);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .thank-you-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--alx-chat-text);
        line-height: 1.4;
        max-width: 260px;
      }

      /* Survey mode: full height form */
      .survey-wrapper {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  @property() type: 'rating' | 'survey' = 'rating';
  @property() question = 'How was your experience?';
  @property({ type: Array }) surveyFields: FormField[] = [];
  @property() thankYouMessage = 'Thank you for your feedback!';

  @state() private rating = 0;
  @state() private hoveredStar = 0;
  @state() private submitted = false;

  private ratingLabels: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  };

  render() {
    if (this.submitted) {
      return this.renderThankYou();
    }

    if (this.type === 'survey' && this.surveyFields.length > 0) {
      return this.renderSurvey();
    }

    return this.renderRating();
  }

  private renderRating() {
    const displayStar = this.hoveredStar || this.rating;

    return html`
      <div class="feedback-container">
        <div class="feedback-icon">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>

        <div class="feedback-question">${this.question}</div>

        <div class="star-rating">
          ${[1, 2, 3, 4, 5].map(
            (star) => html`
              <button
                class="star-btn"
                @click=${() => this.setRating(star)}
                @mouseenter=${() => { this.hoveredStar = star; }}
                @mouseleave=${() => { this.hoveredStar = 0; }}
                aria-label="${star} star${star > 1 ? 's' : ''}"
              >
                <svg viewBox="0 0 24 24"
                  class=${star <= displayStar ? 'star-filled' : 'star-empty'}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            `,
          )}
        </div>

        <div class="rating-label">
          ${displayStar > 0 ? this.ratingLabels[displayStar] : ''}
        </div>

        <button
          class="submit-btn"
          ?disabled=${this.rating === 0}
          @click=${this.handleRatingSubmit}
        >
          Submit Feedback
        </button>

        <button class="skip-btn" @click=${this.handleSkip}>
          No thanks
        </button>
      </div>
    `;
  }

  private renderSurvey() {
    return html`
      <div class="survey-wrapper">
        <alx-chat-prechat-form
          .title=${this.question}
          .fields=${this.surveyFields}
          submitText="Submit Feedback"
          @form-submitted=${this.handleSurveySubmit}
        ></alx-chat-prechat-form>
      </div>
    `;
  }

  private renderThankYou() {
    return html`
      <div class="feedback-container thank-you">
        <div class="thank-you-icon">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="thank-you-text">${this.thankYouMessage}</div>
      </div>
    `;
  }

  private setRating(star: number) {
    this.rating = star;
  }

  private handleRatingSubmit() {
    if (this.rating === 0) return;

    this.submitted = true;

    this.dispatchEvent(
      new CustomEvent('feedback-submitted', {
        detail: { rating: this.rating },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSurveySubmit(e: CustomEvent) {
    this.submitted = true;

    this.dispatchEvent(
      new CustomEvent('feedback-submitted', {
        detail: { survey: e.detail.data },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('feedback-submitted', {
        detail: { skipped: true },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

safeRegister('alx-chat-feedback', AlxChatFeedback);

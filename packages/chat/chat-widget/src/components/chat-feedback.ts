import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { FormField } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
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
    chatAnimations,
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
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
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

      .stars {
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

      .rating-label {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        height: 20px;
        margin-bottom: 16px;
        transition: opacity 0.15s;
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

  @state() private hoverRating = 0;
  @state() private selectedRating = 0;
  @state() private submitted = false;

  private ratingLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Amazing'];

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
    const activeRating = this.hoverRating || this.selectedRating;

    return html`
      <div class="feedback-container">
        <div class="feedback-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 4C8.477 4 4 7.925 4 12.75c0 2.76 1.57 5.22 4.025 6.82-.15 1.46-.8 2.83-1.775 3.93a.5.5 0 00.375.85c2.25-.15 4.2-1.05 5.55-2.15.6.08 1.2.13 1.825.13 5.523 0 10-3.925 10-8.75S19.523 4 14 4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M14 10c-.8-1.5-2.5-2-3.5-1s-1.1 2.9 3.5 5.5c4.6-2.6 4.5-4.5 3.5-5.5s-2.7-.5-3.5 1z" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>

        <div class="question">${this.question}</div>

        <div class="stars">
          ${[1, 2, 3, 4, 5].map(n => {
            const filled = n <= activeRating;
            return html`
              <button
                class="star-btn"
                @mouseenter=${() => { this.hoverRating = n; }}
                @mouseleave=${() => { this.hoverRating = 0; }}
                @click=${() => { this.selectedRating = n; }}
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

        <div class="rating-label">
          ${activeRating > 0 ? this.ratingLabels[activeRating - 1] : ''}
        </div>

        <button
          class="submit-btn"
          ?disabled=${this.selectedRating === 0}
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
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <polyline points="8 16 14 22 24 10" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="thank-you-text">${this.thankYouMessage}</div>
      </div>
    `;
  }

  private handleRatingSubmit() {
    if (this.selectedRating === 0) return;

    this.submitted = true;

    this.dispatchEvent(
      new CustomEvent('feedback-submitted', {
        detail: { rating: this.selectedRating },
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

import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
} from '../../styles/shared.js';

interface FeedbackStatsData {
  averageRating: number;
  totalFeedback: number;
  distribution: Record<string, number>;
}

export class AlxChatFeedbackStats extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    css`
      :host { display: block; }

      .rating-display {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .avg-rating {
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--alx-warning);
        line-height: 1;
      }

      .stars {
        display: flex;
        gap: 2px;
      }

      .star {
        font-size: 1.5rem;
        color: var(--alx-border);
      }

      .star.filled {
        color: var(--alx-warning);
      }

      .star.half {
        color: var(--alx-warning);
        opacity: 0.5;
      }

      .total-count {
        font-size: 0.8125rem;
        color: var(--alx-text-muted);
      }

      .distribution {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .dist-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
      }

      .dist-label {
        width: 20px;
        text-align: right;
        font-weight: 600;
        color: var(--alx-text-muted);
      }

      .dist-bar-track {
        flex: 1;
        height: 12px;
        background: color-mix(in srgb, var(--alx-border) 60%, transparent);
        border-radius: 6px;
        overflow: hidden;
      }

      .dist-bar-fill {
        height: 100%;
        background: var(--alx-warning);
        border-radius: 6px;
        transition: width 0.3s ease;
        min-width: 0;
      }

      .dist-count {
        width: 30px;
        font-variant-numeric: tabular-nums;
        color: var(--alx-text-muted);
        font-size: 0.75rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private stats: FeedbackStatsData | null = null;
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadStats();
  }

  async loadStats() {
    this.loading = true;
    try {
      this.stats = await this.http.get<FeedbackStatsData>('/sessions/feedback-stats');
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load feedback stats';
    } finally {
      this.loading = false;
    }
  }

  private renderStars(rating: number) {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.3;
    return html`
      <span class="stars">
        ${[1, 2, 3, 4, 5].map(i => {
          if (i <= full) return html`<span class="star filled">&#9733;</span>`;
          if (i === full + 1 && hasHalf) return html`<span class="star half">&#9733;</span>`;
          return html`<span class="star">&#9733;</span>`;
        })}
      </span>
    `;
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Feedback</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span></div>` : ''}

        ${!this.loading && this.stats ? html`
          <div class="rating-display">
            <span class="avg-rating">${this.stats.averageRating.toFixed(1)}</span>
            <div>
              ${this.renderStars(this.stats.averageRating)}
              <div class="total-count">${this.stats.totalFeedback} total ratings</div>
            </div>
          </div>

          <div class="distribution">
            ${[5, 4, 3, 2, 1].map(rating => {
              const count = this.stats!.distribution[String(rating)] ?? 0;
              const maxCount = Math.max(...Object.values(this.stats!.distribution), 1);
              const pct = (count / maxCount) * 100;
              return html`
                <div class="dist-row">
                  <span class="dist-label">${rating}</span>
                  <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width:${pct}%"></div>
                  </div>
                  <span class="dist-count">${count}</span>
                </div>
              `;
            })}
          </div>
        ` : ''}

        ${!this.loading && !this.stats && !this.error
          ? html`<div class="alx-empty">No feedback data</div>` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-feedback-stats', AlxChatFeedbackStats);

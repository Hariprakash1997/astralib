import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { FAQItem, FAQCategory } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-faq> -- FAQ accordion viewer with search and categories.
 *
 * Searchable, categorized Q&A list with optional feedback per answer.
 */
export class AlxChatFaq extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .faq-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .faq-header {
        padding: 20px 16px 12px;
        flex-shrink: 0;
      }

      .faq-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--alx-chat-text);
        margin-bottom: 12px;
      }

      .search-wrapper {
        position: relative;
        margin-bottom: 12px;
      }

      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        color: var(--alx-chat-text-muted);
      }

      .search-icon svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .search-input {
        width: 100%;
        padding: 10px 12px 10px 36px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s ease;
      }

      .search-input::placeholder {
        color: var(--alx-chat-text-muted);
      }

      .search-input:focus {
        border-color: var(--alx-chat-primary);
      }

      .categories {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding-bottom: 4px;
        scrollbar-width: none;
      }

      .categories::-webkit-scrollbar {
        display: none;
      }

      .category-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: 1px solid var(--alx-chat-border);
        border-radius: 20px;
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .category-pill:hover {
        background: var(--alx-chat-surface-hover);
        border-color: var(--alx-chat-primary);
        color: var(--alx-chat-text);
      }

      .category-pill.active {
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        border-color: var(--alx-chat-primary);
      }

      .category-icon {
        font-size: 14px;
      }

      .faq-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 16px 16px;
      }

      .faq-item {
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        margin-bottom: 8px;
        overflow: hidden;
        transition: border-color 0.2s ease;
      }

      .faq-item:hover {
        border-color: color-mix(in srgb, var(--alx-chat-border) 50%, var(--alx-chat-primary));
      }

      .faq-question {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        color: var(--alx-chat-text);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        line-height: 1.4;
      }

      .faq-question:hover {
        background: var(--alx-chat-surface-hover);
      }

      .faq-question-text {
        flex: 1;
      }

      .chevron {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        color: var(--alx-chat-text-muted);
        transition: transform 0.2s ease;
      }

      .chevron svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .chevron.expanded {
        transform: rotate(180deg);
      }

      .faq-answer {
        padding: 0 16px 14px;
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        line-height: 1.6;
        animation: slideDown 0.2s ease;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          max-height: 0;
        }
        to {
          opacity: 1;
          max-height: 500px;
        }
      }

      .faq-answer-content {
        padding-top: 8px;
        border-top: 1px solid var(--alx-chat-border);
      }

      .faq-answer-content a {
        color: var(--alx-chat-primary);
      }

      .feedback-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid var(--alx-chat-border);
      }

      .feedback-label {
        font-size: 12px;
        color: var(--alx-chat-text-muted);
      }

      .feedback-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 1px solid var(--alx-chat-border);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--alx-chat-text-muted);
      }

      .feedback-btn:hover {
        border-color: var(--alx-chat-primary);
        color: var(--alx-chat-primary);
      }

      .feedback-btn.voted {
        background: var(--alx-chat-primary);
        border-color: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
      }

      .feedback-btn svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .empty-state {
        padding: 32px 16px;
        text-align: center;
        color: var(--alx-chat-text-muted);
        font-size: 13px;
      }

      .chat-prompt {
        flex-shrink: 0;
        padding: 16px;
        border-top: 1px solid var(--alx-chat-border);
      }

      .chat-prompt-btn {
        display: block;
        width: 100%;
        padding: 12px;
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

      .chat-prompt-btn:hover {
        background: var(--alx-chat-primary-hover);
      }
    `,
  ];

  @property() title = 'Frequently Asked Questions';
  @property({ type: Boolean }) searchEnabled = true;
  @property({ type: Array }) categories: FAQCategory[] = [];
  @property({ type: Array }) items: FAQItem[] = [];
  @property({ type: Boolean }) feedbackEnabled = false;
  @property({ type: Boolean }) showChatPrompt = true;
  @property() chatPromptText = 'Still have questions? Chat with us';
  @property({ type: Boolean }) canSkipToChat = false;

  @state() private searchQuery = '';
  @state() private activeCategory: string | null = null;
  @state() private expandedIndex: number | null = null;
  @state() private feedbackMap: Map<number, boolean> = new Map();

  render() {
    const filteredItems = this.getFilteredItems();

    return html`
      <div class="faq-container">
        <div class="faq-header">
          ${this.title
            ? html`<h2 class="faq-title">${this.title}</h2>`
            : nothing}

          ${this.searchEnabled
            ? html`
                <div class="search-wrapper">
                  <span class="search-icon">
                    <svg viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    class="search-input"
                    type="text"
                    placeholder="Search questions..."
                    .value=${this.searchQuery}
                    @input=${this.handleSearch}
                  />
                </div>
              `
            : nothing}

          ${this.categories.length > 0
            ? html`
                <div class="categories">
                  <button
                    class=${classMap({ 'category-pill': true, active: this.activeCategory === null })}
                    @click=${() => this.setCategory(null)}
                  >
                    All
                  </button>
                  ${this.categories.map(
                    (cat) => html`
                      <button
                        class=${classMap({ 'category-pill': true, active: this.activeCategory === cat.key })}
                        @click=${() => this.setCategory(cat.key)}
                      >
                        ${cat.icon
                          ? html`<span class="category-icon">${cat.icon}</span>`
                          : nothing}
                        ${cat.label}
                      </button>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>

        <div class="faq-list">
          ${filteredItems.length === 0
            ? html`<div class="empty-state">No questions match your search.</div>`
            : filteredItems.map((item, idx) => this.renderFaqItem(item, idx))}
        </div>

        ${this.showChatPrompt
          ? html`
              <div class="chat-prompt">
                <button class="chat-prompt-btn" @click=${this.handleChatPrompt}>
                  ${this.chatPromptText}
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderFaqItem(item: FAQItem, index: number) {
    const isExpanded = this.expandedIndex === index;
    const feedbackValue = this.feedbackMap.get(index);

    return html`
      <div class="faq-item">
        <button class="faq-question" @click=${() => this.toggleItem(index, item)}>
          <span class="faq-question-text">${item.question}</span>
          <span class=${classMap({ chevron: true, expanded: isExpanded })}>
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        ${isExpanded
          ? html`
              <div class="faq-answer">
                <div class="faq-answer-content" .innerHTML=${item.answer}></div>
                ${this.feedbackEnabled
                  ? html`
                      <div class="feedback-row">
                        <span class="feedback-label">Helpful?</span>
                        <button
                          class=${classMap({ 'feedback-btn': true, voted: feedbackValue === true })}
                          @click=${() => this.handleFeedback(index, item, true)}
                          aria-label="Yes, helpful"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                          </svg>
                        </button>
                        <button
                          class=${classMap({ 'feedback-btn': true, voted: feedbackValue === false })}
                          @click=${() => this.handleFeedback(index, item, false)}
                          aria-label="Not helpful"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                          </svg>
                        </button>
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private getFilteredItems(): FAQItem[] {
    let items = [...this.items];

    // Sort by order if available
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Filter by category
    if (this.activeCategory) {
      items = items.filter((item) => item.category === this.activeCategory);
    }

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          (item.tags ?? []).some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return items;
  }

  private handleSearch(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this.expandedIndex = null;
  }

  private setCategory(key: string | null) {
    this.activeCategory = key;
    this.expandedIndex = null;
  }

  private toggleItem(index: number, item: FAQItem) {
    if (this.expandedIndex === index) {
      this.expandedIndex = null;
    } else {
      this.expandedIndex = index;
      this.dispatchEvent(
        new CustomEvent('faq-viewed', {
          detail: { question: item.question },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleFeedback(index: number, item: FAQItem, helpful: boolean) {
    const next = new Map(this.feedbackMap);
    next.set(index, helpful);
    this.feedbackMap = next;

    this.dispatchEvent(
      new CustomEvent('faq-feedback', {
        detail: { question: item.question, helpful },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleChatPrompt() {
    this.dispatchEvent(
      new CustomEvent('step-complete', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-faq', AlxChatFaq);

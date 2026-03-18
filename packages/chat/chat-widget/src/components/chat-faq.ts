import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { FAQItem, FAQCategory } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
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
    chatAnimations,
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
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
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
        color: var(--alx-chat-text-muted);
        pointer-events: none;
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
        transition: border-color 0.2s var(--alx-chat-spring-smooth);
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
        transition: all 0.2s var(--alx-chat-spring-smooth);
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
        border-left: 3px solid var(--alx-chat-primary);
        border-radius: var(--alx-chat-radius-sm);
        margin-bottom: 8px;
        overflow: hidden;
        transition: border-color 0.2s var(--alx-chat-spring-smooth);
      }

      .faq-item:hover {
        border-left-width: 4px;
        border-color: color-mix(in srgb, var(--alx-chat-border) 70%, var(--alx-chat-primary));
      }

      .question-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        font-family: var(--alx-chat-font);
        font-size: 13px;
        font-weight: 600;
        color: var(--alx-chat-text);
        cursor: pointer;
        text-align: left;
        line-height: 1.4;
        transition: background 0.15s var(--alx-chat-spring-smooth);
      }

      .question-btn:hover {
        background: var(--alx-chat-surface-hover);
      }

      .question-text {
        flex: 1;
      }

      .chevron {
        flex-shrink: 0;
        color: var(--alx-chat-text-muted);
        transition: transform 0.2s var(--alx-chat-spring-smooth);
      }

      .faq-item.expanded .chevron {
        transform: rotate(180deg);
      }

      .answer {
        padding: 0 16px 14px;
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        line-height: 1.6;
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }

      .answer-content {
        padding-top: 8px;
        border-top: 1px solid var(--alx-chat-border);
      }

      .answer-content a {
        color: var(--alx-chat-primary);
      }

      .highlight {
        background: var(--alx-chat-primary-light);
        border-radius: 2px;
        padding: 0 2px;
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
        width: 32px;
        height: 32px;
        border: 1px solid var(--alx-chat-border);
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s var(--alx-chat-spring-snappy);
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
        transition: background 0.2s var(--alx-chat-spring-smooth);
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
                  <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
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
    const query = this.searchQuery.trim();

    return html`
      <div class=${classMap({ 'faq-item': true, expanded: isExpanded })}>
        <button class="question-btn" @click=${() => this.toggleItem(index, item)}>
          <span class="question-text">${this._highlightText(item.question, query)}</span>
          <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <polyline points="4 6 8 10 12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        ${isExpanded
          ? html`
              <div class="answer">
                <div class="answer-content">${this._highlightText(item.answer, query)}</div>
                ${this.feedbackEnabled
                  ? html`
                      <div class="feedback-row">
                        <span class="feedback-label">Helpful?</span>
                        <button
                          class=${classMap({ 'feedback-btn': true, voted: feedbackValue === true })}
                          @click=${() => this.handleFeedback(index, item, true)}
                          aria-label="Yes, helpful"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M4 6.5V12.5H2.5C1.95 12.5 1.5 12.05 1.5 11.5V7.5C1.5 6.95 1.95 6.5 2.5 6.5H4ZM5 6.5L7.5 1.5C8.05 1.5 8.5 1.95 8.5 2.5V5H11.5C12.05 5 12.5 5.45 12.5 6V7L10.5 12.5H5V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </button>
                        <button
                          class=${classMap({ 'feedback-btn': true, voted: feedbackValue === false })}
                          @click=${() => this.handleFeedback(index, item, false)}
                          aria-label="Not helpful"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="transform: scaleY(-1)">
                            <path d="M4 6.5V12.5H2.5C1.95 12.5 1.5 12.05 1.5 11.5V7.5C1.5 6.95 1.95 6.5 2.5 6.5H4ZM5 6.5L7.5 1.5C8.05 1.5 8.5 1.95 8.5 2.5V5H11.5C12.05 5 12.5 5.45 12.5 6V7L10.5 12.5H5V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
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

  private _highlightText(text: string, query: string): TemplateResult {
    if (!query || !text) return html`${text}`;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return html`${parts.map(part =>
      regex.test(part) ? html`<span class="highlight">${part}</span>` : part
    )}`;
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

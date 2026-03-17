import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { GuidedQuestion, GuidedOption } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-options.js';

interface ConversationalMessage {
  type: 'question' | 'answer';
  text: string;
}

/**
 * <alx-chat-guided-questions> -- Step-by-step guided question flow
 * with branching support.
 *
 * Two modes:
 * 1. Sequential: one question at a time with clickable option buttons
 * 2. Conversational: simulates chat-like experience with typing animation
 */
export class AlxChatGuidedQuestions extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .guided-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* -- Sequential mode -- */

      .sequential-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .step-indicator {
        display: flex;
        gap: 6px;
        margin-bottom: 24px;
      }

      .step-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--alx-chat-border);
        transition: all 0.2s ease;
      }

      .step-dot.active {
        background: var(--alx-chat-primary);
        width: 24px;
        border-radius: 4px;
      }

      .step-dot.completed {
        background: var(--alx-chat-primary);
      }

      .question-text {
        font-size: 17px;
        font-weight: 600;
        color: var(--alx-chat-text);
        text-align: center;
        margin-bottom: 24px;
        line-height: 1.4;
        max-width: 320px;
      }

      .options-wrapper {
        width: 100%;
        max-width: 340px;
      }

      .free-text-wrapper {
        margin-top: 12px;
        width: 100%;
        max-width: 340px;
      }

      .free-text-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s ease;
      }

      .free-text-input::placeholder {
        color: var(--alx-chat-text-muted);
      }

      .free-text-input:focus {
        border-color: var(--alx-chat-primary);
      }

      .free-text-submit {
        margin-top: 8px;
        display: block;
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .free-text-submit:hover {
        background: var(--alx-chat-primary-hover);
      }

      .free-text-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* -- Conversational mode -- */

      .conversational-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .conv-message {
        display: flex;
        animation: messageIn 0.3s ease;
      }

      @keyframes messageIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .conv-message.question {
        justify-content: flex-start;
      }

      .conv-message.answer {
        justify-content: flex-end;
      }

      .conv-bubble {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 13px;
        line-height: 1.5;
      }

      .conv-message.question .conv-bubble {
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        border-bottom-left-radius: 4px;
      }

      .conv-message.answer .conv-bubble {
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        border-bottom-right-radius: 4px;
      }

      .typing-indicator {
        display: flex;
        justify-content: flex-start;
        animation: messageIn 0.3s ease;
      }

      .typing-bubble {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: var(--alx-chat-surface);
        border-radius: 16px;
        border-bottom-left-radius: 4px;
      }

      .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--alx-chat-text-muted);
        animation: typingBounce 1.4s infinite ease-in-out both;
      }

      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }
      .typing-dot:nth-child(3) { animation-delay: 0s; }

      @keyframes typingBounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }

      .conv-options-area {
        padding: 0 16px 16px;
        flex-shrink: 0;
      }

      .skip-link {
        display: block;
        text-align: center;
        margin-top: 12px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s ease;
      }

      .skip-link:hover {
        color: var(--alx-chat-text);
      }
    `,
  ];

  @property({ type: Array }) questions: GuidedQuestion[] = [];
  @property() mode: 'sequential' | 'conversational' = 'sequential';
  @property({ type: Number }) typingDelayMs = 300;
  @property({ type: Boolean }) canSkipToChat = false;

  @state() private currentQuestionIndex = 0;
  @state() private conversationLog: ConversationalMessage[] = [];
  @state() private isShowingTyping = false;
  @state() private freeTextValue = '';
  @state() private questionHistory: GuidedQuestion[] = [];
  @state() private awaitingOptions = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.questions.length > 0) {
      this.questionHistory = [this.questions[0]];
      if (this.mode === 'conversational') {
        this.showConversationalQuestion(this.questions[0]);
      }
    }
  }

  private get currentQuestion(): GuidedQuestion | null {
    if (this.mode === 'conversational') {
      return this.questionHistory[this.questionHistory.length - 1] ?? null;
    }
    return this.questions[this.currentQuestionIndex] ?? null;
  }

  render() {
    if (this.mode === 'conversational') {
      return this.renderConversational();
    }
    return this.renderSequential();
  }

  private renderSequential() {
    const question = this.currentQuestion;
    if (!question) return nothing;

    const totalSteps = this.questions.length;

    const optionItems = question.options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: opt.icon,
      description: opt.description,
    }));

    return html`
      <div class="guided-container">
        <div class="sequential-container">
          <div class="step-indicator">
            ${this.questions.map(
              (_, i) => html`
                <span class=${classMap({
                  'step-dot': true,
                  active: i === this.currentQuestionIndex,
                  completed: i < this.currentQuestionIndex,
                })}></span>
              `,
            )}
          </div>

          <div class="question-text">${question.text}</div>

          <div class="options-wrapper">
            <alx-chat-options
              .options=${optionItems}
              .multiSelect=${question.multiSelect ?? false}
              confirmText="Continue"
              @option-selected=${(e: CustomEvent) => this.handleOptionSelected(e, question)}
            ></alx-chat-options>
          </div>

          ${question.allowFreeText
            ? html`
                <div class="free-text-wrapper">
                  <input
                    class="free-text-input"
                    type="text"
                    placeholder="Or type your answer..."
                    .value=${this.freeTextValue}
                    @input=${(e: Event) => { this.freeTextValue = (e.target as HTMLInputElement).value; }}
                    @keydown=${this.handleFreeTextKeydown}
                  />
                  <button
                    class="free-text-submit"
                    ?disabled=${!this.freeTextValue.trim()}
                    @click=${this.handleFreeTextSubmit}
                  >
                    Submit
                  </button>
                </div>
              `
            : nothing}

          ${this.canSkipToChat
            ? html`
                <button class="skip-link" @click=${this.handleSkip}>
                  Skip to chat
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  private renderConversational() {
    const question = this.currentQuestion;

    const optionItems = question
      ? question.options.map((opt) => ({
          value: opt.value,
          label: opt.label,
          icon: opt.icon,
          description: opt.description,
        }))
      : [];

    return html`
      <div class="guided-container">
        <div class="conversational-container" id="conv-scroll">
          ${this.conversationLog.map(
            (msg) => html`
              <div class=${classMap({ 'conv-message': true, [msg.type]: true })}>
                <div class="conv-bubble">${msg.text}</div>
              </div>
            `,
          )}
          ${this.isShowingTyping
            ? html`
                <div class="typing-indicator">
                  <div class="typing-bubble">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                  </div>
                </div>
              `
            : nothing}
        </div>

        ${this.awaitingOptions && question && !this.isShowingTyping
          ? html`
              <div class="conv-options-area">
                <alx-chat-options
                  .options=${optionItems}
                  .multiSelect=${question.multiSelect ?? false}
                  confirmText="Continue"
                  @option-selected=${(e: CustomEvent) => this.handleOptionSelected(e, question)}
                ></alx-chat-options>

                ${question.allowFreeText
                  ? html`
                      <div class="free-text-wrapper" style="margin-top:8px">
                        <input
                          class="free-text-input"
                          type="text"
                          placeholder="Or type your answer..."
                          .value=${this.freeTextValue}
                          @input=${(e: Event) => { this.freeTextValue = (e.target as HTMLInputElement).value; }}
                          @keydown=${this.handleFreeTextKeydown}
                        />
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}

        ${this.canSkipToChat
          ? html`
              <button class="skip-link" style="padding:0 16px 12px" @click=${this.handleSkip}>
                Skip to chat
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private handleOptionSelected(e: CustomEvent, question: GuidedQuestion) {
    const rawValue = e.detail.value;
    const selectedValue: string | string[] = rawValue;

    // Fire answer event
    this.dispatchEvent(
      new CustomEvent('answer-selected', {
        detail: { questionKey: question.key, value: selectedValue },
        bubbles: true,
        composed: true,
      }),
    );

    // Find the selected option for branching
    const selectedOptionValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
    const selectedOption = question.options.find((o) => o.value === selectedOptionValue);

    if (this.mode === 'conversational') {
      const answerLabel = Array.isArray(selectedValue)
        ? selectedValue
            .map((v) => question.options.find((o) => o.value === v)?.label ?? v)
            .join(', ')
        : (selectedOption?.label ?? selectedValue);

      this.conversationLog = [
        ...this.conversationLog,
        { type: 'answer', text: answerLabel },
      ];
      this.awaitingOptions = false;
    }

    this.freeTextValue = '';

    // Handle branching
    if (selectedOption?.skipToStep) {
      this.dispatchEvent(
        new CustomEvent('skip-to-step', {
          detail: { stepType: selectedOption.skipToStep },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.advanceToNextQuestion(selectedOption ?? null);
  }

  private handleFreeTextSubmit() {
    const value = this.freeTextValue.trim();
    if (!value) return;

    const question = this.currentQuestion;
    if (!question) return;

    this.dispatchEvent(
      new CustomEvent('answer-selected', {
        detail: { questionKey: question.key, value },
        bubbles: true,
        composed: true,
      }),
    );

    if (this.mode === 'conversational') {
      this.conversationLog = [
        ...this.conversationLog,
        { type: 'answer', text: value },
      ];
      this.awaitingOptions = false;
    }

    this.freeTextValue = '';
    this.advanceToNextQuestion(null);
  }

  private handleFreeTextKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.handleFreeTextSubmit();
    }
  }

  private advanceToNextQuestion(selectedOption: GuidedOption | null) {
    // If option specifies a next question, find it
    let nextQuestion: GuidedQuestion | null = null;

    if (selectedOption?.nextQuestion) {
      nextQuestion = this.questions.find((q) => q.key === selectedOption.nextQuestion) ?? null;
    }

    if (!nextQuestion) {
      // Default sequential advancement
      if (this.mode === 'conversational') {
        const currentKey = this.currentQuestion?.key;
        const currentIndex = this.questions.findIndex((q) => q.key === currentKey);
        const nextIndex = currentIndex + 1;
        if (nextIndex < this.questions.length) {
          nextQuestion = this.questions[nextIndex];
        }
      } else {
        const nextIndex = this.currentQuestionIndex + 1;
        if (nextIndex < this.questions.length) {
          nextQuestion = this.questions[nextIndex];
          this.currentQuestionIndex = nextIndex;
        }
      }
    } else if (this.mode !== 'conversational') {
      // For sequential mode, update the index to the target question
      const targetIndex = this.questions.findIndex((q) => q.key === nextQuestion!.key);
      if (targetIndex !== -1) {
        this.currentQuestionIndex = targetIndex;
      }
    }

    if (nextQuestion) {
      if (this.mode === 'conversational') {
        this.questionHistory = [...this.questionHistory, nextQuestion];
        this.showConversationalQuestion(nextQuestion);
      }
    } else {
      // All questions answered
      this.dispatchEvent(
        new CustomEvent('step-complete', { bubbles: true, composed: true }),
      );
    }
  }

  private showConversationalQuestion(question: GuidedQuestion) {
    this.isShowingTyping = true;
    this.awaitingOptions = false;

    const delay = this.typingDelayMs + question.text.length * 15;

    setTimeout(() => {
      this.isShowingTyping = false;
      this.conversationLog = [
        ...this.conversationLog,
        { type: 'question', text: question.text },
      ];
      this.awaitingOptions = true;
      this.scrollConversation();
    }, delay);
  }

  private scrollConversation() {
    this.updateComplete.then(() => {
      const container = this.shadowRoot?.getElementById('conv-scroll');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('skip-to-chat', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-guided-questions', AlxChatGuidedQuestions);

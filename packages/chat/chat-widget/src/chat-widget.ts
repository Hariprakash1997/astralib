import { LitElement, html, css, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { property, state } from 'lit/decorators.js';
import type {
  ChatMessage,
  ChatAgentInfo,
  ChatSessionStatus,
  ChatWidgetConfig,
  ChatTranslations,
  ConnectedPayload,
  MessageReceivedPayload,
  MessageStatusPayload,
  TypingPayload,
  StatusPayload,
  ChatErrorPayload,
  PreChatFlowConfig,
  FlowStep,
  WelcomeStep,
  FAQStep,
  GuidedQuestionsStep,
  FormStep,
  AgentSelectorStep,
  PostChatConfig,
  OfflineConfig,
  AgentDisconnectedPayload,
  SupportPersonsPayload,
  ChatWidgetFeatures,
  RatingPromptPayload,
  WidgetFileSharingConfig,
  WidgetBusinessHoursConfig,
  WidgetRatingConfig,
} from '@astralibx/chat-types';
import {
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
  ChatSessionStatus as ChatSessionStatusEnum,
} from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from './styles/shared.js';
import { chatDarkTheme } from './styles/theme-dark.js';
import { chatLightTheme } from './styles/theme-light.js';
import { ChatSocketManager } from './services/socket-manager.js';
import { ChatStorageManager } from './services/storage-manager.js';
import { ChatNotificationManager } from './services/notification-manager.js';
import { FlowManager } from './services/flow-manager.js';
import { safeRegister } from './utils/safe-register.js';
import './components/chat-launcher.js';
import './components/chat-window.js';
import './components/chat-welcome.js';
import './components/chat-faq.js';
import './components/chat-guided-questions.js';
import './components/chat-prechat-form.js';
import './components/chat-agent-selector.js';
import './components/chat-feedback.js';
import './components/chat-offline.js';
import './components/chat-rating.js';
import './components/chat-history.js';

const DEFAULT_TRANSLATIONS: ChatTranslations = {
  welcomeTitle: 'Chat Support',
  welcomeSubtitle: 'We are here to help',
  inputPlaceholder: 'Type a message...',
  sendButton: 'Send',
  endChatButton: 'End Chat',
};

/**
 * <alx-chat-widget> -- the single entry point for the embeddable chat widget.
 *
 * Accepts config via HTML attributes or the `configure()` method.
 * Manages widget state, services, pre-chat flow, and child component orchestration.
 *
 * @example
 * ```html
 * <alx-chat-widget
 *   socket-url="http://localhost:3000"
 *   channel="web"
 *   theme="dark"
 *   position="bottom-right"
 * ></alx-chat-widget>
 * ```
 */
export class AlxChatWidget extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatDarkTheme,
    chatLightTheme,
    css`
      :host {
        display: block;
        position: relative;
        z-index: 9998;
      }
      :host([dir="rtl"]) {
        direction: rtl;
      }
      .connection-failed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 300px;
        gap: 16px;
        color: var(--alx-chat-text-muted);
      }
      .connection-failed-text {
        font-size: 14px;
        margin: 0;
      }
      .retry-connection-btn {
        padding: 10px 24px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: transparent;
        color: var(--alx-chat-text);
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
      }
      .retry-connection-btn:hover {
        background: var(--alx-chat-surface);
        border-color: var(--alx-chat-primary);
      }
    `,
  ];

  // -- Config properties (settable via HTML attributes) --

  @property({ attribute: 'socket-url' }) socketUrl = '';
  @property() channel = '';
  @property({ reflect: true }) theme: 'light' | 'dark' | 'auto' = 'dark';
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property({ attribute: 'primary-color' }) primaryColor = '';
  @property() dir: 'ltr' | 'rtl' | 'auto' = 'auto';
  @property() locale = '';

  // -- Internal state --

  @state() private isOpen = false;
  @state() private messages: ChatMessage[] = [];
  @state() private sessionId: string | null = null;
  @state() private agent: ChatAgentInfo | null = null;
  @state() private status: ChatSessionStatus = ChatSessionStatusEnum.New;
  @state() private isTyping = false;
  @state() private unreadCount = 0;
  @state() private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' = 'disconnected';
  @state() private queuePosition: number | null = null;
  @state() private estimatedWaitMinutes: number | null = null;
  @state() private currentView: 'flow' | 'chat' | 'feedback' | 'offline' | 'rating' | 'history' = 'chat';
  @state() private currentFlowStep: FlowStep | null = null;
  @state() private _resolvedTheme: 'dark' | 'light' = 'dark';

  // -- Config --

  private translations: ChatTranslations = { ...DEFAULT_TRANSLATIONS };
  private features: ChatWidgetFeatures & { soundNotifications: boolean; desktopNotifications: boolean; typingIndicator: boolean; readReceipts: boolean } = {
    soundNotifications: true,
    desktopNotifications: false,
    typingIndicator: true,
    readReceipts: true,
  };
  private userInfo: { userId?: string; name?: string; email?: string; avatar?: string } = {};
  private branding: { primaryColor?: string; companyName?: string; logoUrl?: string } = {};
  private offlineConfig: OfflineConfig | null = null;
  private postChatConfig: PostChatConfig | null = null;
  private fileSharingConfig: WidgetFileSharingConfig | null = null;
  private businessHoursConfig: WidgetBusinessHoursConfig | null = null;
  private ratingConfig: WidgetRatingConfig | null = null;
  private ratingPromptPayload: RatingPromptPayload | null = null;
  private reopenMessage = '';

  // -- Theme --

  private _mediaQuery: MediaQueryList | null = null;
  private _handleThemeChange = (e: MediaQueryListEvent) => {
    if (this.theme === 'auto') {
      this._resolvedTheme = e.matches ? 'dark' : 'light';
      this.setAttribute('theme', this._resolvedTheme);
      this.requestUpdate();
    }
  };

  // -- Services --

  private socketManager: ChatSocketManager | null = null;
  private storageManager: ChatStorageManager | null = null;
  private notificationManager: ChatNotificationManager | null = null;
  private flowManager = new FlowManager();
  private _timers: ReturnType<typeof setTimeout>[] = [];

  // -- Temp ID counter --
  private tempIdCounter = 0;

  /**
   * Programmatic configuration. Call this before or after the element is attached.
   */
  configure(config: Partial<ChatWidgetConfig>): void {
    if (config.socketUrl) this.socketUrl = config.socketUrl;
    if (config.channel) this.channel = config.channel;
    if (config.theme) this.theme = config.theme;
    if (config.position) this.position = config.position;
    if (config.dir) this.dir = config.dir;
    if (config.locale) this.locale = config.locale;
    if (config.translations) {
      this.translations = { ...DEFAULT_TRANSLATIONS, ...Object.fromEntries(Object.entries(config.translations).filter(([, v]) => v !== undefined)) } as ChatTranslations;
    }
    if (config.features) {
      this.features = { ...this.features, ...config.features };
    }
    if (config.user) {
      this.userInfo = { ...this.userInfo, ...config.user };
    }
    if (config.branding) {
      this.branding = { ...this.branding, ...config.branding };
      if (config.branding.primaryColor) {
        this.primaryColor = config.branding.primaryColor;
      }
    }
    if (config.preChatFlow) {
      this.flowManager.configure(config.preChatFlow);
      if (config.preChatFlow.enabled && config.preChatFlow.steps.length > 0) {
        this.currentView = 'flow';
        this.currentFlowStep = this.flowManager.getCurrentStep();
      }
    }
    if (config.offline) {
      this.offlineConfig = config.offline;
    }
    if (config.postChat) {
      this.postChatConfig = config.postChat;
    }
    if (config.fileSharing) {
      this.fileSharingConfig = config.fileSharing;
    }
    if (config.businessHours) {
      this.businessHoursConfig = config.businessHours;
    }
    if (config.ratingConfig) {
      this.ratingConfig = config.ratingConfig;
    }

    // Apply custom style overrides
    if (config.styles) {
      for (const [prop, value] of Object.entries(config.styles)) {
        if (prop.startsWith('--alx-chat-')) {
          this.style.setProperty(prop, value);
        }
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();

    // Set ARIA attributes on host
    this.setAttribute('role', 'complementary');
    this.setAttribute('aria-label', 'Chat widget');
    this.setAttribute('dir', this._resolveDir());

    // Init theme media query listener
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._mediaQuery.addEventListener('change', this._handleThemeChange);
    this._resolveTheme();

    // Init storage manager
    this.storageManager = new ChatStorageManager(this.channel || 'default');

    // Init notification manager
    this.notificationManager = new ChatNotificationManager();
    this.notificationManager.setSoundEnabled(this.features.soundNotifications);
    this.notificationManager.setDesktopEnabled(this.features.desktopNotifications);

    // Restore UI state
    this.isOpen = this.storageManager.getWidgetOpen();

    // Listen for visibility change to stop title flash
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Handle file attachment clicks from chat-input
    this.addEventListener('attach-click', this.handleAttachClick as EventListener);

    // Handle message retry from chat-bubble
    this.addEventListener('message-retry', this._handleMessageRetry as EventListener);

    // Handle file-error from chat-input
    this.addEventListener('file-error', this._handleFileError as EventListener);

    // Handle show-history from chat-window
    this.addEventListener('show-history', this._handleShowHistory as EventListener);

    // Handle history-close from chat-history
    this.addEventListener('history-close', this._handleHistoryClose as EventListener);

    // Handle rating-submitted from chat-rating
    this.addEventListener('rating-submitted', this._handleRatingSubmitted as EventListener);

    // Check business hours on init
    this._checkBusinessHours();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this._mediaQuery?.removeEventListener('change', this._handleThemeChange);
    this.socketManager?.disconnect();
    this.notificationManager?.destroy();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.removeEventListener('attach-click', this.handleAttachClick as EventListener);
    this.removeEventListener('message-retry', this._handleMessageRetry as EventListener);
    this.removeEventListener('file-error', this._handleFileError as EventListener);
    this.removeEventListener('show-history', this._handleShowHistory as EventListener);
    this.removeEventListener('history-close', this._handleHistoryClose as EventListener);
    this.removeEventListener('rating-submitted', this._handleRatingSubmitted as EventListener);
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('theme')) {
      this._resolveTheme();
      this.setAttribute('theme', this._resolvedTheme);
    }
    if (changedProps.has('primaryColor')) {
      this._applyPrimaryColor(this.primaryColor);
    }
    if (changedProps.has('dir') || changedProps.has('locale')) {
      this.setAttribute('dir', this._resolveDir());
    }
  }

  private _resolveTheme(): void {
    if (this.theme === 'auto') {
      this._resolvedTheme = this._mediaQuery?.matches ? 'dark' : 'light';
    } else {
      this._resolvedTheme = this.theme;
    }
    this.setAttribute('theme', this._resolvedTheme);
  }

  private _resolveDir(): 'ltr' | 'rtl' {
    if (this.dir === 'ltr' || this.dir === 'rtl') return this.dir;
    const rtlLocales = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'];
    const lang = (this.locale || navigator.language || 'en').split('-')[0].toLowerCase();
    return rtlLocales.includes(lang) ? 'rtl' : 'ltr';
  }

  private _applyPrimaryColor(hex: string): void {
    if (!hex) return;
    const style = this.style;
    style.setProperty('--alx-chat-primary', hex);
    style.setProperty('--alx-chat-primary-hover', `color-mix(in srgb, ${hex} 85%, #000)`);
    // primary-light and primary-muted are already derived via color-mix in shared.ts
  }

  render() {
    return html`
      ${this.connectionStatus === 'failed' && this.isOpen && this.currentView === 'chat' ? html`
        <div class="connection-failed">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="currentColor" stroke-width="2"/>
            <line x1="20" y1="13" x2="20" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="20" cy="26" r="1.5" fill="currentColor"/>
          </svg>
          <p class="connection-failed-text">We're having trouble connecting. Your messages are saved.</p>
          <button class="retry-connection-btn" @click=${this._retryConnection}>Try Again</button>
        </div>
      ` : html`
          <alx-chat-window
          .open=${this.isOpen && this.currentView === 'chat'}
          .position=${this.position}
          .messages=${this.messages}
          .agentName=${this.agent?.name ?? this.branding.companyName ?? this.translations.welcomeTitle}
          .agentAvatar=${this.agent?.avatar ?? this.branding.logoUrl ?? ''}
          .connectionStatus=${this.connectionStatus}
          .isTyping=${this.isTyping}
          .typingLabel=${this.agent?.name ? `${this.agent.name} is typing...` : 'Agent is typing...'}
          .inputPlaceholder=${this.translations.inputPlaceholder}
          .inputDisabled=${this.connectionStatus !== 'connected'}
          .showAttach=${!!this.fileSharingConfig?.enabled}
          .allowedFileTypes=${this.fileSharingConfig?.allowedTypes ?? []}
          .maxFileSizeMb=${this.fileSharingConfig?.maxFileSizeMb ?? 5}
          .showHistoryLink=${!!this.storageManager?.getVisitorId()}
          .queuePosition=${this.status === ChatSessionStatusEnum.WaitingAgent ? this.queuePosition : null}
          .estimatedWaitMinutes=${this.estimatedWaitMinutes}
          .connectionStatusLabel=${this.connectionStatus === 'disconnected' && this.sessionId ? "We're having trouble connecting. Your messages are saved." : ''}
          @minimize=${this.handleToggle}
          @end-chat=${this.handleEndChat}
          @send=${this.handleSend}
          @typing=${this.handleLocalTyping}
        ></alx-chat-window>
      `}
      ${this.isOpen && this.currentView !== 'chat' ? this.renderOverlayView() : nothing}
      <alx-chat-launcher
        .open=${this.isOpen}
        .position=${this.position}
        .unreadCount=${this.unreadCount}
        @toggle=${this.handleToggle}
      ></alx-chat-launcher>
    `;
  }

  private renderOverlayView() {
    switch (this.currentView) {
      case 'flow':
        return this.renderFlowStep();
      case 'feedback':
        return this.renderFeedback();
      case 'offline':
        return this.renderOffline();
      case 'rating':
        return this.renderRating();
      case 'history':
        return this.renderHistory();
      default:
        return nothing;
    }
  }

  private renderFlowStep() {
    if (!this.currentFlowStep) return nothing;

    const step = this.currentFlowStep;
    const canSkip = this.flowManager.canSkipToChat();

    switch (step.type) {
      case 'welcome': {
        const ws = step as WelcomeStep;
        return html`
          <alx-chat-welcome
            .title=${ws.title}
            .subtitle=${ws.subtitle ?? ''}
            .agentAvatar=${ws.agentAvatar ?? ''}
            .agentName=${ws.agentName ?? ''}
            .showOnlineStatus=${ws.showOnlineStatus ?? false}
            .isOnline=${this.connectionStatus === 'connected'}
            .ctaText=${ws.ctaText ?? 'Start Chat'}
            .canSkipToChat=${canSkip}
            @step-complete=${this.handleStepComplete}
            @skip-to-chat=${this.handleSkipToChat}
          ></alx-chat-welcome>
        `;
      }

      case 'faq': {
        const fs = step as FAQStep;
        return html`
          <alx-chat-faq
            .title=${fs.title ?? 'Frequently Asked Questions'}
            .searchEnabled=${fs.searchEnabled ?? true}
            .categories=${fs.categories ?? []}
            .items=${fs.items}
            .feedbackEnabled=${fs.feedbackEnabled ?? false}
            .showChatPrompt=${fs.showChatPrompt ?? true}
            .chatPromptText=${fs.chatPromptText ?? 'Still have questions? Chat with us'}
            .canSkipToChat=${canSkip}
            @step-complete=${this.handleStepComplete}
            @faq-viewed=${this.handleFaqViewed}
            @faq-feedback=${this.handleFaqFeedback}
          ></alx-chat-faq>
        `;
      }

      case 'guided': {
        const gs = step as GuidedQuestionsStep;
        return html`
          <alx-chat-guided-questions
            .questions=${gs.questions}
            .mode=${gs.mode}
            .typingDelayMs=${gs.typingDelayMs ?? 300}
            .canSkipToChat=${canSkip}
            @answer-selected=${this.handleGuidedAnswer}
            @step-complete=${this.handleStepComplete}
            @skip-to-chat=${this.handleSkipToChat}
            @skip-to-step=${this.handleSkipToStep}
          ></alx-chat-guided-questions>
        `;
      }

      case 'form': {
        const fms = step as FormStep;
        return html`
          <alx-chat-prechat-form
            .title=${fms.title ?? ''}
            .fields=${fms.fields}
            .submitText=${fms.submitText ?? 'Start Chat'}
            .canSkipToChat=${canSkip}
            @form-submitted=${this.handleFormSubmitted}
            @step-complete=${this.handleStepComplete}
            @skip-to-chat=${this.handleSkipToChat}
          ></alx-chat-prechat-form>
        `;
      }

      case 'agent-selector': {
        const as = step as AgentSelectorStep;
        return html`
          <alx-chat-agent-selector
            .title=${as.title ?? 'Choose who to talk to'}
            .showAvailability=${as.showAvailability ?? true}
            .showSpecialty=${as.showSpecialty ?? true}
            .autoAssign=${as.autoAssign ?? true}
            .autoAssignText=${as.autoAssignText ?? 'Connect me with anyone available'}
            .canSkipToChat=${canSkip}
            @agent-selected=${this.handleAgentSelected}
            @step-complete=${this.handleStepComplete}
            @skip-to-chat=${this.handleSkipToChat}
          ></alx-chat-agent-selector>
        `;
      }

      case 'custom': {
        // WARNING: custom HTML from developer config — ensure content is trusted
        return html`
          <div>${unsafeHTML(step.html)}</div>
          ${step.ctaText
            ? html`<button @click=${this.handleStepComplete}>${step.ctaText}</button>`
            : nothing}
        `;
      }

      default:
        return nothing;
    }
  }

  private renderFeedback() {
    if (!this.postChatConfig?.enabled) return nothing;

    return html`
      <alx-chat-feedback
        .type=${this.postChatConfig.type}
        .question=${this.postChatConfig.ratingQuestion ?? 'How was your experience?'}
        .surveyFields=${this.postChatConfig.surveyFields ?? []}
        .thankYouMessage=${this.postChatConfig.thankYouMessage ?? 'Thank you for your feedback!'}
        @feedback-submitted=${this.handleFeedbackSubmitted}
      ></alx-chat-feedback>
    `;
  }

  private renderOffline() {
    return html`
      <alx-chat-offline
        .mode=${this.offlineConfig?.mode ?? 'message'}
        .title=${this.offlineConfig?.offlineTitle ?? 'We are currently offline'}
        .message=${this.offlineConfig?.offlineMessage ?? 'Our team is not available right now. Please leave a message and we will get back to you.'}
        .reopenMessage=${this.reopenMessage}
        .formFields=${this.offlineConfig?.formFields ?? []}
        @offline-message-submitted=${this.handleOfflineMessage}
      ></alx-chat-offline>
    `;
  }

  private renderRating() {
    const ratingType = this.ratingConfig?.ratingType
      ?? (this.ratingPromptPayload?.ratingType as 'thumbs' | 'stars' | 'emoji')
      ?? 'thumbs';
    const followUpOptions = this.ratingConfig?.followUpOptions
      ?? this.ratingPromptPayload?.followUpOptions
      ?? {};

    return html`
      <alx-chat-rating
        .ratingType=${ratingType}
        .question=${'How was your experience?'}
        .followUpOptions=${followUpOptions}
      ></alx-chat-rating>
    `;
  }

  private renderHistory() {
    return html`
      <alx-chat-history
        .socketUrl=${this.socketUrl}
        .visitorId=${this.storageManager?.getVisitorId() ?? ''}
        .limit=${5}
      ></alx-chat-history>
    `;
  }

  // -- Flow event handlers --

  private handleStepComplete = () => {
    const nextStep = this.flowManager.nextStep();

    if (nextStep) {
      this.currentFlowStep = nextStep;
    } else {
      // Flow complete
      this.completeFlow();
    }
  };

  private handleSkipToChat = () => {
    this.flowManager.skipToChat();
    this.completeFlow();
  };

  private handleSkipToStep = (e: CustomEvent<{ stepType: string }>) => {
    this.flowManager.skipToStep(e.detail.stepType);
    const step = this.flowManager.getCurrentStep();

    if (step) {
      this.currentFlowStep = step;
    } else {
      this.completeFlow();
    }
  };

  private handleFormSubmitted = (e: CustomEvent<{ data: Record<string, unknown> }>) => {
    this.flowManager.setFormData(e.detail.data);
  };

  private handleGuidedAnswer = (e: CustomEvent<{ questionKey: string; value: string | string[] }>) => {
    this.flowManager.setGuidedAnswer(e.detail.questionKey, e.detail.value);
  };

  private handleAgentSelected = (e: CustomEvent<{ agentId: string | null }>) => {
    this.flowManager.setFormData({ preferredAgentId: e.detail.agentId });
  };

  private handleFaqViewed = (e: CustomEvent<{ question: string }>) => {
    this.fireEvent('chat:faq-viewed', { question: e.detail.question });
  };

  private handleFaqFeedback = (e: CustomEvent<{ question: string; helpful: boolean }>) => {
    this.fireEvent('chat:faq-feedback', {
      question: e.detail.question,
      helpful: e.detail.helpful,
    });
  };

  private handleFeedbackSubmitted = (e: CustomEvent) => {
    const detail = e.detail;

    if (detail.skipped) {
      // User skipped feedback, disconnect and close
      this.socketManager?.disconnect();
      this.connectionStatus = 'disconnected';
      this.currentView = 'chat';
      return;
    }

    // Send feedback via socket before disconnecting
    this.socketManager?.sendFeedback(detail.rating, detail.survey);

    // Dispatch to host for consumer analytics
    this.dispatchEvent(new CustomEvent('chat:feedback-submitted', {
      bubbles: true, composed: true,
      detail: { rating: detail.rating, survey: detail.survey },
    }));

    // Close widget after a short delay for thank-you message
    this._timers.push(setTimeout(() => {
      this.socketManager?.disconnect();
      this.connectionStatus = 'disconnected';
      this.isOpen = false;
      this.storageManager?.setWidgetOpen(false);
      this.currentView = 'chat';
    }, 2000));
  };

  private handleOfflineMessage = (e: CustomEvent<{ data: Record<string, unknown> }>) => {
    this.fireEvent('chat:offline-message', e.detail);
  };

  private completeFlow() {
    const action = this.flowManager.getCompletionAction();
    const preferences = this.flowManager.getCollectedPreferences();

    this.fireEvent('chat:prechat-completed', { preferences });

    switch (action) {
      case 'chat':
        this.currentView = 'chat';
        // Connect socket with collected preferences
        if (!this.socketManager?.isConnected && this.socketUrl) {
          this.initSocket(preferences);
        }
        break;

      case 'close':
        this.isOpen = false;
        this.storageManager?.setWidgetOpen(false);
        break;

      case 'url': {
        const url = this.flowManager.getCompletionUrl();
        if (url) {
          window.open(url, '_blank');
        }
        this.isOpen = false;
        this.storageManager?.setWidgetOpen(false);
        break;
      }
    }
  }

  // -- Event handlers --

  private handleToggle = () => {
    this.isOpen = !this.isOpen;
    this.storageManager?.setWidgetOpen(this.isOpen);

    if (this.isOpen) {
      this.unreadCount = 0;
      this.notificationManager?.stopTitleFlash();
      this.fireEvent('chat:widget-opened');

      // Send analytics
      this.socketManager?.trackWidgetOpened();

      // If flow is enabled and not complete, show flow
      if (this.flowManager.isFlowEnabled() && !this.flowManager.isFlowComplete()) {
        this.currentView = 'flow';
        this.currentFlowStep = this.flowManager.getCurrentStep();
      } else if (this.currentView === 'chat' || this.currentView === 'history') {
        this.currentView = 'chat';
        // Connect if not already connected
        if (!this.socketManager?.isConnected && this.socketUrl) {
          this.initSocket();
        }
      }
    } else {
      this.fireEvent('chat:widget-closed');
      // Send analytics
      this.socketManager?.trackWidgetMinimized();
    }
  };

  private handleSend = (e: CustomEvent<{ content: string }>) => {
    const { content } = e.detail;
    if (!content.trim() || !this.sessionId) return;

    const tempId = `temp-${++this.tempIdCounter}-${Date.now()}`;

    // Optimistic message
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      messageId: tempId,
      sessionId: this.sessionId ?? '',
      senderType: ChatSenderType.Visitor,
      content: content.trim(),
      contentType: ChatContentType.Text,
      status: ChatMessageStatus.Sending,
      createdAt: new Date(),
    };

    this.messages = [...this.messages, optimisticMessage];

    // Send via socket
    this.socketManager
      ?.sendMessage(content.trim(), ChatContentType.Text, tempId)
      .then(() => {
        // Status will be updated via MessageStatus event
      })
      .catch(() => {
        // Mark as failed
        this.messages = this.messages.map((m) =>
          m.messageId === tempId
            ? { ...m, status: ChatMessageStatus.Failed }
            : m,
        );
      });

    this.fireEvent('chat:message-sent', { message: optimisticMessage });
  };

  private handleLocalTyping = (e: CustomEvent<{ isTyping: boolean }>) => {
    this.socketManager?.sendTyping(e.detail.isTyping);
  };

  private handleAttachClick = async (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const file = detail?.file as File | undefined;
    if (!file || !this.sessionId) return;

    this.fireEvent('chat:file-selected', {
      file,
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Upload file via REST API
    try {
      const baseUrl = this.socketUrl.replace(/\/$/, '');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `${baseUrl}/sessions/${encodeURIComponent(this.sessionId)}/upload`,
        { method: 'POST', body: formData },
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ message: `Upload failed (${res.status})` }));
        throw new Error(errJson.message || `Upload failed (${res.status})`);
      }

      const json = await res.json();
      const fileUrl = json.data?.url || json.url;
      const fileName = json.data?.fileName || json.fileName || file.name;

      // Determine content type
      const isImage = file.type.startsWith('image/');
      const contentType = isImage ? ChatContentType.Image : ChatContentType.File;

      const tempId = `temp-${++this.tempIdCounter}-${Date.now()}`;

      // Optimistic file message
      const optimisticMessage: ChatMessage = {
        _id: tempId,
        messageId: tempId,
        sessionId: this.sessionId ?? '',
        senderType: ChatSenderType.Visitor,
        content: fileUrl,
        contentType,
        status: ChatMessageStatus.Sending,
        metadata: { filename: fileName },
        createdAt: new Date(),
      };

      this.messages = [...this.messages, optimisticMessage];

      // Send file message via socket
      this.socketManager
        ?.sendMessage(fileUrl, contentType, tempId, { filename: fileName })
        .then(() => {
          // Status will be updated via MessageStatus event
        })
        .catch(() => {
          this.messages = this.messages.map((m) =>
            m.messageId === tempId
              ? { ...m, status: ChatMessageStatus.Failed }
              : m,
          );
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed';
      this.fireEvent('chat:file-error', { error: message });
    }
  };

  private handleEndChat = () => {
    if (this.sessionId) {
      this.fireEvent('chat:session-ended', { sessionId: this.sessionId });
    }

    // Check if two-step rating is enabled (takes priority)
    if (this.ratingConfig?.enabled) {
      this.currentView = 'rating';
      return;
    }

    // Check if post-chat feedback is enabled
    if (this.postChatConfig?.enabled) {
      this.currentView = 'feedback';
      // Keep socket alive so sendFeedback can reach the server
      return;
    }

    // Disconnect and reset
    this.socketManager?.disconnect();
    this.storageManager?.clearSession();
    this.sessionId = null;
    this.messages = [];
    this.agent = null;
    this.status = ChatSessionStatusEnum.New;
    this.isTyping = false;
    this.isOpen = false;
    this.storageManager?.setWidgetOpen(false);
    this.connectionStatus = 'disconnected';

    // Reset flow so it shows again on next open
    if (this.flowManager.isFlowEnabled()) {
      this.flowManager.reset();
    }
  };

  private _retryConnection = () => {
    this.connectionStatus = 'connecting';
    this.messages = [];
    this.sessionId = null;
    this.agent = null;
    this.queuePosition = null;
    this.socketManager?.disconnect();
    this.socketManager = null;
    this.initSocket();
  };

  private _handleMessageRetry = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const messageId = detail?.messageId;
    if (!messageId) return;

    const msg = this.messages.find(m => m.messageId === messageId || m._id === messageId);
    if (!msg) return;

    const newTempId = `temp-${++this.tempIdCounter}-${Date.now()}`;

    // Update status to sending and assign new tempId
    this.messages = this.messages.map(m =>
      (m.messageId === messageId || m._id === messageId)
        ? { ...m, messageId: newTempId, _id: newTempId, status: ChatMessageStatus.Sending }
        : m,
    );

    this.socketManager
      ?.sendMessage(msg.content, msg.contentType, newTempId)
      .catch(() => {
        this.messages = this.messages.map(m =>
          m.messageId === newTempId
            ? { ...m, status: ChatMessageStatus.Failed }
            : m,
        );
      });
  };

  private _handleFileError = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    this.fireEvent('chat:file-error', { error: detail?.error });
  };

  private _handleShowHistory = () => {
    this.currentView = 'history';
  };

  private _handleHistoryClose = () => {
    this.currentView = 'chat';
  };

  private _handleRatingSubmitted = (e: Event) => {
    const detail = (e as CustomEvent).detail;

    if (detail.skipped) {
      this.socketManager?.disconnect();
      this.connectionStatus = 'disconnected';
      this.currentView = 'chat';
      return;
    }

    // Send rich feedback via socket
    this.socketManager?.sendRichFeedback({
      ratingType: detail.ratingType,
      ratingValue: detail.ratingValue,
      followUpSelections: detail.followUpSelections,
      comment: detail.comment,
    });

    this.dispatchEvent(new CustomEvent('chat:rating-submitted', {
      bubbles: true,
      composed: true,
      detail,
    }));

    // Close widget after thank-you delay
    this._timers.push(setTimeout(() => {
      this.socketManager?.disconnect();
      this.connectionStatus = 'disconnected';
      this.isOpen = false;
      this.storageManager?.setWidgetOpen(false);
      this.currentView = 'chat';
      this.ratingPromptPayload = null;
    }, 2000));
  };

  private handleVisibilityChange = () => {
    if (!document.hidden) {
      this.notificationManager?.stopTitleFlash();
      if (this.isOpen) {
        this.unreadCount = 0;
      }
      // Track page view when page becomes visible
      this.socketManager?.trackPageView(
        document.title,
        window.location.href,
      );
    }
  };

  // -- Socket lifecycle --

  private initSocket(preferences?: Record<string, unknown>) {
    if (!this.socketUrl) return;
    if (!this.storageManager) return;

    const visitorId = this.storageManager.getVisitorId();
    const existingSessionId = this.storageManager.getSessionId();

    this.socketManager = new ChatSocketManager(this.socketUrl, {
      onConnected: this.onSocketConnected,
      onMessage: this.onSocketMessage,
      onMessageStatus: this.onSocketMessageStatus,
      onTyping: this.onSocketTyping,
      onStatus: this.onSocketStatus,
      onAgentJoin: this.onSocketAgentJoin,
      onAgentLeave: this.onSocketAgentLeave,
      onAgentDisconnected: this.onSocketAgentDisconnected,
      onSupportPersons: this.onSocketSupportPersons,
      onError: this.onSocketError,
      onRatingPrompt: this.onSocketRatingPrompt,
      onConnectionChange: (status) => {
        this.connectionStatus = status;
      },
      onConnectionFailed: () => {
        this.connectionStatus = 'failed';
        this.fireEvent('chat:connection-failed');
      },
    }, '/chat', {
      maxReconnectAttempts: this.features.maxReconnectAttempts,
    });

    this.socketManager.connect(
      {
        visitorId,
        channel: this.channel || 'web',
        userAgent: navigator.userAgent,
        page: window.location.href,
        referrer: document.referrer || undefined,
        user: this.userInfo.userId ? this.userInfo : undefined,
        metadata: preferences ? { preChatPreferences: preferences } : undefined,
      },
      existingSessionId,
    );
  }

  // -- Socket callbacks --

  private onSocketConnected = (payload: ConnectedPayload) => {
    this.sessionId = payload.sessionId;
    this.messages = payload.messages;
    this.status = payload.session.status;
    if (payload.agent) {
      this.agent = payload.agent;
    }
    this.storageManager?.setSessionId(payload.sessionId);
    this.fireEvent('chat:session-started', { sessionId: payload.sessionId });
  };

  private onSocketMessage = (payload: MessageReceivedPayload) => {
    const { message, tempId } = payload;

    if (tempId) {
      // Replace optimistic message
      const exists = this.messages.some(m => m.messageId === tempId);
      if (exists) {
        this.messages = this.messages.map((m) =>
          m.messageId === tempId ? message : m,
        );
      } else {
        this.messages = [...this.messages, message];
      }
    } else {
      this.messages = [...this.messages, message];
    }

    // Notifications for non-visitor messages
    if (message.senderType !== ChatSenderType.Visitor) {
      if (!this.isOpen || document.hidden) {
        this.unreadCount++;
      }
      this.notificationManager?.notifyNewMessage(
        message.senderName,
        message.content,
      );
      this.fireEvent('chat:message-received', { message });
    }
  };

  private onSocketMessageStatus = (payload: MessageStatusPayload & { tempId?: string }) => {
    this.messages = this.messages.map((m) => {
      // Match by messageId OR by tempId (for optimistic messages not yet confirmed)
      if (m.messageId === payload.messageId || (payload.tempId && m.messageId === payload.tempId)) {
        return {
          ...m,
          messageId: payload.messageId, // Update to real messageId
          status: payload.status,
          deliveredAt: payload.deliveredAt,
          readAt: payload.readAt,
        };
      }
      return m;
    });
  };

  private onSocketTyping = (payload: TypingPayload) => {
    if (this.features.typingIndicator) {
      this.isTyping = payload.isTyping;
    }
  };

  private onSocketStatus = (payload: StatusPayload) => {
    this.status = payload.status;
    if (payload.agent) {
      this.agent = payload.agent;
    }
    this.queuePosition = payload.queuePosition ?? null;
    this.estimatedWaitMinutes = (payload as StatusPayload & { estimatedWaitMinutes?: number }).estimatedWaitMinutes ?? null;
  };

  private onSocketAgentJoin = (agent: ChatAgentInfo) => {
    this.agent = agent;
  };

  private onSocketAgentLeave = () => {
    const agentName = this.agent?.name ?? 'Your agent';
    this.agent = null;

    // Add a system message so the visitor isn't confused
    const systemMsg: ChatMessage = {
      _id: `sys-leave-${Date.now()}`,
      messageId: `sys-leave-${Date.now()}`,
      sessionId: this.sessionId ?? '',
      senderType: ChatSenderType.System,
      content: `${agentName} has left the chat. You can continue the conversation or start a new chat.`,
      contentType: ChatContentType.Text,
      status: ChatMessageStatus.Delivered,
      createdAt: new Date(),
    };
    this.messages = [...this.messages, systemMsg];
  };

  private onSocketAgentDisconnected = (payload: AgentDisconnectedPayload) => {
    // Agent went offline — clear the agent and notify user
    const agentName = payload.agentName ?? this.agent?.name ?? 'Your agent';
    this.agent = null;

    // Add a system message so the visitor knows what happened
    const systemMsg: ChatMessage = {
      _id: `sys-disconnect-${Date.now()}`,
      messageId: `sys-disconnect-${Date.now()}`,
      sessionId: this.sessionId ?? '',
      senderType: ChatSenderType.System,
      content: `${agentName} has disconnected. Please wait for another agent or leave a message.`,
      contentType: ChatContentType.Text,
      status: ChatMessageStatus.Delivered,
      createdAt: new Date(),
    };
    this.messages = [...this.messages, systemMsg];

    this.fireEvent('chat:agent-disconnected', {
      agentId: payload.agentId,
      agentName: payload.agentName,
    });
  };

  private onSocketSupportPersons = (payload: SupportPersonsPayload) => {
    this.fireEvent('chat:support-persons', { agents: payload.agents });
  };

  private onSocketRatingPrompt = (payload: RatingPromptPayload) => {
    this.ratingPromptPayload = payload;

    // If rating config is enabled, show the two-step rating UI
    if (this.ratingConfig?.enabled) {
      this.currentView = 'rating';
    } else {
      // Fall back to the legacy post-chat feedback if configured
      if (this.postChatConfig?.enabled) {
        this.currentView = 'feedback';
      }
    }
  };

  private onSocketError = (_payload: ChatErrorPayload) => {
    // Error handling can be extended with user-facing notifications
  };

  // -- Custom events --

  private fireEvent(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Check business hours configuration and switch to offline view if outside hours.
   */
  private _checkBusinessHours(): void {
    const bh = this.businessHoursConfig;
    if (!bh || !bh.enabled) return;

    const now = new Date();
    // Convert to the configured timezone
    let localHour: number;
    let localMinute: number;
    let localDay: number;

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: bh.timezone,
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false,
      }).formatToParts(now);

      localHour = Number(parts.find(p => p.type === 'hour')?.value ?? now.getHours());
      localMinute = Number(parts.find(p => p.type === 'minute')?.value ?? now.getMinutes());
      const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      localDay = dayMap[weekday] ?? now.getDay();
    } catch {
      // Fallback to local time if timezone is invalid
      localHour = now.getHours();
      localMinute = now.getMinutes();
      localDay = now.getDay();
    }

    // Check holiday
    const todayStr = now.toISOString().split('T')[0];
    const isHoliday = bh.holidayDates?.includes(todayStr) ?? false;
    if (isHoliday) {
      this._applyOutsideHours(bh, 'holiday', localDay);
      return;
    }

    // Check schedule
    const daySchedule = bh.schedule.find(s => s.day === localDay);
    if (!daySchedule || !daySchedule.isOpen) {
      this._applyOutsideHours(bh, 'closed-day', localDay);
      return;
    }

    const [openH, openM] = daySchedule.open.split(':').map(Number);
    const [closeH, closeM] = daySchedule.close.split(':').map(Number);
    const currentMinutes = localHour * 60 + localMinute;
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (currentMinutes < openMinutes) {
      // Before opening today
      this._applyOutsideHours(bh, 'before-open', localDay, daySchedule.open);
    } else if (currentMinutes >= closeMinutes) {
      // After closing today
      this._applyOutsideHours(bh, 'after-close', localDay);
    }
  }

  private _applyOutsideHours(
    bh: WidgetBusinessHoursConfig,
    reason: 'holiday' | 'closed-day' | 'before-open' | 'after-close' = 'closed-day',
    currentDay = 0,
    todayOpenTime?: string,
  ): void {
    const behavior = bh.outsideHoursBehavior ?? 'offline-message';

    switch (behavior) {
      case 'hide-widget':
        // Hide the entire widget
        this.style.display = 'none';
        break;

      case 'faq-only':
        // If we have a pre-chat flow with FAQ, show it; otherwise show offline
        if (this.flowManager.isFlowEnabled()) {
          this.currentView = 'flow';
          this.currentFlowStep = this.flowManager.getCurrentStep();
        } else {
          this._showOfflineFromBusinessHours(bh, reason, currentDay, todayOpenTime);
        }
        break;

      case 'offline-message':
      default:
        this._showOfflineFromBusinessHours(bh, reason, currentDay, todayOpenTime);
        break;
    }
  }

  private _showOfflineFromBusinessHours(
    bh: WidgetBusinessHoursConfig,
    reason: 'holiday' | 'closed-day' | 'before-open' | 'after-close' = 'closed-day',
    currentDay = 0,
    todayOpenTime?: string,
  ): void {
    // Calculate reopen message based on reason
    this.reopenMessage = this._calcReopenMessage(bh, reason, currentDay, todayOpenTime);

    const customMsg = bh.outsideHoursMessage;
    const defaultTitle = reason === 'holiday' ? 'We\'re closed today' : 'We\'re offline right now';
    const defaultMsg = reason === 'holiday'
      ? 'Our team is taking a day off.'
      : 'Our team is not available right now.';

    if (!this.offlineConfig) {
      this.offlineConfig = {
        mode: 'message',
        offlineMessage: customMsg ?? defaultMsg,
        offlineTitle: defaultTitle,
      };
    } else {
      this.offlineConfig = {
        ...this.offlineConfig,
        offlineTitle: this.offlineConfig.offlineTitle ?? defaultTitle,
        offlineMessage: customMsg ?? this.offlineConfig.offlineMessage ?? defaultMsg,
      };
    }
    this.currentView = 'offline';
  }

  /**
   * Calculate a friendly "Back at ..." or "Back on ..." message from the schedule.
   */
  private _calcReopenMessage(
    bh: WidgetBusinessHoursConfig,
    reason: string,
    currentDay: number,
    todayOpenTime?: string,
  ): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // If before opening today, we can show today's open time
    if (reason === 'before-open' && todayOpenTime) {
      return `Back at ${this._formatTime(todayOpenTime)}`;
    }

    // Find the next open day
    for (let offset = 1; offset <= 7; offset++) {
      const nextDay = (currentDay + offset) % 7;
      const sched = bh.schedule.find(s => s.day === nextDay);
      if (sched && sched.isOpen) {
        if (offset === 1) {
          return `Back tomorrow at ${this._formatTime(sched.open)}`;
        }
        return `Back on ${dayNames[nextDay]} at ${this._formatTime(sched.open)}`;
      }
    }

    return '';
  }

  private _formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  /**
   * Show the offline view programmatically (e.g. when server reports no agents available).
   */
  showOffline(): void {
    this.currentView = 'offline';
  }

  /**
   * Escalate the current session to a human agent.
   */
  escalate(reason?: string): void {
    this.socketManager?.sendEscalate(reason);
    this.fireEvent('chat:escalated', { sessionId: this.sessionId, reason });
  }
}

safeRegister('alx-chat-widget', AlxChatWidget);

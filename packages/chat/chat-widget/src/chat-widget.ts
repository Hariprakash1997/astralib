import { LitElement, html, css, nothing } from 'lit';
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
    `,
  ];

  // -- Config properties (settable via HTML attributes) --

  @property({ attribute: 'socket-url' }) socketUrl = '';
  @property() channel = '';
  @property({ reflect: true }) theme: 'light' | 'dark' = 'dark';
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property({ attribute: 'primary-color' }) primaryColor = '';

  // -- Internal state --

  @state() private isOpen = false;
  @state() private messages: ChatMessage[] = [];
  @state() private sessionId: string | null = null;
  @state() private agent: ChatAgentInfo | null = null;
  @state() private status: ChatSessionStatus = ChatSessionStatusEnum.New;
  @state() private isTyping = false;
  @state() private unreadCount = 0;
  @state() private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  @state() private currentView: 'flow' | 'chat' | 'feedback' | 'offline' = 'chat';
  @state() private currentFlowStep: FlowStep | null = null;

  // -- Config --

  private translations: ChatTranslations = { ...DEFAULT_TRANSLATIONS };
  private features = {
    soundNotifications: true,
    desktopNotifications: false,
    typingIndicator: true,
    readReceipts: true,
  };
  private userInfo: { userId?: string; name?: string; email?: string; avatar?: string } = {};
  private branding: { primaryColor?: string; companyName?: string; logoUrl?: string } = {};
  private offlineConfig: OfflineConfig | null = null;
  private postChatConfig: PostChatConfig | null = null;

  // -- Services --

  private socketManager: ChatSocketManager | null = null;
  private storageManager: ChatStorageManager | null = null;
  private notificationManager: ChatNotificationManager | null = null;
  private flowManager = new FlowManager();

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
  }

  connectedCallback() {
    super.connectedCallback();

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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.socketManager?.disconnect();
    this.notificationManager?.destroy();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  updated(changedProps: Map<string, unknown>) {
    // Apply primary color as CSS custom property
    if (changedProps.has('primaryColor') && this.primaryColor) {
      this.style.setProperty('--alx-chat-primary', this.primaryColor);
    }
  }

  render() {
    return html`
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
        @minimize=${this.handleToggle}
        @end-chat=${this.handleEndChat}
        @send=${this.handleSend}
        @typing=${this.handleLocalTyping}
      ></alx-chat-window>
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
        return html`
          <div .innerHTML=${step.html}></div>
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
        .formFields=${this.offlineConfig?.formFields ?? []}
        @offline-message-submitted=${this.handleOfflineMessage}
      ></alx-chat-offline>
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
    this.fireEvent('chat:feedback-submitted', e.detail);

    // Close widget after a short delay for thank-you message
    setTimeout(() => {
      this.isOpen = false;
      this.storageManager?.setWidgetOpen(false);
      this.currentView = 'chat';
    }, 2000);
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

      // If flow is enabled and not complete, show flow
      if (this.flowManager.isFlowEnabled() && !this.flowManager.isFlowComplete()) {
        this.currentView = 'flow';
        this.currentFlowStep = this.flowManager.getCurrentStep();
      } else if (this.currentView === 'chat') {
        // Connect if not already connected
        if (!this.socketManager?.isConnected && this.socketUrl) {
          this.initSocket();
        }
      }
    } else {
      this.fireEvent('chat:widget-closed');
    }
  };

  private handleSend = (e: CustomEvent<{ content: string }>) => {
    const { content } = e.detail;
    if (!content.trim()) return;

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

  private handleEndChat = () => {
    if (this.sessionId) {
      this.fireEvent('chat:session-ended', { sessionId: this.sessionId });
    }

    // Check if post-chat feedback is enabled
    if (this.postChatConfig?.enabled) {
      this.currentView = 'feedback';
      // Disconnect socket but keep widget open for feedback
      this.socketManager?.disconnect();
      this.connectionStatus = 'disconnected';
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

  private handleVisibilityChange = () => {
    if (!document.hidden) {
      this.notificationManager?.stopTitleFlash();
      if (this.isOpen) {
        this.unreadCount = 0;
      }
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
      onError: this.onSocketError,
      onConnectionChange: (status) => {
        this.connectionStatus = status;
      },
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
      this.messages = this.messages.map((m) =>
        m.messageId === tempId ? message : m,
      );
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

  private onSocketMessageStatus = (payload: MessageStatusPayload) => {
    this.messages = this.messages.map((m) =>
      m.messageId === payload.messageId
        ? { ...m, status: payload.status, deliveredAt: payload.deliveredAt, readAt: payload.readAt }
        : m,
    );
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
  };

  private onSocketAgentJoin = (agent: ChatAgentInfo) => {
    this.agent = agent;
  };

  private onSocketAgentLeave = () => {
    this.agent = null;
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

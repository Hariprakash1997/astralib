import type {
  PreChatFlowConfig,
  FlowStep,
  GuidedQuestion,
  GuidedOption,
  GuidedQuestionsStep,
} from '@astralibx/chat-types';

/**
 * Orchestrates the pre-chat flow: manages which step is active,
 * handles step transitions, branching, and data collection.
 */
export class FlowManager {
  private config: PreChatFlowConfig | null = null;
  private currentStepIndex = 0;
  private collectedData: Record<string, unknown> = {};
  private guidedAnswers: Record<string, string | string[]> = {};
  private flowComplete = false;
  private skippedToChat = false;

  configure(config: PreChatFlowConfig): void {
    this.config = config;
    this.currentStepIndex = 0;
    this.collectedData = {};
    this.guidedAnswers = {};
    this.flowComplete = false;
    this.skippedToChat = false;
  }

  getCurrentStep(): FlowStep | null {
    if (!this.config || this.flowComplete || this.skippedToChat) return null;
    const steps = this.config.steps;
    if (this.currentStepIndex >= steps.length) return null;
    return steps[this.currentStepIndex];
  }

  getStepCount(): number {
    return this.config?.steps.length ?? 0;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  isFlowComplete(): boolean {
    return this.flowComplete;
  }

  isFlowEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  canSkipToChat(): boolean {
    return this.config?.skipToChat ?? true;
  }

  // -- Step navigation --

  nextStep(): FlowStep | null {
    if (!this.config) return null;

    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex >= this.config.steps.length) {
      this.flowComplete = true;
      return null;
    }

    this.currentStepIndex = nextIndex;
    return this.config.steps[nextIndex];
  }

  previousStep(): FlowStep | null {
    if (!this.config || this.currentStepIndex <= 0) return null;
    this.currentStepIndex--;
    return this.config.steps[this.currentStepIndex];
  }

  skipToChat(): void {
    this.skippedToChat = true;
    this.flowComplete = true;
  }

  skipToStep(stepType: string): void {
    if (!this.config) return;

    if (stepType === 'chat') {
      this.skipToChat();
      return;
    }

    const index = this.config.steps.findIndex((s) => s.type === stepType);
    if (index !== -1) {
      this.currentStepIndex = index;
    }
  }

  // -- Data collection --

  setFormData(data: Record<string, unknown>): void {
    this.collectedData = { ...this.collectedData, ...data };
  }

  setGuidedAnswer(questionKey: string, value: string | string[]): void {
    this.guidedAnswers[questionKey] = value;
  }

  getCollectedPreferences(): Record<string, unknown> {
    return {
      ...this.collectedData,
      guidedAnswers: { ...this.guidedAnswers },
    };
  }

  // -- Guided question branching --

  getNextQuestion(currentKey: string, selectedOption: GuidedOption): GuidedQuestion | null {
    if (!this.config) return null;

    // Find the guided questions step
    const guidedStep = this.config.steps.find(
      (s): s is GuidedQuestionsStep => s.type === 'guided',
    );
    if (!guidedStep) return null;

    // If option specifies skipToStep, return null (caller handles step skip)
    if (selectedOption.skipToStep) return null;

    // If option specifies nextQuestion, find it by key
    if (selectedOption.nextQuestion) {
      return guidedStep.questions.find((q) => q.key === selectedOption.nextQuestion) ?? null;
    }

    // Default: next question in sequential order
    const currentIndex = guidedStep.questions.findIndex((q) => q.key === currentKey);
    if (currentIndex === -1 || currentIndex >= guidedStep.questions.length - 1) {
      return null;
    }

    return guidedStep.questions[currentIndex + 1];
  }

  // -- Completion --

  getCompletionAction(): 'chat' | 'close' | 'url' {
    return this.config?.completionAction ?? 'chat';
  }

  getCompletionUrl(): string | undefined {
    return this.config?.completionUrl;
  }

  reset(): void {
    this.currentStepIndex = 0;
    this.collectedData = {};
    this.guidedAnswers = {};
    this.flowComplete = false;
    this.skippedToChat = false;
  }
}

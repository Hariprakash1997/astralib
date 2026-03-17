export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'radio' | 'checkbox';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  validation?: FormFieldValidation;
}

export interface FormFieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  errorMessage?: string;
}

export interface PreChatFlowConfig {
  enabled: boolean;
  steps: FlowStep[];
  skipToChat?: boolean;
  completionAction: 'chat' | 'close' | 'url';
  completionUrl?: string;
}

export type FlowStep =
  | WelcomeStep
  | FAQStep
  | GuidedQuestionsStep
  | FormStep
  | AgentSelectorStep
  | CustomHTMLStep;

export interface WelcomeStep {
  type: 'welcome';
  title: string;
  subtitle?: string;
  agentAvatar?: string;
  agentName?: string;
  showOnlineStatus?: boolean;
  ctaText?: string;
}

export interface FAQStep {
  type: 'faq';
  title?: string;
  searchEnabled?: boolean;
  categories?: FAQCategory[];
  items: FAQItem[];
  feedbackEnabled?: boolean;
  showChatPrompt?: boolean;
  chatPromptText?: string;
}

export interface FAQCategory {
  key: string;
  label: string;
  icon?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  order?: number;
}

export interface GuidedQuestionsStep {
  type: 'guided';
  questions: GuidedQuestion[];
  mode: 'sequential' | 'conversational';
  typingDelayMs?: number;
}

export interface GuidedQuestion {
  key: string;
  text: string;
  options: GuidedOption[];
  allowFreeText?: boolean;
  multiSelect?: boolean;
}

export interface GuidedOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  nextQuestion?: string;
  skipToStep?: string;
  metadata?: Record<string, unknown>;
}

export interface FormStep {
  type: 'form';
  title?: string;
  fields: FormField[];
  submitText?: string;
}

export interface AgentSelectorStep {
  type: 'agent-selector';
  title?: string;
  showAvailability?: boolean;
  showSpecialty?: boolean;
  autoAssign?: boolean;
  autoAssignText?: string;
}

export interface CustomHTMLStep {
  type: 'custom';
  html: string;
  ctaText?: string;
}

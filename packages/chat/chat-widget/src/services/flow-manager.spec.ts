import { describe, it, expect, beforeEach } from 'vitest';
import { FlowManager } from './flow-manager.js';
import type {
  PreChatFlowConfig,
  GuidedOption,
} from '@astralibx/chat-types';

const basicConfig: PreChatFlowConfig = {
  enabled: true,
  steps: [
    { type: 'welcome', title: 'Hello' },
    { type: 'faq', items: [{ question: 'Q1', answer: 'A1' }] },
    { type: 'form', fields: [{ key: 'name', label: 'Name', type: 'text', required: true }] },
  ],
  completionAction: 'chat',
};

const guidedConfig: PreChatFlowConfig = {
  enabled: true,
  steps: [
    {
      type: 'guided',
      mode: 'sequential' as const,
      questions: [
        {
          key: 'topic',
          text: 'What brings you here?',
          options: [
            { value: 'billing', label: 'Billing', nextQuestion: 'billing-detail' },
            { value: 'technical', label: 'Technical', skipToStep: 'chat' },
            { value: 'general', label: 'General' },
          ],
        },
        {
          key: 'billing-detail',
          text: 'Which billing issue?',
          options: [
            { value: 'refund', label: 'Refund' },
            { value: 'invoice', label: 'Invoice' },
          ],
        },
        {
          key: 'priority',
          text: 'How urgent?',
          options: [
            { value: 'high', label: 'High' },
            { value: 'low', label: 'Low' },
          ],
        },
      ],
    },
  ],
  completionAction: 'chat',
};

describe('FlowManager', () => {
  let fm: FlowManager;

  beforeEach(() => {
    fm = new FlowManager();
  });

  describe('unconfigured state', () => {
    it('returns null for current step when not configured', () => {
      expect(fm.getCurrentStep()).toBeNull();
    });

    it('reports flow as disabled', () => {
      expect(fm.isFlowEnabled()).toBe(false);
    });

    it('reports flow as not complete', () => {
      expect(fm.isFlowComplete()).toBe(false);
    });

    it('returns 0 step count', () => {
      expect(fm.getStepCount()).toBe(0);
    });
  });

  describe('basic flow navigation', () => {
    beforeEach(() => {
      fm.configure(basicConfig);
    });

    it('reports flow as enabled', () => {
      expect(fm.isFlowEnabled()).toBe(true);
    });

    it('starts at step 0', () => {
      expect(fm.getCurrentStepIndex()).toBe(0);
      expect(fm.getCurrentStep()?.type).toBe('welcome');
    });

    it('returns correct step count', () => {
      expect(fm.getStepCount()).toBe(3);
    });

    it('advances to next step', () => {
      const next = fm.nextStep();
      expect(next?.type).toBe('faq');
      expect(fm.getCurrentStepIndex()).toBe(1);
    });

    it('advances through all steps then completes', () => {
      fm.nextStep(); // welcome -> faq
      fm.nextStep(); // faq -> form
      const last = fm.nextStep(); // form -> complete

      expect(last).toBeNull();
      expect(fm.isFlowComplete()).toBe(true);
      expect(fm.getCurrentStep()).toBeNull();
    });

    it('goes back to previous step', () => {
      fm.nextStep(); // at faq
      const prev = fm.previousStep();
      expect(prev?.type).toBe('welcome');
      expect(fm.getCurrentStepIndex()).toBe(0);
    });

    it('returns null when going back from first step', () => {
      const prev = fm.previousStep();
      expect(prev).toBeNull();
      expect(fm.getCurrentStepIndex()).toBe(0);
    });
  });

  describe('skip to chat', () => {
    beforeEach(() => {
      fm.configure(basicConfig);
    });

    it('reports canSkipToChat based on config', () => {
      expect(fm.canSkipToChat()).toBe(true);
    });

    it('marks flow complete when skipping to chat', () => {
      fm.skipToChat();
      expect(fm.isFlowComplete()).toBe(true);
      expect(fm.getCurrentStep()).toBeNull();
    });

    it('reports canSkipToChat as false when config says so', () => {
      fm.configure({ ...basicConfig, skipToChat: false });
      expect(fm.canSkipToChat()).toBe(false);
    });
  });

  describe('skip to step', () => {
    beforeEach(() => {
      fm.configure(basicConfig);
    });

    it('jumps to a specific step by type', () => {
      fm.skipToStep('form');
      expect(fm.getCurrentStep()?.type).toBe('form');
      expect(fm.getCurrentStepIndex()).toBe(2);
    });

    it('skips to chat when stepType is "chat"', () => {
      fm.skipToStep('chat');
      expect(fm.isFlowComplete()).toBe(true);
    });

    it('does nothing for unknown step type', () => {
      fm.skipToStep('nonexistent');
      expect(fm.getCurrentStepIndex()).toBe(0);
    });
  });

  describe('data collection', () => {
    beforeEach(() => {
      fm.configure(basicConfig);
    });

    it('collects form data', () => {
      fm.setFormData({ name: 'Alice', email: 'alice@test.com' });
      const prefs = fm.getCollectedPreferences();
      expect(prefs.name).toBe('Alice');
      expect(prefs.email).toBe('alice@test.com');
    });

    it('merges form data across calls', () => {
      fm.setFormData({ name: 'Alice' });
      fm.setFormData({ email: 'alice@test.com' });
      const prefs = fm.getCollectedPreferences();
      expect(prefs.name).toBe('Alice');
      expect(prefs.email).toBe('alice@test.com');
    });

    it('collects guided answers', () => {
      fm.setGuidedAnswer('topic', 'billing');
      fm.setGuidedAnswer('priority', 'high');
      const prefs = fm.getCollectedPreferences();
      expect((prefs.guidedAnswers as Record<string, unknown>).topic).toBe('billing');
      expect((prefs.guidedAnswers as Record<string, unknown>).priority).toBe('high');
    });

    it('supports array values for multi-select guided answers', () => {
      fm.setGuidedAnswer('interests', ['billing', 'support']);
      const prefs = fm.getCollectedPreferences();
      expect((prefs.guidedAnswers as Record<string, unknown>).interests).toEqual(['billing', 'support']);
    });
  });

  describe('guided question branching', () => {
    beforeEach(() => {
      fm.configure(guidedConfig);
    });

    it('follows nextQuestion to branch to specific question', () => {
      const billingOption: GuidedOption = {
        value: 'billing',
        label: 'Billing',
        nextQuestion: 'billing-detail',
      };

      const next = fm.getNextQuestion('topic', billingOption);
      expect(next?.key).toBe('billing-detail');
    });

    it('returns null when option has skipToStep', () => {
      const techOption: GuidedOption = {
        value: 'technical',
        label: 'Technical',
        skipToStep: 'chat',
      };

      const next = fm.getNextQuestion('topic', techOption);
      expect(next).toBeNull();
    });

    it('falls back to sequential order when no branching', () => {
      const generalOption: GuidedOption = {
        value: 'general',
        label: 'General',
      };

      const next = fm.getNextQuestion('topic', generalOption);
      expect(next?.key).toBe('billing-detail');
    });

    it('returns null when at last question with no branching', () => {
      const option: GuidedOption = { value: 'high', label: 'High' };
      const next = fm.getNextQuestion('priority', option);
      expect(next).toBeNull();
    });

    it('returns null when question key is not found', () => {
      const option: GuidedOption = { value: 'x', label: 'X' };
      const next = fm.getNextQuestion('nonexistent', option);
      expect(next).toBeNull();
    });
  });

  describe('completion actions', () => {
    it('returns "chat" completion action by default', () => {
      fm.configure(basicConfig);
      expect(fm.getCompletionAction()).toBe('chat');
    });

    it('returns configured completion action', () => {
      fm.configure({ ...basicConfig, completionAction: 'close' });
      expect(fm.getCompletionAction()).toBe('close');
    });

    it('returns completion URL when configured', () => {
      fm.configure({
        ...basicConfig,
        completionAction: 'url',
        completionUrl: 'https://example.com/help',
      });
      expect(fm.getCompletionAction()).toBe('url');
      expect(fm.getCompletionUrl()).toBe('https://example.com/help');
    });

    it('returns undefined completion URL when not configured', () => {
      fm.configure(basicConfig);
      expect(fm.getCompletionUrl()).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('resets flow to initial state', () => {
      fm.configure(basicConfig);
      fm.nextStep();
      fm.nextStep();
      fm.setFormData({ name: 'Alice' });
      fm.setGuidedAnswer('topic', 'billing');

      fm.reset();

      expect(fm.getCurrentStepIndex()).toBe(0);
      expect(fm.getCurrentStep()?.type).toBe('welcome');
      expect(fm.isFlowComplete()).toBe(false);
      expect(fm.getCollectedPreferences()).toEqual({
        guidedAnswers: {},
      });
    });

    it('resets after skip to chat', () => {
      fm.configure(basicConfig);
      fm.skipToChat();
      expect(fm.isFlowComplete()).toBe(true);

      fm.reset();
      expect(fm.isFlowComplete()).toBe(false);
      expect(fm.getCurrentStep()?.type).toBe('welcome');
    });
  });

  describe('edge cases', () => {
    it('handles empty steps array', () => {
      fm.configure({ ...basicConfig, steps: [] });
      expect(fm.getCurrentStep()).toBeNull();
      expect(fm.getStepCount()).toBe(0);
    });

    it('handles disabled flow', () => {
      fm.configure({ ...basicConfig, enabled: false });
      expect(fm.isFlowEnabled()).toBe(false);
      expect(fm.getCurrentStep()?.type).toBe('welcome');
    });

    it('configure resets previous state', () => {
      fm.configure(basicConfig);
      fm.nextStep();
      fm.setFormData({ name: 'Alice' });

      fm.configure({ ...basicConfig, steps: [{ type: 'welcome', title: 'New' }] });
      expect(fm.getCurrentStepIndex()).toBe(0);
      expect(fm.getCollectedPreferences()).toEqual({ guidedAnswers: {} });
    });

    it('nextStep returns null when not configured', () => {
      expect(fm.nextStep()).toBeNull();
    });

    it('getNextQuestion returns null when no guided step exists', () => {
      fm.configure(basicConfig); // no guided step
      const option: GuidedOption = { value: 'x', label: 'X' };
      expect(fm.getNextQuestion('key', option)).toBeNull();
    });
  });
});

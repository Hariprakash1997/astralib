import { describe, it, expect } from 'vitest';
import { resolveAiMode, resolveAiCharacter } from '../utils/ai-resolver';
import { AI_MODE } from '../constants';
import type { IAiCharacterProfile } from '../schemas/chat-settings.schema';

const mockCharacter: IAiCharacterProfile = {
  name: 'Aria',
  tone: 'friendly',
  personality: 'helpful assistant',
  rules: ['Be concise'],
  responseStyle: 'conversational',
};

describe('resolveAiMode()', () => {
  it('should return manual when global mode is manual regardless of agent', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.Manual },
      { modeOverride: 'ai' },
    );
    expect(result).toBe('manual');
  });

  it('should return ai when global mode is ai regardless of agent', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.AI },
      { modeOverride: 'manual' },
    );
    expect(result).toBe('ai');
  });

  it('should return ai when global is ai and agent is null', () => {
    const result = resolveAiMode({ aiMode: AI_MODE.AI }, null);
    expect(result).toBe('ai');
  });

  it('should defer to agent override when global is agent-wise and agent has ai', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.AgentWise },
      { modeOverride: 'ai' },
    );
    expect(result).toBe('ai');
  });

  it('should defer to agent override when global is agent-wise and agent has manual', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.AgentWise },
      { modeOverride: 'manual' },
    );
    expect(result).toBe('manual');
  });

  it('should default to manual when global is agent-wise and agent has no override', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.AgentWise },
      { modeOverride: null },
    );
    expect(result).toBe('manual');
  });

  it('should default to manual when global is agent-wise and agent is null', () => {
    const result = resolveAiMode(
      { aiMode: AI_MODE.AgentWise },
      null,
    );
    expect(result).toBe('manual');
  });

  it('should default to agent-wise when aiMode is undefined on settings', () => {
    const result = resolveAiMode(
      { aiMode: undefined as any },
      { modeOverride: 'ai' },
    );
    expect(result).toBe('ai');
  });
});

describe('resolveAiCharacter()', () => {
  it('should return agent-level character when set', () => {
    const agentCharacter: IAiCharacterProfile = {
      name: 'Custom',
      tone: 'professional',
      personality: 'expert',
      rules: [],
      responseStyle: 'formal',
    };

    const result = resolveAiCharacter(
      { aiCharacter: { globalCharacter: mockCharacter } },
      { aiCharacter: agentCharacter },
    );
    expect(result).toBe(agentCharacter);
  });

  it('should fall back to global character when agent has no override', () => {
    const result = resolveAiCharacter(
      { aiCharacter: { globalCharacter: mockCharacter } },
      { aiCharacter: null },
    );
    expect(result).toBe(mockCharacter);
  });

  it('should fall back to global character when agent is null', () => {
    const result = resolveAiCharacter(
      { aiCharacter: { globalCharacter: mockCharacter } },
      null,
    );
    expect(result).toBe(mockCharacter);
  });

  it('should fall back to global character when agent is undefined', () => {
    const result = resolveAiCharacter(
      { aiCharacter: { globalCharacter: mockCharacter } },
    );
    expect(result).toBe(mockCharacter);
  });

  it('should return null when neither agent nor global character is set', () => {
    const result = resolveAiCharacter(
      { aiCharacter: { globalCharacter: null } },
      { aiCharacter: null },
    );
    expect(result).toBeNull();
  });

  it('should return null when aiCharacter config is missing globalCharacter', () => {
    const result = resolveAiCharacter(
      { aiCharacter: undefined as any },
      null,
    );
    expect(result).toBeNull();
  });
});

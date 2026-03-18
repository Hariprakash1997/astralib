import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveMode,
  resolveAiEnabled,
  isTypingThrottled,
  clearTypingThrottle,
  clearAllTypingThrottles,
} from '../gateway/helpers';
import { SessionMode } from '@astralibx/chat-types';

describe('resolveMode()', () => {
  it('should use agent modeOverride when set', () => {
    const result = resolveMode(
      { modeOverride: SessionMode.AI },
      { defaultSessionMode: SessionMode.Manual },
    );
    expect(result).toBe(SessionMode.AI);
  });

  it('should fall back to global defaultSessionMode when agent modeOverride is null', () => {
    const result = resolveMode(
      { modeOverride: null },
      { defaultSessionMode: SessionMode.AI },
    );
    expect(result).toBe(SessionMode.AI);
  });

  it('should fall back to global defaultSessionMode when agent modeOverride is undefined', () => {
    const result = resolveMode(
      { modeOverride: undefined },
      { defaultSessionMode: SessionMode.AI },
    );
    expect(result).toBe(SessionMode.AI);
  });

  it('should fall back to global defaultSessionMode when agent is null', () => {
    const result = resolveMode(null, { defaultSessionMode: SessionMode.AI });
    expect(result).toBe(SessionMode.AI);
  });

  it('should fall back to global defaultSessionMode when agent is undefined', () => {
    const result = resolveMode(undefined, { defaultSessionMode: SessionMode.AI });
    expect(result).toBe(SessionMode.AI);
  });

  it('should default to Manual when both agent and global are missing', () => {
    const result = resolveMode(null, {});
    expect(result).toBe(SessionMode.Manual);
  });

  it('should default to Manual when globalSettings.defaultSessionMode is undefined', () => {
    const result = resolveMode(undefined, { defaultSessionMode: undefined });
    expect(result).toBe(SessionMode.Manual);
  });
});

describe('resolveAiEnabled()', () => {
  it('should use agent aiEnabled when explicitly true', () => {
    const result = resolveAiEnabled(
      { aiEnabled: true },
      { aiEnabled: false },
    );
    expect(result).toBe(true);
  });

  it('should use agent aiEnabled when explicitly false', () => {
    const result = resolveAiEnabled(
      { aiEnabled: false },
      { aiEnabled: true },
    );
    expect(result).toBe(false);
  });

  it('should fall back to global when agent aiEnabled is null', () => {
    const result = resolveAiEnabled(
      { aiEnabled: null },
      { aiEnabled: true },
    );
    expect(result).toBe(true);
  });

  it('should fall back to global when agent aiEnabled is undefined', () => {
    const result = resolveAiEnabled(
      { aiEnabled: undefined },
      { aiEnabled: true },
    );
    expect(result).toBe(true);
  });

  it('should fall back to global when agent is null', () => {
    const result = resolveAiEnabled(null, { aiEnabled: true });
    expect(result).toBe(true);
  });

  it('should fall back to global when agent is undefined', () => {
    const result = resolveAiEnabled(undefined, { aiEnabled: true });
    expect(result).toBe(true);
  });

  it('should default to false when both agent and global are missing', () => {
    const result = resolveAiEnabled(null, {});
    expect(result).toBe(false);
  });

  it('should default to false when globalSettings.aiEnabled is undefined', () => {
    const result = resolveAiEnabled(undefined, { aiEnabled: undefined });
    expect(result).toBe(false);
  });
});

describe('isTypingThrottled()', () => {
  beforeEach(() => {
    clearAllTypingThrottles();
  });

  it('should return false on first call (not throttled)', () => {
    expect(isTypingThrottled('sess-1')).toBe(false);
  });

  it('should return true on second call within interval (throttled)', () => {
    isTypingThrottled('sess-1');
    expect(isTypingThrottled('sess-1')).toBe(true);
  });

  it('should return false for different session IDs', () => {
    isTypingThrottled('sess-1');
    expect(isTypingThrottled('sess-2')).toBe(false);
  });

  it('should return false after interval has passed', () => {
    vi.useFakeTimers();
    try {
      isTypingThrottled('sess-1', 2000);
      vi.advanceTimersByTime(2001);
      expect(isTypingThrottled('sess-1', 2000)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should respect custom interval', () => {
    isTypingThrottled('sess-1', 500);
    expect(isTypingThrottled('sess-1', 500)).toBe(true);
  });
});

describe('clearTypingThrottle()', () => {
  beforeEach(() => {
    clearAllTypingThrottles();
  });

  it('should remove the throttle entry so next call is not throttled', () => {
    isTypingThrottled('sess-1');
    expect(isTypingThrottled('sess-1')).toBe(true);
    clearTypingThrottle('sess-1');
    expect(isTypingThrottled('sess-1')).toBe(false);
  });

  it('should not affect other sessions', () => {
    isTypingThrottled('sess-1');
    isTypingThrottled('sess-2');
    clearTypingThrottle('sess-1');
    expect(isTypingThrottled('sess-2')).toBe(true);
  });
});

describe('clearAllTypingThrottles()', () => {
  it('should clear all throttle entries', () => {
    isTypingThrottled('sess-1');
    isTypingThrottled('sess-2');
    clearAllTypingThrottles();
    expect(isTypingThrottled('sess-1')).toBe(false);
    expect(isTypingThrottled('sess-2')).toBe(false);
  });
});

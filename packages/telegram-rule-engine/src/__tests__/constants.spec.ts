import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS,
  DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL,
  DEFAULT_THROTTLE_CONFIG,
  REDIS_KEY_PREFIX,
  RUN_PROGRESS_TTL_SECONDS,
  MESSAGE_PREVIEW_LENGTH,
} from '../constants';

describe('Constants', () => {
  describe('DEFAULT_LOCK_TTL_MS', () => {
    it('is 1,800,000 (30 minutes)', () => {
      expect(DEFAULT_LOCK_TTL_MS).toBe(1_800_000);
    });

    it('is a number', () => {
      expect(typeof DEFAULT_LOCK_TTL_MS).toBe('number');
    });
  });

  describe('DEFAULT_MAX_PER_RUN', () => {
    it('is 100', () => {
      expect(DEFAULT_MAX_PER_RUN).toBe(100);
    });
  });

  describe('DEFAULT_DELAY_BETWEEN_SENDS_MS', () => {
    it('is 3,000 (3 seconds)', () => {
      expect(DEFAULT_DELAY_BETWEEN_SENDS_MS).toBe(3_000);
    });
  });

  describe('DEFAULT_JITTER_MS', () => {
    it('is 1,500', () => {
      expect(DEFAULT_JITTER_MS).toBe(1_500);
    });
  });

  describe('DEFAULT_MAX_CONSECUTIVE_FAILURES', () => {
    it('is 3', () => {
      expect(DEFAULT_MAX_CONSECUTIVE_FAILURES).toBe(3);
    });
  });

  describe('DEFAULT_THINKING_PAUSE_PROBABILITY', () => {
    it('is 0.25', () => {
      expect(DEFAULT_THINKING_PAUSE_PROBABILITY).toBe(0.25);
    });

    it('is between 0 and 1', () => {
      expect(DEFAULT_THINKING_PAUSE_PROBABILITY).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_THINKING_PAUSE_PROBABILITY).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_BATCH_PROGRESS_INTERVAL', () => {
    it('is 10', () => {
      expect(DEFAULT_BATCH_PROGRESS_INTERVAL).toBe(10);
    });
  });

  describe('DEFAULT_THROTTLE_CONFIG', () => {
    it('has correct structure', () => {
      expect(DEFAULT_THROTTLE_CONFIG).toEqual({
        maxPerUserPerDay: 1,
        maxPerUserPerWeek: 2,
        minGapDays: 3,
        throttleWindow: 'rolling',
      });
    });

    it('maxPerUserPerDay is 1', () => {
      expect(DEFAULT_THROTTLE_CONFIG.maxPerUserPerDay).toBe(1);
    });

    it('maxPerUserPerWeek is 2', () => {
      expect(DEFAULT_THROTTLE_CONFIG.maxPerUserPerWeek).toBe(2);
    });

    it('minGapDays is 3', () => {
      expect(DEFAULT_THROTTLE_CONFIG.minGapDays).toBe(3);
    });

    it('throttleWindow is rolling', () => {
      expect(DEFAULT_THROTTLE_CONFIG.throttleWindow).toBe('rolling');
    });

    it('has exactly 4 keys', () => {
      expect(Object.keys(DEFAULT_THROTTLE_CONFIG)).toHaveLength(4);
    });
  });

  describe('REDIS_KEY_PREFIX', () => {
    it('is "tg-rule-engine"', () => {
      expect(REDIS_KEY_PREFIX).toBe('tg-rule-engine');
    });

    it('is a string', () => {
      expect(typeof REDIS_KEY_PREFIX).toBe('string');
    });
  });

  describe('RUN_PROGRESS_TTL_SECONDS', () => {
    it('is 3600 (1 hour)', () => {
      expect(RUN_PROGRESS_TTL_SECONDS).toBe(3600);
    });
  });

  describe('MESSAGE_PREVIEW_LENGTH', () => {
    it('is 200', () => {
      expect(MESSAGE_PREVIEW_LENGTH).toBe(200);
    });
  });

  describe('all constants are positive numbers where applicable', () => {
    it('all numeric defaults are positive', () => {
      expect(DEFAULT_LOCK_TTL_MS).toBeGreaterThan(0);
      expect(DEFAULT_MAX_PER_RUN).toBeGreaterThan(0);
      expect(DEFAULT_DELAY_BETWEEN_SENDS_MS).toBeGreaterThan(0);
      expect(DEFAULT_JITTER_MS).toBeGreaterThan(0);
      expect(DEFAULT_MAX_CONSECUTIVE_FAILURES).toBeGreaterThan(0);
      expect(DEFAULT_BATCH_PROGRESS_INTERVAL).toBeGreaterThan(0);
      expect(RUN_PROGRESS_TTL_SECONDS).toBeGreaterThan(0);
      expect(MESSAGE_PREVIEW_LENGTH).toBeGreaterThan(0);
    });
  });
});

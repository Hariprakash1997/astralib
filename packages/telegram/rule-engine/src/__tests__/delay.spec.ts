import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDelay, isWithinSendWindow, getHumanDelay, getHealthAdjustedDelay } from '../utils/delay';

describe('delay utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateDelay', () => {
    it('returns a value when given base and jitter', () => {
      const result = calculateDelay(3000, 1500);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('returns value within expected range (base +/- jitter)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = calculateDelay(3000, 1500);
      // When random = 0.5: jitter = (0.5 - 0.5) * 2 * 1500 = 0
      expect(result).toBe(3000);
    });

    it('returns base - jitter at minimum random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = calculateDelay(3000, 1500);
      // When random = 0: jitter = (0 - 0.5) * 2 * 1500 = -1500
      expect(result).toBe(1500);
    });

    it('returns base + jitter at maximum random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const result = calculateDelay(3000, 1500);
      // When random = 1: jitter = (1 - 0.5) * 2 * 1500 = 1500
      expect(result).toBe(4500);
    });

    it('never returns negative values', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      // With base=100 and jitter=500, raw would be -400 but Math.max(0,...) clamps
      const result = calculateDelay(100, 500);
      expect(result).toBe(0);
    });

    it('returns 0 when base and jitter are 0', () => {
      const result = calculateDelay(0, 0);
      expect(result).toBe(0);
    });
  });

  describe('isWithinSendWindow', () => {
    it('returns true when current hour is within window (uses Intl.DateTimeFormat)', () => {
      // Mock the formatter to return a known hour
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const instance = new originalDateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'UTC',
        });
        return {
          ...instance,
          format: () => '14', // 2 PM
        } as any;
      });

      const result = isWithinSendWindow({
        startHour: 9,
        endHour: 18,
        timezone: 'UTC',
      });
      expect(result).toBe(true);
    });

    it('returns false when current hour is outside window', () => {
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const instance = new originalDateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'UTC',
        });
        return {
          ...instance,
          format: () => '22', // 10 PM
        } as any;
      });

      const result = isWithinSendWindow({
        startHour: 9,
        endHour: 18,
        timezone: 'UTC',
      });
      expect(result).toBe(false);
    });

    it('handles midnight-wrapping windows (e.g., 22-6)', () => {
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const instance = new originalDateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'UTC',
        });
        return {
          ...instance,
          format: () => '23', // 11 PM — within 22-6 wrap
        } as any;
      });

      const result = isWithinSendWindow({
        startHour: 22,
        endHour: 6,
        timezone: 'UTC',
      });
      expect(result).toBe(true);
    });

    it('returns true for early morning in midnight-wrapping window', () => {
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const instance = new originalDateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'UTC',
        });
        return {
          ...instance,
          format: () => '3', // 3 AM — within 22-6 wrap
        } as any;
      });

      const result = isWithinSendWindow({
        startHour: 22,
        endHour: 6,
        timezone: 'UTC',
      });
      expect(result).toBe(true);
    });

    it('returns false when hour is outside midnight-wrapping window', () => {
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const instance = new originalDateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'UTC',
        });
        return {
          ...instance,
          format: () => '14', // 2 PM — outside 22-6 wrap
        } as any;
      });

      const result = isWithinSendWindow({
        startHour: 22,
        endHour: 6,
        timezone: 'UTC',
      });
      expect(result).toBe(false);
    });

    it('uses Intl.DateTimeFormat for timezone conversion (no manual offset math)', () => {
      const spy = vi.spyOn(Intl, 'DateTimeFormat');

      isWithinSendWindow({
        startHour: 9,
        endHour: 18,
        timezone: 'Asia/Kolkata',
      });

      expect(spy).toHaveBeenCalledWith('en-US', expect.objectContaining({
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      }));
    });
  });

  describe('getHumanDelay', () => {
    it('returns base delay without thinking pause when random >= probability', () => {
      const randomMock = vi.spyOn(Math, 'random');
      // First call: calculateDelay jitter (random=0.5 means no jitter)
      // Second call: thinking pause check (random=0.5 >= 0.25 so no pause)
      randomMock
        .mockReturnValueOnce(0.5) // for calculateDelay
        .mockReturnValueOnce(0.5); // for thinking pause check (>= 0.25, no pause)

      const result = getHumanDelay(3000, 0, 0.25);
      expect(result).toBe(3000);
    });

    it('adds thinking pause when random < probability', () => {
      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)  // calculateDelay: jitter = 0
        .mockReturnValueOnce(0.1)  // thinking pause check: 0.1 < 0.25, triggers pause
        .mockReturnValueOnce(0.5); // pause multiplier: 2 + 0.5 * 2 = 3

      const result = getHumanDelay(3000, 0, 0.25);
      // delay = 3000, pause = 3000 * 3 = 9000, total = 12000
      expect(result).toBe(12000);
    });

    it('returns rounded value', () => {
      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.3) // calculateDelay jitter
        .mockReturnValueOnce(0.9); // no thinking pause

      const result = getHumanDelay(3000, 1500, 0.25);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('with probability 0 never adds thinking pause', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = getHumanDelay(3000, 0, 0);
      expect(result).toBe(3000);
    });

    it('with probability 1 always adds thinking pause', () => {
      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5) // calculateDelay
        .mockReturnValueOnce(0.5) // thinking pause check: 0.5 < 1.0, triggers
        .mockReturnValueOnce(0.0); // pause multiplier: 2 + 0 * 2 = 2

      const result = getHumanDelay(3000, 0, 1);
      // delay = 3000, pause = 3000 * 2 = 6000, total = 9000
      expect(result).toBe(9000);
    });
  });

  describe('getHealthAdjustedDelay', () => {
    it('returns base delay when health is 100', () => {
      const result = getHealthAdjustedDelay(3000, 100);
      // factor = 1 + (3 * (1 - 100/100)) = 1 + 0 = 1
      expect(result).toBe(3000);
    });

    it('returns 4x delay when health is 0', () => {
      const result = getHealthAdjustedDelay(3000, 0);
      // factor = 1 + (3 * (1 - 0/100)) = 1 + 3 = 4
      expect(result).toBe(12000);
    });

    it('returns ~2.5x delay when health is 50', () => {
      const result = getHealthAdjustedDelay(3000, 50);
      // factor = 1 + (3 * (1 - 50/100)) = 1 + 1.5 = 2.5
      expect(result).toBe(7500);
    });

    it('clamps health score below 0 to 0', () => {
      const result = getHealthAdjustedDelay(3000, -50);
      // Math.max(0, -50) = 0, factor = 1 + 3 = 4
      expect(result).toBe(12000);
    });

    it('clamps health score above 100 to 100', () => {
      const result = getHealthAdjustedDelay(3000, 150);
      // Math.min(100, 150) = 100, factor = 1
      expect(result).toBe(3000);
    });

    it('uses custom multiplier', () => {
      const result = getHealthAdjustedDelay(3000, 0, 5);
      // factor = 1 + (5 * 1) = 6
      expect(result).toBe(18000);
    });

    it('returns rounded value', () => {
      const result = getHealthAdjustedDelay(1000, 33);
      // factor = 1 + (3 * (1 - 33/100)) = 1 + 3 * 0.67 = 1 + 2.01 = 3.01
      expect(Number.isInteger(result)).toBe(true);
    });

    it('returns 0 when base is 0', () => {
      const result = getHealthAdjustedDelay(0, 50);
      expect(result).toBe(0);
    });
  });
});

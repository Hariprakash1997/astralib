import { describe, it, expect } from 'vitest';
import {
  randomBetween,
  calculateDeliveryDelay,
  calculateReadDelay,
  calculatePreTypingDelay,
  calculateBubbleDelay,
} from '../gateway/ai-debounce';

describe('AI simulation delay functions', () => {
  describe('randomBetween()', () => {
    it('should return a value within the range', () => {
      for (let i = 0; i < 50; i++) {
        const result = randomBetween(10, 20);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it('should return exact value when min equals max', () => {
      expect(randomBetween(5, 5)).toBe(5);
    });
  });

  describe('calculateDeliveryDelay()', () => {
    it('should use defaults when no config provided', () => {
      const delay = calculateDeliveryDelay({});
      expect(delay).toBeGreaterThanOrEqual(300);
      expect(delay).toBeLessThanOrEqual(1000);
    });

    it('should use custom config', () => {
      const delay = calculateDeliveryDelay({ deliveryDelay: { min: 100, max: 200 } });
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    });
  });

  describe('calculateReadDelay()', () => {
    it('should use defaults when no config provided', () => {
      const delay = calculateReadDelay({}, 100);
      expect(delay).toBeGreaterThan(0);
    });

    it('should scale with message length', () => {
      // Short messages should generally produce shorter delays than long ones
      // Due to randomness we test the scaling factor logic directly
      const shortDelay = calculateReadDelay({ readDelay: { min: 1000, max: 1000 } }, 10);
      const longDelay = calculateReadDelay({ readDelay: { min: 1000, max: 1000 } }, 300);
      // With fixed base (1000), short message scale = min(10/200, 1.5) = 0.05 -> 1000 * (0.5 + 0.05*0.5) = 525
      // Long message scale = min(300/200, 1.5) = 1.5 -> 1000 * (0.5 + 1.5*0.5) = 1250
      expect(shortDelay).toBeLessThan(longDelay);
    });

    it('should cap scale at 1.5x', () => {
      const delay = calculateReadDelay({ readDelay: { min: 1000, max: 1000 } }, 10000);
      // scale = min(10000/200, 1.5) = 1.5 -> 1000 * (0.5 + 1.5*0.5) = 1250
      expect(delay).toBe(1250);
    });
  });

  describe('calculatePreTypingDelay()', () => {
    it('should use defaults when no config provided', () => {
      const delay = calculatePreTypingDelay({});
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1500);
    });

    it('should use custom config', () => {
      const delay = calculatePreTypingDelay({ preTypingDelay: { min: 200, max: 300 } });
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(300);
    });
  });

  describe('calculateBubbleDelay()', () => {
    it('should use defaults when no config provided', () => {
      const delay = calculateBubbleDelay({}, 50);
      expect(delay).toBeGreaterThan(0);
    });

    it('should scale with response length', () => {
      const shortDelay = calculateBubbleDelay({ bubbleDelay: { min: 1000, max: 1000 } }, 10);
      const longDelay = calculateBubbleDelay({ bubbleDelay: { min: 1000, max: 1000 } }, 200);
      expect(shortDelay).toBeLessThan(longDelay);
    });
  });
});

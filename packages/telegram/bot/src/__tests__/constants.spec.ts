import { describe, it, expect } from 'vitest';
import { CONTACT_STATUS, BOT_MODE, DEFAULT_WEBHOOK_PATH } from '../constants';

describe('Constants', () => {
  describe('CONTACT_STATUS', () => {
    it('has all expected values', () => {
      expect(CONTACT_STATUS.Active).toBe('active');
      expect(CONTACT_STATUS.Blocked).toBe('blocked');
      expect(CONTACT_STATUS.Stopped).toBe('stopped');
    });

    it('has exactly 3 entries', () => {
      expect(Object.keys(CONTACT_STATUS)).toHaveLength(3);
    });

    it('all values are unique', () => {
      const values = Object.values(CONTACT_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof CONTACT_STATUS.Active).toBe('string');
      expect(typeof CONTACT_STATUS.Blocked).toBe('string');
      expect(typeof CONTACT_STATUS.Stopped).toBe('string');
    });
  });

  describe('BOT_MODE', () => {
    it('has all expected values', () => {
      expect(BOT_MODE.Polling).toBe('polling');
      expect(BOT_MODE.Webhook).toBe('webhook');
    });

    it('has exactly 2 entries', () => {
      expect(Object.keys(BOT_MODE)).toHaveLength(2);
    });

    it('all values are unique', () => {
      const values = Object.values(BOT_MODE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof BOT_MODE.Polling).toBe('string');
      expect(typeof BOT_MODE.Webhook).toBe('string');
    });
  });

  describe('DEFAULT_WEBHOOK_PATH', () => {
    it('is /telegram/webhook', () => {
      expect(DEFAULT_WEBHOOK_PATH).toBe('/telegram/webhook');
    });

    it('starts with a forward slash', () => {
      expect(DEFAULT_WEBHOOK_PATH.startsWith('/')).toBe(true);
    });

    it('is a string', () => {
      expect(typeof DEFAULT_WEBHOOK_PATH).toBe('string');
    });
  });
});

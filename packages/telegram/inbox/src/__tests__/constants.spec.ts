import { describe, it, expect } from 'vitest';
import {
  CONTENT_TYPES,
  MESSAGE_DIRECTIONS,
  SENDER_TYPES,
  SESSION_STATUSES,
  DEFAULT_HISTORY_SYNC_LIMIT,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_TYPING_TIMEOUT_MS,
} from '../constants';

describe('Constants', () => {
  describe('CONTENT_TYPES', () => {
    it('has all expected values', () => {
      expect(CONTENT_TYPES).toContain('text');
      expect(CONTENT_TYPES).toContain('photo');
      expect(CONTENT_TYPES).toContain('video');
      expect(CONTENT_TYPES).toContain('voice');
      expect(CONTENT_TYPES).toContain('audio');
      expect(CONTENT_TYPES).toContain('document');
      expect(CONTENT_TYPES).toContain('sticker');
      expect(CONTENT_TYPES).toContain('location');
      expect(CONTENT_TYPES).toContain('contact');
    });

    it('has exactly 9 entries', () => {
      expect(CONTENT_TYPES).toHaveLength(9);
    });

    it('all values are unique', () => {
      expect(new Set(CONTENT_TYPES).size).toBe(CONTENT_TYPES.length);
    });

    it('all values are lowercase strings', () => {
      for (const type of CONTENT_TYPES) {
        expect(type).toBe(type.toLowerCase());
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('MESSAGE_DIRECTIONS', () => {
    it('has all expected values', () => {
      expect(MESSAGE_DIRECTIONS).toContain('inbound');
      expect(MESSAGE_DIRECTIONS).toContain('outbound');
    });

    it('has exactly 2 entries', () => {
      expect(MESSAGE_DIRECTIONS).toHaveLength(2);
    });

    it('all values are unique', () => {
      expect(new Set(MESSAGE_DIRECTIONS).size).toBe(MESSAGE_DIRECTIONS.length);
    });
  });

  describe('SENDER_TYPES', () => {
    it('has all expected values', () => {
      expect(SENDER_TYPES).toContain('account');
      expect(SENDER_TYPES).toContain('user');
    });

    it('has exactly 2 entries', () => {
      expect(SENDER_TYPES).toHaveLength(2);
    });

    it('all values are unique', () => {
      expect(new Set(SENDER_TYPES).size).toBe(SENDER_TYPES.length);
    });
  });

  describe('SESSION_STATUSES', () => {
    it('has all expected values', () => {
      expect(SESSION_STATUSES).toContain('active');
      expect(SESSION_STATUSES).toContain('paused');
      expect(SESSION_STATUSES).toContain('closed');
    });

    it('has exactly 3 entries', () => {
      expect(SESSION_STATUSES).toHaveLength(3);
    });

    it('all values are unique', () => {
      expect(new Set(SESSION_STATUSES).size).toBe(SESSION_STATUSES.length);
    });
  });

  describe('default values', () => {
    it('DEFAULT_HISTORY_SYNC_LIMIT is 100', () => {
      expect(DEFAULT_HISTORY_SYNC_LIMIT).toBe(100);
    });

    it('DEFAULT_MAX_FILE_SIZE_MB is 50', () => {
      expect(DEFAULT_MAX_FILE_SIZE_MB).toBe(50);
    });

    it('DEFAULT_TYPING_TIMEOUT_MS is 5000', () => {
      expect(DEFAULT_TYPING_TIMEOUT_MS).toBe(5000);
    });
  });

  describe('as const behavior', () => {
    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof CONTENT_TYPES[0]).toBe('string');
      expect(typeof MESSAGE_DIRECTIONS[0]).toBe('string');
      expect(typeof SENDER_TYPES[0]).toBe('string');
      expect(typeof SESSION_STATUSES[0]).toBe('string');
    });

    it('default values are numbers', () => {
      expect(typeof DEFAULT_HISTORY_SYNC_LIMIT).toBe('number');
      expect(typeof DEFAULT_MAX_FILE_SIZE_MB).toBe('number');
      expect(typeof DEFAULT_TYPING_TIMEOUT_MS).toBe('number');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_CATEGORY,
  TEMPLATE_AUDIENCE,
  RULE_OPERATOR,
  EMAIL_TYPE,
  RUN_TRIGGER,
  THROTTLE_WINDOW,
  EMAIL_SEND_STATUS,
} from '../constants';

describe('Constants', () => {
  describe('TEMPLATE_CATEGORY', () => {
    it('has all expected values', () => {
      expect(TEMPLATE_CATEGORY.Onboarding).toBe('onboarding');
      expect(TEMPLATE_CATEGORY.Engagement).toBe('engagement');
      expect(TEMPLATE_CATEGORY.Transactional).toBe('transactional');
      expect(TEMPLATE_CATEGORY.ReEngagement).toBe('re-engagement');
      expect(TEMPLATE_CATEGORY.Announcement).toBe('announcement');
    });

    it('has exactly 5 entries', () => {
      expect(Object.keys(TEMPLATE_CATEGORY)).toHaveLength(5);
    });
  });

  describe('TEMPLATE_AUDIENCE', () => {
    it('has all expected values', () => {
      expect(TEMPLATE_AUDIENCE.Customer).toBe('customer');
      expect(TEMPLATE_AUDIENCE.Provider).toBe('provider');
      expect(TEMPLATE_AUDIENCE.All).toBe('all');
    });

    it('has exactly 3 entries', () => {
      expect(Object.keys(TEMPLATE_AUDIENCE)).toHaveLength(3);
    });
  });

  describe('RULE_OPERATOR', () => {
    it('has all expected values', () => {
      expect(RULE_OPERATOR.Eq).toBe('eq');
      expect(RULE_OPERATOR.Neq).toBe('neq');
      expect(RULE_OPERATOR.Gt).toBe('gt');
      expect(RULE_OPERATOR.Gte).toBe('gte');
      expect(RULE_OPERATOR.Lt).toBe('lt');
      expect(RULE_OPERATOR.Lte).toBe('lte');
      expect(RULE_OPERATOR.Exists).toBe('exists');
      expect(RULE_OPERATOR.NotExists).toBe('not_exists');
      expect(RULE_OPERATOR.In).toBe('in');
      expect(RULE_OPERATOR.NotIn).toBe('not_in');
      expect(RULE_OPERATOR.Contains).toBe('contains');
    });

    it('has exactly 11 entries', () => {
      expect(Object.keys(RULE_OPERATOR)).toHaveLength(11);
    });
  });

  describe('EMAIL_TYPE', () => {
    it('has all expected values', () => {
      expect(EMAIL_TYPE.Automated).toBe('automated');
      expect(EMAIL_TYPE.Transactional).toBe('transactional');
    });

    it('has exactly 2 entries', () => {
      expect(Object.keys(EMAIL_TYPE)).toHaveLength(2);
    });
  });

  describe('RUN_TRIGGER', () => {
    it('has all expected values', () => {
      expect(RUN_TRIGGER.Cron).toBe('cron');
      expect(RUN_TRIGGER.Manual).toBe('manual');
    });

    it('has exactly 2 entries', () => {
      expect(Object.keys(RUN_TRIGGER)).toHaveLength(2);
    });
  });

  describe('THROTTLE_WINDOW', () => {
    it('has all expected values', () => {
      expect(THROTTLE_WINDOW.Rolling).toBe('rolling');
    });

    it('has exactly 1 entry', () => {
      expect(Object.keys(THROTTLE_WINDOW)).toHaveLength(1);
    });
  });

  describe('EMAIL_SEND_STATUS', () => {
    it('has all 5 expected values', () => {
      expect(EMAIL_SEND_STATUS.Sent).toBe('sent');
      expect(EMAIL_SEND_STATUS.Error).toBe('error');
      expect(EMAIL_SEND_STATUS.Skipped).toBe('skipped');
      expect(EMAIL_SEND_STATUS.Invalid).toBe('invalid');
      expect(EMAIL_SEND_STATUS.Throttled).toBe('throttled');
    });

    it('has exactly 5 entries', () => {
      expect(Object.keys(EMAIL_SEND_STATUS)).toHaveLength(5);
    });

    it('all values are unique', () => {
      const values = Object.values(EMAIL_SEND_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('as const behavior', () => {
    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof TEMPLATE_CATEGORY.Onboarding).toBe('string');
      expect(typeof EMAIL_SEND_STATUS.Sent).toBe('string');
      expect(typeof RULE_OPERATOR.Eq).toBe('string');
    });
  });
});

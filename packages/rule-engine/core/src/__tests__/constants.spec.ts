import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, RULE_TYPE,
  RUN_TRIGGER, THROTTLE_WINDOW, SEND_STATUS, TARGET_MODE, RUN_LOG_STATUS,
  FIELD_TYPE, TYPE_OPERATORS
} from '../constants';

describe('constants', () => {
  it('should have unique values in each enum', () => {
    const enums = [
      TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, RULE_TYPE,
      RUN_TRIGGER, THROTTLE_WINDOW, SEND_STATUS, TARGET_MODE, RUN_LOG_STATUS, FIELD_TYPE
    ];
    for (const e of enums) {
      const values = Object.values(e);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('should have 11 rule operators', () => {
    expect(Object.keys(RULE_OPERATOR)).toHaveLength(11);
  });

  it('should have TYPE_OPERATORS for all field types', () => {
    for (const type of Object.values(FIELD_TYPE)) {
      expect(TYPE_OPERATORS[type as keyof typeof TYPE_OPERATORS]).toBeDefined();
    }
  });
});

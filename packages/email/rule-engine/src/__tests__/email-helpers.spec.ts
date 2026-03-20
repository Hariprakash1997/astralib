import { describe, it, expect } from 'vitest';
import Handlebars from 'handlebars';
import { registerEmailHelpers } from '../email-helpers';

registerEmailHelpers();

describe('email helpers', () => {
  it('currency should format valid number', () => {
    const tpl = Handlebars.compile('{{currency amount}}');
    const result = tpl({ amount: 1234 });
    expect(result).toContain('₹');
    expect(result).toContain('1,234');
  });

  it('currency should handle NaN', () => {
    const tpl = Handlebars.compile('{{currency amount}}');
    const result = tpl({ amount: 'not-a-number' });
    expect(result).toBe('not-a-number');
  });

  it('currency should handle null/undefined', () => {
    const tpl = Handlebars.compile('{{currency amount}}');
    const result = tpl({});
    expect(result).toBeDefined();
  });

  it('formatDate should format valid date', () => {
    const tpl = Handlebars.compile('{{formatDate date}}');
    const result = tpl({ date: '2026-03-19' });
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });

  it('formatDate should handle invalid date', () => {
    const tpl = Handlebars.compile('{{formatDate date}}');
    const result = tpl({ date: 'not-a-date' });
    expect(result).toBe('not-a-date');
  });

  it('formatDate should handle null', () => {
    const tpl = Handlebars.compile('{{formatDate date}}');
    const result = tpl({});
    expect(result).toBe('');
  });
});

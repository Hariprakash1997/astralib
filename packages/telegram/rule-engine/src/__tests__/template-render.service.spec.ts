import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRenderService } from '../services/template-render.service';

describe('TemplateRenderService', () => {
  let service: TemplateRenderService;

  beforeEach(() => {
    service = new TemplateRenderService();
  });

  describe('compile', () => {
    it('creates compiled template functions from messages array', () => {
      const compiled = service.compile(['Hello {{name}}!', 'Hi {{name}}, welcome!']);
      expect(compiled.messageFns).toHaveLength(2);
      expect(typeof compiled.messageFns[0]).toBe('function');
      expect(typeof compiled.messageFns[1]).toBe('function');
    });

    it('compiled functions produce correct output', () => {
      const compiled = service.compile(['Hello {{name}}!']);
      const result = compiled.messageFns[0]({ name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('compiles single-element array', () => {
      const compiled = service.compile(['Only message {{name}}']);
      expect(compiled.messageFns).toHaveLength(1);
      expect(compiled.messageFns[0]({ name: 'Bob' })).toBe('Only message Bob');
    });
  });

  describe('render', () => {
    it('renders with data using random variant selection', () => {
      const compiled = service.compile(['Hello {{name}}!', 'Hi {{name}}!']);
      const result = service.render(compiled, { name: 'Alice' });
      expect(result === 'Hello Alice!' || result === 'Hi Alice!').toBe(true);
    });

    it('renders with specific messageIndex when provided', () => {
      const compiled = service.compile(['First {{name}}', 'Second {{name}}']);
      const result = service.render(compiled, { name: 'Bob' }, 1);
      expect(result).toBe('Second Bob');
    });

    it('renders with index 0 when specified', () => {
      const compiled = service.compile(['First {{name}}', 'Second {{name}}']);
      const result = service.render(compiled, { name: 'Charlie' }, 0);
      expect(result).toBe('First Charlie');
    });
  });

  describe('renderPreview', () => {
    it('renders message with provided data (non-strict mode)', () => {
      const result = service.renderPreview('Hello {{name}}!', { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('renders with missing variables without throwing (non-strict)', () => {
      const result = service.renderPreview('Hello {{name}}, your code is {{code}}', { name: 'Alice' });
      // Non-strict mode should not throw; missing vars render as empty
      expect(result).toContain('Alice');
    });

    it('renders empty data gracefully', () => {
      const result = service.renderPreview('Hello {{name}}!', {});
      expect(typeof result).toBe('string');
    });
  });

  describe('extractVariables', () => {
    it('finds all {{variable}} patterns across multiple templates', () => {
      const vars = service.extractVariables([
        '{{name}} is awesome',
        'Hello {{email}}, your score is {{score}}',
      ]);
      expect(vars).toContain('name');
      expect(vars).toContain('email');
      expect(vars).toContain('score');
    });

    it('ignores Handlebars block helpers (#if, /if, etc.)', () => {
      const vars = service.extractVariables([
        '{{name}} {{#if active}}{{email}}{{/if}} {{! comment}} {{> partial}}',
      ]);
      expect(vars).toContain('name');
      expect(vars).toContain('email');
      expect(vars).not.toContain('#if active');
      expect(vars).not.toContain('/if');
      expect(vars).not.toContain('! comment');
      expect(vars).not.toContain('> partial');
    });

    it('deduplicates and sorts variables', () => {
      const vars = service.extractVariables([
        '{{zebra}} {{alpha}} {{zebra}} {{middle}}',
      ]);
      expect(vars).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('ignores else blocks', () => {
      const vars = service.extractVariables([
        '{{#if x}}{{name}}{{else}}{{fallback}}{{/if}}',
      ]);
      expect(vars).not.toContain('else');
      expect(vars).toContain('name');
      expect(vars).toContain('fallback');
    });

    it('extracts from multiple messages', () => {
      const vars = service.extractVariables([
        'Hello {{firstName}}',
        'Goodbye {{lastName}}',
      ]);
      expect(vars).toContain('firstName');
      expect(vars).toContain('lastName');
    });

    it('returns empty array for templates with no variables', () => {
      const vars = service.extractVariables(['Plain text message']);
      expect(vars).toEqual([]);
    });
  });

  describe('validateTemplate', () => {
    it('returns valid for correct Handlebars syntax', () => {
      const result = service.validateTemplate('Hello {{name}}');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for invalid Handlebars syntax', () => {
      const result = service.validateTemplate('{{#if}}{{/unless}}');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Handlebars syntax error');
    });

    it('validates plain text as valid', () => {
      const result = service.validateTemplate('Just plain text');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Handlebars helpers', () => {
    it('capitalize works', () => {
      const compiled = service.compile(['{{capitalize word}}']);
      const result = compiled.messageFns[0]({ word: 'hello' });
      expect(result).toBe('Hello');
    });

    it('capitalize handles empty string', () => {
      const compiled = service.compile(['{{capitalize word}}']);
      const result = compiled.messageFns[0]({ word: '' });
      expect(result).toBe('');
    });

    it('lowercase works', () => {
      const compiled = service.compile(['{{lowercase word}}']);
      const result = compiled.messageFns[0]({ word: 'HELLO' });
      expect(result).toBe('hello');
    });

    it('uppercase works', () => {
      const compiled = service.compile(['{{uppercase word}}']);
      const result = compiled.messageFns[0]({ word: 'hello' });
      expect(result).toBe('HELLO');
    });

    it('join arrays', () => {
      const compiled = service.compile(['{{join items ", "}}']);
      const result = compiled.messageFns[0]({ items: ['a', 'b', 'c'] });
      expect(result).toBe('a, b, c');
    });

    it('join returns empty string for non-array', () => {
      const compiled = service.compile(['{{join items}}']);
      const result = compiled.messageFns[0]({ items: 'not-an-array' });
      expect(result).toBe('');
    });

    it('pluralize singular', () => {
      const compiled = service.compile(['{{pluralize count "item" "items"}}']);
      const result = compiled.messageFns[0]({ count: 1 });
      expect(result).toBe('item');
    });

    it('pluralize plural', () => {
      const compiled = service.compile(['{{pluralize count "item" "items"}}']);
      const result = compiled.messageFns[0]({ count: 5 });
      expect(result).toBe('items');
    });

    it('eq helper', () => {
      const compiled = service.compile(['{{#if (eq a b)}}yes{{else}}no{{/if}}']);
      expect(compiled.messageFns[0]({ a: 1, b: 1 })).toBe('yes');
      expect(compiled.messageFns[0]({ a: 1, b: 2 })).toBe('no');
    });

    it('neq helper', () => {
      const compiled = service.compile(['{{#if (neq a b)}}different{{else}}same{{/if}}']);
      expect(compiled.messageFns[0]({ a: 1, b: 2 })).toBe('different');
    });

    it('gt helper', () => {
      const compiled = service.compile(['{{#if (gt a b)}}yes{{else}}no{{/if}}']);
      expect(compiled.messageFns[0]({ a: 5, b: 3 })).toBe('yes');
    });

    it('lt helper', () => {
      const compiled = service.compile(['{{#if (lt a b)}}yes{{else}}no{{/if}}']);
      expect(compiled.messageFns[0]({ a: 1, b: 3 })).toBe('yes');
    });

    it('gte helper', () => {
      const compiled = service.compile(['{{#if (gte a b)}}yes{{else}}no{{/if}}']);
      expect(compiled.messageFns[0]({ a: 3, b: 3 })).toBe('yes');
    });

    it('lte helper', () => {
      const compiled = service.compile(['{{#if (lte a b)}}yes{{else}}no{{/if}}']);
      expect(compiled.messageFns[0]({ a: 3, b: 3 })).toBe('yes');
    });

    it('not helper', () => {
      const compiled = service.compile(['{{#if (not val)}}falsy{{else}}truthy{{/if}}']);
      expect(compiled.messageFns[0]({ val: false })).toBe('falsy');
      expect(compiled.messageFns[0]({ val: true })).toBe('truthy');
    });
  });
});

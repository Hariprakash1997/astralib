import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRenderService } from '../services/template-render.service';

describe('TemplateRenderService', () => {
  let service: TemplateRenderService;

  beforeEach(() => {
    service = new TemplateRenderService();
  });

  describe('compile + render', () => {
    it('compiles and renders basic variable substitution', () => {
      const compiled = service.compile('Hello {{name}}!');
      const result = service.render(compiled, { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('renders multiple variables', () => {
      const compiled = service.compile('{{greeting}} {{name}}, score: {{score}}');
      const result = service.render(compiled, { greeting: 'Hi', name: 'Bob', score: 99 });
      expect(result).toBe('Hi Bob, score: 99');
    });

    it('handles missing variables gracefully (strict: false)', () => {
      const compiled = service.compile('Hello {{missing}}');
      const result = service.render(compiled, {});
      expect(result).toBe('Hello ');
    });
  });

  describe('compileBatchVariants + renderFromCompiled', () => {
    it('compiles multiple subjects and bodies into arrays of functions', () => {
      const { subjectFns, bodyFns } = service.compileBatchVariants(
        ['Hello {{name}}', 'Hi {{name}}'],
        ['<p>Body A for {{name}}</p>', '<p>Body B for {{name}}</p>']
      );

      expect(subjectFns).toHaveLength(2);
      expect(bodyFns).toHaveLength(2);

      const data = { name: 'Alice' };
      expect(subjectFns[0](data)).toBe('Hello Alice');
      expect(subjectFns[1](data)).toBe('Hi Alice');
      expect(bodyFns[0](data)).toContain('Body A for Alice');
      expect(bodyFns[1](data)).toContain('Body B for Alice');
    });

    it('renders correct variant by index', () => {
      const { subjectFns, bodyFns } = service.compileBatchVariants(
        ['Subject A {{name}}', 'Subject B {{name}}'],
        ['Body A {{name}}', 'Body B {{name}}']
      );

      const result = service.renderFromCompiled(subjectFns, bodyFns, { name: 'Carol' }, 1, 1);
      expect(result.subject).toBe('Subject B Carol');
      expect(result.body).toBe('Body B Carol');
    });

    it('subject is undefined when subjectFns array is empty', () => {
      const { bodyFns } = service.compileBatchVariants([], ['Body {{name}}']);
      const result = service.renderFromCompiled([], bodyFns, { name: 'Dan' }, 0, 0);
      expect(result.subject).toBeUndefined();
      expect(result.body).toBe('Body Dan');
    });

    it('returns undefined preheaderFns when no preheaders provided', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['Body {{name}}']
      );
      expect(result.preheaderFns).toBeUndefined();
    });

    it('returns undefined preheaderFns when preheaders is empty array', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['Body {{name}}'],
        []
      );
      expect(result.preheaderFns).toBeUndefined();
    });

    it('compiles preheaders into preheaderFns array', () => {
      const { preheaderFns } = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['Body {{name}}'],
        ['Preview {{name}}', 'Check this out, {{name}}!']
      );

      expect(preheaderFns).toBeDefined();
      expect(preheaderFns).toHaveLength(2);

      const data = { name: 'Eve' };
      expect(preheaderFns![0](data)).toBe('Preview Eve');
      expect(preheaderFns![1](data)).toBe('Check this out, Eve!');
    });

    it('renderFromCompiled includes preheader when provided', () => {
      const { subjectFns, bodyFns, preheaderFns } = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['Body {{name}}'],
        ['Preview text for {{name}}']
      );

      const result = service.renderFromCompiled(
        subjectFns, bodyFns, { name: 'Frank' }, 0, 0, preheaderFns, 0
      );

      expect(result.preheader).toBe('Preview text for Frank');
    });
  });

  describe('extractVariables', () => {
    it('extracts {{name}} and {{user.email}} patterns', () => {
      const vars = service.extractVariables('Hello {{name}}, your email is {{user.email}}');
      expect(vars).toContain('name');
      expect(vars).toContain('user.email');
    });

    it('ignores block helpers (#if, /if, etc.)', () => {
      const template = '{{name}} {{#if active}}{{email}}{{/if}} {{! comment}} {{> partial}}';
      const vars = service.extractVariables(template);

      expect(vars).toContain('name');
      expect(vars).toContain('email');
      expect(vars).not.toContain('#if active');
      expect(vars).not.toContain('/if');
      expect(vars).not.toContain('! comment');
      expect(vars).not.toContain('> partial');
    });

    it('deduplicates and sorts variables', () => {
      const template = '{{zebra}} {{alpha}} {{zebra}} {{middle}}';
      const vars = service.extractVariables(template);
      expect(vars).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('ignores else blocks', () => {
      const template = '{{#if x}}{{name}}{{else}}{{fallback}}{{/if}}';
      const vars = service.extractVariables(template);

      expect(vars).not.toContain('else');
      expect(vars).toContain('name');
      expect(vars).toContain('fallback');
    });

    it('returns empty array for template with no variables', () => {
      const vars = service.extractVariables('Hello World!');
      expect(vars).toEqual([]);
    });
  });

  describe('validateTemplate', () => {
    it('returns valid for correct Handlebars syntax', () => {
      const result = service.validateTemplate('<p>Hello {{name}}</p>');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for invalid Handlebars syntax', () => {
      const result = service.validateTemplate('{{#if}}{{/unless}}');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Handlebars syntax error');
    });

    it('returns valid for template with helpers', () => {
      const result = service.validateTemplate('{{#if active}}{{name}}{{/if}}');
      expect(result.valid).toBe(true);
    });
  });

  describe('Handlebars helpers', () => {
    it('capitalize works', () => {
      const compiled = service.compile('{{capitalize word}}');
      expect(service.render(compiled, { word: 'hello' })).toBe('Hello');
    });

    it('capitalize handles empty string', () => {
      const compiled = service.compile('{{capitalize word}}');
      expect(service.render(compiled, { word: '' })).toBe('');
    });

    it('lowercase works', () => {
      const compiled = service.compile('{{lowercase word}}');
      expect(service.render(compiled, { word: 'HELLO' })).toBe('hello');
    });

    it('uppercase works', () => {
      const compiled = service.compile('{{uppercase word}}');
      expect(service.render(compiled, { word: 'hello' })).toBe('HELLO');
    });

    it('eq helper returns true when equal', () => {
      const compiled = service.compile('{{#if (eq a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 1, b: 1 })).toBe('yes');
    });

    it('eq helper returns false when not equal', () => {
      const compiled = service.compile('{{#if (eq a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 1, b: 2 })).toBe('no');
    });

    it('neq helper', () => {
      const compiled = service.compile('{{#if (neq a b)}}different{{else}}same{{/if}}');
      expect(service.render(compiled, { a: 1, b: 2 })).toBe('different');
      expect(service.render(compiled, { a: 1, b: 1 })).toBe('same');
    });

    it('not helper', () => {
      const compiled = service.compile('{{#if (not val)}}falsy{{else}}truthy{{/if}}');
      expect(service.render(compiled, { val: false })).toBe('falsy');
      expect(service.render(compiled, { val: true })).toBe('truthy');
    });

    it('gt helper', () => {
      const compiled = service.compile('{{#if (gt a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 5, b: 3 })).toBe('yes');
      expect(service.render(compiled, { a: 1, b: 3 })).toBe('no');
    });

    it('lt helper', () => {
      const compiled = service.compile('{{#if (lt a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 1, b: 3 })).toBe('yes');
      expect(service.render(compiled, { a: 5, b: 3 })).toBe('no');
    });

    it('gte helper', () => {
      const compiled = service.compile('{{#if (gte a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 3, b: 3 })).toBe('yes');
      expect(service.render(compiled, { a: 2, b: 3 })).toBe('no');
    });

    it('lte helper', () => {
      const compiled = service.compile('{{#if (lte a b)}}yes{{else}}no{{/if}}');
      expect(service.render(compiled, { a: 3, b: 3 })).toBe('yes');
      expect(service.render(compiled, { a: 4, b: 3 })).toBe('no');
    });

    it('join arrays', () => {
      const compiled = service.compile('{{join items ", "}}');
      expect(service.render(compiled, { items: ['a', 'b', 'c'] })).toBe('a, b, c');
    });

    it('join returns empty string for non-array', () => {
      const compiled = service.compile('{{join items}}');
      expect(service.render(compiled, { items: 'not-an-array' })).toBe('');
    });

    it('pluralize singular', () => {
      const compiled = service.compile('{{pluralize count "item" "items"}}');
      expect(service.render(compiled, { count: 1 })).toBe('item');
    });

    it('pluralize plural', () => {
      const compiled = service.compile('{{pluralize count "item" "items"}}');
      expect(service.render(compiled, { count: 5 })).toBe('items');
    });
  });

  describe('registerHelper', () => {
    it('custom helper works after registration', () => {
      service.registerHelper('shout', (str: string) => str.toUpperCase() + '!!!');
      const compiled = service.compile('{{shout word}}');
      expect(service.render(compiled, { word: 'hello' })).toBe('HELLO!!!');
    });

    it('custom numeric helper works', () => {
      service.registerHelper('double', (n: number) => n * 2);
      const compiled = service.compile('{{double value}}');
      expect(service.render(compiled, { value: 7 })).toBe('14');
    });
  });
});

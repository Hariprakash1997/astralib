import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRenderService } from '../services/template-render.service';

describe('TemplateRenderService', () => {
  let service: TemplateRenderService;

  beforeEach(() => {
    service = new TemplateRenderService();
  });

  describe('renderSingle', () => {
    it('renders subject, body (MJML wrapped), and text correctly', () => {
      const result = service.renderSingle(
        'Hello {{name}}',
        '<p>Welcome, {{name}}!</p>',
        { name: 'Alice' }
      );

      expect(result.subject).toBe('Hello Alice');
      expect(result.html).toContain('Welcome, Alice!');
      expect(result.html).toContain('<!doctype html>');
      expect(result.text).toContain('Welcome, Alice!');
    });

    it('passes through full MJML documents without wrapping', () => {
      const fullMjml = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Custom {{name}} template</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

      const result = service.renderSingle(
        'Subject',
        fullMjml,
        { name: 'Bob' }
      );

      expect(result.html).toContain('Custom Bob template');
      expect(result.html).toContain('<!doctype html>');
    });

    it('uses textBody when provided instead of auto-generating', () => {
      const result = service.renderSingle(
        'Subject {{name}}',
        '<p>HTML body for {{name}}</p>',
        { name: 'Charlie' },
        'Plain text for {{name}}'
      );

      expect(result.text).toBe('Plain text for Charlie');
      expect(result.subject).toBe('Subject Charlie');
    });
  });

  describe('compileBatch + renderFromCompiled', () => {
    it('compiles once, renders multiple times with different data', () => {
      const compiled = service.compileBatch(
        'Hi {{name}}',
        '<p>Score: {{score}}</p>'
      );

      const result1 = service.renderFromCompiled(compiled, { name: 'Alice', score: 100 });
      const result2 = service.renderFromCompiled(compiled, { name: 'Bob', score: 200 });

      expect(result1.subject).toBe('Hi Alice');
      expect(result1.html).toContain('Score: 100');
      expect(result2.subject).toBe('Hi Bob');
      expect(result2.html).toContain('Score: 200');
    });

    it('uses textBodyFn when textBody is provided to compileBatch', () => {
      const compiled = service.compileBatch(
        'Subject',
        '<p>Body</p>',
        'Text for {{name}}'
      );

      const result = service.renderFromCompiled(compiled, { name: 'Dave' });
      expect(result.text).toBe('Text for Dave');
    });

    it('auto-generates text from html when no textBody provided', () => {
      const compiled = service.compileBatch(
        'Subject',
        '<p>Hello World</p>'
      );

      const result = service.renderFromCompiled(compiled, {});
      expect(result.text).toContain('Hello World');
    });
  });

  describe('compileBatchVariants', () => {
    it('compiles multiple subjects and bodies into arrays of functions', () => {
      const result = service.compileBatchVariants(
        ['Hello {{name}}', 'Hi {{name}}'],
        ['<p>Body A for {{name}}</p>', '<p>Body B for {{name}}</p>']
      );

      expect(result.subjectFns).toHaveLength(2);
      expect(result.bodyFns).toHaveLength(2);
      expect(result.textBodyFn).toBeUndefined();

      const data = { name: 'Alice' };
      expect(result.subjectFns[0](data)).toBe('Hello Alice');
      expect(result.subjectFns[1](data)).toBe('Hi Alice');
      expect(result.bodyFns[0](data)).toContain('Body A for Alice');
      expect(result.bodyFns[1](data)).toContain('Body B for Alice');
    });

    it('compiles single-element arrays', () => {
      const result = service.compileBatchVariants(
        ['Only subject {{name}}'],
        ['<p>Only body {{name}}</p>']
      );

      expect(result.subjectFns).toHaveLength(1);
      expect(result.bodyFns).toHaveLength(1);

      const data = { name: 'Bob' };
      expect(result.subjectFns[0](data)).toBe('Only subject Bob');
      expect(result.bodyFns[0](data)).toContain('Only body Bob');
    });

    it('includes textBodyFn when textBody is provided', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['<p>Body</p>'],
        'Plain text for {{name}}'
      );

      expect(result.textBodyFn).toBeDefined();
      expect(result.textBodyFn!({ name: 'Charlie' })).toBe('Plain text for Charlie');
    });
  });

  describe('compileBatchVariants with preheaders', () => {
    it('compiles preheaders into preheaderFns array with correct length', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['<p>Body {{name}}</p>'],
        undefined,
        ['Preview {{name}}', 'Check this out, {{name}}!']
      );

      expect(result.preheaderFns).toBeDefined();
      expect(result.preheaderFns).toHaveLength(2);

      const data = { name: 'Alice' };
      expect(result.preheaderFns![0](data)).toBe('Preview Alice');
      expect(result.preheaderFns![1](data)).toBe('Check this out, Alice!');
    });

    it('returns undefined preheaderFns when no preheaders provided', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['<p>Body {{name}}</p>']
      );

      expect(result.preheaderFns).toBeUndefined();
    });

    it('returns undefined preheaderFns when preheaders is empty array', () => {
      const result = service.compileBatchVariants(
        ['Subject {{name}}'],
        ['<p>Body {{name}}</p>'],
        undefined,
        []
      );

      expect(result.preheaderFns).toBeUndefined();
    });
  });

  describe('extractVariables', () => {
    it('finds all {{variable}} patterns, ignores helpers (#if, /if, etc.)', () => {
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
  });

  describe('Handlebars helpers', () => {
    it('currency formats with ₹ and Indian locale', () => {
      const result = service.renderSingle(
        '{{currency price}}',
        '<p>{{currency price}}</p>',
        { price: 150000 }
      );

      expect(result.subject).toBe('₹1,50,000');
    });

    it('formatDate works', () => {
      const result = service.renderSingle(
        '{{formatDate date}}',
        '<p>date</p>',
        { date: '2025-01-15T00:00:00Z' }
      );

      expect(result.subject).toMatch(/15/);
      expect(result.subject).toMatch(/Jan/);
      expect(result.subject).toMatch(/2025/);
    });

    it('capitalize works', () => {
      const result = service.renderSingle(
        '{{capitalize word}}',
        '<p>ok</p>',
        { word: 'hello' }
      );

      expect(result.subject).toBe('Hello');
    });

    it('capitalize handles empty string', () => {
      const result = service.renderSingle(
        '{{capitalize word}}',
        '<p>ok</p>',
        { word: '' }
      );

      expect(result.subject).toBe('');
    });

    it('lowercase works', () => {
      const result = service.renderSingle(
        '{{lowercase word}}',
        '<p>ok</p>',
        { word: 'HELLO' }
      );

      expect(result.subject).toBe('hello');
    });

    it('uppercase works', () => {
      const result = service.renderSingle(
        '{{uppercase word}}',
        '<p>ok</p>',
        { word: 'hello' }
      );

      expect(result.subject).toBe('HELLO');
    });

    it('join arrays', () => {
      const result = service.renderSingle(
        '{{join items ", "}}',
        '<p>ok</p>',
        { items: ['a', 'b', 'c'] }
      );

      expect(result.subject).toBe('a, b, c');
    });

    it('join returns empty string for non-array', () => {
      const result = service.renderSingle(
        '{{join items}}',
        '<p>ok</p>',
        { items: 'not-an-array' }
      );

      expect(result.subject).toBe('');
    });

    it('pluralize singular', () => {
      const result = service.renderSingle(
        '{{pluralize count "item" "items"}}',
        '<p>ok</p>',
        { count: 1 }
      );

      expect(result.subject).toBe('item');
    });

    it('pluralize plural', () => {
      const result = service.renderSingle(
        '{{pluralize count "item" "items"}}',
        '<p>ok</p>',
        { count: 5 }
      );

      expect(result.subject).toBe('items');
    });

    it('eq helper', () => {
      const result = service.renderSingle(
        '{{#if (eq a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 1, b: 1 }
      );
      expect(result.subject).toBe('yes');

      const result2 = service.renderSingle(
        '{{#if (eq a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 1, b: 2 }
      );
      expect(result2.subject).toBe('no');
    });

    it('neq helper', () => {
      const result = service.renderSingle(
        '{{#if (neq a b)}}different{{else}}same{{/if}}',
        '<p>ok</p>',
        { a: 1, b: 2 }
      );
      expect(result.subject).toBe('different');
    });

    it('gt helper', () => {
      const result = service.renderSingle(
        '{{#if (gt a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 5, b: 3 }
      );
      expect(result.subject).toBe('yes');
    });

    it('lt helper', () => {
      const result = service.renderSingle(
        '{{#if (lt a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 1, b: 3 }
      );
      expect(result.subject).toBe('yes');
    });

    it('gte helper', () => {
      const result = service.renderSingle(
        '{{#if (gte a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 3, b: 3 }
      );
      expect(result.subject).toBe('yes');
    });

    it('lte helper', () => {
      const result = service.renderSingle(
        '{{#if (lte a b)}}yes{{else}}no{{/if}}',
        '<p>ok</p>',
        { a: 3, b: 3 }
      );
      expect(result.subject).toBe('yes');
    });

    it('not helper', () => {
      const result = service.renderSingle(
        '{{#if (not val)}}falsy{{else}}truthy{{/if}}',
        '<p>ok</p>',
        { val: false }
      );
      expect(result.subject).toBe('falsy');

      const result2 = service.renderSingle(
        '{{#if (not val)}}falsy{{else}}truthy{{/if}}',
        '<p>ok</p>',
        { val: true }
      );
      expect(result2.subject).toBe('truthy');
    });
  });
});

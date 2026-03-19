import { describe, it, expect } from 'vitest';
import { renderMjml, htmlToPlainText } from '../mjml-renderer';

describe('renderMjml', () => {
  it('should convert MJML body to HTML', () => {
    const html = renderMjml('<mj-text>Hello World</mj-text>');
    expect(html).toContain('Hello World');
    expect(html).toContain('<html');
  });

  it('should handle full MJML document', () => {
    const mjml = '<mjml><mj-body><mj-section><mj-column><mj-text>Test</mj-text></mj-column></mj-section></mj-body></mjml>';
    const html = renderMjml(mjml);
    expect(html).toContain('Test');
    expect(html).toContain('<html');
  });

  it('should pass through plain HTML unchanged', () => {
    const html = '<div>Plain HTML</div>';
    const result = renderMjml(html);
    expect(result).toBe(html);
  });

  it('should handle Handlebars variables in MJML', () => {
    const html = renderMjml('<mj-text>Hello {{name}}</mj-text>');
    expect(html).toContain('{{name}}');
  });
});

describe('htmlToPlainText', () => {
  it('should convert HTML to plain text', () => {
    const text = htmlToPlainText('<p>Hello <strong>World</strong></p>');
    expect(text).toContain('Hello');
    expect(text).toContain('World');
    expect(text).not.toContain('<p>');
  });
});

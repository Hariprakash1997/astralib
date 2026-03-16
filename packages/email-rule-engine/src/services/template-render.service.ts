import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { convert } from 'html-to-text';

export interface RenderResult {
  html: string;
  text: string;
  subject: string;
}

export interface CompiledTemplate {
  subjectFn: HandlebarsTemplateDelegate;
  bodyFn: HandlebarsTemplateDelegate;
  textBodyFn?: HandlebarsTemplateDelegate;
}

const MJML_BASE_OPEN = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="15px" color="#333333" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding="20px">
      <mj-column>
        <mj-text>`;

const MJML_BASE_CLOSE = `        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
};

function registerHelpers(): void {
  Handlebars.registerHelper('currency', (val: number) => {
    return `₹${Number(val).toLocaleString('en-IN')}`;
  });

  Handlebars.registerHelper('formatDate', (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', DATE_FORMAT_OPTIONS);
  });

  Handlebars.registerHelper('capitalize', (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('neq', (a: unknown, b: unknown) => a !== b);
  Handlebars.registerHelper('not', (val: unknown) => !val);
  Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
  Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
  Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

  Handlebars.registerHelper('lowercase', (str: string) => {
    return str ? str.toLowerCase() : '';
  });

  Handlebars.registerHelper('uppercase', (str: string) => {
    return str ? str.toUpperCase() : '';
  });

  Handlebars.registerHelper('join', (arr: string[], separator: string) => {
    if (!Array.isArray(arr)) return '';
    const sep = typeof separator === 'string' ? separator : ', ';
    return arr.join(sep);
  });

  Handlebars.registerHelper('pluralize', (count: number, singular: string, plural: string) => {
    return count === 1 ? singular : (typeof plural === 'string' ? plural : singular + 's');
  });
}

let helpersRegistered = false;

function ensureHelpers(): void {
  if (!helpersRegistered) {
    registerHelpers();
    helpersRegistered = true;
  }
}

function wrapInMjml(body: string): string {
  if (body.trim().startsWith('<mjml')) {
    return body;
  }
  return `${MJML_BASE_OPEN}${body}${MJML_BASE_CLOSE}`;
}

function compileMjml(mjmlSource: string): string {
  const result = mjml2html(mjmlSource, {
    validationLevel: 'soft',
    minify: false
  });
  if (result.errors && result.errors.length > 0) {
    const criticalErrors = result.errors.filter((e: any) => e.tagName !== undefined);
    if (criticalErrors.length > 0) {
      throw new Error(`MJML compilation errors: ${criticalErrors.map(e => e.message).join('; ')}`);
    }
  }
  return result.html;
}

function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 80,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

export class TemplateRenderService {
  constructor() {
    ensureHelpers();
  }

  renderSingle(
    subject: string,
    body: string,
    data: Record<string, unknown>,
    textBody?: string
  ): RenderResult {
    const subjectFn = Handlebars.compile(subject, { strict: true });
    const resolvedSubject = subjectFn(data);

    const bodyFn = Handlebars.compile(body, { strict: true });
    const resolvedBody = bodyFn(data);

    const mjmlSource = wrapInMjml(resolvedBody);
    const html = compileMjml(mjmlSource);

    let text: string;
    if (textBody) {
      const textFn = Handlebars.compile(textBody, { strict: true });
      text = textFn(data);
    } else {
      text = htmlToPlainText(html);
    }

    return { html, text, subject: resolvedSubject };
  }

  compileBatch(subject: string, body: string, textBody?: string): CompiledTemplate {
    const mjmlSource = wrapInMjml(body);
    const htmlWithHandlebars = compileMjml(mjmlSource);

    const subjectFn = Handlebars.compile(subject, { strict: true });
    const bodyFn = Handlebars.compile(htmlWithHandlebars, { strict: true });
    const textBodyFn = textBody ? Handlebars.compile(textBody, { strict: true }) : undefined;

    return { subjectFn, bodyFn, textBodyFn };
  }

  compileBatchVariants(
    subjects: string[],
    bodies: string[],
    textBody?: string,
    preheaders?: string[]
  ): { subjectFns: HandlebarsTemplateDelegate[]; bodyFns: HandlebarsTemplateDelegate[]; textBodyFn?: HandlebarsTemplateDelegate; preheaderFns?: HandlebarsTemplateDelegate[] } {
    const subjectFns = subjects.map(s => Handlebars.compile(s, { strict: true }));
    const bodyFns = bodies.map(b => {
      const mjmlSource = wrapInMjml(b);
      const htmlWithHandlebars = compileMjml(mjmlSource);
      return Handlebars.compile(htmlWithHandlebars, { strict: true });
    });
    const textBodyFn = textBody ? Handlebars.compile(textBody, { strict: true }) : undefined;
    const preheaderFns = preheaders && preheaders.length > 0
      ? preheaders.map(p => Handlebars.compile(p, { strict: true }))
      : undefined;
    return { subjectFns, bodyFns, textBodyFn, preheaderFns };
  }

  renderFromCompiled(
    compiled: CompiledTemplate,
    data: Record<string, unknown>
  ): RenderResult {
    const subject = compiled.subjectFn(data);
    const html = compiled.bodyFn(data);
    const text = compiled.textBodyFn
      ? compiled.textBodyFn(data)
      : htmlToPlainText(html);

    return { html, text, subject };
  }

  renderPreview(
    subject: string,
    body: string,
    data: Record<string, unknown>,
    textBody?: string
  ): RenderResult {
    // Preview uses non-strict mode so missing variables render as empty strings
    const subjectFn = Handlebars.compile(subject, { strict: false });
    const resolvedSubject = subjectFn(data);

    const bodyFn = Handlebars.compile(body, { strict: false });
    const resolvedBody = bodyFn(data);

    const mjmlSource = wrapInMjml(resolvedBody);
    const html = compileMjml(mjmlSource);

    let text: string;
    if (textBody) {
      const textFn = Handlebars.compile(textBody, { strict: false });
      text = textFn(data);
    } else {
      text = htmlToPlainText(html);
    }

    return { html, text, subject: resolvedSubject };
  }

  htmlToText(html: string): string {
    return htmlToPlainText(html);
  }

  extractVariables(template: string): string[] {
    const regex = /\{\{(?!#|\/|!|>)([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      if (!variable.startsWith('else')) {
        variables.add(variable);
      }
    }

    return Array.from(variables).sort();
  }

  validateTemplate(body: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      Handlebars.precompile(body);
    } catch (e) {
      errors.push(`Handlebars syntax error: ${(e as Error).message}`);
    }

    const mjmlSource = wrapInMjml(body);
    try {
      const result = mjml2html(mjmlSource, { validationLevel: 'strict' });
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(`MJML error: ${err.message}`);
        }
      }
    } catch (e) {
      errors.push(`MJML compilation error: ${(e as Error).message}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

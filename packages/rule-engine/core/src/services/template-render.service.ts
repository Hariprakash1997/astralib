import Handlebars from 'handlebars';

export interface RenderResult {
  subject?: string;
  body: string;
  textBody?: string;
  preheader?: string;
}

export type CompiledTemplate = Handlebars.TemplateDelegate;

function registerHelpers(): void {
  Handlebars.registerHelper('capitalize', (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('lowercase', (str: string) => {
    return str ? str.toLowerCase() : '';
  });

  Handlebars.registerHelper('uppercase', (str: string) => {
    return str ? str.toUpperCase() : '';
  });

  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('neq', (a: unknown, b: unknown) => a !== b);
  Handlebars.registerHelper('not', (val: unknown) => !val);
  Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
  Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
  Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

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

export class TemplateRenderService {
  constructor() {
    ensureHelpers();
  }

  compile(templateStr: string, options?: CompileOptions): CompiledTemplate {
    return Handlebars.compile(templateStr, { strict: false, ...options });
  }

  render(compiled: CompiledTemplate, data: Record<string, unknown>): string {
    return compiled(data);
  }

  compileBatchVariants(
    subjects: string[],
    bodies: string[],
    preheaders?: string[]
  ): {
    subjectFns: Handlebars.TemplateDelegate[];
    bodyFns: Handlebars.TemplateDelegate[];
    preheaderFns?: Handlebars.TemplateDelegate[];
  } {
    const subjectFns = subjects.map(s => Handlebars.compile(s, { strict: false }));
    const bodyFns = bodies.map(b => Handlebars.compile(b, { strict: false }));
    const preheaderFns =
      preheaders && preheaders.length > 0
        ? preheaders.map(p => Handlebars.compile(p, { strict: false }))
        : undefined;

    return { subjectFns, bodyFns, preheaderFns };
  }

  renderFromCompiled(
    compiledSubjects: Handlebars.TemplateDelegate[],
    compiledBodies: Handlebars.TemplateDelegate[],
    data: Record<string, unknown>,
    subjectIndex: number,
    bodyIndex: number,
    compiledPreheaders?: Handlebars.TemplateDelegate[],
    preheaderIndex?: number
  ): RenderResult {
    const subject =
      compiledSubjects.length > 0 ? compiledSubjects[subjectIndex](data) : undefined;
    const body = compiledBodies[bodyIndex](data);

    let preheader: string | undefined;
    if (compiledPreheaders && preheaderIndex !== undefined) {
      preheader = compiledPreheaders[preheaderIndex](data);
    }

    return { subject, body, preheader };
  }

  extractVariables(templateStr: string): string[] {
    const regex = /\{\{(?!#|\/|!|>)([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(templateStr)) !== null) {
      const variable = match[1].trim();
      if (!variable.startsWith('else')) {
        variables.add(variable);
      }
    }

    return Array.from(variables).sort();
  }

  validateTemplate(templateStr: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      Handlebars.precompile(templateStr);
    } catch (e) {
      errors.push(`Handlebars syntax error: ${(e as Error).message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  renderSingle(
    subject: string | undefined,
    body: string,
    data: Record<string, unknown>,
    textBody?: string
  ): { subject?: string; body: string; textBody: string } {
    const subjectFn = subject ? Handlebars.compile(subject, { strict: false }) : null;
    const bodyFn = Handlebars.compile(body, { strict: false });
    const textFn = textBody ? Handlebars.compile(textBody, { strict: false }) : null;
    const renderedBody = bodyFn(data);
    const hasHtml = /<\w+[^>]*>/.test(renderedBody);
    return {
      subject: subjectFn ? subjectFn(data) : undefined,
      body: renderedBody,
      textBody: textFn ? textFn(data) : (hasHtml ? renderedBody.replace(/<[^>]+>/g, '') : renderedBody),
    };
  }

  renderPreview(
    subject: string | undefined,
    body: string,
    data: Record<string, unknown>,
    textBody?: string
  ): { subject?: string; body: string; textBody: string } {
    return this.renderSingle(subject, body, data, textBody);
  }

  registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    Handlebars.registerHelper(name, fn);
  }
}

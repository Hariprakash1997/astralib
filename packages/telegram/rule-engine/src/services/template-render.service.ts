import Handlebars from 'handlebars';

export interface CompiledMessages {
  messageFns: HandlebarsTemplateDelegate[];
}

let helpersRegistered = false;

function ensureHelpers(): void {
  if (helpersRegistered) return;

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

  helpersRegistered = true;
}

export class TemplateRenderService {
  constructor() {
    ensureHelpers();
  }

  compile(messages: string[]): CompiledMessages {
    const messageFns = messages.map(m => Handlebars.compile(m, { strict: true }));
    return { messageFns };
  }

  render(compiled: CompiledMessages, data: Record<string, unknown>, messageIndex?: number): string {
    const idx = messageIndex ?? Math.floor(Math.random() * compiled.messageFns.length);
    return compiled.messageFns[idx](data);
  }

  renderPreview(message: string, data: Record<string, unknown>): string {
    const fn = Handlebars.compile(message, { strict: false });
    return fn(data);
  }

  extractVariables(templates: string[]): string[] {
    const regex = /\{\{(?!#|\/|!|>)([^}]+)\}\}/g;
    const variables = new Set<string>();

    for (const template of templates) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(template)) !== null) {
        const variable = match[1].trim();
        if (!variable.startsWith('else')) {
          variables.add(variable);
        }
      }
    }

    return Array.from(variables).sort();
  }

  validateTemplate(message: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      Handlebars.precompile(message);
    } catch (e) {
      errors.push(`Handlebars syntax error: ${(e as Error).message}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

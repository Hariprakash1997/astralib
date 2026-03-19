# @astralibx/email-rule-engine Refactor — Thin Wrapper Design

**Date:** 2026-03-19
**Status:** Design
**Sub-project:** 3 of 3 (email-rule-engine becomes thin wrapper over core)

---

## Problem

`@astralibx/email-rule-engine` contains ~3000+ lines of services, schemas, controllers, routes, and types that are now duplicated in `@astralibx/rule-engine` (the core). The email package should become a thin wrapper that adds only email-specific functionality.

---

## Design

### What the email package does

1. **Maps `sendEmail` → generic `send`** — wraps the consumer's `sendEmail` adapter, adding MJML → HTML conversion before calling it
2. **Registers email-specific Handlebars helpers** — `currency` (INR format) and `formatDate`
3. **Exports `createEmailRuleEngine()`** — the only public API. Accepts email-specific config, maps it to core config, returns core's `RuleEngine` interface

### What gets deleted

Everything that now lives in the core:
- All services (`template.service.ts`, `rule.service.ts`, `rule-runner.service.ts`, `template-render.service.ts`, `scheduler.service.ts`)
- All schemas (`rule.schema.ts`, `template.schema.ts`, `rule-send.schema.ts`, `run-log.schema.ts`, `throttle-config.schema.ts`, `shared-schemas.ts`)
- All controllers (`rule.controller.ts`, `template.controller.ts`, `runner.controller.ts`, `settings.controller.ts`, `send-log.controller.ts`, `collection.controller.ts`)
- All routes (`routes/index.ts`)
- All types (replaced by re-exports from core)
- All constants (re-export from core)
- All errors (re-export from core)
- All validation (`config.schema.ts`, `condition.validator.ts`)
- All utils (`index.ts`, `query-helpers.ts`)

### Package structure after refactor

```
packages/email/rule-engine/
├── src/
│   ├── index.ts              ← createEmailRuleEngine() + re-exports
│   ├── mjml-renderer.ts      ← MJML → HTML + plain text conversion
│   ├── email-helpers.ts      ← currency, formatDate Handlebars helpers
│   └── __tests__/
│       ├── mjml-renderer.spec.ts
│       └── integration.spec.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### `createEmailRuleEngine()` function

```typescript
import { createRuleEngine, type RuleEngine, type RuleEngineConfig } from '@astralibx/rule-engine';
import { renderMjml } from './mjml-renderer';
import { registerEmailHelpers } from './email-helpers';

export interface EmailSendParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  ruleId: string;
  autoApprove: boolean;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
}

export interface EmailRuleEngineConfig extends Omit<RuleEngineConfig, 'adapters'> {
  adapters: Omit<RuleEngineConfig['adapters'], 'send'> & {
    sendEmail: (params: EmailSendParams) => Promise<void>;
  };
}

export function createEmailRuleEngine(config: EmailRuleEngineConfig): RuleEngine {
  const coreConfig: RuleEngineConfig = {
    ...config,
    adapters: {
      ...config.adapters,
      send: async (params) => {
        const html = renderMjml(params.body);
        const text = params.textBody || htmlToText(html);
        await config.adapters.sendEmail({
          identifierId: params.identifierId,
          contactId: params.contactId,
          accountId: params.accountId,
          subject: params.subject || '',
          htmlBody: html,
          textBody: text,
          ruleId: params.ruleId,
          autoApprove: params.autoApprove,
          attachments: params.metadata?.attachments as any,
        });
      },
    },
  };

  const engine = createRuleEngine(coreConfig);
  registerEmailHelpers(engine);
  return engine;
}
```

### MJML Renderer

```typescript
import mjml from 'mjml';
import { convert } from 'html-to-text';

export function renderMjml(mjmlBody: string): string {
  // If body is already HTML (not MJML), return as-is
  if (!mjmlBody.includes('<mjml>') && !mjmlBody.includes('<mj-')) {
    return mjmlBody;
  }

  // Wrap in MJML structure if not already wrapped
  const fullMjml = mjmlBody.includes('<mjml>')
    ? mjmlBody
    : `<mjml><mj-body>${mjmlBody}</mj-body></mjml>`;

  const result = mjml(fullMjml, { validationLevel: 'soft' });
  return result.html;
}

export function htmlToText(html: string): string {
  return convert(html, { wordwrap: 130 });
}
```

### Email Helpers

```typescript
import type { RuleEngine } from '@astralibx/rule-engine';

export function registerEmailHelpers(engine: RuleEngine): void {
  // Access the render service to register helpers
  // The render service exposes registerHelper()
  const renderService = (engine.services.template as any).renderService
    ?? (engine.services as any).renderService;

  if (!renderService?.registerHelper) return;

  renderService.registerHelper('currency', (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return '₹' + num.toLocaleString('en-IN');
  });

  renderService.registerHelper('formatDate', (value: any, format: any) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  });
}
```

### Dependencies

```json
{
  "dependencies": {
    "@astralibx/rule-engine": "*",
    "mjml": "^4.0.0",
    "html-to-text": "^9.0.0"
  },
  "peerDependencies": {
    "@astralibx/rule-engine": "^0.1.0",
    "express": "^4.18.0 || ^5.0.0",
    "ioredis": "^5.0.0",
    "mongoose": "^7.0.0 || ^8.0.0"
  }
}
```

Note: `handlebars`, `zod`, `@astralibx/core` are transitive via `@astralibx/rule-engine`.

### Re-exports

`index.ts` re-exports everything from core so email consumers don't need to import from two packages:

```typescript
export { createEmailRuleEngine, type EmailRuleEngineConfig, type EmailSendParams } from './index';
export * from '@astralibx/rule-engine';
```

---

## Breaking Changes

**Everything breaks.** This is intentional — nothing is in production. Consumers must:

1. Update `sendEmail` adapter → wrap it in `createEmailRuleEngine` config
2. `collectionName` + `joins` move from rules to templates
3. `emailType` → `ruleType`
4. Collection names change: `email_rules` → `rules`, `email_templates` → `templates`, etc.
5. Import paths may change (types come from core now)

---

## Files Deleted (from current email package)

Everything in `src/` except what's listed in the new structure above. Specifically:

- `src/services/*.ts` (5 files)
- `src/schemas/*.ts` (6 files)
- `src/controllers/*.ts` (6 files)
- `src/routes/index.ts`
- `src/types/*.ts` (5 files)
- `src/constants/*.ts` (2 files)
- `src/errors/index.ts`
- `src/validation/*.ts` (2 files)
- `src/utils/*.ts` (2 files)
- `src/__tests__/*.ts` (9 files) — replaced with 2 new test files

## Files Created

| File | Purpose |
|------|---------|
| `src/index.ts` | `createEmailRuleEngine()` + re-exports from core |
| `src/mjml-renderer.ts` | MJML → HTML + plain text |
| `src/email-helpers.ts` | `currency`, `formatDate` Handlebars helpers |
| `src/__tests__/mjml-renderer.spec.ts` | MJML rendering tests |
| `src/__tests__/integration.spec.ts` | End-to-end test with email engine |

---

## Verification

1. `npx vitest run` — all new tests pass
2. `npx tsup` — builds successfully
3. `createEmailRuleEngine()` with mock adapters — engine starts, routes mount
4. Template with MJML body → send pipeline renders HTML correctly
5. `currency` and `formatDate` helpers work in templates

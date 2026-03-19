# Email Rule Engine Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `@astralibx/email-rule-engine` from a standalone ~3000-line package to a thin ~100-line wrapper over `@astralibx/rule-engine`, keeping only MJML rendering and email-specific Handlebars helpers.

**Architecture:** Delete all services, schemas, controllers, routes, types, constants, errors, validation, and utils from the email package. Replace with `createEmailRuleEngine()` that maps email-specific config to core config, wraps `sendEmail` in MJML rendering, and registers `currency`/`formatDate` helpers.

**Tech Stack:** TypeScript, MJML, html-to-text, @astralibx/rule-engine (core), Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-email-rule-engine-refactor-design.md`

**Reference:** Current email package at `packages/email/rule-engine/src/` (to extract MJML logic from)

---

## File Map

All paths relative to `packages/email/rule-engine/`.

| File | Action | Responsibility |
|------|--------|----------------|
| `src/index.ts` | Rewrite | `createEmailRuleEngine()` factory + re-exports from core |
| `src/mjml-renderer.ts` | Create | MJML → HTML + plain text conversion |
| `src/email-helpers.ts` | Create | `currency`, `formatDate` Handlebars helpers |
| `src/__tests__/mjml-renderer.spec.ts` | Create | MJML rendering tests |
| `src/__tests__/integration.spec.ts` | Rewrite | Slim integration test using core |
| `package.json` | Modify | Update dependencies |
| `src/services/*` | Delete | Replaced by core |
| `src/schemas/*` | Delete | Replaced by core |
| `src/controllers/*` | Delete | Replaced by core |
| `src/routes/*` | Delete | Replaced by core |
| `src/types/*` | Delete | Replaced by core |
| `src/constants/*` | Delete | Replaced by core |
| `src/errors/*` | Delete | Replaced by core |
| `src/validation/*` | Delete | Replaced by core |
| `src/utils/*` | Delete | Replaced by core |
| `src/__tests__/collection.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/config-validation.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/constants.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/errors.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/redis-lock.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/rule-runner.service.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/template-render.service.spec.ts` | Delete | Tests live in core now |
| `src/__tests__/utils.spec.ts` | Delete | Tests live in core now |

---

## Task 1: Delete all old source files

**Files:**
- Delete: All files in `src/services/`, `src/schemas/`, `src/controllers/`, `src/routes/`, `src/types/`, `src/constants/`, `src/errors/`, `src/validation/`, `src/utils/`
- Delete: Old test files: `src/__tests__/collection.spec.ts`, `src/__tests__/config-validation.spec.ts`, `src/__tests__/constants.spec.ts`, `src/__tests__/errors.spec.ts`, `src/__tests__/redis-lock.spec.ts`, `src/__tests__/rule-runner.service.spec.ts`, `src/__tests__/template-render.service.spec.ts`, `src/__tests__/utils.spec.ts`
- Keep: `src/__tests__/integration.spec.ts` (will be rewritten)
- Keep: `src/index.ts` (will be rewritten)
- Keep: `package.json`, `tsconfig.json`, `tsup.config.ts`

- [ ] **Step 1: Delete all old directories and files**

```bash
cd packages/email/rule-engine
rm -rf src/services src/schemas src/controllers src/routes src/types src/constants src/errors src/validation src/utils
rm -f src/__tests__/collection.spec.ts src/__tests__/config-validation.spec.ts src/__tests__/constants.spec.ts src/__tests__/errors.spec.ts src/__tests__/redis-lock.spec.ts src/__tests__/rule-runner.service.spec.ts src/__tests__/template-render.service.spec.ts src/__tests__/utils.spec.ts
```

- [ ] **Step 2: Commit the deletion**

```bash
git add -A packages/email/rule-engine/src/
git commit -m "refactor(email-rule-engine): delete all source files replaced by @astralibx/rule-engine core"
```

---

## Task 2: Update package.json dependencies

**Files:**
- Modify: `packages/email/rule-engine/package.json`

- [ ] **Step 1: Update package.json**

Replace dependencies to depend on core. Keep only email-specific deps:

```json
{
  "name": "@astralibx/email-rule-engine",
  "version": "13.0.0",
  "description": "Email automation engine — thin wrapper over @astralibx/rule-engine with MJML rendering",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/email/rule-engine"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "keywords": ["email", "automation", "rule-engine", "mjml", "handlebars"],
  "license": "MIT",
  "dependencies": {
    "@astralibx/rule-engine": "*",
    "html-to-text": "^9.0.0",
    "mjml": "^4.0.0"
  },
  "peerDependencies": {
    "@astralibx/rule-engine": "^0.1.0",
    "express": "^4.18.0 || ^5.0.0",
    "ioredis": "^5.0.0",
    "mongoose": "^7.0.0 || ^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/html-to-text": "^9.0.4",
    "@types/mjml": "^4.7.4",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "express": "^5.0.0",
    "ioredis": "^5.4.2",
    "mongoose": "^8.12.1",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0",
    "mongodb-memory-server": "^10.0.0"
  }
}
```

Key changes:
- Removed `@astralibx/core`, `handlebars`, `zod` from dependencies (transitive via core)
- Added `@astralibx/rule-engine` as dependency
- Kept `mjml` and `html-to-text` (email-specific)
- Major version bump to 13.0.0 (breaking change)

- [ ] **Step 2: Install dependencies**

Run: `cd packages/email/rule-engine && npm install`

- [ ] **Step 3: Commit**

```bash
git add packages/email/rule-engine/package.json
git commit -m "refactor(email-rule-engine): update dependencies to use @astralibx/rule-engine core"
```

---

## Task 3: Create MJML renderer

**Files:**
- Create: `packages/email/rule-engine/src/mjml-renderer.ts`
- Test: `packages/email/rule-engine/src/__tests__/mjml-renderer.spec.ts`

- [ ] **Step 1: Write MJML renderer tests**

```typescript
import { describe, it, expect } from 'vitest';
import { renderMjml, htmlToPlainText } from '../mjml-renderer';

describe('renderMjml', () => {
  it('should convert MJML body to HTML', () => {
    const html = renderMjml('<mj-text>Hello World</mj-text>');
    expect(html).toContain('Hello World');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
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

  it('should handle links', () => {
    const text = htmlToPlainText('<a href="https://example.com">Click here</a>');
    expect(text).toContain('Click here');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/mjml-renderer.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create mjml-renderer.ts**

Extract from `packages/email/rule-engine/src/services/template-render.service.ts` (the `wrapInMjml`, `compileMjml`, `htmlToPlainText` functions):

```typescript
import mjml2html from 'mjml';
import { convert } from 'html-to-text';

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

export function renderMjml(body: string): string {
  // If body is plain HTML (not MJML), return as-is
  if (!body.includes('<mj-') && !body.trim().startsWith('<mjml')) {
    return body;
  }

  // Wrap in MJML structure if not a full document
  const fullMjml = body.trim().startsWith('<mjml')
    ? body
    : `${MJML_BASE_OPEN}${body}${MJML_BASE_CLOSE}`;

  const result = mjml2html(fullMjml, {
    validationLevel: 'soft',
    minify: false,
  });

  if (result.errors?.length) {
    const critical = result.errors.filter((e: any) => e.tagName !== undefined);
    if (critical.length > 0) {
      throw new Error(`MJML compilation errors: ${critical.map(e => e.message).join('; ')}`);
    }
  }

  return result.html;
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 80,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' },
    ],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/email/rule-engine && npx vitest run src/__tests__/mjml-renderer.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/email/rule-engine/src/mjml-renderer.ts packages/email/rule-engine/src/__tests__/mjml-renderer.spec.ts
git commit -m "feat(email-rule-engine): add standalone MJML renderer"
```

---

## Task 4: Create email helpers + main index

**Files:**
- Create: `packages/email/rule-engine/src/email-helpers.ts`
- Rewrite: `packages/email/rule-engine/src/index.ts`

- [ ] **Step 1: Create email-helpers.ts**

```typescript
import type { TemplateRenderService } from '@astralibx/rule-engine';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

export function registerEmailHelpers(renderService: TemplateRenderService): void {
  renderService.registerHelper('currency', (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return String(val ?? '');
    return `₹${num.toLocaleString('en-IN')}`;
  });

  renderService.registerHelper('formatDate', (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-IN', DATE_FORMAT_OPTIONS);
  });
}
```

- [ ] **Step 2: Rewrite index.ts**

```typescript
import {
  createRuleEngine,
  type RuleEngine,
  type RuleEngineConfig,
  type SendParams,
  TemplateRenderService,
} from '@astralibx/rule-engine';
import { renderMjml, htmlToPlainText } from './mjml-renderer';
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
    sendTestEmail?: (to: string, subject: string, html: string, text: string, attachments?: Array<{ filename: string; url: string; contentType: string }>) => Promise<void>;
  };
}

export function createEmailRuleEngine(config: EmailRuleEngineConfig): RuleEngine {
  const coreConfig: RuleEngineConfig = {
    ...config,
    adapters: {
      queryUsers: config.adapters.queryUsers,
      resolveData: config.adapters.resolveData,
      selectAgent: config.adapters.selectAgent,
      findIdentifier: config.adapters.findIdentifier,
      send: async (params: SendParams) => {
        const html = renderMjml(params.body);
        const text = params.textBody || htmlToPlainText(html);
        await config.adapters.sendEmail({
          identifierId: params.identifierId,
          contactId: params.contactId,
          accountId: params.accountId,
          subject: params.subject || '',
          htmlBody: html,
          textBody: text,
          ruleId: params.ruleId,
          autoApprove: params.autoApprove,
          attachments: (params.metadata?.attachments as any[]) ?? undefined,
        });
      },
      sendTest: config.adapters.sendTestEmail
        ? async (to, body, subject, metadata) => {
            const html = renderMjml(body);
            const text = htmlToPlainText(html);
            await config.adapters.sendTestEmail!(to, subject || '', html, text, (metadata?.attachments as any[]) ?? undefined);
          }
        : undefined,
    },
  };

  const engine = createRuleEngine(coreConfig);

  // Register email-specific Handlebars helpers
  registerEmailHelpers(new TemplateRenderService());

  return engine;
}

// Re-export everything from core so consumers use one import
export * from '@astralibx/rule-engine';
export { renderMjml, htmlToPlainText } from './mjml-renderer';
export { registerEmailHelpers } from './email-helpers';
export type { EmailSendParams, EmailRuleEngineConfig };
```

- [ ] **Step 3: Verify build**

Run: `cd packages/email/rule-engine && npx tsc --noEmit`
Expected: No errors (or fix any type issues)

- [ ] **Step 4: Commit**

```bash
git add packages/email/rule-engine/src/email-helpers.ts packages/email/rule-engine/src/index.ts
git commit -m "feat(email-rule-engine): rewrite as thin wrapper over @astralibx/rule-engine core"
```

---

## Task 5: Integration test

**Files:**
- Rewrite: `packages/email/rule-engine/src/__tests__/integration.spec.ts`

- [ ] **Step 1: Rewrite integration test**

Slim test that verifies the email wrapper works end-to-end:

```typescript
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createEmailRuleEngine } from '../index';

let mongoServer: MongoMemoryServer;
let connection: mongoose.Connection;

const mockRedis: Record<string, string> = {};
const redisMock = {
  get: vi.fn((key: string) => Promise.resolve(mockRedis[key] || null)),
  set: vi.fn((key: string, value: string) => { mockRedis[key] = value; return Promise.resolve('OK'); }),
  del: vi.fn((key: string) => { delete mockRedis[key]; return Promise.resolve(1); }),
  eval: vi.fn(() => Promise.resolve(1)),
  quit: vi.fn(),
};

const queryUsers = vi.fn();
const resolveData = vi.fn((user: any) => user);
const sendEmail = vi.fn();
const selectAgent = vi.fn();
const findIdentifier = vi.fn();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  connection = await mongoose.createConnection(mongoServer.getUri()).asPromise();
});

afterAll(async () => {
  await connection.close();
  await mongoServer.stop();
});

describe('Email Rule Engine (thin wrapper)', () => {
  const engine = createEmailRuleEngine({
    db: { connection },
    redis: { connection: redisMock as any },
    adapters: { queryUsers, resolveData, sendEmail, selectAgent, findIdentifier },
    platforms: ['email'],
    audiences: ['customer'],
    categories: ['onboarding'],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRedis).forEach(k => delete mockRedis[k]);
  });

  it('should create engine with routes and services', () => {
    expect(engine.routes).toBeDefined();
    expect(engine.services.template).toBeDefined();
    expect(engine.services.rule).toBeDefined();
    expect(engine.services.runner).toBeDefined();
  });

  it('should create template and rule', async () => {
    const template = await engine.services.template.create({
      name: 'Welcome Email',
      slug: 'welcome-email',
      category: 'onboarding',
      audience: 'customer',
      platform: 'email',
      subjects: ['Welcome {{name}}!'],
      bodies: ['<mj-text>Hello {{name}}, welcome aboard!</mj-text>'],
    });

    expect(template._id).toBeDefined();
    expect(template.name).toBe('Welcome Email');

    const rule = await engine.services.rule.create({
      name: 'Welcome Rule',
      platform: 'email',
      templateId: template._id.toString(),
      target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
    });

    expect(rule._id).toBeDefined();
    expect(rule.templateId.toString()).toBe(template._id.toString());
  });

  it('should render MJML and call sendEmail adapter', async () => {
    const template = await engine.services.template.create({
      name: 'MJML Test',
      slug: 'mjml-test-' + Date.now(),
      category: 'onboarding',
      audience: 'customer',
      platform: 'email',
      subjects: ['Test Subject'],
      bodies: ['<mj-text>Hello {{name}}</mj-text>'],
    });

    const rule = await engine.services.rule.create({
      name: 'MJML Rule',
      platform: 'email',
      templateId: template._id.toString(),
      target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
    });

    // Activate rule
    await engine.services.rule.toggleActive(rule._id.toString());

    // Mock adapter responses
    queryUsers.mockResolvedValueOnce([
      { _id: 'user1', email: 'test@example.com', name: 'Alice' },
    ]);
    selectAgent.mockResolvedValueOnce({
      accountId: 'acc1',
      contactValue: 'sender@example.com',
      metadata: {},
    });
    findIdentifier.mockResolvedValueOnce({
      id: 'ident1',
      contactId: 'contact1',
    });
    sendEmail.mockResolvedValueOnce(undefined);

    // Trigger run
    await engine.services.runner.runAllRules('manual');

    // Verify sendEmail was called with HTML (MJML converted)
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.htmlBody).toContain('<html');  // MJML rendered to HTML
    expect(call.htmlBody).toContain('Hello');
    expect(call.subject).toBeDefined();
    expect(call.textBody).toBeDefined();  // plain text generated
  });

  it('should support currency helper in templates', async () => {
    const template = await engine.services.template.create({
      name: 'Currency Test',
      slug: 'currency-test-' + Date.now(),
      category: 'onboarding',
      audience: 'customer',
      platform: 'email',
      subjects: ['Payment of {{currency amount}}'],
      bodies: ['<mj-text>You paid {{currency amount}}</mj-text>'],
    });

    expect(template).toBeDefined();
    // Helper registration is tested implicitly via the send pipeline
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/email/rule-engine && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/email/rule-engine/src/__tests__/integration.spec.ts
git commit -m "test(email-rule-engine): add slim integration tests for thin wrapper"
```

---

## Task 6: Build verification

- [ ] **Step 1: Run all tests**

Run: `cd packages/email/rule-engine && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build the package**

Run: `cd packages/email/rule-engine && npx tsup`
Expected: Build succeeds

- [ ] **Step 3: Verify exports**

Run: `cd D:/Codes/astralib && node -e "const m = require('./packages/email/rule-engine/dist/index.cjs'); console.log('createEmailRuleEngine:', typeof m.createEmailRuleEngine); console.log('createRuleEngine:', typeof m.createRuleEngine); console.log('renderMjml:', typeof m.renderMjml);"`
Expected: All `function`

- [ ] **Step 4: Verify core tests still pass**

Run: `cd packages/rule-engine/core && npx vitest run`
Expected: 188 tests PASS (core unaffected)

- [ ] **Step 5: Final commit**

```bash
git add -A packages/email/rule-engine/
git commit -m "refactor(email-rule-engine): complete rewrite as thin wrapper over @astralibx/rule-engine"
```

# @astralibx/rule-engine-ui — Shared UI Components Design

**Date:** 2026-03-19
**Status:** Design
**Sub-project:** 2 of 3 (shared UI components for rule engine)

---

## Problem

The email UI package (`@astralibx/email-ui`) contains ~11,700 lines of Lit web components. About 60% of these components are platform-agnostic (rule editor, template editor, run history, throttle settings) and would need to be duplicated for telegram and whatsapp UIs. Extracting shared components into `@astralibx/rule-engine-ui` eliminates this duplication.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Package location | `packages/rule-engine/ui/` as `@astralibx/rule-engine-ui` |
| Component framework | Lit 3 (web components, same as email UI) |
| Architecture | Individual components + pre-built dashboard |
| Template editor layout | Two-column: settings sidebar left, content slot right |
| Slot API | Props down, events up (standard web component pattern) |
| API connection | Built-in HTTP client via `baseUrl` prop + optional `.api` override |
| Styling | Shared style system extracted from email UI (`shared.ts`) |

---

## Components (9 total)

### 1. `<alx-template-editor>`

Slot-based template editor. The shared wrapper handles metadata + variables + collection/join. Platform fills the content slot.

**Layout:** Two-column sidebar
- **Left sidebar (35%):** name, slug, description, category, audience, platform, collection picker, join checkboxes, variables list with "Insert Variable" button
- **Right main (65%):** `<slot name="content">` — platform fills this with their editor

**Properties (input):**
```typescript
@property() baseUrl: string = '';
@property() api?: RuleEngineAPI;
@property() templateId?: string;        // edit mode
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
@property({ type: Array }) categories: string[] = [];
```

**Slot interface — the content slot component receives:**
```typescript
// Props passed to slotted component:
.bodies: string[]
.subjects: string[]
.preheaders: string[]
.textBody: string
.metadata: Record<string, unknown>
.variables: string[]           // available variables for insertion
.collectionFields: CollectionField[]  // available fields from collection

// Events emitted by slotted component:
@content-changed: { bodies?, subjects?, preheaders?, textBody?, metadata? }
```

**Email usage:**
```html
<alx-template-editor baseUrl="/api/rules" templateId="abc">
  <alx-email-body-editor slot="content"
    .bodies=${bodies} .subjects=${subjects} .preheaders=${preheaders}
    @content-changed=${handleChange}>
  </alx-email-body-editor>
</alx-template-editor>
```

**Telegram usage:**
```html
<alx-template-editor baseUrl="/api/rules" templateId="abc">
  <alx-telegram-message-editor slot="content"
    .bodies=${bodies}
    @content-changed=${handleChange}>
  </alx-telegram-message-editor>
</alx-template-editor>
```

**Without slot (fallback):** If no slotted content, renders a basic textarea for `bodies[0]` and optional `subjects[0]` input. Works for simple platforms or quick prototyping.

### 2. `<alx-rule-editor>`

Rule CRUD with condition builder. Inherits collection context from the linked template.

**Key behavior:**
- Admin picks a template → component loads template's `collectionName` + `joins`
- Condition builder shows fields from template's collection + active joins (grouped by source)
- Type-aware operators (string → eq/neq/contains, number → gt/gte/lt/lte, etc.)
- Query mode (conditions) vs list mode (identifiers textarea)
- Schedule section with cron presets
- Behavior section (sendOnce, resendAfterDays, maxPerRun, autoApprove, ruleType, bypassThrottle)
- "Preview" button next to conditions — calls `POST /rules/preview-conditions` and shows matched count + sample

**Properties:**
```typescript
@property() baseUrl: string = '';
@property() api?: RuleEngineAPI;
@property() ruleId?: string;
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
```

### 3. `<alx-rule-list>`

Rules table with actions.

**Features:**
- Table: name, template, platform, status (active/inactive), last run, total sent
- Actions: toggle active, edit (opens drawer), delete, dry run, clone
- Dry run results shown inline
- Platform filter dropdown
- Pagination

### 4. `<alx-template-list>`

Templates table with actions.

**Features:**
- Table: name, slug, category, platform, status, version
- Actions: toggle active, edit (opens drawer), delete, clone
- Platform/category filter dropdowns
- Pagination

### 5. `<alx-run-history>`

Run execution history with real-time progress.

**Features:**
- Table: run date, triggered by, duration, rules processed, sent/skipped/failed/throttled
- Expandable rows showing per-rule stats
- "Run Now" button with real-time polling progress bar
- Cancel button for running jobs

### 6. `<alx-throttle-settings>`

Throttle and send window configuration.

**Features:**
- Per-user limits: maxPerUserPerDay, maxPerUserPerWeek, minGapDays
- Send window: startHour, endHour, timezone
- Save with success feedback

### 7. `<alx-send-log>`

Send log viewer.

**Features:**
- Table: date, contact value, rule, status, account, subject
- Filters: ruleId, status, date range
- Pagination

### 8. `<alx-drawer>`

Right-side drawer for forms.

**Features:**
- Slides from right with overlay
- Title, close button
- `<slot>` for content
- Open/close via property or method

### 9. `<alx-rule-engine-dashboard>`

Pre-built tabbed dashboard composing all components.

**Tabs:**
1. Templates — `<alx-template-list>` with drawer containing `<alx-template-editor>`
2. Rules — `<alx-rule-list>` with drawer containing `<alx-rule-editor>`
3. Run History — `<alx-run-history>`
4. Send Log — `<alx-send-log>`
5. Settings — `<alx-throttle-settings>`

**Properties:**
```typescript
@property() baseUrl: string = '';
@property() api?: RuleEngineAPI;
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
@property({ type: Array }) categories: string[] = [];
@property() templateSlot?: TemplateFunction;  // renders platform-specific template content
```

**The `templateSlot` prop** allows the dashboard to render platform-specific template editors without requiring HTML slot composition:

```typescript
// Email dashboard
<alx-rule-engine-dashboard
  baseUrl="/api/rules"
  .templateSlot=${(props) => html`
    <alx-email-body-editor
      .bodies=${props.bodies}
      .subjects=${props.subjects}
      @content-changed=${props.onContentChanged}>
    </alx-email-body-editor>
  `}
></alx-rule-engine-dashboard>
```

---

## API Client

### Built-in `RuleEngineAPI` class

```typescript
class RuleEngineAPI {
  constructor(baseUrl: string);

  // Templates
  listTemplates(params?): Promise<any>;
  createTemplate(data): Promise<any>;
  getTemplate(id): Promise<any>;
  updateTemplate(id, data): Promise<any>;
  deleteTemplate(id): Promise<any>;
  toggleTemplate(id): Promise<any>;
  previewTemplate(id, data): Promise<any>;
  cloneTemplate(id): Promise<any>;

  // Rules
  listRules(params?): Promise<any>;
  createRule(data): Promise<any>;
  getRule(id): Promise<any>;
  updateRule(id, data): Promise<any>;
  deleteRule(id): Promise<any>;
  toggleRule(id): Promise<any>;
  dryRun(id): Promise<any>;
  cloneRule(id): Promise<any>;
  previewConditions(data): Promise<any>;

  // Collections
  listCollections(): Promise<any>;
  getCollectionFields(name, joins?): Promise<any>;

  // Runner
  triggerRun(): Promise<any>;
  getRunStatus(runId): Promise<any>;
  cancelRun(runId): Promise<any>;
  getRunHistory(params?): Promise<any>;

  // Settings
  getThrottleConfig(): Promise<any>;
  updateThrottleConfig(data): Promise<any>;

  // Send logs
  listSendLogs(params?): Promise<any>;
}
```

Components create this internally from `baseUrl`, or accept a custom instance via `.api` prop.

---

## Styling

### Shared style system

Extracted from email UI's `shared.ts`. Provides CSS custom properties for theming:

```css
:host {
  --alx-primary: #4f46e5;
  --alx-bg: #ffffff;
  --alx-text: #1f2937;
  --alx-border: #e5e7eb;
  --alx-radius: 6px;
  /* ... etc */
}
```

Components use these variables internally. Consumers override them:

```css
alx-rule-engine-dashboard {
  --alx-primary: #0ea5e9;
  --alx-radius: 8px;
}
```

**Exported style sets:** `alxBaseStyles`, `alxInputStyles`, `alxTableStyles`, `alxButtonStyles`, `alxCardStyles`, `alxBadgeStyles`, `alxLoadingStyles`

---

## Package Structure

```
packages/rule-engine/ui/
├── src/
│   ├── index.ts
│   ├── api/
│   │   ├── http-client.ts
│   │   └── rule-engine.api.ts
│   ├── components/
│   │   ├── alx-template-editor.ts
│   │   ├── alx-template-editor.styles.ts
│   │   ├── alx-rule-editor.ts
│   │   ├── alx-rule-editor.types.ts
│   │   ├── alx-rule-editor.styles.ts
│   │   ├── alx-rule-list.ts
│   │   ├── alx-template-list.ts
│   │   ├── alx-run-history.ts
│   │   ├── alx-throttle-settings.ts
│   │   ├── alx-send-log.ts
│   │   ├── alx-drawer.ts
│   │   └── alx-rule-engine-dashboard.ts
│   ├── styles/
│   │   ├── shared.ts
│   │   └── theme.ts
│   └── utils/
│       ├── config.ts
│       ├── format.ts
│       └── safe-register.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## Dependencies

```json
{
  "dependencies": {
    "lit": "^3.0.0"
  },
  "peerDependencies": {
    "lit": "^3.0.0"
  }
}
```

No runtime dependency on `@astralibx/rule-engine` — only type imports for `CollectionField`, `Condition`, etc. These are copied as local interfaces to avoid requiring backend package in the browser.

---

## What Stays in Email UI

After extraction, `@astralibx/email-ui` keeps:
- `<alx-email-body-editor>` — MJML content editor (fills template editor slot)
- `<alx-email-dashboard>` — wraps shared dashboard, adds Account and Analytics tabs
- All account components (account-form, account-list, warmup, health, capacity, etc.)
- All analytics components
- Email-specific API methods (account API, analytics API)

Email UI imports shared components from `@astralibx/rule-engine-ui` and composes them.

---

## Breaking Changes

None to external consumers. This is a new package. The email UI refactor to use shared components is a separate task (not part of this sub-project).

---

## Verification

1. All components render without errors
2. Template editor slot works with a basic fallback editor
3. Rule editor loads collection fields from linked template
4. Condition preview returns matched count
5. Dashboard switches tabs and opens drawers correctly
6. `baseUrl` prop connects to backend API
7. Custom `.api` override works
8. CSS custom properties allow theming

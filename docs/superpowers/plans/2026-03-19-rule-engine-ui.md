# @astralibx/rule-engine-ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@astralibx/rule-engine-ui` — shared Lit web components for rule engine admin UIs, with slot-based template editor for platform-specific content editing.

**Architecture:** Extract and generalize components from `@astralibx/email-ui` (`packages/email/ui/src/`). Each component takes a `baseUrl` prop for API connection (or custom `.api` instance). Template editor uses a sidebar layout with `<slot name="content">` for platform-specific editors. Dashboard composes all components in a tabbed interface.

**Tech Stack:** Lit 3, TypeScript, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-rule-engine-ui-design.md`
**Reference implementation:** `packages/email/ui/src/` — extract and generalize from here.

---

## File Map

All paths relative to `packages/rule-engine/ui/`.

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Create | Package config |
| `tsconfig.json` | Create | TypeScript config |
| `vite.config.ts` | Create | Vite build config |
| `src/index.ts` | Create | Barrel export |
| `src/api/http-client.ts` | Create | HTTP client with error handling |
| `src/api/rule-engine.api.ts` | Create | RuleEngineAPI class — all backend methods |
| `src/styles/shared.ts` | Create | Shared CSS styles (extracted from email) |
| `src/styles/theme.ts` | Create | CSS custom properties for theming |
| `src/utils/config.ts` | Create | AlxConfig for baseUrl |
| `src/utils/format.ts` | Create | Date/number formatters |
| `src/utils/safe-register.ts` | Create | Safe customElements.define |
| `src/components/alx-drawer.ts` | Create | Right-side drawer |
| `src/components/alx-template-editor.ts` | Create | Template CRUD with sidebar + content slot |
| `src/components/alx-template-editor.styles.ts` | Create | Template editor styles |
| `src/components/alx-rule-editor.ts` | Create | Rule CRUD with condition builder |
| `src/components/alx-rule-editor.types.ts` | Create | Types for rule editor |
| `src/components/alx-rule-editor.styles.ts` | Create | Rule editor styles |
| `src/components/alx-rule-list.ts` | Create | Rules table |
| `src/components/alx-template-list.ts` | Create | Templates table |
| `src/components/alx-run-history.ts` | Create | Run history with progress |
| `src/components/alx-throttle-settings.ts` | Create | Throttle + send window config |
| `src/components/alx-send-log.ts` | Create | Send log viewer |
| `src/components/alx-rule-engine-dashboard.ts` | Create | Tabbed dashboard |

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/rule-engine/ui/package.json`
- Create: `packages/rule-engine/ui/tsconfig.json`
- Create: `packages/rule-engine/ui/vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@astralibx/rule-engine-ui",
  "version": "0.1.0",
  "description": "Shared Lit Web Components for @astralibx rule engine admin UIs",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/rule-engine/ui"
  },
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    },
    "./api": {
      "import": {
        "types": "./dist/api.d.ts",
        "default": "./dist/api.js"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run"
  },
  "dependencies": {
    "lit": "^3.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

Copy from `packages/email/ui/tsconfig.json`. Adjust paths if needed.

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) => id === 'lit' || id.startsWith('lit/'),
    },
    sourcemap: true,
    minify: false,
  },
});
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p packages/rule-engine/ui/src/{api,components,styles,utils}
```

- [ ] **Step 5: Install dependencies**

```bash
cd packages/rule-engine/ui && npm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/rule-engine/ui/package.json packages/rule-engine/ui/tsconfig.json packages/rule-engine/ui/vite.config.ts
git commit -m "chore: scaffold @astralibx/rule-engine-ui package"
```

---

## Task 2: Styles + Utils + API Client

**Files:**
- Create: `src/styles/shared.ts`, `src/styles/theme.ts`
- Create: `src/utils/config.ts`, `src/utils/format.ts`, `src/utils/safe-register.ts`
- Create: `src/api/http-client.ts`, `src/api/rule-engine.api.ts`, `src/api/index.ts`

- [ ] **Step 1: Extract shared styles**

Read `packages/email/ui/src/styles/shared.ts` and copy it. This contains CSS style sheets (`alxBaseStyles`, `alxInputStyles`, `alxTableStyles`, `alxButtonStyles`, `alxCardStyles`, `alxBadgeStyles`, `alxLoadingStyles`, etc.) used by all components.

Read `packages/email/ui/src/styles/theme.ts` and copy it. Contains CSS custom properties for light/dark themes.

- [ ] **Step 2: Extract utils**

Read and copy from `packages/email/ui/src/utils/`:
- `config.ts` — `AlxConfig` class for baseUrl management
- `format.ts` — date/number formatting helpers
- `safe-register.ts` — safe `customElements.define` that doesn't throw on duplicate registration

- [ ] **Step 3: Create API client**

Read `packages/email/ui/src/api/http-client.ts` and copy it. Generic HTTP client with error handling.

Read `packages/email/ui/src/api/rule.api.ts` and generalize it into `rule-engine.api.ts`. This is the `RuleEngineAPI` class with methods for:
- Templates: list, create, get, update, delete, toggle, preview, clone
- Rules: list, create, get, update, delete, toggle, dryRun, clone, previewConditions
- Collections: list, getFields (with optional joins param)
- Runner: trigger, getStatus, cancel, getRunHistory
- Settings: getThrottleConfig, updateThrottleConfig
- Sends: list

Key change from email: `getCollectionFields(name, joins?)` adds `?joins=` query param.

Create `src/api/index.ts` barrel export.

- [ ] **Step 4: Verify build**

```bash
cd packages/rule-engine/ui && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/rule-engine/ui/src/styles/ packages/rule-engine/ui/src/utils/ packages/rule-engine/ui/src/api/
git commit -m "feat(rule-engine-ui): add shared styles, utils, and API client"
```

---

## Task 3: Drawer Component

**Files:**
- Create: `src/components/alx-drawer.ts`

- [ ] **Step 1: Extract drawer**

Read `packages/email/ui/src/components/shared/alx-drawer.ts` and copy it. This is already platform-agnostic — right-side sliding drawer with overlay, title, close button, and content slot.

No changes needed except updating import paths for styles.

- [ ] **Step 2: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-drawer.ts
git commit -m "feat(rule-engine-ui): add drawer component"
```

---

## Task 4: Rule Editor Types + Styles

**Files:**
- Create: `src/components/alx-rule-editor.types.ts`
- Create: `src/components/alx-rule-editor.styles.ts`

- [ ] **Step 1: Extract and generalize types**

Read `packages/email/ui/src/components/rules/alx-rule-editor.types.ts`. Copy and update:
- `RuleData` — add `platform: string`, remove `collectionName` and `joins` (these come from template now)
- `EMPTY_RULE` — add `platform: ''`, remove `collectionName` and `joins`
- Keep: `Condition`, `CollectionField`, `CollectionSummary` (with `joins: JoinOption[]`), `JoinOption`, `TYPE_OPERATORS`, `OPERATORS`, `TemplateOption`

- [ ] **Step 2: Extract styles**

Read `packages/email/ui/src/components/rules/alx-rule-editor.styles.ts`. Copy with join section styles included.

- [ ] **Step 3: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-rule-editor.types.ts packages/rule-engine/ui/src/components/alx-rule-editor.styles.ts
git commit -m "feat(rule-engine-ui): add rule editor types and styles"
```

---

## Task 5: Template Editor (Slot-Based)

**Files:**
- Create: `src/components/alx-template-editor.ts`
- Create: `src/components/alx-template-editor.styles.ts`

- [ ] **Step 1: Create template editor styles**

Read `packages/email/ui/src/components/rules/alx-template-editor.styles.ts` for reference. Create new styles with **two-column sidebar layout**:

```css
.editor-layout {
  display: flex;
  gap: 16px;
  min-height: 500px;
}
.editor-sidebar {
  width: 35%;
  min-width: 280px;
  border-right: 1px solid var(--alx-border, #e5e7eb);
  padding-right: 16px;
  overflow-y: auto;
}
.editor-main {
  flex: 1;
  min-width: 0;
}
```

Plus variable picker styles, join checkbox styles, collection dropdown styles.

- [ ] **Step 2: Create template editor component**

Read `packages/email/ui/src/components/rules/alx-template-editor.ts` for the full reference (~740 lines). Create a generalized version with these key changes:

**Sidebar (left):** name, slug, description, category, audience, platform dropdowns, collection picker, join checkboxes, variables list with "Insert Variable" picker

**Main area (right):** `<slot name="content">` with fallback (basic textarea)

**Properties:**
```typescript
@property() baseUrl = '';
@property() api?: RuleEngineAPI;
@property() templateId?: string;
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
@property({ type: Array }) categories: string[] = [];
```

**Internal state:**
```typescript
@state() private _form: TemplateData = { ...EMPTY_TEMPLATE };
@state() private _collections: CollectionSummary[] = [];
@state() private _availableJoins: JoinOption[] = [];
@state() private _collectionFields: CollectionField[] = [];
@state() private _showVariablePicker = false;
@state() private _pickerFields: CollectionField[] = [];
```

**Key behaviors:**
- On collection change: load available joins, reset selected joins
- On join toggle: refresh collection fields via `getCollectionFields(name, joins)`
- Variable picker: shows fields grouped by collection + joins
- Insert variable: dispatches `content-changed` event with updated variables list
- Save: validates, calls create/update API, emits `alx-template-saved` event
- Load: if `templateId` set, fetch and populate form
- **Slot data passing:** When form state changes, update slotted elements' properties via `this.querySelector('[slot="content"]')` property assignment, and listen for `content-changed` events

**Fallback content (no slot):**
```html
<slot name="content">
  <div class="fallback-editor">
    <label>Body</label>
    <textarea .value=${this._form.bodies[0] || ''} @input=${this._onBodyChange}></textarea>
  </div>
</slot>
```

- [ ] **Step 3: Verify build**

```bash
cd packages/rule-engine/ui && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-template-editor.ts packages/rule-engine/ui/src/components/alx-template-editor.styles.ts
git commit -m "feat(rule-engine-ui): add slot-based template editor with sidebar layout"
```

---

## Task 6: Rule Editor

**Files:**
- Create: `src/components/alx-rule-editor.ts`

- [ ] **Step 1: Extract and generalize rule editor**

Read `packages/email/ui/src/components/rules/alx-rule-editor.ts` (~832 lines). Create generalized version with these key changes:

1. **Collection context from template:** When admin picks a template, load that template's `collectionName` + `joins` to populate the condition builder. Rule editor does NOT have its own collection picker — it inherits from the linked template.

2. **Condition builder:** Shows fields grouped by primary collection + active joins (using `<optgroup>`). Type-aware operators. Value inputs adapt to field type (enum dropdown, boolean, date picker, number input).

3. **Condition preview:** "Preview" button calls `POST /rules/preview-conditions` with the template's collection + joins + current conditions. Shows `matchedCount` + sample inline.

4. **Platform field:** Top-level platform dropdown (was not in email — email assumed platform='email').

5. **Remove:** `collectionName` and `joins` from the rule form — these no longer exist on rules.

**Properties:**
```typescript
@property() baseUrl = '';
@property() api?: RuleEngineAPI;
@property() ruleId?: string;
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
```

- [ ] **Step 2: Verify build**

```bash
cd packages/rule-engine/ui && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-rule-editor.ts
git commit -m "feat(rule-engine-ui): add rule editor with template-based condition builder and preview"
```

---

## Task 7: List Components (Rule List + Template List)

**Files:**
- Create: `src/components/alx-rule-list.ts`
- Create: `src/components/alx-template-list.ts`

- [ ] **Step 1: Extract rule list**

Read `packages/email/ui/src/components/rules/alx-rule-list.ts` (~338 lines). Generalize:
- Add platform filter dropdown
- Dry run results inline display
- Actions: toggle, edit (emits event), delete, dry run, clone
- Pagination

- [ ] **Step 2: Extract template list**

Read `packages/email/ui/src/components/rules/alx-template-list.ts` (~337 lines). Generalize:
- Add platform and category filter dropdowns
- Actions: toggle, edit (emits event), delete, clone
- Pagination

- [ ] **Step 3: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-rule-list.ts packages/rule-engine/ui/src/components/alx-template-list.ts
git commit -m "feat(rule-engine-ui): add rule list and template list components"
```

---

## Task 8: Run History + Throttle Settings + Send Log

**Files:**
- Create: `src/components/alx-run-history.ts`
- Create: `src/components/alx-throttle-settings.ts`
- Create: `src/components/alx-send-log.ts`

- [ ] **Step 1: Extract run history**

Read `packages/email/ui/src/components/rules/alx-run-history.ts` (~497 lines). Copy and generalize:
- "Run Now" button with real-time progress polling
- Cancel button
- Run log table with expandable per-rule stats
- Use unified stats shape (matched, sent, skipped, throttled, failed)

- [ ] **Step 2: Extract throttle settings**

Read `packages/email/ui/src/components/rules/alx-throttle-settings.ts` (~321 lines). Copy with send window fields (startHour, endHour, timezone).

- [ ] **Step 3: Extract send log**

Read `packages/email/ui/src/components/rules/alx-send-log.ts` (~270 lines). Generalize:
- Column label: "Contact" not "Email"
- Status filter uses `SEND_STATUS` values
- Generic field names

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-run-history.ts packages/rule-engine/ui/src/components/alx-throttle-settings.ts packages/rule-engine/ui/src/components/alx-send-log.ts
git commit -m "feat(rule-engine-ui): add run history, throttle settings, and send log components"
```

---

## Task 9: Dashboard + Index

**Files:**
- Create: `src/components/alx-rule-engine-dashboard.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create dashboard**

Read `packages/email/ui/src/components/shared/alx-email-dashboard.ts` (~593 lines) for the tabbed shell pattern. Create a simplified version with 5 tabs:

1. **Templates** — `<alx-template-list>` + drawer with `<alx-template-editor>`
2. **Rules** — `<alx-rule-list>` + drawer with `<alx-rule-editor>`
3. **Run History** — `<alx-run-history>`
4. **Send Log** — `<alx-send-log>`
5. **Settings** — `<alx-throttle-settings>`

**Properties:**
```typescript
@property() baseUrl = '';
@property() api?: RuleEngineAPI;
@property({ type: Array }) platforms: string[] = [];
@property({ type: Array }) audiences: string[] = [];
@property({ type: Array }) categories: string[] = [];
@property() templateSlot?: (props: TemplateSlotProps) => TemplateResult;
```

The `templateSlot` render function lets consumers inject platform-specific template editors:
```typescript
// In template editor rendering:
${this.templateSlot
  ? this.templateSlot({ bodies, subjects, preheaders, textBody, metadata, onContentChanged })
  : html`<textarea .value=${bodies[0] || ''}></textarea>`
}
```

- [ ] **Step 2: Create index.ts**

Barrel export of all components, API client, styles, types, and utils:

```typescript
// Components
export { AlxTemplateEditor } from './components/alx-template-editor';
export { AlxRuleEditor } from './components/alx-rule-editor';
export { AlxRuleList } from './components/alx-rule-list';
export { AlxTemplateList } from './components/alx-template-list';
export { AlxRunHistory } from './components/alx-run-history';
export { AlxThrottleSettings } from './components/alx-throttle-settings';
export { AlxSendLog } from './components/alx-send-log';
export { AlxDrawer } from './components/alx-drawer';
export { AlxRuleEngineDashboard } from './components/alx-rule-engine-dashboard';

// API
export { RuleEngineAPI } from './api/rule-engine.api';
export { HttpClient, HttpClientError } from './api/http-client';

// Styles
export * from './styles/shared';
export * from './styles/theme';

// Types
export * from './components/alx-rule-editor.types';

// Utils
export { AlxConfig } from './utils/config';
```

- [ ] **Step 3: Build**

```bash
cd packages/rule-engine/ui && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/rule-engine/ui/src/components/alx-rule-engine-dashboard.ts packages/rule-engine/ui/src/index.ts
git commit -m "feat(rule-engine-ui): add tabbed dashboard and package exports"
```

---

## Task 10: Build Verification + Docs

- [ ] **Step 1: Build the package**

```bash
cd packages/rule-engine/ui && npx vite build
```
Expected: Build succeeds, outputs to `dist/`

- [ ] **Step 2: Verify type check**

```bash
cd packages/rule-engine/ui && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Create README.md**

Create `packages/rule-engine/ui/README.md` (~80 lines) with:
- Package description
- Component list with usage examples
- Slot-based template editor example
- Dashboard quick start
- Theming via CSS custom properties
- Links to core docs (absolute GitHub URLs)

- [ ] **Step 4: Commit**

```bash
git add -A packages/rule-engine/ui/
git commit -m "feat(rule-engine-ui): @astralibx/rule-engine-ui package complete with docs"
```

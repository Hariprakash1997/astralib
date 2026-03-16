# Rule Components

7 components for managing email templates, automation rules, execution history, throttle settings, and a built-in guide.

All components use `RuleAPI` internally and require `ruleEngineApi` to be configured via `AlxConfig.setup()`.

---

## `<alx-template-list>`

Paginated table of email templates with category, audience, and platform filters.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `categories` | `string` | `''` | JSON array of category options, e.g. `'["marketing","onboarding"]'` |
| `audiences` | `string` | `''` | JSON array of audience options |
| `platforms` | `string` | `''` | JSON array of platform options |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-template-selected` | `{ _id, name, slug, category, audience, platform, isActive }` | Row clicked |
| `alx-template-create` | `undefined` | "Create Template" button clicked |
| `alx-template-deleted` | `{ id: string }` | Template deleted via row delete button |

### Features
- Filter dropdowns for category, audience, platform (shown only when options are provided)
- Active/inactive toggle per template (updates via API)
- Delete button per row (dispatches `alx-template-deleted`)
- Pagination with page count
- Slug displayed in monospace

### Usage

```html
<alx-template-list
  categories='["marketing","transactional","onboarding"]'
  audiences='["clients","leads"]'
  platforms='["myapp"]'
></alx-template-list>
```

---

## `<alx-template-editor>`

Create or edit email templates with MJML/Handlebars body, variable management, and live preview.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `template-id` | `string` | `''` | Template ID to edit. Empty = create mode. |
| `categories` | `string` | `''` | JSON array of category options |
| `audiences` | `string` | `''` | JSON array of audience options |
| `platforms` | `string` | `''` | JSON array of platform options |
| `hide-header` | Boolean | `false` | Hide the card header (use when inside a drawer) |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-template-saved` | API response object | Template created or updated |
| `alx-template-deleted` | `{ id: string }` | Template deleted via delete button in editor |

### Features
- Fields: name, slug, category, audience, platform, subjects (array), bodies (array, MJML), text body
- Multi-variant support: `subjects[]`, `bodies[]`, and `preheaders[]` arrays with add/remove controls
- Template fields: key-value editor for template-level placeholder defaults
- Category/audience/platform render as dropdowns when options are provided, text inputs otherwise
- Variable tag management (add/remove, displayed as `{{variableName}}` chips)
- Info hints for each form section
- Delete button in edit mode (dispatches `alx-template-deleted`)
- "Preview" button renders MJML bodies via the API and displays in an iframe
- Monospace font for bodies textarea

### Usage

```html
<!-- Create mode -->
<alx-template-editor
  categories='["marketing","transactional"]'
  audiences='["clients","therapists"]'
  platforms='["myapp"]'
></alx-template-editor>

<!-- Edit mode -->
<alx-template-editor
  template-id="64a1b2c3d4e5f6a7b8c9d0e1"
  categories='["marketing","transactional"]'
></alx-template-editor>
```

---

## `<alx-rule-list>`

Table of automation rules with active toggles, execution stats, and dry-run capability.

### Attributes

None.

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-rule-selected` | `{ _id, name, templateId, isActive, ... }` | Row clicked |
| `alx-rule-create` | `undefined` | "Create Rule" button clicked |
| `alx-rule-dry-run` | `{ ruleId, result }` | Dry run completed |
| `alx-rule-deleted` | `{ id: string }` | Rule deleted via row delete button |

### Features
- Columns: name, template, active toggle, last run date, sent count, skipped count
- Per-row "Dry Run" button to preview matched users without sending
- Delete button per row (dispatches `alx-rule-deleted`)
- Active/inactive toggle (calls `toggleRule` API)
- Pagination with totals

### Usage

```html
<alx-rule-list></alx-rule-list>

<script>
  document.querySelector('alx-rule-list')
    .addEventListener('alx-rule-dry-run', (e) => {
      console.log(`Rule ${e.detail.ruleId} dry run:`, e.detail.result);
    });
</script>
```

---

## `<alx-rule-editor>`

Create or edit an automation rule with condition builder, template selection, and behavior configuration.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `rule-id` | `string` | `''` | Rule ID to edit. Empty = create mode. |
| `hide-header` | Boolean | `false` | Hide the card header (use when inside a drawer) |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-rule-saved` | API response object | Rule created or updated |
| `alx-rule-deleted` | `{ id: string }` | Rule deleted via delete button in editor |

### Features
- Fields: name, template (dropdown populated from API), platform, audience
- **Targeting mode** toggle: Query or List. Query mode uses the condition builder; List mode shows a textarea for entering email identifiers directly.
- **Target Conditions** builder (Query mode): add/remove condition rows with field path, operator (equals, not_equals, contains, gt, gte, lt, lte, in, exists), and value
- **Validity dates**: `validFrom` and `validTill` date pickers to constrain when the rule is active
- Delete button in edit mode (dispatches `alx-rule-deleted`)
- **Behavior** settings:
  - Email type: marketing / transactional
  - Max per run (number)
  - Resend after days (number or empty for never)
  - Send once (checkbox)
  - Auto approve (checkbox)
  - Bypass throttle (checkbox)
- Auto-loads existing rule data when `rule-id` is set

### Usage

```html
<!-- Create mode -->
<alx-rule-editor></alx-rule-editor>

<!-- Edit mode -->
<alx-rule-editor rule-id="64a1b2c3d4e5f6a7b8c9d0e1"></alx-rule-editor>
```

---

## `<alx-run-history>`

Paginated execution log with expandable per-rule breakdown for each run.

### Attributes

None.

### Events

None.

### Features
- Date range filter (from/to date inputs)
- Columns: run time, triggered by, duration, rules processed, sent, skipped, errors
- Run status badges: color-coded by state (running, completed, cancelled, failed)
- Run Now button with confirmation dialog
- Cancel button on running jobs to abort in-progress runs
- Expandable rows showing per-rule stats (rule name, sent, skipped, errors)
- Duration formatted as milliseconds or seconds
- Error count shown as danger badge when > 0
- Pagination with totals

### Usage

```html
<alx-run-history></alx-run-history>
```

---

## `<alx-throttle-settings>`

Global throttle configuration to prevent email fatigue.

### Attributes

None.

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-throttle-saved` | `{ maxPerUserPerDay, maxPerUserPerWeek, minGapDays }` | Settings saved |

### Features
- Max per user per day (number input with hint)
- Max per user per week (number input with hint)
- Min gap days between consecutive emails (number input with hint)
- Save button with success confirmation (auto-hides after 3 seconds)
- Responsive: stacks to single column on small screens

### Usage

```html
<alx-throttle-settings></alx-throttle-settings>
```

---

## `<alx-guide-panel>`

Collapsible built-in documentation panel covering templates, rules, throttling, and hooks.

### Attributes

None.

### Events

None.

### Features
- Toggle button to show/hide the full guide
- Collapsible sections: Getting Started, Templates, Rules, Throttling, Hooks
- Rich HTML content with code examples
- No API calls -- all content is static/embedded

### Usage

```html
<alx-guide-panel></alx-guide-panel>
```

# Rule Engine UI — Component Reference

All components are Lit-based custom elements registered under the `alx-` prefix. They accept either a `baseUrl` string (to construct an internal `RuleEngineAPI` instance) or a pre-built `api` object passed as a JavaScript property.

---

## Table of Contents

1. [`<alx-rule-engine-dashboard>`](#1-alx-rule-engine-dashboard)
2. [`<alx-template-editor>`](#2-alx-template-editor)
3. [`<alx-rule-editor>`](#3-alx-rule-editor)
4. [`<alx-template-list>`](#4-alx-template-list)
5. [`<alx-rule-list>`](#5-alx-rule-list)
6. [`<alx-run-history>`](#6-alx-run-history)
7. [`<alx-throttle-settings>`](#7-alx-throttle-settings)
8. [`<alx-send-log>`](#8-alx-send-log)
9. [`<alx-drawer>`](#9-alx-drawer)

---

## 1. `<alx-rule-engine-dashboard>`

**Source:** [`packages/rule-engine/ui/src/components/alx-rule-engine-dashboard.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-rule-engine-dashboard.ts)

The top-level shell component. Renders a five-tab navigation bar (Templates, Rules, History, Sends, Settings) and mounts child components per tab. Template and rule editing opens in a side drawer (`<alx-drawer>`) so users never leave the current tab context.

### Properties

| Name | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `''` | Base URL passed to the internal `RuleEngineAPI` instance. Ignored when `api` is supplied. |
| `api` | `RuleEngineAPI \| undefined` | `undefined` | Pre-built API client. Takes precedence over `baseUrl`. Set as a JS property (not an HTML attribute). |
| `platforms` | `string[]` | `[]` | List of platform values forwarded to child list and editor components. |
| `audiences` | `string[]` | `[]` | List of audience values forwarded to the rule editor. |
| `categories` | `string[]` | `[]` | List of category values forwarded to the template list and editor. |
| `templateSlot` | `(props: any) => any \| undefined` | `undefined` | Optional render function for a custom platform-specific content editor. Set as a JS property. |

### Events

This component does not emit custom events itself. It forwards events from child components internally to orchestrate drawer open/close.

### Slots

None. All content is rendered internally.

### Usage

```html
<alx-rule-engine-dashboard
  base-url="https://api.example.com"
  .platforms="${['email', 'telegram']}"
  .audiences="${['customer', 'provider']}"
  .categories="${['engagement', 'transactional']}"
></alx-rule-engine-dashboard>
```

---

## 2. `<alx-template-editor>`

**Source:** [`packages/rule-engine/ui/src/components/alx-template-editor.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-template-editor.ts)

A form for creating or editing a message template. Uses a two-column layout: a settings sidebar on the left (name, slug, description, category, audience, platform, collection, joins, subjects, variables) and a content area on the right. When a `template-id` attribute is set the component loads the existing template; when absent it initialises an empty form.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `templateId` | `string \| undefined` | `template-id` | `undefined` | ID of the template to load for editing. Omit to create a new template. |
| `platforms` | `string[]` | — (JS only) | `[]` | Platform options for the platform select. Falls back to a free-text input when empty. |
| `audiences` | `string[]` | — (JS only) | `[]` | Audience options for the audience select. Falls back to a free-text input when empty. |
| `categories` | `string[]` | — (JS only) | `[]` | Category options for the category select. Falls back to a free-text input when empty. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-template-saved` | The created or updated template object returned by the API | Fired after a successful save. |
| `alx-template-cancelled` | `undefined` | Fired when the user clicks Cancel. |

### Slots

| Slot | Description |
|---|---|
| `content` | Platform-specific rich editor (e.g. an email HTML editor). The component syncs `bodies`, `subjects`, `preheaders`, `textBody`, `metadata`, `variables`, and `collectionFields` onto the slotted element as properties. The slotted element should dispatch a `content-changed` CustomEvent with `{ bodies, subjects, preheaders, textBody, metadata }` whenever its content changes. Falls back to a plain `<textarea>` when nothing is slotted. |

### Usage

```html
<!-- Create mode -->
<alx-template-editor
  base-url="https://api.example.com"
  .platforms="${['email', 'telegram']}"
  .audiences="${['customer']}"
  .categories="${['engagement']}"
  @alx-template-saved="${(e) => console.log('saved', e.detail)}"
  @alx-template-cancelled="${() => closeDrawer()}"
>
  <my-email-editor slot="content"></my-email-editor>
</alx-template-editor>

<!-- Edit mode -->
<alx-template-editor
  base-url="https://api.example.com"
  template-id="64abc123def456"
  @alx-template-saved="${() => closeDrawer()}"
  @alx-template-cancelled="${() => closeDrawer()}"
></alx-template-editor>
```

---

## 3. `<alx-rule-editor>`

**Source:** [`packages/rule-engine/ui/src/components/alx-rule-editor.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-rule-editor.ts)

A form for creating or editing a send rule. Sections include: basic info (name, platform, template), targeting (query mode with field conditions or list mode with raw identifiers), behaviour (rule type, max per run, resend policy, send-once, auto-approve, bypass throttle), schedule (cron presets or custom expression with timezone), and validity date range. When a template with a linked collection is selected, collection fields are fetched and used to power a structured condition builder with type-aware operator filtering.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `ruleId` | `string \| undefined` | `rule-id` | `undefined` | ID of the rule to load for editing. Omit to create a new rule. |
| `platforms` | `string[]` | — (JS only) | `[]` | Platform options. Falls back to a free-text input when empty. |
| `audiences` | `string[]` | — (JS only) | `[]` | Audience options for query-mode targeting. Falls back to a free-text input when empty. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-rule-saved` | The created or updated rule object returned by the API | Fired after a successful save. |
| `alx-rule-cancel` | `undefined` | Fired when the user clicks Cancel. |

### Slots

None.

### Usage

```html
<!-- Create mode -->
<alx-rule-editor
  base-url="https://api.example.com"
  .platforms="${['email']}"
  .audiences="${['customer', 'provider']}"
  @alx-rule-saved="${() => closeDrawer()}"
  @alx-rule-cancel="${() => closeDrawer()}"
></alx-rule-editor>

<!-- Edit mode -->
<alx-rule-editor
  base-url="https://api.example.com"
  rule-id="64abc999def000"
  @alx-rule-saved="${() => closeDrawer()}"
  @alx-rule-cancel="${() => closeDrawer()}"
></alx-rule-editor>
```

### Condition Builder

The condition builder is embedded directly inside `<alx-rule-editor>` — it is not a separate, standalone component.

**How it works:**

1. When the user selects a template that has a `collectionName` and optional `joins`, the editor calls `GET /collections/:name/fields?joins=...` to load available fields.
2. Fields are displayed in a grouped `<select>` dropdown, using `<optgroup>` elements per join alias so root and joined fields are visually separated.
3. Once a field is selected, the operator list is filtered by field type using the `TYPE_OPERATORS` mapping (see table below).
4. The value input adapts to the field type:
   - `enum` fields → `<select>` dropdown populated with `enumValues`
   - `boolean` fields → a `true` / `false` dropdown
   - `date` fields → `<input type="date">`
   - `number` fields → `<input type="number">`
   - All other fields → `<input type="text">`
5. The "Preview" button calls `POST /rules/preview-conditions` with the current conditions and displays the matched document count inline next to the button.
6. If the selected template has no linked collection, the field input falls back to a free-text `<input>` and all operators are available.

#### TYPE_OPERATORS Mapping

**Source:** [`packages/rule-engine/ui/src/components/alx-rule-editor.types.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-rule-editor.types.ts)

| Field Type | Valid Operators |
|------------|----------------|
| `string` | `eq`, `neq`, `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `number` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists` |
| `boolean` | `eq`, `neq`, `exists`, `not_exists` |
| `date` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists` |
| `objectId` | `eq`, `neq`, `in`, `not_in`, `exists`, `not_exists` |
| `array` | `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `object` | `exists`, `not_exists` |

---

## 4. `<alx-template-list>`

**Source:** [`packages/rule-engine/ui/src/components/alx-template-list.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-template-list.ts)

A paginated table listing all templates. Includes toolbar filters by category and platform, inline active/inactive toggles, and per-row Edit, Clone, and Delete actions. Loads 20 records per page. Exposes a public `load()` method to programmatically refresh the list.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `platforms` | `string[]` | — (JS only) | `[]` | Platform filter options shown in the toolbar. No filter control is rendered when empty. |
| `categories` | `string[]` | — (JS only) | `[]` | Category filter options shown in the toolbar. No filter control is rendered when empty. |
| `density` | `'default' \| 'compact'` | `density` | `'default'` | Controls row and spacing density. Reflected as an attribute. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-template-edit` | `{ templateId: string }` | Fired when the user clicks Edit on a row. |
| `alx-template-created` | `undefined` | Fired when the user clicks the "+ New Template" button. |
| `alx-template-deleted` | `{ _id: string }` | Fired after a template is successfully deleted. |

### Slots

None.

### Usage

```html
<alx-template-list
  base-url="https://api.example.com"
  .platforms="${['email', 'telegram']}"
  .categories="${['engagement', 'transactional']}"
  density="compact"
  @alx-template-edit="${(e) => openEditor(e.detail.templateId)}"
  @alx-template-created="${() => openEditor()}"
  @alx-template-deleted="${(e) => console.log('deleted', e.detail._id)}"
></alx-template-list>
```

---

## 5. `<alx-rule-list>`

**Source:** [`packages/rule-engine/ui/src/components/alx-rule-list.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-rule-list.ts)

A paginated table listing all rules. Includes a platform filter in the toolbar, inline active/inactive toggles, and per-row Edit, Dry Run, Clone, and Delete actions. A dry run result badge (matched count and error count) is displayed inline after a dry run completes. Loads 20 records per page. Exposes a public `load()` method to programmatically refresh the list.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `platforms` | `string[]` | — (JS only) | `[]` | Platform filter options shown in the toolbar. No filter control is rendered when empty. |
| `density` | `'default' \| 'compact'` | `density` | `'default'` | Controls row and spacing density. Reflected as an attribute. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-rule-edit` | `{ ruleId: string }` | Fired when the user clicks Edit on a row. |
| `alx-rule-created` | `undefined` | Fired when the user clicks the "+ New Rule" button. |
| `alx-rule-deleted` | `{ _id: string }` | Fired after a rule is successfully deleted. |
| `alx-rule-dry-run` | `{ ruleId: string; result: unknown }` | Fired after a dry run completes. `result` is the raw API response. |

### Slots

None.

### Usage

```html
<alx-rule-list
  base-url="https://api.example.com"
  .platforms="${['email']}"
  @alx-rule-edit="${(e) => openRuleEditor(e.detail.ruleId)}"
  @alx-rule-created="${() => openRuleEditor()}"
  @alx-rule-deleted="${(e) => console.log('deleted', e.detail._id)}"
  @alx-rule-dry-run="${(e) => console.log('dry run result', e.detail)}"
></alx-rule-list>
```

---

## 6. `<alx-run-history>`

**Source:** [`packages/rule-engine/ui/src/components/alx-run-history.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-run-history.ts)

A paginated table of rule-engine run logs. Includes a date-range filter toolbar, a "Run Now" button that triggers an immediate run, and real-time progress tracking via 2-second polling while a run is active. Active runs show a live progress bar with sent/skipped/throttled/failed counters. Running entries show a Cancel button. Each row is expandable to reveal per-rule statistics for that run.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `density` | `'default' \| 'compact'` | `density` | `'default'` | Controls row and spacing density. Reflected as an attribute. |

### Events

This component does not emit custom events.

### Slots

None.

### Usage

```html
<alx-run-history
  base-url="https://api.example.com"
  density="default"
></alx-run-history>
```

---

## 7. `<alx-throttle-settings>`

**Source:** [`packages/rule-engine/ui/src/components/alx-throttle-settings.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-throttle-settings.ts)

A settings form for global send throttle limits. Controls the maximum messages per user per day, per week, and the minimum gap between consecutive messages to the same user. Also manages an optional send window (start hour, end hour, IANA timezone) that restricts all sends to a specific time of day. Loads the current configuration on connect and saves via the throttle API endpoint.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `density` | `'default' \| 'compact'` | `density` | `'default'` | Controls spacing density. Reflected as an attribute. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-throttle-saved` | `{ maxPerUserPerDay: number; maxPerUserPerWeek: number; minGapDays: number; sendWindow: { startHour: number; endHour: number; timezone: string } \| null }` | Fired after the settings are successfully saved. |

### Slots

None.

### Usage

```html
<alx-throttle-settings
  base-url="https://api.example.com"
  @alx-throttle-saved="${(e) => console.log('saved throttle config', e.detail)}"
></alx-throttle-settings>
```

---

## 8. `<alx-send-log>`

**Source:** [`packages/rule-engine/ui/src/components/alx-send-log.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-send-log.ts)

A paginated, filterable log viewer for individual send records. Filters include status (sent, skipped, throttled, failed, error, invalid), rule ID, date range (from/to), and contact search. Contact search and rule ID filter apply on Enter key or the Search button. Loads 50 records per page. Exposes a public `load()` method to programmatically refresh.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | `base-url` | `''` | Base URL for the internal API instance. |
| `api` | `RuleEngineAPI \| undefined` | — (JS only) | `undefined` | Pre-built API client. |
| `density` | `'default' \| 'compact'` | `density` | `'default'` | Controls row and spacing density. Reflected as an attribute. |

### Events

This component does not emit custom events.

### Slots

None.

### Usage

```html
<alx-send-log
  base-url="https://api.example.com"
  density="compact"
></alx-send-log>
```

---

## 9. `<alx-drawer>`

**Source:** [`packages/rule-engine/ui/src/components/alx-drawer.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-drawer.ts)

A right-side slide-in drawer panel. Renders a fixed backdrop and a panel (max width 560 px or 90vw). Closes on backdrop click or the Escape key. Used internally by `<alx-rule-engine-dashboard>` to host the template and rule editors, but can be used standalone.

### Properties

| Name | Type | Attribute | Default | Description |
|---|---|---|---|---|
| `open` | `boolean` | `open` | `false` | When `true` the drawer slides in and the backdrop becomes visible. Reflected as an attribute. |
| `heading` | `string` | `heading` | `''` | Text displayed in the drawer header. |

### Events

| Event | Detail type | Description |
|---|---|---|
| `alx-drawer-closed` | `undefined` | Fired when the drawer closes — via backdrop click, the close button, or the Escape key. |

### Slots

| Slot | Description |
|---|---|
| *(default)* | Content rendered inside the scrollable drawer body. |

### Usage

```html
<alx-drawer
  heading="Edit Template"
  .open="${isOpen}"
  @alx-drawer-closed="${() => { isOpen = false; }}"
>
  <p>Any content here scrolls inside the drawer.</p>
</alx-drawer>
```

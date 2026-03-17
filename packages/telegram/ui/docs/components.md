# Components

All components in @astralibx/telegram-ui organized by domain.

---

## Shared

### `<alx-telegram-dashboard>`

All-in-one dashboard with tabs for every domain, drawer-based editing, density toggle, and theme switcher.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density for all child components |
| `theme` | `theme` | `'light' \| 'dark'` | `'light'` | Color theme with built-in dark mode |
| `defaultTab` | `default-tab` | `TabId` | `'accounts'` | Tab shown on initial load |

**Tabs:** `accounts`, `templates`, `rules`, `runs`, `inbox`, `bot-stats`, `analytics`, `settings`

**Features:**
- Hash-based routing (`#accounts`, `#templates`, etc.)
- Lazy-loads tab content on first visit
- Built-in drawer for account/template/rule editing
- Toast notifications on save/delete
- Density and theme toggle controls

---

### `<alx-tg-drawer>`

Slide-in panel for hosting editor forms. Closes on backdrop click, Escape key, or close button.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `open` | `open` | `boolean` | `false` | Show/hide the drawer |
| `heading` | `heading` | `string` | `''` | Title shown in the drawer header |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-drawer-closed` | -- | Emitted when drawer is closed |

**Slots:** Default slot for editor content.

---

## Account Management

### `<alx-tg-account-list>`

Paginated table of Telegram accounts with status badges, health scores, capacity bars, and connect/disconnect actions.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `page` | `page` | `number` | `1` | Current page |
| `limit` | `limit` | `number` | `20` | Items per page |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-account-selected` | `TgAccount` | User clicked edit on an account |
| `alx-account-create` | -- | User clicked "Add Account" |
| `alx-account-deleted` | `TgAccount` | Account was deleted |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload the account list from the API |

---

### `<alx-tg-account-form>`

Create/edit form for Telegram accounts. Fields: phone number, name, session string, daily limit, delay min/max.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `hideHeader` | `hide-header` | `boolean` | `false` | Hide the card header (for drawer use) |
| `accountId` | `account-id` | `string` | `''` | Account ID to edit; empty for create mode |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-saved` | API response | Account was created or updated |
| `alx-deleted` | `{ _id }` | Account was deleted |
| `alx-cancelled` | -- | User clicked cancel |

---

## Rule Engine

### `<alx-tg-template-list>`

Paginated table of message templates showing name, message count, variables, and category. Supports cloning templates via a one-click duplicate action.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `page` | `page` | `number` | `1` | Current page |
| `limit` | `limit` | `number` | `20` | Items per page |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-template-selected` | `TgTemplate` | User clicked edit on a template |
| `alx-template-create` | -- | User clicked "Create" |
| `alx-template-cloned` | `{ name }` | Template was cloned; `name` is the new template name |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload the template list from the API |

---

### `<alx-tg-template-editor>`

Editor for message templates with multi-variant message editing, custom fields, media URL, preview support, and category/platform/audience metadata.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `hideHeader` | `hide-header` | `boolean` | `false` | Hide the card header |
| `templateId` | `template-id` | `string` | `''` | Template ID to edit; empty for create mode |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-template-saved` | API response | Template was created or updated |
| `alx-template-deleted` | `{ _id }` | Template was deleted |
| `alx-template-cancelled` | -- | User clicked cancel |

---

### `<alx-tg-rule-list>`

Paginated table of campaign rules with active toggle, mode badge (query/list), template reference, and last run date. Supports cloning rules via a one-click duplicate action (cloned rules default to inactive).

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `page` | `page` | `number` | `1` | Current page |
| `limit` | `limit` | `number` | `20` | Items per page |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-rule-selected` | `TgRule` | User clicked edit on a rule |
| `alx-rule-create` | -- | User clicked "Create" |
| `alx-rule-cloned` | `{ name }` | Rule was cloned; `name` is the new rule name |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload the rule list from the API |

---

### `<alx-tg-rule-editor>`

Rule editor with condition builder (query mode) or identifier list (list mode), template selector, send-once toggle, max-per-run limit, and validity date range.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `hideHeader` | `hide-header` | `boolean` | `false` | Hide the card header |
| `ruleId` | `rule-id` | `string` | `''` | Rule ID to edit; empty for create mode |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-rule-saved` | API response | Rule was created or updated |
| `alx-rule-deleted` | `{ _id }` | Rule was deleted |
| `alx-rule-cancelled` | -- | User clicked cancel |

**Condition Operators:** `eq`, `neq`, `contains`, `gt`, `lt`, `in`, `exists`

---

### `<alx-tg-throttle-settings>`

Per-recipient throttle configuration panel. Controls how many messages a single user can receive to prevent spam and protect account health.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxPerUserPerDay` | `number` | `1` | Maximum messages sent to one user in a single day |
| `maxPerUserPerWeek` | `number` | `3` | Maximum messages sent to one user in a 7-day window |
| `minGapDays` | `number` | `1` | Minimum days between consecutive messages to the same user |
| `throttleWindow` | `'rolling' \| 'fixed'` | `'rolling'` | Rolling = sliding window from last send; Fixed = calendar-based reset |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-throttle-saved` | `ThrottleData` | Settings were saved successfully |

---

### `<alx-tg-run-history>`

Paginated table of campaign run logs with run ID, trigger source, status badges, sent/failed/skipped counters, start time, and duration. Includes a "Run Now" button to trigger execution.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `page` | `page` | `number` | `1` | Current page |
| `limit` | `limit` | `number` | `20` | Items per page |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload run history from the API |

---

## Inbox

### `<alx-tg-inbox>`

Split-pane inbox with conversation list on the left and message thread on the right. Supports search, unread badges, media rendering (photos, files), and inline message sending.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `loadConversations()` | Reload the conversation list from the API |

**Features:**
- Search conversations by name/username
- Unread count badges
- Auto-scroll to latest message
- Mark-as-read on conversation select
- Photo and file media rendering
- Responsive: collapses to single-column on mobile

---

## Bot

### `<alx-tg-bot-stats>`

Bot monitoring dashboard with status card, user stat cards (total, active, blocked), and a paginated user table with Telegram ID, username, name, status, and last active date.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |
| `page` | `page` | `number` | `1` | Current page (users table) |
| `limit` | `limit` | `number` | `20` | Items per page |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload bot status, stats, and users from the API |

---

## Analytics

### `<alx-tg-analytics>`

Analytics dashboard with aggregate stat cards (total sent, failed, skipped), filterable send log table, and error log table. Supports status filter and date range filtering.

**Properties:**

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `density` | `density` | `'default' \| 'compact'` | `'default'` | Display density |

**Public Methods:**

| Method | Description |
|--------|-------------|
| `load()` | Reload stats, send logs, and error logs from the API |

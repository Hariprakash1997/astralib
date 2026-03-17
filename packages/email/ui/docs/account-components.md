# Account Components

9 components for managing email accounts, health monitoring, warmup tracking, SMTP testing, bounce detection, approval workflows, and global settings.

All components use `AccountAPI` internally and require `accountManagerApi` to be configured via `AlxConfig.setup()`.

---

## `<alx-account-list>`

Paginated table of email accounts with status badges, health bars, capacity indicators, and warmup status.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Current page number |
| `limit` | `number` | `20` | Items per page |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-account-selected` | `{ _id, email, provider, status, ... }` | Row clicked |
| `alx-account-create` | `undefined` | "Create" button clicked |
| `alx-account-deleted` | `{ id: string }` | Account deleted via row delete button |

### Features
- Status/provider dropdown filters
- Health score bar (color-coded: green >80, yellow >50, red)
- Capacity usage bar (sent/limit ratio)
- Warmup active/off badge
- Connection column showing SMTP/IMAP host:port per account
- Dynamic metadata columns (shows top 3 metadata keys as separate columns)
- Edit icon button per row (no row click)
- Health score and warmup day display from nested API fields
- Delete button per row (dispatches `alx-account-deleted`)
- Pagination controls

### Usage

```html
<alx-account-list page="1" limit="10"></alx-account-list>

<script>
  document.querySelector('alx-account-list')
    .addEventListener('alx-account-selected', (e) => {
      console.log('Selected:', e.detail.email);
    });
</script>
```

---

## `<alx-account-form>`

Create or edit an email account with SMTP and optional IMAP configuration.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `account-id` | `string` | `''` | Account ID to edit. Empty = create mode. |
| `hide-header` | Boolean | `false` | Hide the card header (use when inside a drawer) |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-account-saved` | API response object | Account created or updated |
| `alx-account-cancelled` | `undefined` | Cancel button clicked |
| `alx-account-deleted` | `{ id: string }` | Account deleted via delete button in form |

### Features
- Provider selection (Gmail / AWS SES)
- SMTP config fields: host, port, user, password
- IMAP config fields (shown only for Gmail provider)
- IMAP auto-derive for Gmail (checkbox + auto-config, optional customize)
- Delete button in edit mode (dispatches `alx-account-deleted`)
- Redesigned metadata editor with card-per-entry layout
- Auto-loads account data when `account-id` is set

### Usage

```html
<!-- Create mode -->
<alx-account-form></alx-account-form>

<!-- Edit mode -->
<alx-account-form account-id="64a1b2c3d4e5f6a7b8c9d0e1"></alx-account-form>
```

---

## `<alx-account-health>`

Health dashboard showing all accounts with health scores, bounce rates, consecutive errors, and last error info.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `refresh-interval` | `number` | `30` | Auto-refresh interval in seconds. Set to `0` to disable. |

### Events

None.

### Features
- Grid of health cards, one per account
- Color-coded health score (green >80, yellow >50, red)
- Health bar visualization
- Bounce rate percentage
- Consecutive error count
- Last error date and message
- Auto-refresh with configurable interval

### Usage

```html
<alx-account-health refresh-interval="60"></alx-account-health>
```

---

## `<alx-account-warmup>`

Warmup status for a specific account with progress bar, phase schedule, and start action.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `account-id` | `string` | `''` | Account ID to show warmup status for (required) |

### Events

None.

### Features
- Status badge: Active / Completed / Inactive
- Stats: current day, phase, daily limit
- Progress bar with percentage
- Phase schedule list with current phase highlighted
- Start Warmup button (when inactive)
- Refresh button

### Usage

```html
<alx-account-warmup account-id="64a1b2c3d4e5f6a7b8c9d0e1"></alx-account-warmup>
```

---

## `<alx-account-capacity>`

Aggregate and per-account sending capacity overview with usage bars.

### Attributes

None.

### Events

None.

### Features
- Aggregate stats: total limit, sent today, remaining
- Per-account capacity bars with color-coded usage (green >50% remaining, yellow >20%, red)
- Sent/limit ratio display
- Refresh button

### Usage

```html
<alx-account-capacity></alx-account-capacity>
```

---

## `<alx-smtp-tester>`

One-click SMTP connection test for a specific account.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `account-id` | `string` | `''` | Account ID to test (required) |

### Events

None.

### Features
- Test Connection button
- Loading spinner during test
- Success/failure result with message and icon

### Usage

```html
<alx-smtp-tester account-id="64a1b2c3d4e5f6a7b8c9d0e1"></alx-smtp-tester>
```

---

## `<alx-bounce-status>`

IMAP bounce check status. Shows a single account detail view when `account-id` is set, or a table of all accounts otherwise.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `account-id` | `string` | `''` | Optional. Single account view when set, table view when empty. |

### Events

None.

### Features
- **Single view**: IMAP enabled badge, last checked date, bounces found count, status badge, "Check Now" button
- **Table view**: all accounts with IMAP on/off, last checked, bounce count, per-row "Check Now"

### Usage

```html
<!-- All accounts table -->
<alx-bounce-status></alx-bounce-status>

<!-- Single account detail -->
<alx-bounce-status account-id="64a1b2c3d4e5f6a7b8c9d0e1"></alx-bounce-status>
```

---

## `<alx-approval-queue>`

Draft approval queue with select-all, individual and bulk approve/reject actions.

### Attributes

None.

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-draft-approved` | `{ id }` or `{ ids: string[] }` | Draft(s) approved |
| `alx-draft-rejected` | `{ id }` or `{ ids: string[] }` | Draft(s) rejected |
| `alx-draft-view` | `{ _id, to, subject, status, createdAt }` | View button clicked |

### Features
- Table of pending drafts with recipient, subject, created date
- Individual approve/reject buttons per row
- Checkbox selection with select-all
- Bulk approve/reject for selected items
- Selected count indicator
- Refresh button

### Usage

```html
<alx-approval-queue></alx-approval-queue>

<script>
  document.querySelector('alx-approval-queue')
    .addEventListener('alx-draft-approved', (e) => {
      console.log('Approved:', e.detail);
    });
</script>
```

---

## `<alx-global-settings>`

Collapsible settings panel for timezone, dev mode, IMAP configuration, approval workflow, and queue tuning. Includes info banners and section descriptions for each settings group.

### Attributes

None.

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `alx-settings-saved` | `{ section, data }` | A settings section was saved |

### Features
- **Timezone & General**: timezone input, dev mode toggle
- **IMAP Configuration**: enable/disable, poll interval (minutes)
- **Approval Workflow**: enable/disable, auto-approve timeout (minutes)
- **Queue Tuning**: concurrency, retry attempts, retry delay (ms)
- Each section is collapsible with independent save buttons
- Per-section saving state

### Usage

```html
<alx-global-settings></alx-global-settings>

<script>
  document.querySelector('alx-global-settings')
    .addEventListener('alx-settings-saved', (e) => {
      console.log(`Saved ${e.detail.section}:`, e.detail.data);
    });
</script>
```

---

## `<alx-metadata-editor>`

Key-value metadata editor for attaching arbitrary data to an account. Embedded inside `<alx-account-form>` but can also be used standalone.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `metadata` | `string` | `'{}'` | JSON object of initial metadata key-value pairs |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `metadata-change` | `Record<string, string \| string[]>` | Fired on any add, edit, or remove of a key-value row |

### Features
- Add/remove key-value rows
- Per-row type toggle: text (single string) or list (array of strings)
- Dispatches `metadata-change` on every change with the full metadata object

### Usage

```html
<alx-metadata-editor metadata='{"region":"us-east","tags":["vip","beta"]}'></alx-metadata-editor>

<script>
  document.querySelector('alx-metadata-editor')
    .addEventListener('metadata-change', (e) => {
      console.log('Metadata updated:', e.detail);
    });
</script>
```

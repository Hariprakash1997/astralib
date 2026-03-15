# Events

All custom events dispatched by `@astralibx/email-ui` components. Every event uses `bubbles: true` and `composed: true` so they cross Shadow DOM boundaries and can be caught by parent elements.

## Event Naming Convention

All events follow the pattern `alx-{noun}-{verb}` (e.g., `alx-account-selected`, `alx-template-saved`).

## Account Events

### `alx-account-selected`

Dispatched by `<alx-account-list>` when a row is clicked.

```typescript
interface Detail {
  _id: string;
  email: string;
  senderName?: string;
  provider: string;        // 'gmail' | 'ses'
  status: string;          // 'active' | 'warmup' | 'disabled' | 'error'
  healthScore?: number;
  dailyLimit?: number;
  sentToday?: number;
  warmupActive?: boolean;
}
```

```javascript
el.addEventListener('alx-account-selected', (e) => {
  router.navigate(`/accounts/${e.detail._id}`);
});
```

### `alx-account-create`

Dispatched by `<alx-account-list>` when the "Create" button is clicked.

```typescript
// detail: undefined
```

```javascript
el.addEventListener('alx-account-create', () => {
  showCreateAccountForm();
});
```

### `alx-account-saved`

Dispatched by `<alx-account-form>` after a successful create or update.

```typescript
// detail: API response object (the created/updated account)
```

```javascript
el.addEventListener('alx-account-saved', (e) => {
  console.log('Account saved:', e.detail._id);
  refreshAccountList();
});
```

### `alx-account-cancelled`

Dispatched by `<alx-account-form>` when the "Cancel" button is clicked.

```typescript
// detail: undefined
```

```javascript
el.addEventListener('alx-account-cancelled', () => {
  hideForm();
});
```

### `alx-account-deleted`

Dispatched by `<alx-account-list>` or `<alx-account-form>` when an account is deleted.

```typescript
interface Detail { id: string }
```

```javascript
el.addEventListener('alx-account-deleted', (e) => {
  console.log('Deleted account:', e.detail.id);
  refreshAccountList();
});
```

---

## Template Events

### `alx-template-selected`

Dispatched by `<alx-template-list>` when a row is clicked.

```typescript
interface Detail {
  _id: string;
  name: string;
  slug: string;
  category: string;
  audience: string;
  platform: string;
  isActive: boolean;
}
```

```javascript
el.addEventListener('alx-template-selected', (e) => {
  openTemplateEditor(e.detail._id);
});
```

### `alx-template-create`

Dispatched by `<alx-template-list>` when the "Create Template" button is clicked.

```typescript
// detail: undefined
```

### `alx-template-saved`

Dispatched by `<alx-template-editor>` after a successful create or update.

```typescript
// detail: API response object (the created/updated template)
```

```javascript
el.addEventListener('alx-template-saved', (e) => {
  console.log('Template saved:', e.detail.name);
  navigateToTemplateList();
});
```

### `alx-template-deleted`

Dispatched by `<alx-template-list>` or `<alx-template-editor>` when a template is deleted.

```typescript
interface Detail { id: string }
```

```javascript
el.addEventListener('alx-template-deleted', (e) => {
  console.log('Deleted template:', e.detail.id);
  refreshTemplateList();
});
```

---

## Rule Events

### `alx-rule-selected`

Dispatched by `<alx-rule-list>` when a row is clicked.

```typescript
interface Detail {
  _id: string;
  name: string;
  templateName?: string;
  templateId: string;
  isActive: boolean;
  lastRunAt: string | null;
  totalSent: number;
  totalSkipped: number;
}
```

### `alx-rule-create`

Dispatched by `<alx-rule-list>` when the "Create Rule" button is clicked.

```typescript
// detail: undefined
```

### `alx-rule-dry-run`

Dispatched by `<alx-rule-list>` after a dry run completes.

```typescript
interface Detail {
  ruleId: string;
  result: unknown;  // API response from dry-run endpoint
}
```

```javascript
el.addEventListener('alx-rule-dry-run', (e) => {
  console.log(`Dry run for rule ${e.detail.ruleId}:`, e.detail.result);
});
```

### `alx-rule-saved`

Dispatched by `<alx-rule-editor>` after a successful create or update.

```typescript
// detail: API response object (the created/updated rule)
```

### `alx-rule-deleted`

Dispatched by `<alx-rule-list>` or `<alx-rule-editor>` when a rule is deleted.

```typescript
interface Detail { id: string }
```

```javascript
el.addEventListener('alx-rule-deleted', (e) => {
  console.log('Deleted rule:', e.detail.id);
  refreshRuleList();
});
```

---

## Metadata Events

### `metadata-change`

Dispatched by `<alx-metadata-editor>` on any add, edit, or remove of a key-value row.

```typescript
type Detail = Record<string, string | string[]>;
```

```javascript
el.addEventListener('metadata-change', (e) => {
  console.log('Metadata:', e.detail);
});
```

---

## Draft / Approval Events

### `alx-draft-approved`

Dispatched by `<alx-approval-queue>` when draft(s) are approved.

```typescript
// Single approval
interface Detail { id: string }

// Bulk approval
interface Detail { ids: string[] }
```

```javascript
el.addEventListener('alx-draft-approved', (e) => {
  if (e.detail.ids) {
    console.log(`Bulk approved ${e.detail.ids.length} drafts`);
  } else {
    console.log(`Approved draft: ${e.detail.id}`);
  }
});
```

### `alx-draft-rejected`

Dispatched by `<alx-approval-queue>` when draft(s) are rejected. Same detail shape as `alx-draft-approved`.

### `alx-draft-view`

Dispatched by `<alx-approval-queue>` when the "View" button is clicked on a draft row.

```typescript
interface Detail {
  _id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: string;
}
```

```javascript
el.addEventListener('alx-draft-view', (e) => {
  openDraftPreview(e.detail._id);
});
```

---

## Settings Events

### `alx-settings-saved`

Dispatched by `<alx-global-settings>` when a settings section is saved.

```typescript
interface Detail {
  section: string;  // 'timezone' | 'imap' | 'approval' | 'queue'
  data: Record<string, unknown>;
}
```

```javascript
el.addEventListener('alx-settings-saved', (e) => {
  console.log(`Saved ${e.detail.section}:`, e.detail.data);
  showToast('Settings saved');
});
```

### `alx-throttle-saved`

Dispatched by `<alx-throttle-settings>` when throttle settings are saved.

```typescript
interface Detail {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
}
```

---

## Listening in Different Frameworks

### Angular

```html
<alx-account-list (alx-account-selected)="onSelect($event)"></alx-account-list>
```

### Vue

```html
<alx-account-list @alx-account-selected="onSelect" />
```

### React

```tsx
useEffect(() => {
  const el = ref.current;
  const handler = (e: Event) => onSelect((e as CustomEvent).detail);
  el?.addEventListener('alx-account-selected', handler);
  return () => el?.removeEventListener('alx-account-selected', handler);
}, []);
```

### Plain JS

```javascript
document.querySelector('alx-account-list')
  .addEventListener('alx-account-selected', (e) => {
    console.log(e.detail);
  });
```

## Event Summary Table

| Event | Component | Detail |
|-------|-----------|--------|
| `alx-account-selected` | `<alx-account-list>` | Account object |
| `alx-account-create` | `<alx-account-list>` | `undefined` |
| `alx-account-saved` | `<alx-account-form>` | API response |
| `alx-account-cancelled` | `<alx-account-form>` | `undefined` |
| `alx-account-deleted` | `<alx-account-list>`, `<alx-account-form>` | `{ id }` |
| `alx-template-selected` | `<alx-template-list>` | Template object |
| `alx-template-create` | `<alx-template-list>` | `undefined` |
| `alx-template-saved` | `<alx-template-editor>` | API response |
| `alx-template-deleted` | `<alx-template-list>`, `<alx-template-editor>` | `{ id }` |
| `alx-rule-selected` | `<alx-rule-list>` | Rule object |
| `alx-rule-create` | `<alx-rule-list>` | `undefined` |
| `alx-rule-dry-run` | `<alx-rule-list>` | `{ ruleId, result }` |
| `alx-rule-saved` | `<alx-rule-editor>` | API response |
| `alx-rule-deleted` | `<alx-rule-list>`, `<alx-rule-editor>` | `{ id }` |
| `metadata-change` | `<alx-metadata-editor>` | `Record<string, string \| string[]>` |
| `alx-draft-approved` | `<alx-approval-queue>` | `{ id }` or `{ ids }` |
| `alx-draft-rejected` | `<alx-approval-queue>` | `{ id }` or `{ ids }` |
| `alx-draft-view` | `<alx-approval-queue>` | Draft object |
| `alx-settings-saved` | `<alx-global-settings>` | `{ section, data }` |
| `alx-throttle-saved` | `<alx-throttle-settings>` | Throttle settings |

# Events

All custom events dispatched by `@astralibx/email-ui` components. Every event uses `bubbles: true` and `composed: true` so they cross Shadow DOM boundaries and can be caught by parent elements.

> **Note:** For rule engine component events (`alx-template-*`, `alx-rule-*`, `alx-run-*`, `alx-throttle-*`, `alx-send-log-*`), see [@astralibx/rule-engine-ui](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md). This document covers events from account and analytics components only.

## Event Naming Convention

All events follow the pattern `alx-{noun}-{verb}` (e.g., `alx-account-selected`, `alx-account-saved`).

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

## Drawer Events

### `alx-drawer-closed`

Emitted when the drawer is closed (via backdrop click, Escape key, or close button).

**Detail:** `undefined`

**Source:** `<alx-drawer>`

---

### Window Events

These events are dispatched on the `window` object, not on components.

#### alx-auth-error

Dispatched when the API returns 401 Unauthorized or 403 Forbidden. Use this to trigger re-authentication in your host application.

**Detail:**
```typescript
{ status: number; url: string }
```

**Usage:**
```javascript
window.addEventListener('alx-auth-error', (e) => {
  console.log('Auth failed:', e.detail.status, e.detail.url);
  // Redirect to login or refresh token
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
| `metadata-change` | `<alx-metadata-editor>` | `Record<string, string \| string[]>` |
| `alx-draft-approved` | `<alx-approval-queue>` | `{ id }` or `{ ids }` |
| `alx-draft-rejected` | `<alx-approval-queue>` | `{ id }` or `{ ids }` |
| `alx-draft-view` | `<alx-approval-queue>` | Draft object |
| `alx-drawer-closed` | `<alx-drawer>` | `undefined` |
| `alx-settings-saved` | `<alx-global-settings>` | `{ section, data }` |
| `alx-auth-error` | `window` | `{ status, url }` |

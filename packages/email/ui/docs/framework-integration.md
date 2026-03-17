# Framework Integration

`@astralibx/email-ui` components are native Custom Elements. They work in any framework that can render HTML elements. This guide covers Angular, React, Vue, Next.js, and plain HTML.

## Angular

### Setup

```typescript
// app.config.ts or main.ts
import { AlxConfig } from '@astralibx/email-ui';

AlxConfig.setup({
  accountManagerApi: '/api/email-accounts',
  ruleEngineApi: '/api/email-rules',
  analyticsApi: '/api/analytics',
  authToken: `Bearer ${authService.getToken()}`,
  theme: 'dark',
});
```

### Component Usage

Add `CUSTOM_ELEMENTS_SCHEMA` to any component that uses `alx-` tags:

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@astralibx/email-ui';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <alx-account-list
      [attr.page]="currentPage"
      [attr.limit]="pageSize"
      (alx-account-selected)="onAccountSelected($event)"
      (alx-account-create)="showCreateForm()"
    ></alx-account-list>

    <alx-account-form
      *ngIf="showForm"
      [attr.account-id]="selectedAccountId"
      (alx-account-saved)="onAccountSaved($event)"
      (alx-account-cancelled)="showForm = false"
    ></alx-account-form>
  `,
})
export class EmailAccountsComponent {
  currentPage = 1;
  pageSize = 20;
  showForm = false;
  selectedAccountId = '';

  onAccountSelected(event: CustomEvent) {
    this.selectedAccountId = event.detail._id;
    this.showForm = true;
  }

  showCreateForm() {
    this.selectedAccountId = '';
    this.showForm = true;
  }

  onAccountSaved(event: CustomEvent) {
    this.showForm = false;
    // Refresh list by updating page to trigger reload
    this.currentPage = this.currentPage;
  }
}
```

### Dynamic Auth Token

```typescript
// On token refresh
import { AlxConfig } from '@astralibx/email-ui';

authService.onTokenRefresh((newToken) => {
  AlxConfig.setAuthToken(`Bearer ${newToken}`);
});
```

---

## React

### Setup

```tsx
// src/email-ui-init.ts
import { AlxConfig } from '@astralibx/email-ui';

export function initEmailUI(token: string) {
  AlxConfig.setup({
    accountManagerApi: '/api/email-accounts',
    ruleEngineApi: '/api/email-rules',
    analyticsApi: '/api/analytics',
    authToken: `Bearer ${token}`,
    theme: 'dark',
  });
}
```

### Component Usage

Custom Elements in React require `ref`-based event listeners for custom events:

```tsx
import { useEffect, useRef } from 'react';
import '@astralibx/email-ui';

export function AccountList({ onSelect }: { onSelect: (account: any) => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: Event) => onSelect((e as CustomEvent).detail);
    el.addEventListener('alx-account-selected', handler);
    return () => el.removeEventListener('alx-account-selected', handler);
  }, [onSelect]);

  return <alx-account-list ref={ref} />;
}

export function AnalyticsDashboard() {
  return (
    <div>
      <alx-analytics-overview date-from="2025-01-01" date-to="2025-01-31" />
      <alx-analytics-timeline date-from="2025-01-01" date-to="2025-01-31" interval="daily" />
      <alx-analytics-engagement date-from="2025-01-01" date-to="2025-01-31" />
    </div>
  );
}
```

### TypeScript Declarations

Add type declarations for JSX:

```typescript
// src/types/custom-elements.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'alx-account-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      page?: number;
      limit?: number;
    }, HTMLElement>;
    'alx-account-form': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'account-id'?: string;
    }, HTMLElement>;
    'alx-analytics-overview': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'date-from'?: string;
      'date-to'?: string;
    }, HTMLElement>;
    'alx-analytics-timeline': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      'date-from'?: string;
      'date-to'?: string;
      interval?: 'daily' | 'weekly' | 'monthly';
    }, HTMLElement>;
    // Add more as needed
  }
}
```

---

## Vue

### Setup

```typescript
// main.ts
import { createApp } from 'vue';
import { AlxConfig } from '@astralibx/email-ui';
import App from './App.vue';

AlxConfig.setup({
  accountManagerApi: '/api/email-accounts',
  ruleEngineApi: '/api/email-rules',
  analyticsApi: '/api/analytics',
  authToken: `Bearer ${token}`,
  theme: 'dark',
});

const app = createApp(App);

// Tell Vue to skip resolution for alx- elements
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('alx-');

app.mount('#app');
```

### Component Usage

Vue handles custom events on Custom Elements natively:

```vue
<template>
  <alx-account-list
    :page="currentPage"
    :limit="pageSize"
    @alx-account-selected="onSelect"
    @alx-account-create="showCreate = true"
  />

  <alx-template-editor
    v-if="editingTemplate"
    :template-id="selectedTemplateId"
    :categories='JSON.stringify(["marketing", "onboarding"])'
    @alx-template-saved="onSaved"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import '@astralibx/email-ui';

const currentPage = ref(1);
const pageSize = ref(20);
const showCreate = ref(false);
const editingTemplate = ref(false);
const selectedTemplateId = ref('');

function onSelect(event: CustomEvent) {
  console.log('Selected:', event.detail);
}

function onSaved(event: CustomEvent) {
  editingTemplate.value = false;
}
</script>
```

---

## Next.js

### Setup

Custom Elements only work client-side. Use dynamic imports or `'use client'`:

```tsx
// components/EmailAdmin.tsx
'use client';

import { useEffect, useRef } from 'react';

let initialized = false;

export function EmailAdmin({ token }: { token: string }) {
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    (async () => {
      const { AlxConfig } = await import('@astralibx/email-ui');
      if (!initialized) {
        AlxConfig.setup({
          accountManagerApi: '/api/email-accounts',
          ruleEngineApi: '/api/email-rules',
          analyticsApi: '/api/analytics',
          authToken: `Bearer ${token}`,
          theme: 'dark',
        });
        initialized = true;
      }
    })();
  }, [token]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      console.log('Selected:', (e as CustomEvent).detail);
    };
    el.addEventListener('alx-account-selected', handler);
    return () => el.removeEventListener('alx-account-selected', handler);
  }, []);

  return <alx-account-list ref={listRef} />;
}
```

```tsx
// app/admin/page.tsx
import { EmailAdmin } from '@/components/EmailAdmin';
import { getServerSession } from 'next-auth';

export default async function AdminPage() {
  const session = await getServerSession();
  return <EmailAdmin token={session?.accessToken ?? ''} />;
}
```

---

## Plain HTML

No build step required:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Email Admin</title>
  <style>
    body { margin: 0; padding: 2rem; background: #111; }
    .dashboard { display: grid; gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="dashboard">
    <alx-account-list></alx-account-list>
    <alx-account-health refresh-interval="30"></alx-account-health>
    <alx-account-capacity></alx-account-capacity>
    <alx-analytics-overview></alx-analytics-overview>
  </div>

  <script type="module">
    import { AlxConfig } from './node_modules/@astralibx/email-ui/dist/index.js';

    AlxConfig.setup({
      accountManagerApi: 'http://localhost:3000/api/email-accounts',
      ruleEngineApi: 'http://localhost:3001/api/email-rules',
      analyticsApi: 'http://localhost:3002/api/analytics',
      authToken: 'Bearer your-token',
      theme: 'dark',
    });

    document.querySelector('alx-account-list')
      .addEventListener('alx-account-selected', (e) => {
        alert('Selected: ' + e.detail.email);
      });
  </script>
</body>
</html>
```

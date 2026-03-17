# Types

All exported types, APIs, styles, and utilities from `@astralibx/telegram-ui`.

## Configuration

```typescript
import { AlxTelegramConfig } from '@astralibx/telegram-ui';
import type { AlxTelegramConfigOptions } from '@astralibx/telegram-ui';
```

### AlxTelegramConfigOptions

```typescript
interface AlxTelegramConfigOptions {
  accountManagerApi?: string;
  ruleEngineApi?: string;
  inboxApi?: string;
  botApi?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}
```

## API Clients

All API clients are available from both the main entry point and the `/api` subpath:

```typescript
// From main
import { TelegramAccountAPI, TelegramRuleAPI, TelegramInboxAPI, TelegramBotAPI } from '@astralibx/telegram-ui';

// From /api subpath
import { TelegramAccountAPI, TelegramRuleAPI, TelegramInboxAPI, TelegramBotAPI } from '@astralibx/telegram-ui/api';
```

### TelegramAccountAPI

| Method | Arguments | Description |
|--------|-----------|-------------|
| `listAccounts(params?)` | `PaginationParams & Record` | List accounts with pagination and filters |
| `getAccount(id)` | `string` | Get a single account |
| `createAccount(data)` | `Record` | Create an account |
| `updateAccount(id, data)` | `string, Record` | Update an account |
| `deleteAccount(id)` | `string` | Delete an account |
| `connectAccount(id)` | `string` | Connect (start session) |
| `disconnectAccount(id)` | `string` | Disconnect (stop session) |
| `reconnectAccount(id)` | `string` | Reconnect an account |
| `quarantineAccount(id, data)` | `string, Record` | Quarantine an account |
| `releaseAccount(id)` | `string` | Release from quarantine |
| `getCapacity(id)` | `string` | Get capacity for one account |
| `getAllCapacity()` | -- | Get aggregate capacity |
| `getHealth(id)` | `string` | Get health for one account |
| `getAllHealth()` | -- | Get aggregate health |
| `listIdentifiers(params?)` | `PaginationParams & Record` | List identifiers |
| `getIdentifier(id)` | `string` | Get a single identifier |
| `createIdentifier(data)` | `Record` | Create an identifier |
| `updateIdentifier(id, data)` | `string, Record` | Update an identifier |
| `deleteIdentifier(id)` | `string` | Delete an identifier |

### TelegramRuleAPI

| Method | Arguments | Description |
|--------|-----------|-------------|
| `listTemplates(params?)` | `PaginationParams & Record` | List templates |
| `getTemplate(id)` | `string` | Get a single template |
| `createTemplate(data)` | `Record` | Create a template |
| `updateTemplate(id, data)` | `string, Record` | Update a template |
| `deleteTemplate(id)` | `string` | Delete a template |
| `previewTemplate(data)` | `Record` | Preview a rendered template |
| `listRules(params?)` | `PaginationParams & Record` | List rules |
| `getRule(id)` | `string` | Get a single rule |
| `createRule(data)` | `Record` | Create a rule |
| `updateRule(id, data)` | `string, Record` | Update a rule |
| `deleteRule(id)` | `string` | Delete a rule |
| `activateRule(id)` | `string` | Activate a rule |
| `deactivateRule(id)` | `string` | Deactivate a rule |
| `dryRunRule(id)` | `string` | Dry-run a rule |
| `triggerRun()` | -- | Trigger the runner |
| `getRunStatus(runId?)` | `string?` | Get run status |
| `cancelRun(runId)` | `string` | Cancel a run |
| `getThrottleConfig()` | -- | Get throttle settings |
| `updateThrottleConfig(data)` | `Record` | Update throttle settings |
| `getSendLogs(params?)` | `Record` | Get send logs |
| `getErrorLogs(params?)` | `Record` | Get error logs |
| `getRunLogs(params?)` | `PaginationParams & Record` | Get runner execution logs |
| `getStats(params?)` | `Record` | Get aggregate stats |

### TelegramInboxAPI

| Method | Arguments | Description |
|--------|-----------|-------------|
| `listConversations(params?)` | `PaginationParams & Record` | List conversations |
| `getMessages(conversationId, params?)` | `string, PaginationParams & Record` | Get messages for a conversation |
| `sendMessage(conversationId, data)` | `string, Record` | Send a message |
| `markAsRead(conversationId)` | `string` | Mark conversation as read |
| `getUnreadCount()` | -- | Get total unread count |
| `syncHistory(conversationId)` | `string` | Sync message history |
| `listSessions(params?)` | `PaginationParams & Record` | List sessions |
| `getSession(id)` | `string` | Get a session |
| `closeSession(id)` | `string` | Close a session |
| `pauseSession(id)` | `string` | Pause a session |
| `resumeSession(id)` | `string` | Resume a session |

### TelegramBotAPI

| Method | Arguments | Description |
|--------|-----------|-------------|
| `getStatus()` | -- | Get bot running status |
| `getStats()` | -- | Get bot user stats |
| `getUsers(params?)` | `Record` | List bot users |
| `getUser(id)` | `string` | Get a single bot user |

## HTTP Client

```typescript
import { HttpClient, HttpClientError } from '@astralibx/telegram-ui';
import type { PaginationParams, ApiResponse, PaginatedResponse } from '@astralibx/telegram-ui';
```

### PaginationParams

```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
}
```

### ApiResponse

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
}
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### HttpClientError

```typescript
class HttpClientError extends Error {
  readonly status: number;
  readonly body?: unknown;
}
```

## Styles

Shared Lit CSS modules for building custom components that match the library's design:

```typescript
import {
  alxBaseStyles,
  alxDarkTheme,
  alxLightTheme,
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxToolbarStyles,
  alxToggleStyles,
  alxProgressBarStyles,
  alxTooltipStyles,
} from '@astralibx/telegram-ui';
```

## Utilities

### safeRegister

```typescript
import { safeRegister } from '@astralibx/telegram-ui';
```

Safely registers a custom element, preventing duplicate registration errors:

```typescript
safeRegister('my-element', MyElement);
// Equivalent to customElements.define() but won't throw if already registered
```

## Component Classes

All component classes are exported for type-checking and programmatic access:

```typescript
import {
  AlxTelegramDashboard,
  AlxTgDrawer,
  AlxTgAccountList,
  AlxTgAccountForm,
  AlxTgTemplateList,
  AlxTgTemplateEditor,
  AlxTgRuleList,
  AlxTgRuleEditor,
  AlxTgRunHistory,
  AlxTgInbox,
  AlxTgBotStats,
  AlxTgAnalytics,
} from '@astralibx/telegram-ui';
```

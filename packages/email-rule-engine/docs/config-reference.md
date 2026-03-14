# Config Reference — Full Configuration Object

Complete reference for the `EmailRuleEngineConfig` object passed to `createEmailRuleEngine()`.

## TypeScript Interface

```typescript
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';

interface EmailRuleEngineConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  redis: {
    connection: Redis;
    keyPrefix?: string;
  };

  adapters: {
    queryUsers: (target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>;
    resolveData: (user: Record<string, unknown>) => Record<string, unknown>;
    sendEmail: (params: SendEmailParams) => Promise<void>;
    selectAgent: (identifierId: string) => Promise<AgentSelection | null>;
    findIdentifier: (email: string) => Promise<RecipientIdentifier | null>;
    sendTestEmail?: (to: string, subject: string, html: string, text: string) => Promise<void>;
  };

  platforms?: string[];
  audiences?: string[];
  logger?: LogAdapter;

  options?: {
    lockTTLMs?: number;
    defaultMaxPerRun?: number;
    sendWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
    };
    delayBetweenSendsMs?: number;
    jitterMs?: number;
  };

  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number }) => void;
    onSend?: (info: { ruleId: string; ruleName: string; email: string; status: 'sent' | 'error' }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[] }) => void;
  };
}
```

## Field Reference

### db (required)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `connection` | `mongoose.Connection` | Yes | — | Mongoose connection instance. The engine creates 5 collections on this connection. |
| `collectionPrefix` | `string` | No | `''` | Prefix for collection names (e.g., `'myapp_'` creates `myapp_email_templates`). |

### redis (required)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `connection` | `Redis` | Yes | — | ioredis instance. Used only for distributed locking. |
| `keyPrefix` | `string` | No | `''` | Prefix for Redis keys (e.g., `'myapp:'`). |

### adapters (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queryUsers` | `(target, limit) => Promise<Record[]>` | Yes | Find users matching rule conditions. See [adapters.md](adapters.md). |
| `resolveData` | `(user) => Record` | Yes | Transform user to template variables. See [adapters.md](adapters.md). |
| `sendEmail` | `(params) => Promise<void>` | Yes | Deliver the email. See [adapters.md](adapters.md). |
| `selectAgent` | `(id) => Promise<{accountId} \| null>` | Yes | Pick sender account. See [account-rotation.md](account-rotation.md). |
| `findIdentifier` | `(email) => Promise<{id, contactId} \| null>` | Yes | Map email to contact. See [email-validation.md](email-validation.md). |
| `sendTestEmail` | `(to, subject, html, text) => Promise<void>` | No | Send test emails for template preview. |

### platforms (optional)

| Type | Default | Description |
|------|---------|-------------|
| `string[]` | `['web', 'mobile', 'both']` | Valid platform values for template/rule schema validation. |

### audiences (optional)

| Type | Default | Description |
|------|---------|-------------|
| `string[]` | `['customer', 'provider', 'all']` | Valid audience/role values for template/rule schema validation. |

### logger (optional)

| Type | Default | Description |
|------|---------|-------------|
| `LogAdapter` | Silent (no-op) | Object with `info`, `warn`, `error` methods. Compatible with `console`, Winston, Pino. |

```typescript
interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}
```

### options (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lockTTLMs` | `number` | `1800000` (30 min) | Redis lock timeout. Must exceed max expected run duration. |
| `defaultMaxPerRun` | `number` | `500` | Default max users per rule if rule doesn't specify `maxPerRun`. |
| `sendWindow` | `object` | — | Time-based execution window. See [send-window.md](send-window.md). |
| `sendWindow.startHour` | `number` | — | Start hour (0-23, inclusive). |
| `sendWindow.endHour` | `number` | — | End hour (0-23, exclusive). |
| `sendWindow.timezone` | `string` | — | IANA timezone (e.g., `'Asia/Kolkata'`). |
| `delayBetweenSendsMs` | `number` | `0` | Base delay between sends in ms. See [delivery-delays.md](delivery-delays.md). |
| `jitterMs` | `number` | `0` | Max random additional delay in ms. See [delivery-delays.md](delivery-delays.md). |

### hooks (optional)

| Field | Fires When | Signature |
|-------|-----------|-----------|
| `onRunStart` | After loading rules | `(info: { rulesCount, triggeredBy }) => void` |
| `onRuleStart` | After matching users | `(info: { ruleId, ruleName, matchedCount }) => void` |
| `onSend` | After each send/error | `(info: { ruleId, ruleName, email, status }) => void` |
| `onRuleComplete` | After rule finishes | `(info: { ruleId, ruleName, stats }) => void` |
| `onRunComplete` | After run log saved | `(info: { duration, totalStats, perRuleStats }) => void` |

See [progress-hooks.md](progress-hooks.md) for examples.

## Complete Example

```typescript
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';

const dbConnection = mongoose.createConnection('mongodb://localhost/myapp');
const redis = new Redis();

const engine = createEmailRuleEngine({
  db: {
    connection: dbConnection,
    collectionPrefix: 'myapp_',
  },

  redis: {
    connection: redis,
    keyPrefix: 'myapp:',
  },

  platforms: ['web', 'mobile', 'both'],
  audiences: ['customer', 'provider', 'all'],

  adapters: {
    queryUsers: async (target, limit) => {
      return User.find({ role: target.role, platform: target.platform }).limit(limit).lean();
    },
    resolveData: (user) => ({
      user: { name: user.name, email: user.email },
      platform: { name: 'MyApp', domain: 'myapp.com' },
    }),
    sendEmail: async (params) => {
      await transporter.sendMail({
        to: params.identifierId,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody,
      });
    },
    selectAgent: async () => ({ accountId: 'default' }),
    findIdentifier: async (email) => {
      const contact = await Contact.findOne({ email });
      return contact ? { id: contact._id.toString(), contactId: contact._id.toString() } : null;
    },
  },

  logger: console,

  options: {
    lockTTLMs: 30 * 60 * 1000,
    defaultMaxPerRun: 500,
    sendWindow: {
      startHour: 9,
      endHour: 20,
      timezone: 'Asia/Kolkata',
    },
    delayBetweenSendsMs: 2000,
    jitterMs: 1000,
  },

  hooks: {
    onRunStart: ({ rulesCount, triggeredBy }) => {
      console.log(`Run started: ${rulesCount} rules (${triggeredBy})`);
    },
    onSend: ({ ruleName, email, status }) => {
      console.log(`${status === 'sent' ? '+' : 'x'} ${ruleName} → ${email}`);
    },
    onRunComplete: ({ duration, totalStats }) => {
      console.log(`Done in ${duration}ms: ${totalStats.sent} sent, ${totalStats.errors} errors`);
    },
  },
});
```

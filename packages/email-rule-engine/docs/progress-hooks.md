# Progress Hooks — Live Execution Tracking

Progress hooks are optional callbacks that fire at key points during rule execution. Use them to stream progress to a frontend, publish events, or log execution details.

## Available Hooks

| Hook | Fires When | Frequency |
|------|-----------|-----------|
| `onRunStart` | After loading active rules | Once per run |
| `onRuleStart` | After matching users for a rule | Once per rule |
| `onSend` | After each email send (success or error) | Once per user per rule |
| `onRuleComplete` | After finishing a rule | Once per rule |
| `onRunComplete` | After all rules and run log saved | Once per run |

## Hook Signatures

```typescript
hooks?: {
  onRunStart?: (info: {
    rulesCount: number;
    triggeredBy: string;    // 'cron' | 'manual'
  }) => void;

  onRuleStart?: (info: {
    ruleId: string;
    ruleName: string;
    matchedCount: number;   // users matched by queryUsers
  }) => void;

  onSend?: (info: {
    ruleId: string;
    ruleName: string;
    email: string;          // recipient email
    status: 'sent' | 'error';
  }) => void;

  onRuleComplete?: (info: {
    ruleId: string;
    ruleName: string;
    stats: RuleRunStats;    // { matched, sent, skipped, skippedByThrottle, errors }
  }) => void;

  onRunComplete?: (info: {
    duration: number;           // total run time in ms
    totalStats: RuleRunStats;
    perRuleStats: PerRuleStats[];  // stats per rule with ruleId and ruleName
  }) => void;
};
```

## Configuration

```typescript
const engine = createEmailRuleEngine({
  // ...
  hooks: {
    onRunStart: (info) => { /* ... */ },
    onRuleStart: (info) => { /* ... */ },
    onSend: (info) => { /* ... */ },
    onRuleComplete: (info) => { /* ... */ },
    onRunComplete: (info) => { /* ... */ },
  },
});
```

All hooks are optional. You can provide any combination.

## When Each Hook Fires

See [execution-flow.md](execution-flow.md) for the complete flow. Here's where hooks fire:

```
runAllRules() called
├── Send window check
├── Acquire lock
├── Load throttle config
├── Load active rules
├── ★ onRunStart({ rulesCount, triggeredBy })
├── For each rule:
│   ├── Load template
│   ├── queryUsers adapter
│   ├── ★ onRuleStart({ ruleId, ruleName, matchedCount })
│   ├── For each user:
│   │   ├── Throttle/dedup checks
│   │   ├── Send email
│   │   └── ★ onSend({ ruleId, ruleName, email, status })
│   └── ★ onRuleComplete({ ruleId, ruleName, stats })
├── Save run log
├── ★ onRunComplete({ duration, totalStats, perRuleStats })
└── Release lock
```

## Example: SSE Streaming to Frontend

```typescript
import { EventEmitter } from 'events';

const progressEmitter = new EventEmitter();

const engine = createEmailRuleEngine({
  // ...
  hooks: {
    onRunStart: (info) => {
      progressEmitter.emit('progress', {
        type: 'run-start',
        ...info,
      });
    },
    onSend: (info) => {
      progressEmitter.emit('progress', {
        type: 'send',
        ...info,
      });
    },
    onRunComplete: (info) => {
      progressEmitter.emit('progress', {
        type: 'run-complete',
        ...info,
      });
    },
  },
});

// SSE endpoint
app.get('/api/email-rules/runner/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const handler = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  progressEmitter.on('progress', handler);
  req.on('close', () => progressEmitter.off('progress', handler));
});
```

## Example: Redis Pub/Sub

```typescript
import Redis from 'ioredis';

const publisher = new Redis();

const engine = createEmailRuleEngine({
  // ...
  hooks: {
    onRunStart: (info) => {
      publisher.publish('email-engine:progress', JSON.stringify({
        event: 'run-start', ...info,
      }));
    },
    onSend: (info) => {
      publisher.publish('email-engine:progress', JSON.stringify({
        event: 'send', ...info,
      }));
    },
    onRunComplete: (info) => {
      publisher.publish('email-engine:progress', JSON.stringify({
        event: 'run-complete', ...info,
      }));
    },
  },
});
```

## Example: Simple Console Logging

```typescript
const engine = createEmailRuleEngine({
  // ...
  hooks: {
    onRunStart: ({ rulesCount, triggeredBy }) => {
      console.log(`[Email Engine] Run started: ${rulesCount} rules, triggered by ${triggeredBy}`);
    },
    onRuleStart: ({ ruleName, matchedCount }) => {
      console.log(`[Email Engine] Rule "${ruleName}": ${matchedCount} users matched`);
    },
    onSend: ({ ruleName, email, status }) => {
      const icon = status === 'sent' ? '+' : 'x';
      console.log(`[Email Engine] [${icon}] ${ruleName} → ${email}`);
    },
    onRuleComplete: ({ ruleName, stats }) => {
      console.log(`[Email Engine] Rule "${ruleName}" done: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.errors} errors`);
    },
    onRunComplete: ({ duration, totalStats }) => {
      console.log(`[Email Engine] Run complete in ${duration}ms: ${totalStats.sent} sent, ${totalStats.errors} errors`);
    },
  },
});
```

## Error Handling

Hook calls use optional chaining (`this.config.hooks?.onSend?.(...)`) so they never throw internally. However, if your hook function itself throws, the error will propagate and may affect the current send or rule execution. Keep your hooks lightweight and non-throwing — wrap in try/catch if doing I/O:

```typescript
onSend: (info) => {
  try {
    publisher.publish('channel', JSON.stringify(info));
  } catch {
    // swallow — don't let hook errors stop email delivery
  }
},
```

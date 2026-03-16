# Email Library — Hooks Enhancement Request

## Package: @astralibx/email-rule-engine

### Problem

Lifecycle hooks (`onSend`, `onRuleStart`, `onRuleComplete`) pass incomplete context. Consumers wiring analytics, logging, or external integrations can't attribute events to the correct account or template without this data.

### Current Hook Signatures

```typescript
onSend?: (info: {
    ruleId: string;
    ruleName: string;
    email: string;
    status: 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled';
}) => void;

onRuleStart?: (info: {
    ruleId: string;
    ruleName: string;
    matchedCount: number;
}) => void;

onRuleComplete?: (info: {
    ruleId: string;
    ruleName: string;
    stats: RuleRunStats;
}) => void;

onRunStart?: (info: {
    rulesCount: number;
    triggeredBy: string;
}) => void;

onRunComplete?: (info: {
    duration: number;
    totalStats: RuleRunStats;
    perRuleStats: PerRuleStats[];
}) => void;
```

### Requested Changes

#### `onSend` — Add `accountId`, `templateId`, `runId`

```typescript
onSend?: (info: {
    ruleId: string;
    ruleName: string;
    email: string;
    status: 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled';
    accountId: string;       // NEW — which account sent this
    templateId: string;      // NEW — which template was used
    runId: string;           // NEW — which run this belongs to
    subjectIndex: number;    // NEW — which subject variant was picked
    bodyIndex: number;       // NEW — which body variant was picked
    failureReason?: string;  // NEW — why it failed (if status is error/invalid)
}) => void;
```

**Use cases:**
- Per-account analytics (`analytics.events.record({ accountId })`)
- Template A/B performance tracking (which subject/body variant performs best)
- Error debugging (failure reason without digging through logs)
- Run-level grouping for batch analytics

#### `onRuleStart` — Add `templateId`, `runId`

```typescript
onRuleStart?: (info: {
    ruleId: string;
    ruleName: string;
    matchedCount: number;
    templateId: string;      // NEW — which template this rule uses
    runId: string;           // NEW — which run this belongs to
}) => void;
```

**Use cases:**
- Log which template is about to be sent
- Correlate rule start with run for monitoring dashboards

#### `onRuleComplete` — Add `templateId`, `runId`

```typescript
onRuleComplete?: (info: {
    ruleId: string;
    ruleName: string;
    stats: RuleRunStats;
    templateId: string;      // NEW
    runId: string;           // NEW
}) => void;
```

#### `onRunStart` — Add `runId`

```typescript
onRunStart?: (info: {
    rulesCount: number;
    triggeredBy: string;
    runId: string;           // NEW — so consumers can track the full run lifecycle
}) => void;
```

**Use case:** Currently `onRunStart` doesn't tell you which run started. You have to wait for `trigger()` to return the `runId` and hope timing aligns. Passing `runId` in the hook makes run lifecycle tracking reliable.

#### `onRunComplete` — Add `runId`

```typescript
onRunComplete?: (info: {
    duration: number;
    totalStats: RuleRunStats;
    perRuleStats: PerRuleStats[];
    runId: string;           // NEW
}) => void;
```

### Summary

| Hook | New Fields |
|---|---|
| `onSend` | `accountId`, `templateId`, `runId`, `subjectIndex`, `bodyIndex`, `failureReason` |
| `onRuleStart` | `templateId`, `runId` |
| `onRuleComplete` | `templateId`, `runId` |
| `onRunStart` | `runId` |
| `onRunComplete` | `runId` |

### Why This Matters

The rule engine already has all this data internally during execution. It's just not passing it through to hooks. Every consumer that needs analytics, monitoring, or external integrations has to work around this by building their own state tracking (mapping runIds, guessing accountIds, etc.). Passing the data through hooks is zero-cost to the engine and eliminates boilerplate for every consumer.

### Backward Compatible

All new fields are additive. Existing hook implementations that don't destructure the new fields will continue working without changes.

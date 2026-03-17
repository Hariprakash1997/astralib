# Warmup System

New accounts start in `warmup` status with gradually increasing send limits. The warmup schedule is defined as phases stored in the database per-account.

## Warmup Phases

Each phase defines a day range, daily send limit, and inter-email delay:

```ts
interface WarmupPhase {
  days: [start, end];  // [22, 0] means "day 22+" (0 = no upper bound)
  dailyLimit: number;
  delayMinMs: number;  // Minimum delay between emails (ms)
  delayMaxMs: number;  // Maximum delay between emails (ms)
}
```

### Default Schedule

The default 5-phase schedule (configurable via factory config):

| Phase | Days | Daily Limit | Delay Range |
|-------|------|-------------|-------------|
| 1 | 1-3 | 5 | 60s - 180s |
| 2 | 4-7 | 15 | 30s - 120s |
| 3 | 8-14 | 30 | 15s - 60s |
| 4 | 15-21 | 80 | 5s - 30s |
| 5 | 22+ | 200 | 2s - 10s |

## Progression

- `warmup.currentDay` starts at 1 and advances daily
- The current phase is determined by which `days` range includes `currentDay`
- When `currentDay` exceeds the last phase's upper bound, warmup auto-completes and the account transitions to `active`

## DB-Driven Schedules

Each account stores its own warmup schedule in the database. This allows per-account customization:

```ts
// Custom schedule at creation
await eam.accounts.create({
  // ...
  warmup: {
    schedule: [
      { days: [1, 7],   dailyLimit: 10,  delayMinMs: 30000, delayMaxMs: 120000 },
      { days: [8, 14],  dailyLimit: 50,  delayMinMs: 10000, delayMaxMs: 60000  },
      { days: [15, 0],  dailyLimit: 300, delayMinMs: 2000,  delayMaxMs: 10000  },
    ],
  },
});

// Update schedule via API
// PUT /accounts/:id/warmup/schedule
```

If no custom schedule is provided, the account falls back to `options.warmup.defaultSchedule` from the factory config.

## Programmatic Control

```ts
// Start warmup
await eam.warmup.startWarmup(accountId);

// Advance day (call daily, e.g., via cron)
await eam.warmup.advanceDay(accountId);

// Force-complete warmup (transition to active)
await eam.warmup.completeWarmup(accountId);

// Restart from day 1
await eam.warmup.resetWarmup(accountId);

// Get current warmup status
const status = await eam.warmup.getStatus(accountId);
// {
//   accountId, email, enabled, currentDay,
//   currentPhase, dailyLimit,
//   delayRange: { min, max }
// }

// Get recommended delay for the current phase
const delay = await eam.warmup.getRecommendedDelay(accountId);
// Random ms within current phase's delay range

// Advance all warmup-enabled accounts at once
const { advanced, errors } = await eam.warmup.advanceAllAccounts();
// Loops all accounts with status='warmup' and warmup.enabled=true
// Use with a cron job:
// cron.schedule('0 0 * * *', () => eam.warmup.advanceAllAccounts());
```

## Warmup and Capacity

During warmup, the phase's `dailyLimit` overrides the account's `limits.dailyMax`. This ensures the account does not exceed the warmup volume even if the account's configured limit is higher.

## Related

- [Capacity Selection](./capacity-selection.md) -- how warmup limits affect account selection
- [Configuration](./configuration.md) -- `options.warmup.defaultSchedule`
- [API Routes](./api-routes.md) -- warmup REST endpoints

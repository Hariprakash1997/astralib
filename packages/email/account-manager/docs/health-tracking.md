# Health Tracking

Each account maintains a health score (0-100, starting at 100) that adjusts automatically based on send outcomes.

## Score Changes

| Event | Score Change |
|-------|-------------|
| Successful send | **+1** |
| Send error | **-5** |
| Bounce received | **-10** |

## Auto-Disable Triggers

An account is automatically disabled when any threshold is crossed:

- Health score drops below `minScore` (default: 50)
- Bounce rate exceeds `maxBounceRate` % (default: 5%)
- Consecutive errors exceed `maxConsecutiveErrors` (default: 10)

When an account is auto-disabled, the `onAccountDisabled` hook fires with the reason.

## Configuring Thresholds

Thresholds can be set globally in the factory config or per-account.

### Global defaults (factory config)

```ts
createEmailAccountManager({
  // ...
  options: {
    healthDefaults: {
      minScore: 50,
      maxBounceRate: 5,
      maxConsecutiveErrors: 10,
    },
  },
});
```

### Per-account thresholds

```ts
// At creation time
await eam.accounts.create({
  // ...
  health: {
    thresholds: {
      minScore: 60,
      maxBounceRate: 3,
      maxConsecutiveErrors: 5,
    },
  },
});

// Or update via API
// PUT /accounts/:id/health/thresholds
```

## Programmatic Access

```ts
// Check a single account's health
const health = await eam.health.getHealth(accountId);
// {
//   accountId, email, score: 85,
//   consecutiveErrors: 0, bounceCount: 2,
//   thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 },
//   status: 'active'
// }

// Check all accounts' health
const all = await eam.health.getAllHealth();

// Manual score adjustments
await eam.health.recordSuccess(accountId);
await eam.health.recordError(accountId);
await eam.health.recordBounce(accountId);
```

## Related

- [Account Management](./account-management.md) -- status lifecycle
- [Configuration](./configuration.md) -- `options.healthDefaults`

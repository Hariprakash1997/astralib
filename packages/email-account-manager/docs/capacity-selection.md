# Capacity & Account Selection

The `CapacityManager` selects the best account for sending based on health score and remaining daily capacity.

## Selection Algorithm

1. Query all accounts with status `active` or `warmup`
2. Sort by `health.score` descending (healthiest first)
3. For each account, check remaining daily capacity
4. Return the first account with `remaining > 0`

This ensures the healthiest account with available capacity is always used first.

## Daily Limits

- Each account has a `limits.dailyMax` (default: 450)
- During warmup, the current phase's `dailyLimit` overrides `limits.dailyMax`
- The `sentToday` counter resets daily
- When an account hits its limit, its status changes to `quota_exceeded`

## Programmatic Access

```ts
// Get the best available account (used internally by smtp.send())
const account = await eam.capacity.getBestAccount();

// Check a specific account's capacity
const cap = await eam.capacity.getAccountCapacity(accountId);
// {
//   accountId, email, provider,
//   dailyMax, sentToday, remaining,
//   usagePercent
// }

// Get all accounts' capacity summary
const { accounts, totalRemaining } = await eam.capacity.getAllCapacity();
```

## Rotation Behavior

The rotation is health-weighted, not round-robin. The account with the highest health score and available capacity is always preferred. This means:

- Healthy accounts carry more load
- Degraded accounts are used less, giving them time to recover
- If all accounts are exhausted, a `NoAvailableAccountError` is thrown

## Related

- [Health Tracking](./health-tracking.md) -- how health scores are computed
- [Warmup System](./warmup-system.md) -- warmup phase limits
- [Email Sending](./email-sending.md) -- how capacity ties into sending

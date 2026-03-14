# Send Window — Time-Based Execution Control

The send window restricts rule execution to specific hours of the day, ensuring emails are only sent during appropriate times for your audience.

## What It Does

When configured, the runner checks the current time against the window before processing any rules. If the current hour falls outside the window, the entire run is skipped — no lock is acquired, no database queries are made.

## Config Example

```typescript
const engine = createEmailRuleEngine({
  // ...other config
  options: {
    sendWindow: {
      startHour: 9,    // 9:00 AM
      endHour: 18,     // 6:00 PM (exclusive)
      timezone: 'Asia/Kolkata',
    },
  },
});
```

This allows sends between 9:00 AM and 5:59 PM IST. The `endHour` is exclusive — if `endHour` is 18, the last valid hour is 17 (5 PM).

## How Timezone Works

The `timezone` field accepts any [IANA timezone string](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). The engine uses `Intl.DateTimeFormat` to convert the server's current time to the specified timezone.

Common timezone values:

| Timezone | Region |
|----------|--------|
| `Asia/Kolkata` | India (IST, UTC+5:30) |
| `America/New_York` | US Eastern |
| `America/Los_Angeles` | US Pacific |
| `Europe/London` | UK (GMT/BST) |
| `Asia/Dubai` | UAE (GST, UTC+4) |
| `Asia/Singapore` | Singapore (SGT, UTC+8) |

## What Happens Outside the Window

When the current hour is outside the send window:

1. The runner logs an info message: `"Outside send window, skipping run"`
2. The method returns immediately
3. **No Redis lock is acquired** — this is intentional to avoid acquiring a lock just to release it
4. No database queries are executed
5. No rules are processed

The log includes the current hour, configured window, and timezone for debugging:

```
Outside send window, skipping run { currentHour: 22, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }
```

## Alternative: Controlling via Cron Schedule

If your scheduling needs are simple, you can achieve similar behavior by configuring your cron job directly:

```typescript
// Only run at specific hours — no sendWindow config needed
cron.schedule('0 9,12,15,18 * * *', () => {
  engine.runner.runAllRules();
});
```

The `sendWindow` option is more useful when:
- Your cron runs frequently (e.g., every 30 minutes) and you need a broad window
- Multiple triggers (cron + manual + webhooks) all call `runAllRules()`
- You want a single source of truth for the allowed send hours

## Example: India Business Hours

```typescript
const engine = createEmailRuleEngine({
  // ...
  options: {
    sendWindow: {
      startHour: 10,   // 10:00 AM IST
      endHour: 20,     // 8:00 PM IST (exclusive)
      timezone: 'Asia/Kolkata',
    },
  },
});

// Cron runs every 30 minutes, but sends only go out 10 AM - 7:59 PM
cron.schedule('*/30 * * * *', () => {
  engine.runner.runAllRules();
});
```

## Edge Cases

- **Midnight spans**: If you need a window like 10 PM to 6 AM, this is not directly supported with a single window. Use cron scheduling instead, or implement the check in your cron job.
- **DST transitions**: The engine uses `Intl.DateTimeFormat` which handles daylight saving time automatically for the specified timezone.
- **Hour format**: Hours are in 24-hour format (0-23). `startHour: 0, endHour: 24` effectively disables the window (all hours allowed).

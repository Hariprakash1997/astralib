# Delivery Delays — Natural Send Spread

Delivery delays add a configurable pause between individual email sends, spreading deliveries over time to improve deliverability and avoid spam triggers.

## Why Delays Matter

Sending hundreds of emails in rapid succession can:

- Trigger spam filters at receiving mail servers
- Cause SMTP rate limiting and temporary blocks
- Overwhelm your email provider's sending quotas
- Make your sending pattern look automated (because it is)

Adding delays between sends creates a more natural sending pattern that email providers are less likely to flag.

## Config Options

```typescript
const engine = createEmailRuleEngine({
  // ...
  options: {
    delayBetweenSendsMs: 2000, // 2 seconds between each send
    jitterMs: 1000,            // add random 0-1000ms on top
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delayBetweenSendsMs` | `number` | `0` | Base delay in milliseconds between sends |
| `jitterMs` | `number` | `0` | Maximum random additional delay in milliseconds |

## How Jitter Works

Jitter adds a random value between 0 and `jitterMs` (inclusive) to the base delay. This prevents a perfectly regular sending pattern.

```
totalDelay = delayBetweenSendsMs + random(0, jitterMs)
```

Examples with `delayBetweenSendsMs: 2000, jitterMs: 1000`:

| Send | Base | Jitter | Total Delay |
|------|------|--------|-------------|
| 1 → 2 | 2000ms | +731ms | 2731ms |
| 2 → 3 | 2000ms | +204ms | 2204ms |
| 3 → 4 | 2000ms | +892ms | 2892ms |
| 4 → 5 | 2000ms | +0ms | 2000ms |

## Example Calculations

| Users | Base Delay | Jitter | Min Total Time | Max Total Time |
|-------|-----------|--------|----------------|----------------|
| 100 | 1s | 0 | ~1.6 min | ~1.6 min |
| 100 | 2s | 1s | ~3.3 min | ~5 min |
| 500 | 2s | 0 | ~16.6 min | ~16.6 min |
| 500 | 2s | 1s | ~16.6 min | ~25 min |
| 1000 | 3s | 2s | ~50 min | ~83 min |

Formula: `time = users × (delayMs + jitterMs/2) / 1000 / 60` minutes (average)

## Performance Considerations

- **Last user optimization**: No delay is applied after the last user in each rule's batch. There's no point delaying when there's nothing to send next.
- **Lock TTL**: Ensure your `lockTTLMs` is long enough to accommodate the total send time. Default is 30 minutes. For 500 users at 3s delay: set it to at least 30 minutes.
- **Per-rule delays**: Delays apply within each rule's user loop. There is no delay between rules.
- **Skipped users**: Delays only apply after successful sends. Users skipped by throttle, deduplication, or missing identifiers do not trigger a delay.

## Recommended Settings

| Volume | Recommended Config |
|--------|-------------------|
| < 50 emails/run | No delay needed |
| 50-200 emails/run | `delayBetweenSendsMs: 1000, jitterMs: 500` |
| 200-500 emails/run | `delayBetweenSendsMs: 2000, jitterMs: 1000` |
| 500+ emails/run | `delayBetweenSendsMs: 3000, jitterMs: 2000` |

Adjust based on your email provider's rate limits. AWS SES allows 14 emails/second by default, so delays may be unnecessary unless you're near quota.

# Account Rotation — Multi-Account Sending

Account rotation distributes email sends across multiple sender accounts to improve deliverability, stay within provider quotas, and maintain sender reputation.

## Why Rotation Matters

Single-account sending creates problems at scale:

- **Quota limits**: Gmail allows 500/day, Google Workspace 2,000/day, SES starts at 200/day
- **Reputation risk**: One account sending thousands of emails gets flagged
- **Single point of failure**: If the account gets suspended, all sending stops

Rotation solves this by distributing sends across multiple accounts.

## How selectAgent Works

The `selectAgent` adapter is called once per user during rule execution. It receives the recipient's identifier ID and returns a sender account selection — or `null` to skip the user.

```typescript
(identifierId: string) => Promise<{ accountId: string } | null>
```

The engine uses the returned `accountId` in the `SendEmailParams` passed to your `sendEmail` adapter. Your send logic can then look up the account's credentials and send from the correct address.

## Round-Robin Implementation

Distributes sends evenly across all active accounts:

```typescript
let roundRobinIndex = 0;

async function selectAgent(identifierId: string) {
  const accounts = await EmailAccount.find({ isActive: true }).lean();
  if (accounts.length === 0) return null;

  const account = accounts[roundRobinIndex % accounts.length];
  roundRobinIndex++;

  return { accountId: account._id.toString() };
}
```

Note: The `roundRobinIndex` resets when the process restarts. For persistent rotation, store the index in Redis:

```typescript
async function selectAgent(identifierId: string) {
  const accounts = await EmailAccount.find({ isActive: true }).lean();
  if (accounts.length === 0) return null;

  const index = await redis.incr('email-rotation:index');
  const account = accounts[(index - 1) % accounts.length];

  return { accountId: account._id.toString() };
}
```

## Weighted Rotation

Some accounts can handle more volume than others. Weight by capacity:

```typescript
async function selectAgent(identifierId: string) {
  const accounts = await EmailAccount.find({ isActive: true }).lean();
  if (accounts.length === 0) return null;

  // Build weighted pool: account with weight 3 appears 3 times
  const pool: typeof accounts = [];
  for (const account of accounts) {
    const weight = account.weight || 1;
    for (let i = 0; i < weight; i++) {
      pool.push(account);
    }
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  return { accountId: selected._id.toString() };
}
```

Example weights:

| Account | Provider | Daily Limit | Weight |
|---------|----------|-------------|--------|
| account-1 | SES | 50,000 | 10 |
| account-2 | Gmail | 500 | 1 |
| account-3 | Workspace | 2,000 | 4 |

## Daily Quota Tracking

Track sends per account per day and skip accounts that hit their limit:

```typescript
async function selectAgent(identifierId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const accounts = await EmailAccount.find({ isActive: true }).lean();

  for (const account of accounts) {
    const key = `email-quota:${account._id}:${today}`;
    const sent = parseInt(await redis.get(key) || '0', 10);

    if (sent < account.dailyLimit) {
      await redis.incr(key);
      await redis.expire(key, 86400 * 2); // expire after 2 days

      return { accountId: account._id.toString() };
    }
  }

  // All accounts at quota
  return null;
}
```

## What Happens When null Is Returned

When `selectAgent` returns `null`, the user is skipped for this rule execution. The skip is counted in `stats.skipped`. The user will be retried on the next run if they still match the rule's conditions.

This is the correct way to handle:
- All accounts at daily quota
- No active accounts available
- Account-level rate limiting

## Combining with sendEmail

Your `sendEmail` adapter receives the `accountId` and should use it to select the correct credentials:

```typescript
async function sendEmail(params: SendEmailParams) {
  const account = await EmailAccount.findById(params.accountId);
  if (!account) throw new Error(`Account ${params.accountId} not found`);

  const transporter = getOrCreateTransporter(account);
  await transporter.sendMail({
    from: `"${account.fromName}" <${account.fromEmail}>`,
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
  });
}
```

See [smtp-pooling.md](smtp-pooling.md) for efficient transporter management across multiple accounts.

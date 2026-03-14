# Email Validation — MX & Domain Checks

Email validation catches invalid or risky email addresses before attempting to send, reducing bounces and protecting your sender reputation.

## Why Validation Matters

Sending to invalid emails causes:

- **Hard bounces**: Damage sender reputation
- **Spam traps**: Old or fake addresses used by ISPs to catch spammers
- **Wasted resources**: Rendering templates and making SMTP connections for emails that will never arrive
- **Provider penalties**: High bounce rates can get your account suspended

## Where to Implement

The `findIdentifier` adapter is the natural place for email validation. It's called once per unique email before the send loop, so validation overhead is minimal.

```typescript
async function findIdentifier(email: string) {
  // Step 1: Look up contact
  const contact = await Contact.findOne({ email: email.toLowerCase() });
  if (!contact) return null;

  // Step 2: Validate email
  const isValid = await validateEmail(email);
  if (!isValid) return null;  // returning null = skip this user

  return {
    id: contact.emailIdentifierId.toString(),
    contactId: contact._id.toString(),
  };
}
```

## DNS MX Lookup

Verify the email's domain has valid mail exchange (MX) records:

```typescript
import { promises as dns } from 'dns';

const mxCache = new Map<string, { valid: boolean; expiresAt: number }>();
const MX_CACHE_TTL = 3600000; // 1 hour

async function hasMxRecords(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.valid;
  }

  try {
    const records = await dns.resolveMx(domain);
    const valid = records.length > 0;
    mxCache.set(domain, { valid, expiresAt: Date.now() + MX_CACHE_TTL });
    return valid;
  } catch {
    mxCache.set(domain, { valid: false, expiresAt: Date.now() + MX_CACHE_TTL });
    return false;
  }
}

async function validateEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  return hasMxRecords(domain);
}
```

## Disposable Email Domain Detection

Block temporary/disposable email addresses:

```typescript
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'dispostable.com',
  '10minutemail.com',
  // Add more as needed, or use a package like `disposable-email-domains`
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : true;
}
```

## Combined Validation

```typescript
import { promises as dns } from 'dns';

const mxCache = new Map<string, { valid: boolean; expiresAt: number }>();
const MX_CACHE_TTL = 3600000;

async function validateEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  // Check disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) return false;

  // Check MX records
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.valid;

  try {
    const records = await dns.resolveMx(domain);
    const valid = records.length > 0;
    mxCache.set(domain, { valid, expiresAt: Date.now() + MX_CACHE_TTL });
    return valid;
  } catch {
    mxCache.set(domain, { valid: false, expiresAt: Date.now() + MX_CACHE_TTL });
    return false;
  }
}

async function findIdentifier(email: string) {
  const contact = await Contact.findOne({ email: email.toLowerCase() });
  if (!contact) return null;

  const isValid = await validateEmail(email);
  if (!isValid) return null;

  return {
    id: contact.emailIdentifierId.toString(),
    contactId: contact._id.toString(),
  };
}
```

## Caching MX Results

The examples above use an in-memory cache with a 1-hour TTL. For multi-process deployments, use Redis:

```typescript
async function hasMxRecords(domain: string): Promise<boolean> {
  const cacheKey = `mx-check:${domain}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === '1';

  try {
    const records = await dns.resolveMx(domain);
    const valid = records.length > 0;
    await redis.setex(cacheKey, 3600, valid ? '1' : '0');
    return valid;
  } catch {
    await redis.setex(cacheKey, 3600, '0');
    return false;
  }
}
```

## What to Return for Invalid Emails

Return `null` from `findIdentifier` to skip the user. The engine will:

1. Count the user in `stats.skipped`
2. Move to the next user
3. Not log a send (so the user can be retried if the email becomes valid)

This is the same behavior as when a contact doesn't exist in your system — clean and non-disruptive.

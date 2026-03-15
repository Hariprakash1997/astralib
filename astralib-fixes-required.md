# @astralibx Package Improvements

Gaps discovered during massage-website integration. Only items that benefit ALL consumers are listed — no project-specific requests.

---

## RESOLVED

- ~~CJS resolution bug~~ — Fixed in v8+
- ~~TemplateAudience type too strict~~ — Fixed in v8+ (`QueryTarget.role` is now `string`)
- ~~Hook param naming~~ — Verified correct (`healthScore`, not `score`)

---

## REQUESTED — Benefits All Consumers

### 1. Add `findById(id)` to IdentifierService

**Priority:** High

**Why every consumer needs this:** The rule engine's `sendEmail` adapter receives `identifierId` (a MongoDB `_id` string). To send the actual email, consumers must resolve the email address from this ID. Currently `IdentifierService` only has `findByEmail(email)` — there's no way to go from ID → email through the service layer.

Every consumer integrating `email-rule-engine` + `email-account-manager` together hits this gap.

**Fix:**
```typescript
class IdentifierService {
  async findById(id: string): Promise<EmailIdentifierDocument | null> {
    return this.EmailIdentifier.findById(id);
  }
  // ... existing methods
}
```

---

### 2. Auto-increment `sentCount` inside `SmtpService.send()`

**Priority:** High

**Why every consumer needs this:** After a successful SMTP send, the identifier's `sentCount` should reflect the new total. Currently consumers must manually call `identifiers.incrementSentCount(email)` after every send. If they forget (which they will), `sentCount` drifts and eligibility sorting by "least contacted" breaks.

Since `SmtpService.send()` already knows the recipient email, it can increment internally.

**Fix:**
```typescript
// Inside SmtpService.send()
if (result.success && params.to) {
  await this.identifierService.incrementSentCount(params.to);
}
```

---

### 3. Optional built-in warmup cron

**Priority:** Medium

**Why every consumer needs this:** Every consumer using the warmup system needs a daily cron to call `advanceDay()` per account. This is always the same logic — loop warmup-enabled accounts, advance each one. No reason for every consumer to implement this.

**Fix — Option A (built-in scheduler):**
```typescript
// In createEmailAccountManager config:
options: {
  warmup: {
    autoCron: true,           // Enable built-in daily cron
    cronTime: '0 0 * * *',   // Default: midnight UTC
    timezone: 'Asia/Kolkata', // Consumer's timezone
  }
}
```

**Fix — Option B (expose helper method):**
```typescript
// Consumer calls once:
manager.warmup.startDailyCron({ timezone: 'Asia/Kolkata' });
```

Option B is simpler and gives consumers control over when to start/stop.

---

### 4. Auto-start IMAP if config is provided

**Priority:** Low

**Why:** If a consumer provides IMAP config on accounts, they always want bounce checking. Requiring an explicit `manager.imap.start()` call is an easy thing to forget.

**Fix:** Auto-start IMAP polling when at least one account has IMAP config. Or add `autoStart: true` option:
```typescript
options: {
  imap: { autoStart: true, pollIntervalMs: 300_000 }
}
```

---

## NOT REQUESTED — Project-Specific

These are massage-website-specific and should NOT be added to the library:

- `contactId` on `IEmailIdentifier` — domain-specific field. We use our local Mongoose model for this.
- Domain-specific audience values (`client`/`therapist`) — already handled via `audiences` config + `string` type on `QueryTarget.role`.

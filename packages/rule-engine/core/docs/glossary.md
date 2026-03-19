# Glossary

Quick reference for all terms, IDs, constants, and gotchas in `@astralibx/rule-engine`.

---

## ID Types

| Term | Description | Source | Example |
|------|-------------|--------|---------|
| `templateId` | MongoDB `_id` of a template document | Created via `POST /templates` | `"665abc123def456789000001"` |
| `ruleId` | MongoDB `_id` of a rule document | Created via `POST /rules` | `"665def789abc123456000001"` |
| `runId` | UUID identifying one rule engine execution | Generated per run by the runner | `"run_a1b2c3d4e5f6"` |
| `identifierId` | Internal ID of the recipient's identifier record | Returned by your `findIdentifier` adapter (`id` field) | `"507f1f77bcf86cd799439012"` |
| `contactId` | Your system's CRM or user ID for the recipient | Returned by your `findIdentifier` adapter (`contactId` field) | `"crm-contact-42"` |
| `accountId` | ID of the sending account (email account, Telegram account, etc.) | Returned by your `selectAgent` adapter (`accountId` field) | `"507f1f77bcf86cd799439011"` |
| `userId` | Your application's user record identifier | The `_id` field on objects returned by your `queryUsers` adapter | `"507f1f77bcf86cd799439010"` |

### Key Relationships

- `templateId` is stored on the rule -- a rule says "send THIS template to THESE targets."
- `identifierId` is the library's internal record. `contactId` is your system's ID. Your `findIdentifier` adapter maps between them.
- `accountId` is resolved by your `selectAgent` adapter at send time -- it picks which sending account to use for each recipient.
- `runId` is ephemeral; it exists for the duration of a run. Historical data is stored in run log documents.

---

## Constants

### `RULE_TYPE`

| Value | Meaning |
|-------|---------|
| `'automated'` | Recurring campaign rule, respects all throttle limits |
| `'transactional'` | System or event-driven message, bypasses throttle |

### `SEND_STATUS`

| Value | Meaning |
|-------|---------|
| `'sent'` | Message was dispatched successfully |
| `'error'` | Send adapter threw an error |
| `'skipped'` | Recipient was skipped (e.g. `sendOnce` already sent, no identifier found) |
| `'invalid'` | Recipient data was unusable (no `contactValue`, bad identifier) |
| `'throttled'` | Recipient exceeded global throttle limits |

### `TARGET_MODE`

| Value | Meaning |
|-------|---------|
| `'query'` | Recipients are resolved by your `queryUsers` adapter from conditions |
| `'list'` | Recipients are provided as a fixed array of identifier strings |

### `RUN_TRIGGER`

| Value | Meaning |
|-------|---------|
| `'cron'` | Run was triggered by the scheduler |
| `'manual'` | Run was triggered via API call |

### `RUN_LOG_STATUS`

| Value | Meaning |
|-------|---------|
| `'completed'` | All rules processed without fatal errors |
| `'cancelled'` | Run was stopped mid-execution |
| `'failed'` | Run exited due to an unrecoverable error |

### `TEMPLATE_CATEGORY`

| Value | Use case |
|-------|---------|
| `'onboarding'` | Welcome and setup sequences |
| `'engagement'` | Activity or retention messages |
| `'transactional'` | Receipts, alerts, confirmations |
| `'re-engagement'` | Win-back campaigns for inactive users |
| `'announcement'` | Product updates, releases, news |

### `TEMPLATE_AUDIENCE`

| Value | Meaning |
|-------|---------|
| `'customer'` | Template targets end customers |
| `'provider'` | Template targets internal providers or agents |
| `'all'` | Template applies to both audiences |

### `RULE_OPERATOR`

| Value | Meaning | Supported field types |
|-------|---------|----------------------|
| `'eq'` | Equals | string, number, boolean, date, objectId |
| `'neq'` | Not equals | string, number, boolean, date, objectId |
| `'gt'` | Greater than | number, date |
| `'gte'` | Greater than or equal | number, date |
| `'lt'` | Less than | number, date |
| `'lte'` | Less than or equal | number, date |
| `'exists'` | Field is present | all types |
| `'not_exists'` | Field is absent | all types |
| `'in'` | Value is in array | string, number, objectId, array |
| `'not_in'` | Value is not in array | string, number, objectId, array |
| `'contains'` | String or array contains value | string, array |

### `FIELD_TYPE`

| Value | Meaning | Available operators |
|-------|---------|---------------------|
| `'string'` | Text field | `eq`, `neq`, `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `'number'` | Numeric field | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists` |
| `'boolean'` | True/false field | `eq`, `neq`, `exists`, `not_exists` |
| `'date'` | Date/datetime field | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists` |
| `'objectId'` | MongoDB ObjectId field | `eq`, `neq`, `in`, `not_in`, `exists`, `not_exists` |
| `'array'` | Array field | `contains`, `in`, `not_in`, `exists`, `not_exists` |
| `'object'` | Nested object field | `exists`, `not_exists` |

---

## Key Concepts

### Templates own the data source

`collectionName` and `joins` are defined on the template, not on the rule. When the engine runs a rule, it reads the template to know which MongoDB collection to query users from and which related collections to join. Changing the template changes the data source for every rule that references it.

### Adapter-based dependency injection

The engine is transport-agnostic. It orchestrates when and to whom to send, but delegates all I/O to adapters you provide:

| Adapter | What it does |
|---------|-------------|
| `queryUsers` | Fetches matching recipients for a rule target |
| `resolveData` | Returns template variable data for a single user |
| `findIdentifier` | Looks up a recipient's identifier record by contact value |
| `selectAgent` | Picks which sending account to use for a recipient |
| `send` | Performs the actual send (email, Telegram, etc.) |
| `sendTest` | Optional -- used by the condition preview endpoint |

### Shared collections

All platforms store rules, templates, and run logs in the same MongoDB collections, separated by a `platform` field. Two rule engines on the same database (e.g. one for email, one for Telegram) share these collections without conflict as long as `platform` values are distinct.

### Pipeline builder

A utility (`buildAggregationPipeline`) constructs MongoDB aggregation pipelines from a template's `joins` and a rule's `conditions`. The pipeline is passed to your `queryUsers` adapter as context so you can apply it directly, or build your own query logic on top of it.

### Condition preview

Before saving a rule, you can test conditions against real data using `POST /rules/preview`. The engine calls your `queryUsers` adapter with the conditions and returns a count and sample of matched users without performing any sends.

### Send window

A time range (`startHour`/`endHour` in a given `timezone`) outside which the engine will not send. Supports overnight wrapping -- if `startHour: 20` and `endHour: 8`, sends are allowed from 8pm to 8am. Configured in `options.sendWindow` and can also be updated at runtime via the Settings API.

---

## Gotchas

1. **Throttle is global per user, not per rule.** `maxPerUserPerDay: 2` applies across ALL rules. If Rule A already sent to a contact today, Rule B counts against the same daily limit for that contact.

2. **`queryUsers` must return objects with `_id` and `contactValue`.** The engine reads `_id` as the `userId` and `contactValue` as the address to look up via `findIdentifier`. Missing either field causes the recipient to be logged as `invalid`.

3. **Template `subjects` is optional and can be omitted entirely or set to an empty array. `bodies` must have at least one entry.** Platforms like Telegram don't use subjects. A template with no body variants will fail at send time.

4. **Collection schemas are optional.** Without a `CollectionSchema` registered for a collection, conditions work as free-text with no operator validation. Register schemas to enable the UI to constrain operators by field type.

5. **`ruleType: 'transactional'` bypasses all throttle limits.** Transactional rules always attempt a send regardless of `maxPerUserPerDay`, `maxPerUserPerWeek`, or `minGapDays`. Use only for system messages (password resets, receipts) -- never for marketing.

6. **`sendOnce: true` without `resendAfterDays` means once per user, forever.** The engine records the send against the user and skips them on all future runs with no expiry. Set `resendAfterDays` if you want users to re-enter after a period.

7. **Redis `keyPrefix` prevents key collisions.** When multiple rule engines (e.g. email and Telegram) share one Redis instance, each must have a unique `keyPrefix` in config. Without it, throttle counters and distributed locks overwrite each other.

8. **`beforeSend` is the only async hook.** All other hooks (`onRunStart`, `onSend`, `onRuleComplete`, etc.) are fire-and-forget -- the engine does not await them. Only `beforeSend` is awaited and can modify the message body before it is sent.

9. **Run cancellation is cooperative.** Calling `POST /runner/cancel` sets a flag in Redis. The runner checks this flag every 10 users. A run with large batches may continue briefly after a cancel request before it stops.

10. **`collectionPrefix` changes MongoDB collection names, not Mongoose model names.** Two engines on the same Mongoose connection with the same prefix will register conflicting models and crash on startup. Use a unique `collectionPrefix` per engine instance on a shared connection.

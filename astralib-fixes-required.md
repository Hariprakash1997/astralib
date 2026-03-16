# @astralibx Package Improvements

Gaps discovered during massage-website integration. Only items that benefit ALL consumers are listed.

---

## RESOLVED

- ~~CJS resolution bug~~ — Fixed in v8+
- ~~TemplateAudience type too strict~~ — Fixed (`QueryTarget.role` is now `string`)
- ~~`findById` missing on IdentifierService~~ — Fixed in v10.1.0
- ~~Auto-increment sentCount on send~~ — Fixed in v10.1.0
- ~~IMAP autoStart option~~ — Fixed in v10.1.0
- ~~`advanceAllAccounts()` warmup helper~~ — Fixed in v10.1.0
- ~~CreateDraftInput source field~~ — Added in latest release. source?: string on CreateDraftInput and schema.
- ~~CreateDraftInput identifierId + auto-increment~~ — Added in latest release. identifierId?: string on drafts, auto-increment sentCount in approval queue processor.
- ~~Full draft in onDraftApproved~~ — Added in latest release. Hook now receives { draftId, to, scheduledAt, draft }.
- ~~onSend fires after approved send~~ — Already works as expected. approve() → onDraftApproved → queue → send → onSend.

---

## REQUESTED — Benefits All Consumers

All items resolved.

---

## NOT REQUESTED — Project-Specific

- `contactId` on `IEmailIdentifier` — our domain field, stored in shared collection via local Mongoose model
- Domain-specific audience values — handled via `audiences` config
- Campaign orchestrator logic — our business logic, not library concern

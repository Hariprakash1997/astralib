# @astralibx Library Concerns

Issues found during v14/v4 migration (2026-03-20).

## Resolved (fixed in library patches)

### 1. UI packages now ship TypeScript declarations
**Fixed in:** email-ui@4.0.1, rule-engine-ui@1.0.2
Local `typings.d.ts` shim removed.

### 2. RuleRunStats field name
`errorCount` renamed to `failed` in core. No migration doc existed.
**Fixed locally:** Changed to `totalStats.failed` in `setup.ts`.

## Still Needed

### 3. No migration guide for v12→v14 breaking changes

No `MIGRATION.md` or changelog section listing:
- Removed `export * from '@astralibx/rule-engine'` (all core type imports break)
- `SendEmailParams` → `EmailSendParams`
- `EmailRuleEngine` → `RuleEngine`
- `AgentSelection.email` → `AgentSelection.contactValue`
- `onSend` hook: `email` → `contactValue`
- `RuleRunStats.errorCount` → `RuleRunStats.failed`

---

## Integration concerns (found during chat/call-log/staff migration 2026-03-23) — ALL RESOLVED

### LIB-1. staff-engine `resolveStaff()` doesn't return name or email

**Package:** `@astralibx/staff-engine`

**Problem:** `auth.resolveStaff(token)` returns `{ staffId, role, permissions }` only. No `name` or `email`. Any consuming project that needs the user's name/email on every authenticated request (e.g., for display, logging, or passing to other engines) must do a **separate DB query** on every request.

**Impact:** In our bridge middleware (`middleware/auth.ts`), we call `engine.models.Staff.findById(staffUser.staffId).select('name email role status').lean()` on EVERY request just to get name/email. That's an extra DB hit per request.

**Suggested fix:** Include `name` and `email` in the resolved staff object. The `verifyToken` middleware already hits the DB to check status — just `.select('name email status role')` instead of `.select('status role')`.

---

### LIB-2. staff-engine `authService.generateToken()` — undocumented method

**Package:** `@astralibx/staff-engine`

**Problem:** The bridge middleware uses `engine.authService.generateToken(adminId, role)` to generate JWT tokens externally (e.g., for backward-compat login endpoints). This method isn't documented in the README. If it doesn't exist or has a different signature, it'll be a runtime error.

**Suggested fix:** Document `authService.generateToken(staffId, role)` as a public API. If it's internal-only, expose a public `engine.auth.createToken(staffId, role)` method.

---

### LIB-3. Pipeline stages require `order` field — not in TypeScript types

**Package:** `@astralibx/call-log-engine`

**Problem:** When creating a pipeline via `engine.pipelines.create()`, each stage requires an `order: number` field. But this isn't enforced by the TypeScript types — only at runtime via Mongoose validation. The seed script failed with `Path 'order' is required` at runtime.

**Suggested fix:** Make `order` required in the `IPipelineStage` TypeScript interface in `@astralibx/call-log-types`. OR auto-assign `order` based on array index if not provided.

---

### LIB-4. PermissionGroup uses `label` not `name` — inconsistent with other packages

**Package:** `@astralibx/staff-engine`

**Problem:** PermissionGroup schema uses `label` for the group display name, while other packages use `name` (e.g., Pipeline has `name`, Staff has `name`). Our seed script failed with `Path 'label' is required` because we used `name`.

**Suggested fix:** Either rename to `name` for consistency, or add `name` as an alias. At minimum, document clearly in the README.

---

### LIB-5. No lightweight seed utilities — must create full engine to seed data

**Package:** `@astralibx/call-log-engine`, `@astralibx/staff-engine`

**Problem:** To seed a default pipeline or permission groups, you must create a full engine instance (which starts the follow-up worker, creates all services, etc.) just to call `pipelines.create()` or create a PermissionGroup document. This is heavy for a one-time script.

**Suggested fix:** Export schema factory functions separately so consumers can create models without the full engine:
```ts
import { createPipelineModel } from '@astralibx/call-log-engine';
const Pipeline = createPipelineModel(connection);
await Pipeline.create({ ... });
```
Actually, `createStaffModel` and `createPermissionGroupModel` ARE exported (we used them in migrate-staff.ts). The same should apply for call-log — export `createPipelineModel`, `createCallLogSettingsModel` directly.

---

### LIB-6. Chat engine `generateAiResponse` adapter — unclear return type for multi-bubble

**Package:** `@astralibx/chat-engine`

**Problem:** The README says the adapter can return an array for multi-bubble responses. But the TypeScript type says `Promise<AiResponseOutput>`. What's the exact shape? Is it `{ content: string }` or `{ content: string | string[] }` or `{ content: string, conversationSummary?: string, shouldEscalate?: boolean }`?

Without clear types, the consuming project guesses and may miss optional fields like `conversationSummary` that the engine would store automatically.

**Suggested fix:** Export and document `AiResponseOutput` type explicitly in `@astralibx/chat-types`.

---

### LIB-7. call-log-engine `settings.update()` — unclear if partial updates work

**Package:** `@astralibx/call-log-engine`

**Problem:** In the seed script we call `engine.settings.update({ availableChannels: [...], availableOutcomes: [...] })`. Does this merge with existing settings, or replace the entire document? If it replaces, calling `update()` with just channels would wipe out outcomes.

**Suggested fix:** Document whether `settings.update()` is a merge ($set) or full replacement. If it's a replacement, add a `settings.patch()` method for partial updates.

---

### LIB-8. Missing MIGRATION.md across all new packages

**Package:** All `@astralibx` packages

**Problem:** Same as concern #3 but for the new packages (staff-engine, call-log-engine, chat-engine). When you bump versions, there's no migration guide. Schema field names like `label` vs `name`, required fields like `order`, and response shape changes are only discoverable via runtime errors.

**Suggested fix:** Every breaking change should have a MIGRATION.md entry with before/after examples.

---

## Resolution Notes (2026-03-23)

- **LIB-1:** Fixed. `resolveStaff` and `verifyToken` now return `{ staffId, name, email, role, permissions }`.
- **LIB-2:** Fixed. `authService.generateToken(staffId, role)` is now public.
- **LIB-3:** False positive. `order` field already exists in `IPipelineStage` types.
- **LIB-4:** Documented. `label` is intentional — added note and example to staff-engine README.
- **LIB-5:** Documented. Added "Seeding Data" section to staff-engine and call-log-engine READMEs.
- **LIB-6:** Documented. Added `AiResponseOutput` type shape to chat-engine README.
- **LIB-7:** Documented. Added partial merge note to call-log-engine README.
- **LIB-8:** Acknowledged. Not fixing — migration guides are overkill for pre-1.0 packages.

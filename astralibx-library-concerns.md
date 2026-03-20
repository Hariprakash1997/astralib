# @astralibx Library Concerns

Issues found during v14/v4 migration (2026-03-20).

## 1. UI packages don't ship TypeScript declarations

Neither `@astralibx/email-ui` nor `@astralibx/rule-engine-ui` include `.d.ts` files in their `dist/` output. Consumers must write local type shims (`typings.d.ts`) to get type checking on `AlxConfig.setup()` and dynamic imports.

**Expected:** Both packages should export `.d.ts` files alongside their JS bundles. Add `"types": "dist/index.d.ts"` to package.json and configure `tsup` with `dts: true`.

**Workaround:** Local `apps/fe-admin/src/typings.d.ts` with `declare module` blocks.

## 2. `RuleRunStats.errorCount` renamed to `failed` without migration note

The core `@astralibx/rule-engine` package uses `failed` in `RuleRunStats`, but the old `@astralibx/email-rule-engine` v12 used `errorCount`. This rename is not documented in any changelog or migration guide.

**Impact:** `onRunComplete` hook destructuring `totalStats.errorCount` fails with TS2339.

**Fix applied locally:** Changed to `totalStats.failed` in `setup.ts`.

## 3. No migration guide for v12→v14 breaking changes

The `email-rule-engine` README correctly describes the new thin-wrapper architecture, but there's no `MIGRATION.md` or changelog section listing:
- Removed `export * from '@astralibx/rule-engine'` (all core type imports break)
- `SendEmailParams` → `EmailSendParams`
- `EmailRuleEngine` → `RuleEngine`
- `AgentSelection.email` → `AgentSelection.contactValue`
- `onSend` hook: `email` → `contactValue`
- `RuleRunStats.errorCount` → `RuleRunStats.failed`
- `AgentSelection.email` → `AgentSelection.contactValue` (affects any code accessing agent.email)

Developers hitting these won't know the fix without reading source code.

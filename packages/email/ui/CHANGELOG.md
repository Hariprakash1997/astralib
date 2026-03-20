# @astralibx/email-ui

## 4.0.1

### Patch Changes

- 3e23687: Fixes: TypeScript declarations for UI packages - renamed AlxConfig to RuleEngineUIConfig - added changelog links to READMEs
- Updated dependencies [3e23687]
  - @astralibx/rule-engine-ui@1.0.2

## 4.0.0

### Major Changes

- 10d07e2: Fixes: rule-engine hook error safety and email dependency issues - Features: chat engine enhancements, email-ui and telegram-ui migrated to shared core
- e7fd2f2: Fixes: rule-engine hook error safety and email dependency issues - Features: chat engine enhancements, email-ui and telegram-ui migrated to shared core

### Patch Changes

- Updated dependencies [10d07e2]
- Updated dependencies [e7fd2f2]
  - @astralibx/rule-engine-ui@1.0.1

## 3.0.0

### Major Changes

- 44e3111: Features: shared rule-engine core and UI packages, chat engine with AI knowledge base and websocket gateway, telegram and email migrated to core adapters
- d01dabd: Features: shared rule-engine core and UI packages, chat engine with AI knowledge base and websocket gateway, telegram and email migrated to core adapters

## 2.12.0

### Minor Changes

- 4dc407f: Feature: send window runtime configuration via Settings UI and PUT /throttle API

## 2.11.1

### Patch Changes

- f78f016: Fixes: renamed collection to collectionName to avoid Mongoose reserved key warning, added core as peer dependency, suppressed BullMQ repeated eviction warnings

## 2.11.0

### Minor Changes

- 58ac84f: Feature: collection schema registration for field dropdowns, type-aware operators, template variable picker. Fixes: 14 bugs including userId string identifiers, run history field mapping, pagination, template deletion guard, cooldownDays, resendAfterDays 0, strict Handlebars, preheaderIndex. Refactor: DRY extraction of processSingleUser, asyncHandler, shared utilities, UI formatters. 236 tests.

## 2.10.0

### Minor Changes

- 9eaba73: Feature: collection schema registration for field dropdowns, type-aware operators, template variable picker. Fixes: userId accepts string identifiers, run history field mapping, pagination for rules and templates lists, template deletion checks rule refs, lock failure status, cooldownDays implementation, resendAfterDays 0 edge case, send log email filter, default date filters, strict Handlebars in production, preheaderIndex in onSend hook, timer cleanup, redundant index, scheduler idempotent stop

## 2.9.0

### Minor Changes

- 90aa64e: Feature: collection schema registration for field dropdowns, type-aware operators, template variable picker. Fix: EmailRuleSend userId accepts string identifiers

## 2.8.1

### Patch Changes

- 1e9a196: Features: dry-run results display, run progress polling, onboarding banner. Fixes: UI feedback for delete, toggle, approve, cancel operations

## 2.8.0

### Minor Changes

- 47242ec: Features: email template editor, draft schema, integration tests, SMTP updates. Fixes: rule schema, tsup configs

## 2.7.0

### Minor Changes

- 8e558d9: Features: chat widget overhaul, engine routes and services, agent dashboard. Telegram batch connect, account rotation, rule runner, inbox sync. Email template editor, draft schema, SMTP updates

## 2.6.1

### Patch Changes

- 9924a76: Docs: updated READMEs and added detailed documentation for all packages

## 2.6.0

### Minor Changes

- 6810aa1: Features: email cloning, scheduling, A/B variants, dark mode. Telegram account, rule, bot, inbox management. Chat engine, AI, widget. Fixes: rule editor, form reset, operators, lazy tabs

## 2.5.0

### Minor Changes

- 46fb03b: Features: template/rule cloning, cron scheduling, A/B variant analytics, send log viewer, segmentation preview, real-data preview. Fixes: rule editor payload, toggle, form reset, operator enum, lazy tabs, templateId display.

## 2.4.2

### Patch Changes

- 5169baa: fix rule editor data mapping, toggle, form reset, operators, emailType, lazy tab loading, populated templateId display

## 2.4.1

### Patch Changes

- 6b887aa: fix template preview strict mode, fix rule editor payload structure and data mapping, fix operators and emailType enum mismatch

## 2.4.0

### Minor Changes

- 86b9214: add alx-email-dashboard component, fix drawer slot rendering, willUpdate lifecycle, public load method, dark mode toggle, dashboard docs

## 2.3.0

### Minor Changes

- 34acb9f: channel analytics, beforeSend context, POST /track, fetch timeout, 401 detection, form validation, docs and tests

## 2.2.0

### Minor Changes

- dd4aab9: UI overhaul: drawer edit flow, design system, file splits, dynamic metadata columns, IMAP auto-derive, rich empty states, settings redesign

## 2.1.0

### Minor Changes

- 647c922: add delete, metadata editor, Gmail auto-fill, template variants, list-mode rules, validity dates, run trigger/cancel, compact density mode

## 2.0.9

### Patch Changes

- 70ad0c4: add repository field, findById on identifiers, advanceAllAccounts warmup helper, IMAP autoStart, npm links in README

## 2.0.8

### Patch Changes

- 4b963f6: fix BullMQ Worker TypeError, fix UI component response data access keys

## 2.0.7

### Patch Changes

- 4bf7db0: fix UI response envelope unwrapping in handleResponse

## 2.0.6

### Patch Changes

- fce647f: fix duplicate Mongoose indexes, rename reserved errors field to errorCount, fix account creation defaults, fix UI response envelope unwrapping

## 2.0.5

### Patch Changes

- 47978cb: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix CJS resolution, loosen audience/category types, fix docs

## 2.0.4

### Patch Changes

- 1e0c2c8: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix docs across all packages

## 2.0.3

### Patch Changes

- 7eeaa3e: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, fix docs

## 2.0.2

### Patch Changes

- 966d464: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, fix docs across all packages

## 2.0.1

### Patch Changes

- c74e219: fix README doc links to use absolute GitHub URLs for npm

## 2.0.0

### Major Changes

- d6b8e20: Initial release of full email ecosystem

# @astralibx/email-account-manager

## 10.6.0

### Minor Changes

- 6810aa1: Features: email cloning, scheduling, A/B variants, dark mode. Telegram account, rule, bot, inbox management. Chat engine, AI, widget. Fixes: rule editor, form reset, operators, lazy tabs

### Patch Changes

- Updated dependencies [6810aa1]
  - @astralibx/core@1.2.0

## 10.5.0

### Minor Changes

- b5f104b: draft fields, enriched hooks, account list filters, per-rule throttle override, dry-run limits, analytics bridge, redis keyPrefix docs
- fde05c1: move handlebars/mjml/html-to-text to deps, widen nodemailer peer dep, draft fields, enriched hooks, account list filters, per-rule throttle, dry-run limits, analytics bridge

## 10.4.0

### Minor Changes

- 2e08c46: draft fields, enriched hooks, account list filters, per-rule throttle override, dry-run limits, analytics bridge, redis keyPrefix docs

## 10.3.0

### Minor Changes

- db98a6d: draft source/identifierId fields, full draft in onDraftApproved, enrich all hooks with accountId/templateId/runId/variant indices. IMPORTANT: set unique redis keyPrefix per project if sharing Redis

## 10.2.0

### Minor Changes

- 71787b2: draft source/identifierId fields, full draft in onDraftApproved, enrich all hooks with accountId/templateId/runId/variant indices

## 10.1.0

### Minor Changes

- 70ad0c4: add repository field, findById on identifiers, advanceAllAccounts warmup helper, IMAP autoStart, npm links in README

### Patch Changes

- Updated dependencies [70ad0c4]
  - @astralibx/core@1.1.3

## 10.0.1

### Patch Changes

- 4b963f6: fix BullMQ Worker TypeError, fix UI component response data access keys

## 10.0.0

### Major Changes

- fce647f: fix duplicate Mongoose indexes, rename reserved errors field to errorCount, fix account creation defaults, fix UI response envelope unwrapping

## 9.0.0

### Major Changes

- 30751dc: fix duplicate Mongoose indexes, rename reserved errors field to errorCount, fix account creation defaults

## 8.0.1

### Patch Changes

- f65b73f: fix duplicate Mongoose indexes, rename reserved errors field to errorCount

## 8.0.0

### Major Changes

- 23a2b04: fix UI-backend route mismatches: move run-history to /runner/logs, throttle to top-level PUT, toggle/approve/reject to POST

## 7.0.0

### Major Changes

- 47978cb: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix CJS resolution, loosen audience/category types, fix docs

### Patch Changes

- Updated dependencies [47978cb]
  - @astralibx/core@1.1.2

## 6.0.0

### Major Changes

- 1e0c2c8: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix docs across all packages

## 5.0.0

### Major Changes

- 7eeaa3e: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, fix docs

## 4.0.0

### Major Changes

- 966d464: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, fix docs across all packages

## 3.0.0

### Major Changes

- 345c4bb: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata

## 2.0.2

### Patch Changes

- c74e219: fix README doc links to use absolute GitHub URLs for npm
- Updated dependencies [c74e219]
  - @astralibx/core@1.1.1

## 2.0.1

### Patch Changes

- 1378fd4: fix CI publish by removing prepublishOnly, update root README

## 2.0.0

### Major Changes

- d6b8e20: Initial release of full email ecosystem

### Patch Changes

- Updated dependencies [d6b8e20]
  - @astralibx/core@1.1.0

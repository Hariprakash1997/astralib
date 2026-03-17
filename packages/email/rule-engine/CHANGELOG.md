# @astralibx/email-rule-engine

## 12.7.1

### Patch Changes

- 9924a76: Docs: updated READMEs and added detailed documentation for all packages
- Updated dependencies [9924a76]
  - @astralibx/core@1.2.1

## 12.7.0

### Minor Changes

- 6810aa1: Features: email cloning, scheduling, A/B variants, dark mode. Telegram account, rule, bot, inbox management. Chat engine, AI, widget. Fixes: rule editor, form reset, operators, lazy tabs

### Patch Changes

- Updated dependencies [6810aa1]
  - @astralibx/core@1.2.0

## 12.6.0

### Minor Changes

- 46fb03b: Features: template/rule cloning, cron scheduling, A/B variant analytics, send log viewer, segmentation preview, real-data preview. Fixes: rule editor payload, toggle, form reset, operator enum, lazy tabs, templateId display.

## 12.5.2

### Patch Changes

- 5169baa: fix rule editor data mapping, toggle, form reset, operators, emailType, lazy tab loading, populated templateId display

## 12.5.1

### Patch Changes

- 6b887aa: fix template preview strict mode, fix rule editor payload structure and data mapping, fix operators and emailType enum mismatch

## 12.5.0

### Minor Changes

- b5f104b: draft fields, enriched hooks, account list filters, per-rule throttle override, dry-run limits, analytics bridge, redis keyPrefix docs
- fde05c1: move handlebars/mjml/html-to-text to deps, widen nodemailer peer dep, draft fields, enriched hooks, account list filters, per-rule throttle, dry-run limits, analytics bridge

## 12.4.0

### Minor Changes

- 2e08c46: draft fields, enriched hooks, account list filters, per-rule throttle override, dry-run limits, analytics bridge, redis keyPrefix docs

## 12.3.0

### Minor Changes

- db98a6d: draft source/identifierId fields, full draft in onDraftApproved, enrich all hooks with accountId/templateId/runId/variant indices. IMPORTANT: set unique redis keyPrefix per project if sharing Redis

## 12.2.0

### Minor Changes

- 71787b2: draft source/identifierId fields, full draft in onDraftApproved, enrich all hooks with accountId/templateId/runId/variant indices

## 12.1.0

### Minor Changes

- 34acb9f: channel analytics, beforeSend context, POST /track, fetch timeout, 401 detection, form validation, docs and tests

## 12.0.1

### Patch Changes

- 70ad0c4: add repository field, findById on identifiers, advanceAllAccounts warmup helper, IMAP autoStart, npm links in README
- Updated dependencies [70ad0c4]
  - @astralibx/core@1.1.3

## 12.0.0

### Major Changes

- fce647f: fix duplicate Mongoose indexes, rename reserved errors field to errorCount, fix account creation defaults, fix UI response envelope unwrapping

## 11.0.0

### Major Changes

- 30751dc: fix duplicate Mongoose indexes, rename reserved errors field to errorCount, fix account creation defaults

## 10.0.0

### Major Changes

- f65b73f: fix duplicate Mongoose indexes, rename reserved errors field to errorCount

## 9.0.0

### Major Changes

- 23a2b04: fix UI-backend route mismatches: move run-history to /runner/logs, throttle to top-level PUT, toggle/approve/reject to POST

## 8.0.0

### Major Changes

- 47978cb: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix CJS resolution, loosen audience/category types, fix docs

### Patch Changes

- Updated dependencies [47978cb]
  - @astralibx/core@1.1.2

## 7.0.0

### Major Changes

- 1e0c2c8: major: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, preheaders, fix docs across all packages

## 6.0.0

### Major Changes

- 7eeaa3e: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, validity dates, template fields, auto-disable rules, fix docs

## 5.0.0

### Major Changes

- 966d464: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata, fix docs across all packages

## 4.0.0

### Major Changes

- 345c4bb: add multi-variant templates, beforeSend hook, list-mode targeting, run status/cancel, account metadata

## 3.0.2

### Patch Changes

- c74e219: fix README doc links to use absolute GitHub URLs for npm
- Updated dependencies [c74e219]
  - @astralibx/core@1.1.1

## 3.0.1

### Patch Changes

- 1378fd4: fix CI publish by removing prepublishOnly, update root README

## 3.0.0

### Major Changes

- d6b8e20: Initial release of full email ecosystem

### Patch Changes

- Updated dependencies [d6b8e20]
  - @astralibx/core@1.1.0

## 1.2.2

### Patch Changes

- 62875b4: fix doc links to correct GitHub repo URL in README

## 1.2.1

### Patch Changes

- 874d0fb: fix doc links to use absolute GitHub URLs in README

## 1.2.0

### Minor Changes

- 8dddb58: add configurable audiences and updated README

## 1.1.0

### Minor Changes

- 7d1e528: Add configurable audiences, update README with full documentation

## 1.0.1

### Patch Changes

- 74fc246: test: verify CI publish pipeline

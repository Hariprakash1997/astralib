# Error Handling

All error classes extend `AlxEmailError` (which extends `AlxError` from `@astralibx/core`). Each error has a `code` string for programmatic handling.

## Error Classes

| Error Class | Code | When Thrown | Extra Fields |
|-------------|------|-------------|--------------|
| `ConfigValidationError` | `CONFIG_VALIDATION` | Invalid config at startup | `field: string` |
| `TemplateNotFoundError` | `TEMPLATE_NOT_FOUND` | Template ID does not exist | `templateId: string` |
| `TemplateSyntaxError` | `TEMPLATE_SYNTAX` | Invalid Handlebars or MJML syntax | `errors: string[]` |
| `RuleNotFoundError` | `RULE_NOT_FOUND` | Rule ID does not exist | `ruleId: string` |
| `RuleTemplateIncompatibleError` | `RULE_TEMPLATE_INCOMPATIBLE` | Audience/platform mismatch between rule and template | `reason: string` |
| `LockAcquisitionError` | `LOCK_ACQUISITION` | Could not acquire distributed lock | -- |
| `DuplicateSlugError` | `DUPLICATE_SLUG` | Template slug already exists | `slug: string` |

## Usage

```typescript
import {
  ConfigValidationError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  RuleNotFoundError,
  RuleTemplateIncompatibleError,
  LockAcquisitionError,
  DuplicateSlugError,
} from '@astralibx/email-rule-engine';

try {
  await engine.ruleService.create({ ... });
} catch (err) {
  if (err instanceof RuleTemplateIncompatibleError) {
    console.error(`Incompatible: ${err.reason}`);
  }
}
```

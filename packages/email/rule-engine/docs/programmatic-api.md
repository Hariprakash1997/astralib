# Programmatic API

The engine instance exposes services for direct use outside of REST routes.

## RuleRunnerService

```typescript
// Trigger a full run (blocking, waits for completion)
const { runId } = await engine.runner.runAllRules('cron');  // or 'manual'
```

The runner acquires a distributed Redis lock, processes active rules in `sortOrder`, and releases the lock in a `finally` block. If the lock is held by another process, the run is silently skipped.

### Non-blocking trigger

```typescript
// Fire-and-forget -- returns immediately with a runId
const { runId } = await engine.runner.trigger('manual');
```

### Run status

```typescript
// Check progress of a specific run
const status = await engine.runner.getStatus(runId);
// { runId, state: 'running' | 'completed' | 'cancelled' | 'failed', progress: { rulesProcessed, totalRules, sent, errors }, startedAt, completedAt? }
```

### Cancel a run

```typescript
// Gracefully cancel a running execution
await engine.runner.cancel(runId);
// The runner will finish the current send and stop processing further users/rules
```

## TemplateService

```typescript
// List with filters
const templates = await engine.templateService.list({ category: 'onboarding', isActive: true });

// Create
const template = await engine.templateService.create({
  name: 'Welcome',
  slug: 'welcome',
  category: 'onboarding',
  audience: 'customer',
  platform: 'web',
  subjects: ['Hello {{user.name}}'],
  bodies: ['<mj-text>Welcome!</mj-text>'],
});

// Update (auto-increments version if content changes)
await engine.templateService.update(template._id, { subjects: ['Hi {{user.name}}'] });

// Preview with sample data
const rendered = await engine.templateService.preview(template._id, {
  user: { name: 'Jane' },
});
// { html: '...', text: '...', subject: 'Hello Jane' }

// Validate syntax
const result = await engine.templateService.validate('<mj-text>{{user.name}}</mj-text>');
// { valid: true, errors: [], variables: ['user.name'] }

// Toggle active
await engine.templateService.toggleActive(template._id);

// Delete
await engine.templateService.delete(template._id);
```

## RuleService

```typescript
// Create
const rule = await engine.ruleService.create({
  name: 'Welcome new customers',
  templateId: template._id,
  target: { role: 'customer', platform: 'web', conditions: [] },
  sendOnce: true,
});

// Update
await engine.ruleService.update(rule._id, { maxPerRun: 1000 });

// Dry run -- count matches without sending
const { matchedCount } = await engine.ruleService.dryRun(rule._id);

// Toggle active (validates linked template exists and is active)
await engine.ruleService.toggleActive(rule._id);

// Delete (disables if has send history)
const result = await engine.ruleService.delete(rule._id);
// { deleted: true } or { deleted: false, disabled: true }

// Run history
const logs = await engine.ruleService.getRunHistory(20);
```

## TemplateRenderService (standalone)

The render service can be used independently for rendering templates outside of rule execution:

```typescript
import { TemplateRenderService } from '@astralibx/email-rule-engine';

const renderer = new TemplateRenderService();

// Single render (compile + render in one step)
const result = renderer.renderSingle(
  'Hello {{user.name}}',
  '<mj-text>Welcome, {{user.name}}!</mj-text>',
  { user: { name: 'Jane' } }
);
// { html: '...compiled HTML...', text: 'Welcome, Jane!', subject: 'Hello Jane' }

// Batch render (compile once, render many times -- more efficient)
const compiled = renderer.compileBatch(subjectTemplate, bodyTemplate, textBodyTemplate);
for (const user of users) {
  const result = renderer.renderFromCompiled(compiled, resolveData(user));
}

// Extract variables from template strings
const vars = renderer.extractVariables('{{user.name}} loves {{platform.name}}');
// ['platform.name', 'user.name']

// Validate template syntax (Handlebars + MJML)
const validation = renderer.validateTemplate('<mj-text>{{user.name}}</mj-text>');
// { valid: true, errors: [] }
```

## Direct Model Access

For advanced queries, access the Mongoose models directly:

```typescript
const { EmailTemplate, EmailRule, EmailRuleSend, EmailRuleRunLog, EmailThrottleConfig } = engine.models;

// Example: find all sends for a specific rule
const sends = await EmailRuleSend.find({ ruleId: '...' }).sort({ sentAt: -1 }).limit(100);
```

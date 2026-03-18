Fixed. Renamed the `collection` field in the rule target schema to `collectionName` to avoid conflicting with Mongoose's reserved `collection` keyword. The warning no longer appears.

Affected files: `rule.schema.ts` (schema field), `rule.types.ts` (TypeScript type), `rule-editor.ts` (UI), `rule.service.ts` and `rule-runner.service.ts` (backend logic), all docs updated.

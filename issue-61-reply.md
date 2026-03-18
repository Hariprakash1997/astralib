Fixed. The `EmailRuleSend` schema defined `userId`, `emailIdentifierId`, and `messageId` as `Schema.Types.ObjectId`, but `findIdentifier` returns arbitrary strings (e.g., email addresses). Changed all three fields to `String` type in the schema.

**What changed:** `rule-send.schema.ts` — `userId`, `emailIdentifierId`, `messageId` fields changed from `ObjectId` to `String`. The `ruleId` field remains `ObjectId` since it always references an internal rule document.

This is a schema-level fix. Existing documents with ObjectId values in these fields will continue to work — MongoDB stores both as strings in the underlying BSON, and Mongoose `String` type accepts any value that was previously stored as ObjectId.

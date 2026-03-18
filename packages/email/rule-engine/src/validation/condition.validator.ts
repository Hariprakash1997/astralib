import type { RuleCondition } from '../types/rule.types';
import type { CollectionSchema, FlattenedField } from '../types/collection.types';
import { TYPE_OPERATORS } from '../constants/field-types';
import { flattenFields } from '../controllers/collection.controller';

export interface ConditionValidationError {
  index: number;
  field: string;
  message: string;
}

export function validateConditions(
  conditions: RuleCondition[],
  collectionName: string | undefined,
  collections: CollectionSchema[]
): ConditionValidationError[] {
  if (!collectionName || collections.length === 0) return [];

  const collection = collections.find(c => c.name === collectionName);
  if (!collection) return [];

  const flatFields = flattenFields(collection.fields);

  // Include joined fields
  if (collection.joins?.length) {
    for (const join of collection.joins) {
      const joinedCollection = collections.find(c => c.name === join.from);
      if (joinedCollection) {
        flatFields.push(...flattenFields(joinedCollection.fields, join.as));
      }
    }
  }

  const fieldMap = new Map<string, FlattenedField>();
  for (const f of flatFields) {
    fieldMap.set(f.path, f);
  }

  const errors: ConditionValidationError[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];

    const fieldDef = fieldMap.get(cond.field);
    if (!fieldDef) {
      errors.push({
        index: i,
        field: cond.field,
        message: `Field "${cond.field}" does not exist in collection "${collectionName}"`,
      });
      continue;
    }

    const allowedOps = TYPE_OPERATORS[fieldDef.type];
    if (allowedOps && !allowedOps.includes(cond.operator)) {
      errors.push({
        index: i,
        field: cond.field,
        message: `Operator "${cond.operator}" is not valid for field type "${fieldDef.type}"`,
      });
    }
  }

  return errors;
}

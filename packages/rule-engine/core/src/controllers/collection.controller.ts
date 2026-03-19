import type { Request, Response } from 'express';
import type { CollectionSchema, FieldDefinition, FlattenedField } from '../types/collection.types';
import { TYPE_OPERATORS } from '../constants/field-types';

export function flattenFields(fields: FieldDefinition[], prefix = '', parentIsArray = false): FlattenedField[] {
  const result: FlattenedField[] = [];
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const isArray = field.type === 'array';
    if (field.type === 'object' && field.fields?.length) {
      result.push({ path, type: 'object', label: field.label, description: field.description });
      result.push(...flattenFields(field.fields, path, false));
    } else if (isArray && field.fields?.length) {
      result.push({ path: `${path}[]`, type: 'array', label: field.label, description: field.description, isArray: true });
      result.push(...flattenFields(field.fields, `${path}[]`, true));
    } else {
      result.push({ path, type: field.type, label: field.label, description: field.description, enumValues: field.enumValues, isArray: parentIsArray || isArray });
    }
  }
  return result;
}

export function createCollectionController(collections: CollectionSchema[]) {
  return {
    list(_req: Request, res: Response) {
      const summary = collections.map(c => ({
        name: c.name, label: c.label, description: c.description, identifierField: c.identifierField,
        fieldCount: c.fields.length, joinCount: c.joins?.length ?? 0,
        joins: (c.joins ?? []).map(j => ({
          alias: j.as, from: j.from,
          label: collections.find(x => x.name === j.from)?.label ?? j.from,
        })),
      }));
      res.json({ collections: summary });
    },
    getFields(req: Request, res: Response) {
      const { name } = req.params;
      const collection = collections.find(c => c.name === name);
      if (!collection) { res.status(404).json({ error: `Collection "${name}" not found` }); return; }
      const fields = flattenFields(collection.fields);
      const requestedJoins = req.query.joins ? (req.query.joins as string).split(',') : undefined;
      if (collection.joins?.length) {
        for (const join of collection.joins) {
          if (requestedJoins && !requestedJoins.includes(join.as)) continue;
          const joinedCollection = collections.find(c => c.name === join.from);
          if (joinedCollection) { fields.push(...flattenFields(joinedCollection.fields, join.as)); }
        }
      }
      res.json({ name: collection.name, label: collection.label, identifierField: collection.identifierField, fields, typeOperators: TYPE_OPERATORS });
    },
  };
}

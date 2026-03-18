import type { FieldType } from '../types/collection.types';

export const FIELD_TYPE = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Date: 'date',
  ObjectId: 'objectId',
  Array: 'array',
  Object: 'object',
} as const;

export type { FieldType };

export const TYPE_OPERATORS: Record<FieldType, string[]> = {
  string: ['eq', 'neq', 'contains', 'in', 'not_in', 'exists', 'not_exists'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'exists', 'not_exists'],
  boolean: ['eq', 'neq', 'exists', 'not_exists'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'],
  objectId: ['eq', 'neq', 'in', 'not_in', 'exists', 'not_exists'],
  array: ['contains', 'in', 'not_in', 'exists', 'not_exists'],
  object: ['exists', 'not_exists'],
};

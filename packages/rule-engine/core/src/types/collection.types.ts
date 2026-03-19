import type { FieldType } from '../constants/field-types';
export type { FieldType };

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  fields?: FieldDefinition[];
}

export interface JoinDefinition {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
}

export interface CollectionSchema {
  name: string;
  label?: string;
  description?: string;
  identifierField?: string;
  fields: FieldDefinition[];
  joins?: JoinDefinition[];
}

export interface FlattenedField {
  path: string;
  type: FieldType;
  label?: string;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}

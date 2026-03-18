export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';

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

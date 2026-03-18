import { describe, it, expect } from 'vitest';
import { flattenFields } from '../controllers/collection.controller';
import { validateConditions } from '../validation/condition.validator';
import type { CollectionSchema, FieldDefinition } from '../types/collection.types';

describe('flattenFields', () => {
  it('should flatten simple fields', () => {
    const fields: FieldDefinition[] = [
      { name: 'name', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'isActive', type: 'boolean' },
    ];

    const result = flattenFields(fields);
    expect(result).toEqual([
      { path: 'name', type: 'string', label: undefined, description: undefined, enumValues: undefined, isArray: false },
      { path: 'age', type: 'number', label: undefined, description: undefined, enumValues: undefined, isArray: false },
      { path: 'isActive', type: 'boolean', label: undefined, description: undefined, enumValues: undefined, isArray: false },
    ]);
  });

  it('should flatten nested object fields', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'address',
        type: 'object',
        fields: [
          { name: 'city', type: 'string', label: 'City' },
          { name: 'zip', type: 'string' },
        ],
      },
    ];

    const result = flattenFields(fields);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ path: 'address', type: 'object' }));
    expect(result[1]).toEqual(expect.objectContaining({ path: 'address.city', type: 'string', label: 'City' }));
    expect(result[2]).toEqual(expect.objectContaining({ path: 'address.zip', type: 'string' }));
  });

  it('should flatten array fields with children', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'orders',
        type: 'array',
        fields: [
          { name: 'amount', type: 'number' },
          { name: 'date', type: 'date' },
        ],
      },
    ];

    const result = flattenFields(fields);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ path: 'orders[]', type: 'array', isArray: true }));
    expect(result[1]).toEqual(expect.objectContaining({ path: 'orders[].amount', type: 'number', isArray: true }));
    expect(result[2]).toEqual(expect.objectContaining({ path: 'orders[].date', type: 'date', isArray: true }));
  });

  it('should handle enum values', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', type: 'string', enumValues: ['active', 'inactive', 'pending'] },
    ];

    const result = flattenFields(fields);
    expect(result[0].enumValues).toEqual(['active', 'inactive', 'pending']);
  });

  it('should handle deeply nested structures', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'profile',
        type: 'object',
        fields: [
          {
            name: 'settings',
            type: 'object',
            fields: [
              { name: 'theme', type: 'string' },
            ],
          },
        ],
      },
    ];

    const result = flattenFields(fields);
    const paths = result.map(f => f.path);
    expect(paths).toContain('profile');
    expect(paths).toContain('profile.settings');
    expect(paths).toContain('profile.settings.theme');
  });

  it('should flatten with prefix', () => {
    const fields: FieldDefinition[] = [
      { name: 'email', type: 'string' },
    ];

    const result = flattenFields(fields, 'joined');
    expect(result[0].path).toBe('joined.email');
  });
});

describe('validateConditions', () => {
  const collections: CollectionSchema[] = [
    {
      name: 'users',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'isActive', type: 'boolean' },
        { name: 'createdAt', type: 'date' },
        { name: 'status', type: 'string', enumValues: ['active', 'inactive'] },
      ],
    },
  ];

  it('should return no errors for valid conditions', () => {
    const errors = validateConditions(
      [
        { field: 'name', operator: 'eq', value: 'John' },
        { field: 'age', operator: 'gt', value: 18 },
      ],
      'users',
      collections,
    );
    expect(errors).toHaveLength(0);
  });

  it('should return error for non-existent field', () => {
    const errors = validateConditions(
      [{ field: 'nonexistent', operator: 'eq', value: 'test' }],
      'users',
      collections,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('does not exist');
  });

  it('should return error for invalid operator on field type', () => {
    const errors = validateConditions(
      [{ field: 'isActive', operator: 'gt', value: true }],
      'users',
      collections,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('not valid for field type');
  });

  it('should skip validation when no collection specified', () => {
    const errors = validateConditions(
      [{ field: 'anything', operator: 'eq', value: 'test' }],
      undefined,
      collections,
    );
    expect(errors).toHaveLength(0);
  });

  it('should skip validation when collection not found', () => {
    const errors = validateConditions(
      [{ field: 'anything', operator: 'eq', value: 'test' }],
      'nonexistent',
      collections,
    );
    expect(errors).toHaveLength(0);
  });

  it('should skip validation when no collections configured', () => {
    const errors = validateConditions(
      [{ field: 'anything', operator: 'eq', value: 'test' }],
      'users',
      [],
    );
    expect(errors).toHaveLength(0);
  });

  it('should validate multiple conditions and report all errors', () => {
    const errors = validateConditions(
      [
        { field: 'nonexistent', operator: 'eq', value: 'test' },
        { field: 'isActive', operator: 'contains', value: 'test' },
      ],
      'users',
      collections,
    );
    expect(errors).toHaveLength(2);
  });
});

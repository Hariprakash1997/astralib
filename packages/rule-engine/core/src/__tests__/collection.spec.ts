import { describe, it, expect, vi } from 'vitest';
import { flattenFields, createCollectionController } from '../controllers/collection.controller';
import { validateConditions, validateJoinAliases } from '../validation/condition.validator';
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
    const fields: FieldDefinition[] = [{
      name: 'address', type: 'object',
      fields: [
        { name: 'city', type: 'string', label: 'City' },
        { name: 'zip', type: 'string' },
      ],
    }];
    const result = flattenFields(fields);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ path: 'address', type: 'object' }));
    expect(result[1]).toEqual(expect.objectContaining({ path: 'address.city', type: 'string', label: 'City' }));
    expect(result[2]).toEqual(expect.objectContaining({ path: 'address.zip', type: 'string' }));
  });

  it('should flatten array fields with children', () => {
    const fields: FieldDefinition[] = [{
      name: 'orders', type: 'array',
      fields: [
        { name: 'amount', type: 'number' },
        { name: 'date', type: 'date' },
      ],
    }];
    const result = flattenFields(fields);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ path: 'orders[]', type: 'array', isArray: true }));
    expect(result[1]).toEqual(expect.objectContaining({ path: 'orders[].amount', type: 'number', isArray: true }));
  });

  it('should handle enum values', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', type: 'string', enumValues: ['active', 'inactive', 'pending'] },
    ];
    const result = flattenFields(fields);
    expect(result[0].enumValues).toEqual(['active', 'inactive', 'pending']);
  });

  it('should flatten with prefix', () => {
    const fields: FieldDefinition[] = [{ name: 'email', type: 'string' }];
    const result = flattenFields(fields, 'joined');
    expect(result[0].path).toBe('joined.email');
  });
});

describe('validateConditions', () => {
  const collections: CollectionSchema[] = [{
    name: 'users',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'isActive', type: 'boolean' },
      { name: 'createdAt', type: 'date' },
    ],
  }];

  it('should return no errors for valid conditions', () => {
    const errors = validateConditions(
      [{ field: 'name', operator: 'eq', value: 'John' }, { field: 'age', operator: 'gt', value: 18 }],
      'users', collections,
    );
    expect(errors).toHaveLength(0);
  });

  it('should return error for non-existent field', () => {
    const errors = validateConditions(
      [{ field: 'nonexistent', operator: 'eq', value: 'test' }],
      'users', collections,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('does not exist');
  });

  it('should return error for invalid operator on field type', () => {
    const errors = validateConditions(
      [{ field: 'isActive', operator: 'gt', value: true }],
      'users', collections,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('not valid for field type');
  });

  it('should skip validation when no collection specified', () => {
    expect(validateConditions([{ field: 'anything', operator: 'eq', value: 'x' }], undefined, collections)).toHaveLength(0);
  });

  it('should skip validation when collection not found', () => {
    expect(validateConditions([{ field: 'anything', operator: 'eq', value: 'x' }], 'nonexistent', collections)).toHaveLength(0);
  });

  it('should validate joined fields when activeJoinAliases provided', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    expect(validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols, ['sub'])).toHaveLength(0);
  });

  it('should reject joined fields when join not active', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    const errors = validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols, []);
    expect(errors).toHaveLength(1);
  });

  it('should include all joins when activeJoinAliases undefined', () => {
    const cols: CollectionSchema[] = [
      { name: 'users', fields: [{ name: 'name', type: 'string' }],
        joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
      { name: 'subs', fields: [{ name: 'plan', type: 'string' }] },
    ];
    expect(validateConditions([{ field: 'sub.plan', operator: 'eq', value: 'x' }], 'users', cols)).toHaveLength(0);
  });
});

describe('validateJoinAliases', () => {
  const cols: CollectionSchema[] = [{
    name: 'users', fields: [{ name: 'name', type: 'string' }],
    joins: [
      { from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' },
      { from: 'pay', localField: '_id', foreignField: 'userId', as: 'payment' },
    ],
  }];

  it('should return no errors for valid aliases', () => { expect(validateJoinAliases(['sub'], 'users', cols)).toHaveLength(0); });
  it('should return error for invalid alias', () => { expect(validateJoinAliases(['bad'], 'users', cols)[0]).toContain('not defined'); });
  it('should return error for missing collection', () => { expect(validateJoinAliases(['sub'], 'nope', cols)[0]).toContain('not found'); });
  it('should return empty for empty aliases', () => { expect(validateJoinAliases([], 'users', cols)).toHaveLength(0); });
});

describe('createCollectionController', () => {
  const cols: CollectionSchema[] = [
    { name: 'users', label: 'Users', fields: [{ name: 'name', type: 'string' }],
      joins: [{ from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' }] },
    { name: 'subs', label: 'Subscriptions', fields: [{ name: 'plan', type: 'string' }] },
  ];
  const ctrl = createCollectionController(cols);
  const mockRes = () => { const r: any = { json: vi.fn(), status: vi.fn(() => r) }; return r; };

  it('list includes joins with alias and label', () => {
    const res = mockRes();
    ctrl.list({} as any, res);
    const data = res.json.mock.calls[0][0];
    expect(data.collections[0].joins[0]).toEqual({ alias: 'sub', from: 'subs', label: 'Subscriptions' });
  });

  it('getFields without joins param returns all', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: {} } as any, res);
    const paths = res.json.mock.calls[0][0].fields.map((f: any) => f.path);
    expect(paths).toContain('name');
    expect(paths).toContain('sub.plan');
  });

  it('getFields with joins param filters', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'users' }, query: { joins: 'sub' } } as any, res);
    expect(res.json.mock.calls[0][0].fields.map((f: any) => f.path)).toContain('sub.plan');
  });

  it('getFields returns 404 for unknown collection', () => {
    const res = mockRes();
    ctrl.getFields({ params: { name: 'unknown' }, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

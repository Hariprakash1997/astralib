import { describe, it, expect } from 'vitest';
import { buildAggregationPipeline } from '../utils/pipeline-builder';
import type { JoinDefinition } from '../types/collection.types';

describe('buildAggregationPipeline', () => {
  const subJoin: JoinDefinition = { from: 'subs', localField: '_id', foreignField: 'userId', as: 'sub' };

  it('returns empty pipeline with no joins/conditions', () => {
    expect(buildAggregationPipeline({ joins: [], conditions: [] })).toEqual([]);
  });

  it('adds $lookup + $unwind per join', () => {
    const p = buildAggregationPipeline({ joins: [subJoin], conditions: [] });
    expect(p).toHaveLength(2);
    expect(p[0]).toHaveProperty('$lookup');
    expect(p[1]).toHaveProperty('$unwind');
  });

  it('builds $match with $and from conditions', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'age', operator: 'gt', value: 18 },
      { field: 'status', operator: 'eq', value: 'active' },
    ]});
    expect((p[0] as any).$match.$and).toHaveLength(2);
  });

  it('handles same-field multiple conditions', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'age', operator: 'gte', value: 18 },
      { field: 'age', operator: 'lt', value: 65 },
    ]});
    expect((p[0] as any).$match.$and[0].age).toEqual({ $gte: 18 });
    expect((p[0] as any).$match.$and[1].age).toEqual({ $lt: 65 });
  });

  it('escapes regex in contains operator', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 'name', operator: 'contains', value: 'test.val(1)' },
    ]});
    expect((p[0] as any).$match.$and[0].name.$regex).toBe('test\\.val\\(1\\)');
  });

  it('wraps non-array value in array for in operator', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [
      { field: 's', operator: 'in', value: 'x' },
    ]});
    expect((p[0] as any).$match.$and[0].s.$in).toEqual(['x']);
  });

  it('orders stages: $lookup -> $unwind -> $match -> $limit', () => {
    const p = buildAggregationPipeline({
      joins: [subJoin],
      conditions: [{ field: 'sub.status', operator: 'eq', value: 'active' }],
      limit: 50,
    });
    expect(p).toHaveLength(4);
    expect(p[0]).toHaveProperty('$lookup');
    expect(p[1]).toHaveProperty('$unwind');
    expect(p[2]).toHaveProperty('$match');
    expect(p[3]).toEqual({ $limit: 50 });
  });

  it('adds $limit when provided without conditions', () => {
    const p = buildAggregationPipeline({ joins: [], conditions: [], limit: 100 });
    expect(p).toEqual([{ $limit: 100 }]);
  });
});

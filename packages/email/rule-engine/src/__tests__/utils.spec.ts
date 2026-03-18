import { describe, it, expect, vi } from 'vitest';
import { buildDateRangeFilter, calculatePagination, filterUpdateableFields } from '../utils/query-helpers';
import { getErrorStatus, isValidValue, asyncHandler } from '../utils/controller';
import { createRunStatsSchema } from '../schemas/shared-schemas';

// ─── buildDateRangeFilter ─────────────────────────────────────

describe('buildDateRangeFilter', () => {
  it('returns empty object when no dates provided', () => {
    expect(buildDateRangeFilter('runAt')).toEqual({});
  });

  it('returns empty object when both dates are undefined', () => {
    expect(buildDateRangeFilter('runAt', undefined, undefined)).toEqual({});
  });

  it('builds $gte filter for from only', () => {
    const filter = buildDateRangeFilter('runAt', '2026-01-01');
    expect(filter).toHaveProperty('runAt');
    expect((filter.runAt as any).$gte).toEqual(new Date('2026-01-01'));
    expect((filter.runAt as any).$lte).toBeUndefined();
  });

  it('builds $lte filter for to only', () => {
    const filter = buildDateRangeFilter('sentAt', undefined, '2026-03-18');
    expect(filter).toHaveProperty('sentAt');
    expect((filter.sentAt as any).$gte).toBeUndefined();
    expect((filter.sentAt as any).$lte).toEqual(new Date('2026-03-18T23:59:59.999Z'));
  });

  it('builds both $gte and $lte when both provided', () => {
    const filter = buildDateRangeFilter('runAt', '2026-01-01', '2026-03-18');
    expect((filter.runAt as any).$gte).toEqual(new Date('2026-01-01'));
    expect((filter.runAt as any).$lte).toEqual(new Date('2026-03-18T23:59:59.999Z'));
  });

  it('uses custom date field name', () => {
    const filter = buildDateRangeFilter('createdAt', '2026-01-01');
    expect(filter).toHaveProperty('createdAt');
    expect(filter).not.toHaveProperty('runAt');
  });

  it('ignores empty string from', () => {
    expect(buildDateRangeFilter('runAt', '')).toEqual({});
  });

  it('ignores empty string to', () => {
    expect(buildDateRangeFilter('runAt', undefined, '')).toEqual({});
  });

  it('ignores whitespace-only strings', () => {
    expect(buildDateRangeFilter('runAt', '   ', '  ')).toEqual({});
  });

  it('ignores invalid date strings', () => {
    expect(buildDateRangeFilter('runAt', 'not-a-date')).toEqual({});
  });

  it('ignores invalid from but accepts valid to', () => {
    const filter = buildDateRangeFilter('runAt', 'garbage', '2026-03-18');
    expect((filter.runAt as any).$gte).toBeUndefined();
    expect((filter.runAt as any).$lte).toEqual(new Date('2026-03-18T23:59:59.999Z'));
  });
});

// ─── calculatePagination ──────────────────────────────────────

describe('calculatePagination', () => {
  it('returns defaults when no args', () => {
    expect(calculatePagination()).toEqual({ page: 1, limit: 200, skip: 0 });
  });

  it('respects page and limit', () => {
    expect(calculatePagination(3, 50)).toEqual({ page: 3, limit: 50, skip: 100 });
  });

  it('clamps page to minimum 1', () => {
    expect(calculatePagination(0, 50)).toEqual({ page: 1, limit: 50, skip: 0 });
    expect(calculatePagination(-5, 50)).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it('clamps limit to minimum 1', () => {
    expect(calculatePagination(1, 0)).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(calculatePagination(1, -10)).toEqual({ page: 1, limit: 1, skip: 0 });
  });

  it('clamps limit to maxLimit', () => {
    expect(calculatePagination(1, 1000)).toEqual({ page: 1, limit: 500, skip: 0 });
  });

  it('respects custom maxLimit', () => {
    expect(calculatePagination(1, 300, 200)).toEqual({ page: 1, limit: 200, skip: 0 });
  });

  it('calculates skip correctly for page 2', () => {
    expect(calculatePagination(2, 20)).toEqual({ page: 2, limit: 20, skip: 20 });
  });

  it('handles undefined page with defined limit', () => {
    expect(calculatePagination(undefined, 10)).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('handles NaN inputs via undefined fallback', () => {
    expect(calculatePagination(NaN, NaN)).toEqual({ page: 1, limit: 200, skip: 0 });
  });
});

// ─── filterUpdateableFields ───────────────────────────────────

describe('filterUpdateableFields', () => {
  const allowed = new Set(['name', 'email', 'age']);

  it('filters only allowed fields', () => {
    const result = filterUpdateableFields({ name: 'John', email: 'j@x.com', password: 'secret' }, allowed);
    expect(result).toEqual({ name: 'John', email: 'j@x.com' });
    expect(result).not.toHaveProperty('password');
  });

  it('excludes undefined values', () => {
    const result = filterUpdateableFields({ name: 'John', email: undefined }, allowed);
    expect(result).toEqual({ name: 'John' });
  });

  it('includes null values', () => {
    const result = filterUpdateableFields({ name: null }, allowed);
    expect(result).toEqual({ name: null });
  });

  it('includes falsy values (0, false, empty string)', () => {
    const result = filterUpdateableFields({ name: '', age: 0 }, allowed);
    expect(result).toEqual({ name: '', age: 0 });
  });

  it('returns empty object when no fields match', () => {
    const result = filterUpdateableFields({ foo: 'bar' }, allowed);
    expect(result).toEqual({});
  });

  it('returns empty object for empty input', () => {
    const result = filterUpdateableFields({}, allowed);
    expect(result).toEqual({});
  });
});

// ─── getErrorStatus ───────────────────────────────────────────

describe('getErrorStatus', () => {
  it('returns 404 for not found messages', () => {
    expect(getErrorStatus('Template not found')).toBe(404);
    expect(getErrorStatus('Rule not found')).toBe(404);
  });

  it('returns 400 for validation messages', () => {
    expect(getErrorStatus('Slug already exists')).toBe(400);
    expect(getErrorStatus('validation failed')).toBe(400);
    expect(getErrorStatus('audience mismatch')).toBe(400);
    expect(getErrorStatus('Cannot activate rule')).toBe(400);
    expect(getErrorStatus('Cannot delete template')).toBe(400);
  });

  it('returns 500 for unknown messages', () => {
    expect(getErrorStatus('something went wrong')).toBe(500);
    expect(getErrorStatus('')).toBe(500);
  });

  it('prioritizes not found over validation keywords', () => {
    // "not found" check comes first
    expect(getErrorStatus('validation not found')).toBe(404);
  });
});

// ─── isValidValue ─────────────────────────────────────────────

describe('isValidValue', () => {
  const allowed = ['customer', 'provider', 'all'] as const;

  it('returns true for valid values', () => {
    expect(isValidValue(allowed, 'customer')).toBe(true);
    expect(isValidValue(allowed, 'all')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidValue(allowed, 'admin')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isValidValue(allowed, 123)).toBe(false);
    expect(isValidValue(allowed, null)).toBe(false);
    expect(isValidValue(allowed, undefined)).toBe(false);
    expect(isValidValue(allowed, true)).toBe(false);
    expect(isValidValue(allowed, {})).toBe(false);
  });

  it('returns false for empty allowed list', () => {
    expect(isValidValue([], 'anything')).toBe(false);
  });
});

// ─── asyncHandler ─────────────────────────────────────────────

describe('asyncHandler', () => {
  function mockRes() {
    const res: any = {
      headersSent: false,
      statusCode: 200,
      body: null,
      status(code: number) { res.statusCode = code; return res; },
      json(data: any) { res.body = data; return res; },
    };
    return res;
  }

  it('calls the handler with req and res', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = {} as any;
    const res = mockRes();
    wrapped(req, res);
    await new Promise(r => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledWith(req, res);
  });

  it('catches errors and sends error response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Template not found'));
    const wrapped = asyncHandler(handler);
    const res = mockRes();
    wrapped({} as any, res);
    await new Promise(r => setTimeout(r, 10));
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Template not found' });
  });

  it('sends 500 for generic errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('database timeout'));
    const wrapped = asyncHandler(handler);
    const res = mockRes();
    wrapped({} as any, res);
    await new Promise(r => setTimeout(r, 10));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'database timeout' });
  });

  it('sends 400 for validation errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('validation failed'));
    const wrapped = asyncHandler(handler);
    const res = mockRes();
    wrapped({} as any, res);
    await new Promise(r => setTimeout(r, 10));
    expect(res.statusCode).toBe(400);
  });

  it('handles non-Error throws', async () => {
    const handler = vi.fn().mockRejectedValue('string error');
    const wrapped = asyncHandler(handler);
    const res = mockRes();
    wrapped({} as any, res);
    await new Promise(r => setTimeout(r, 10));
    expect(res.body).toEqual({ success: false, error: 'Unknown error' });
  });

  it('does not send response if headers already sent', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const wrapped = asyncHandler(handler);
    const res = mockRes();
    res.headersSent = true;
    const jsonSpy = vi.spyOn(res, 'json');
    wrapped({} as any, res);
    await new Promise(r => setTimeout(r, 10));
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

// ─── createRunStatsSchema ─────────────────────────────────────

describe('createRunStatsSchema', () => {
  it('creates a schema with all 5 stats fields', () => {
    const schema = createRunStatsSchema();
    const paths = Object.keys(schema.paths);
    expect(paths).toContain('matched');
    expect(paths).toContain('sent');
    expect(paths).toContain('skipped');
    expect(paths).toContain('skippedByThrottle');
    expect(paths).toContain('errorCount');
  });

  it('has _id disabled', () => {
    const schema = createRunStatsSchema();
    expect((schema as any).options._id).toBe(false);
  });

  it('all fields default to 0', () => {
    const schema = createRunStatsSchema();
    for (const field of ['matched', 'sent', 'skipped', 'skippedByThrottle', 'errorCount']) {
      expect(schema.path(field).options.default).toBe(0);
    }
  });

  it('can be used to spread into another schema', () => {
    const base = createRunStatsSchema();
    expect(base.obj).toBeDefined();
    expect(base.obj).toHaveProperty('matched');
    expect(base.obj).toHaveProperty('errorCount');
  });
});

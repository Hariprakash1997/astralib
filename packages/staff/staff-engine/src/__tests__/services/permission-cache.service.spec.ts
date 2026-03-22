import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionCacheService } from '../../services/permission-cache.service.js';

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function mockStaffModel(permissions: string[] = []) {
  return {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ permissions }),
      }),
    }),
  } as any;
}

describe('PermissionCacheService (in-memory)', () => {
  let cache: PermissionCacheService;
  let model: any;

  beforeEach(() => {
    model = mockStaffModel(['chat:view', 'chat:edit']);
    cache = new PermissionCacheService(model, 60000, null, '', noopLogger);
  });

  it('fetches from DB on cache miss', async () => {
    const perms = await cache.get('staff1');
    expect(perms).toEqual(['chat:view', 'chat:edit']);
    expect(model.findOne).toHaveBeenCalledOnce();
  });

  it('returns cached value on second call', async () => {
    await cache.get('staff1');
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledOnce();
  });

  it('invalidate forces re-fetch', async () => {
    await cache.get('staff1');
    await cache.invalidate('staff1');
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidateAll clears all entries', async () => {
    await cache.get('staff1');
    await cache.get('staff2');
    await cache.invalidateAll();
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledTimes(3);
  });

  it('returns empty array if staff not found', async () => {
    const emptyModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      }),
    } as any;
    const emptyCache = new PermissionCacheService(emptyModel, 60000, null, '', noopLogger);
    const perms = await emptyCache.get('unknown');
    expect(perms).toEqual([]);
  });
});

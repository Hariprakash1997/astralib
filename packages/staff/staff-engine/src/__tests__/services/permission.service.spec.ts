import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionService } from '../../services/permission.service.js';
import { DuplicateError, GroupNotFoundError } from '../../errors/index.js';

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    groupId: 'grp-1',
    label: 'Group One',
    permissions: [
      { key: 'chat:view', label: 'View Chat', type: 'view' },
      { key: 'chat:edit', label: 'Edit Chat', type: 'edit' },
    ],
    sortOrder: 0,
    ...overrides,
  };
}

function mockPermissionGroup() {
  const group = makeGroup();
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([group]),
      }),
    }),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      ...group,
      toObject: vi.fn().mockReturnValue(group),
    }),
    findOneAndUpdate: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(group),
    }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  } as any;
}

function mockCache() {
  return { invalidateAll: vi.fn().mockResolvedValue(undefined) } as any;
}

describe('PermissionService', () => {
  let Model: ReturnType<typeof mockPermissionGroup>;
  let cache: ReturnType<typeof mockCache>;
  let service: PermissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    Model = mockPermissionGroup();
    cache = mockCache();
    service = new PermissionService(Model, cache, noopLogger);
  });

  // ── listGroups ──────────────────────────────────────────────────────────────

  describe('listGroups', () => {
    it('returns groups sorted by sortOrder', async () => {
      const groups = await service.listGroups();
      expect(Model.find).toHaveBeenCalledWith({});
      expect(groups).toHaveLength(1);
      expect(groups[0].groupId).toBe('grp-1');
    });
  });

  // ── createGroup ─────────────────────────────────────────────────────────────

  describe('createGroup', () => {
    it('creates and returns a group', async () => {
      const input = {
        groupId: 'grp-new',
        label: 'New Group',
        permissions: [],
      };
      const result = await service.createGroup(input);
      expect(Model.findOne).toHaveBeenCalledWith({ groupId: 'grp-new' });
      expect(Model.create).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'grp-new', sortOrder: 0 }));
      expect(result.groupId).toBe('grp-1'); // toObject() returns makeGroup()
      expect(noopLogger.info).toHaveBeenCalledWith('Permission group created', { groupId: 'grp-new' });
    });

    it('uses provided sortOrder when given', async () => {
      const input = { groupId: 'grp-sorted', label: 'Sorted', permissions: [], sortOrder: 5 };
      await service.createGroup(input);
      expect(Model.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 5 }));
    });

    it('throws DuplicateError when groupId already exists', async () => {
      Model.findOne.mockResolvedValue(makeGroup());
      await expect(
        service.createGroup({ groupId: 'grp-1', label: 'Dup', permissions: [] }),
      ).rejects.toThrow(DuplicateError);
    });
  });

  // ── updateGroup ─────────────────────────────────────────────────────────────

  describe('updateGroup', () => {
    it('updates and returns the group', async () => {
      const result = await service.updateGroup('grp-1', { label: 'Updated' });
      expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
        { groupId: 'grp-1' },
        { $set: { label: 'Updated' } },
        { new: true },
      );
      expect(result.groupId).toBe('grp-1');
      expect(noopLogger.info).toHaveBeenCalledWith('Permission group updated', {
        groupId: 'grp-1',
        fields: ['label'],
      });
    });

    it('throws GroupNotFoundError when group does not exist', async () => {
      Model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(service.updateGroup('missing', { label: 'X' })).rejects.toThrow(GroupNotFoundError);
    });

    it('calls permissionCache.invalidateAll() after successful update', async () => {
      await service.updateGroup('grp-1', { label: 'Updated' });
      expect(cache.invalidateAll).toHaveBeenCalledOnce();
    });
  });

  // ── deleteGroup ─────────────────────────────────────────────────────────────

  describe('deleteGroup', () => {
    it('deletes the group', async () => {
      await service.deleteGroup('grp-1');
      expect(Model.deleteOne).toHaveBeenCalledWith({ groupId: 'grp-1' });
      expect(noopLogger.info).toHaveBeenCalledWith('Permission group deleted', { groupId: 'grp-1' });
    });

    it('throws GroupNotFoundError when group does not exist', async () => {
      Model.deleteOne.mockResolvedValue({ deletedCount: 0 });
      await expect(service.deleteGroup('missing')).rejects.toThrow(GroupNotFoundError);
    });

    it('calls permissionCache.invalidateAll() after successful delete', async () => {
      await service.deleteGroup('grp-1');
      expect(cache.invalidateAll).toHaveBeenCalledOnce();
    });
  });

  // ── getAllPermissionKeys ─────────────────────────────────────────────────────

  describe('getAllPermissionKeys', () => {
    it('returns flat array of all permission keys', async () => {
      const keys = await service.getAllPermissionKeys();
      expect(keys).toEqual(['chat:view', 'chat:edit']);
    });

    it('returns empty array when no groups exist', async () => {
      Model.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
      const keys = await service.getAllPermissionKeys();
      expect(keys).toEqual([]);
    });
  });

  // ── tenantId filtering ───────────────────────────────────────────────────────

  describe('with tenantId', () => {
    beforeEach(() => {
      service = new PermissionService(Model, cache, noopLogger, 'tenant-abc');
    });

    it('listGroups passes tenantId filter', async () => {
      await service.listGroups();
      expect(Model.find).toHaveBeenCalledWith({ tenantId: 'tenant-abc' });
    });

    it('createGroup includes tenantId in create call', async () => {
      await service.createGroup({ groupId: 'grp-t', label: 'T', permissions: [] });
      expect(Model.create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-abc' }));
    });

    it('updateGroup includes tenantId in filter', async () => {
      await service.updateGroup('grp-1', { label: 'X' });
      expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
        { groupId: 'grp-1', tenantId: 'tenant-abc' },
        expect.anything(),
        expect.anything(),
      );
    });

    it('deleteGroup includes tenantId in filter', async () => {
      await service.deleteGroup('grp-1');
      expect(Model.deleteOne).toHaveBeenCalledWith({ groupId: 'grp-1', tenantId: 'tenant-abc' });
    });
  });
});

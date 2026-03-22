import { describe, it, expect } from 'vitest';
import { validatePermissionPairs } from '../validation/index.js';
import { InvalidPermissionError } from '../errors/index.js';

function makeGroups(entries: { key: string; type: string }[]) {
  return [
    {
      groupId: 'test-group',
      label: 'Test Group',
      permissions: entries.map(e => ({ ...e, label: e.key })),
      sortOrder: 0,
    },
  ] as any[];
}

describe('validatePermissionPairs', () => {
  it('passes when all edit keys have matching view keys', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'chat:edit', type: 'edit' },
    ]);
    expect(() =>
      validatePermissionPairs(['chat:view', 'chat:edit'], groups),
    ).not.toThrow();
  });

  it('throws InvalidPermissionError when edit key has no matching view key', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'chat:edit', type: 'edit' },
    ]);
    expect(() =>
      validatePermissionPairs(['chat:edit'], groups),
    ).toThrow(InvalidPermissionError);
  });

  it('includes the missing view key in the error', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'chat:edit', type: 'edit' },
    ]);
    try {
      validatePermissionPairs(['chat:edit'], groups);
      expect.fail('Expected InvalidPermissionError');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidPermissionError);
      expect((err as InvalidPermissionError).missingViewKeys).toContain('chat:view');
    }
  });

  it('passes for action-type permissions (no cascade needed)', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'reports:export', type: 'action' },
    ]);
    expect(() =>
      validatePermissionPairs(['reports:export'], groups),
    ).not.toThrow();
  });

  it('passes when no edit keys are present in permissions', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'chat:edit', type: 'edit' },
    ]);
    // Only view permission selected — no edits, no violation
    expect(() =>
      validatePermissionPairs(['chat:view'], groups),
    ).not.toThrow();
  });

  it('passes for empty permissions array', () => {
    const groups = makeGroups([
      { key: 'chat:view', type: 'view' },
      { key: 'chat:edit', type: 'edit' },
    ]);
    expect(() =>
      validatePermissionPairs([], groups),
    ).not.toThrow();
  });
});

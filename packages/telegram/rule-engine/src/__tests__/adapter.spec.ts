import { describe, it, expect, vi } from 'vitest';
import { createTelegramAdapters } from '../adapters/telegram.adapter';
import type { TelegramRuleEngineConfig } from '../types/config.types';

function createMockConfig(overrides: Partial<TelegramRuleEngineConfig['adapters']> = {}): TelegramRuleEngineConfig {
  return {
    db: { connection: {} as any },
    redis: { connection: {} as any },
    adapters: {
      queryUsers: vi.fn().mockResolvedValue([]),
      resolveData: vi.fn().mockReturnValue({ name: 'Test' }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      selectAccount: vi.fn().mockResolvedValue({ accountId: 'acc-1', phone: '+1234567890', metadata: { label: 'main' } }),
      findIdentifier: vi.fn().mockResolvedValue({ id: 'id-1', contactId: 'contact-1' }),
      ...overrides,
    },
  };
}

describe('createTelegramAdapters', () => {
  it('returns an object with all 5 core adapter methods', () => {
    const config = createMockConfig();
    const adapters = createTelegramAdapters(config);

    expect(typeof adapters.send).toBe('function');
    expect(typeof adapters.selectAgent).toBe('function');
    expect(typeof adapters.queryUsers).toBe('function');
    expect(typeof adapters.resolveData).toBe('function');
    expect(typeof adapters.findIdentifier).toBe('function');
  });

  describe('send', () => {
    it('maps core body to telegram message', async () => {
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const config = createMockConfig({ sendMessage });
      const adapters = createTelegramAdapters(config);

      await adapters.send({
        identifierId: 'id-1',
        contactId: 'contact-1',
        accountId: 'acc-1',
        body: 'Hello world',
        ruleId: 'rule-1',
        metadata: { templateId: 'tmpl-1' },
      });

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          identifierId: 'id-1',
          contactId: 'contact-1',
          accountId: 'acc-1',
          message: 'Hello world',
          ruleId: 'rule-1',
          templateId: 'tmpl-1',
        }),
      );
    });

    it('passes media from metadata', async () => {
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const config = createMockConfig({ sendMessage });
      const adapters = createTelegramAdapters(config);

      const media = { type: 'photo' as const, url: 'https://example.com/img.jpg' };
      await adapters.send({
        identifierId: 'id-1',
        contactId: 'contact-1',
        accountId: 'acc-1',
        body: 'Check this out',
        ruleId: 'rule-1',
        metadata: { templateId: 'tmpl-1', media },
      });

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          media,
        }),
      );
    });

    it('defaults templateId to empty string when not in metadata', async () => {
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const config = createMockConfig({ sendMessage });
      const adapters = createTelegramAdapters(config);

      await adapters.send({
        identifierId: 'id-1',
        contactId: 'contact-1',
        accountId: 'acc-1',
        body: 'Hello',
        ruleId: 'rule-1',
      });

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: '' }),
      );
    });
  });

  describe('selectAgent', () => {
    it('maps phone to contactValue and preserves healthScore', async () => {
      const selectAccount = vi.fn().mockResolvedValue({
        accountId: 'acc-1',
        phone: '+919876543210',
        metadata: { label: 'main' },
        healthScore: 85,
      });
      const config = createMockConfig({ selectAccount });
      const adapters = createTelegramAdapters(config);

      const result = await adapters.selectAgent('id-1', { ruleId: 'r1', templateId: 't1' });

      expect(result).not.toBeNull();
      expect(result!.accountId).toBe('acc-1');
      expect(result!.contactValue).toBe('+919876543210');
      expect(result!.metadata?.healthScore).toBe(85);
      expect(result!.metadata?.label).toBe('main');
    });

    it('returns null when selectAccount returns null', async () => {
      const selectAccount = vi.fn().mockResolvedValue(null);
      const config = createMockConfig({ selectAccount });
      const adapters = createTelegramAdapters(config);

      const result = await adapters.selectAgent('id-1');
      expect(result).toBeNull();
    });

    it('passes identifierId and context to selectAccount', async () => {
      const selectAccount = vi.fn().mockResolvedValue({
        accountId: 'acc-1', phone: '+111', metadata: {},
      });
      const config = createMockConfig({ selectAccount });
      const adapters = createTelegramAdapters(config);

      await adapters.selectAgent('id-test', { ruleId: 'r1', templateId: 't1' });

      expect(selectAccount).toHaveBeenCalledWith('id-test', { ruleId: 'r1', templateId: 't1' });
    });
  });

  describe('queryUsers', () => {
    it('passes through to config.adapters.queryUsers', async () => {
      const queryUsers = vi.fn().mockResolvedValue([{ _id: 'u1' }]);
      const config = createMockConfig({ queryUsers });
      const adapters = createTelegramAdapters(config);

      const target = { mode: 'query' as const, conditions: { role: 'customer' } };
      const result = await adapters.queryUsers(target as any, 50, {});

      expect(queryUsers).toHaveBeenCalled();
      expect(result).toEqual([{ _id: 'u1' }]);
    });
  });

  describe('resolveData', () => {
    it('passes through directly', () => {
      const resolveData = vi.fn().mockReturnValue({ name: 'Alice', email: 'alice@test.com' });
      const config = createMockConfig({ resolveData });
      const adapters = createTelegramAdapters(config);

      const result = adapters.resolveData({ _id: 'u1', name: 'Alice' });

      expect(resolveData).toHaveBeenCalledWith({ _id: 'u1', name: 'Alice' });
      expect(result).toEqual({ name: 'Alice', email: 'alice@test.com' });
    });
  });

  describe('findIdentifier', () => {
    it('passes through and returns result', async () => {
      const findIdentifier = vi.fn().mockResolvedValue({ id: 'id-abc', contactId: 'contact-xyz' });
      const config = createMockConfig({ findIdentifier });
      const adapters = createTelegramAdapters(config);

      const result = await adapters.findIdentifier('+919876543210');

      expect(findIdentifier).toHaveBeenCalledWith('+919876543210');
      expect(result).toEqual({ id: 'id-abc', contactId: 'contact-xyz' });
    });

    it('returns null when findIdentifier returns null', async () => {
      const findIdentifier = vi.fn().mockResolvedValue(null);
      const config = createMockConfig({ findIdentifier });
      const adapters = createTelegramAdapters(config);

      const result = await adapters.findIdentifier('+000');
      expect(result).toBeNull();
    });
  });
});

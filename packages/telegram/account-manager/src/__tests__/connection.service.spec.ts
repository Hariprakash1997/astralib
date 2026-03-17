import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionService } from '../services/connection.service';
import { ACCOUNT_STATUS } from '../constants';
import { AccountNotFoundError, ConnectionError } from '../errors';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramAccountManagerConfig } from '../types/config.types';

vi.mock('telegram', () => {
  return {
    TelegramClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getMe: vi.fn().mockResolvedValue({ id: '123', firstName: 'Test' }),
    })),
  };
});

vi.mock('telegram/sessions', () => {
  return {
    StringSession: vi.fn().mockImplementation((s: string) => s),
  };
});

function createMockConfig(overrides: Partial<TelegramAccountManagerConfig> = {}): TelegramAccountManagerConfig {
  return {
    db: { connection: {} as any },
    credentials: { apiId: 12345, apiHash: 'abc123' },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    hooks: {
      onAccountConnected: vi.fn(),
      onAccountDisconnected: vi.fn(),
    },
    ...overrides,
  };
}

function createMockTelegramAccount() {
  return {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  } as unknown as TelegramAccountModel;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    phone: '+919876543210',
    name: 'Test Account',
    session: 'session-string',
    status: 'disconnected',
    ...overrides,
  };
}

describe('ConnectionService', () => {
  let service: ConnectionService;
  let TelegramAccount: ReturnType<typeof createMockTelegramAccount>;
  let config: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    TelegramAccount = createMockTelegramAccount();
    config = createMockConfig();
    service = new ConnectionService(TelegramAccount as any, config as any, config.hooks);
  });

  describe('connect()', () => {
    it('should throw AccountNotFoundError when account does not exist', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.connect('non-existent')).rejects.toThrow(AccountNotFoundError);
    });

    it('should connect client, validate with getMe, update status, store client, fire hook', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.connect('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { status: ACCOUNT_STATUS.Connected },
      });

      expect(config.hooks!.onAccountConnected).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+919876543210',
      });

      // Client should be stored and retrievable
      const client = service.getClient('acc-1');
      expect(client).not.toBeNull();
    });

    it('should throw ConnectionError when getMe returns null', async () => {
      const { TelegramClient } = await import('telegram');
      (TelegramClient as any).mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        getMe: vi.fn().mockResolvedValue(null),
      }));

      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      // Re-create service so the new mock is picked up
      service = new ConnectionService(TelegramAccount as any, config as any, config.hooks);

      await expect(service.connect('acc-1')).rejects.toThrow(ConnectionError);
    });
  });

  describe('disconnect()', () => {
    it('should do nothing when accountId is not in clients map', async () => {
      await service.disconnect('unknown-id');

      expect(TelegramAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should disconnect client, remove from map, update status, fire hook', async () => {
      // First connect to populate the clients map
      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.connect('acc-1');
      vi.clearAllMocks();

      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.disconnect('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { status: ACCOUNT_STATUS.Disconnected },
      });

      expect(config.hooks!.onAccountDisconnected).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+919876543210',
        reason: 'manual',
      });

      // Client should no longer be retrievable
      expect(service.getClient('acc-1')).toBeNull();
    });
  });

  describe('reconnect()', () => {
    it('should disconnect then connect on success', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      // First connect
      await service.connect('acc-1');
      vi.clearAllMocks();

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.reconnect('acc-1');

      // After reconnect, client should be available
      expect(service.getClient('acc-1')).not.toBeNull();
    });

    it('should exhaust retries with exponential backoff on repeated failure', async () => {
      const maxRetries = 2;
      config = createMockConfig({ options: { reconnectMaxRetries: maxRetries } });
      service = new ConnectionService(TelegramAccount as any, config as any, config.hooks);

      // connect always fails (account not found)
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await service.reconnect('acc-1');

      // After exhaustion, status should be updated to Error
      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: expect.objectContaining({
          status: ACCOUNT_STATUS.Error,
          lastError: 'RECONNECT_EXHAUSTED',
        }),
      });
    });
  });

  describe('getClient()', () => {
    it('should return client when connected', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.connect('acc-1');

      const client = service.getClient('acc-1');
      expect(client).not.toBeNull();
    });

    it('should return null when account not found', () => {
      const client = service.getClient('non-existent');
      expect(client).toBeNull();
    });
  });

  describe('getConnectedAccounts()', () => {
    it('should return array of ConnectedAccount with phone and name', async () => {
      const account1 = makeAccountDoc({ _id: 'acc-1', phone: '+911111', name: 'A1' });
      const account2 = makeAccountDoc({ _id: 'acc-2', phone: '+922222', name: 'A2' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(account1)
        .mockResolvedValueOnce(account2);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.connect('acc-1');
      await service.connect('acc-2');

      const accounts = service.getConnectedAccounts();

      expect(accounts).toHaveLength(2);
      expect(accounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'acc-1', phone: '+911111', name: 'A1', isConnected: true }),
          expect.objectContaining({ accountId: 'acc-2', phone: '+922222', name: 'A2', isConnected: true }),
        ]),
      );
    });

    it('should return empty array when no clients connected', () => {
      const accounts = service.getConnectedAccounts();
      expect(accounts).toEqual([]);
    });
  });

  describe('disconnectAll()', () => {
    it('should disconnect all clients and clear map', async () => {
      const account1 = makeAccountDoc({ _id: 'acc-1', phone: '+911111' });
      const account2 = makeAccountDoc({ _id: 'acc-2', phone: '+922222' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(account1)
        .mockResolvedValueOnce(account2);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.connect('acc-1');
      await service.connect('acc-2');

      expect(service.getConnectedAccounts()).toHaveLength(2);

      await service.disconnectAll();

      expect(service.getConnectedAccounts()).toHaveLength(0);
      expect(service.getClient('acc-1')).toBeNull();
      expect(service.getClient('acc-2')).toBeNull();
    });
  });
});

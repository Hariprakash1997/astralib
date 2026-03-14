import type { GlobalSettings, UpdateGlobalSettingsInput } from '../types/settings.types';
import type { LogAdapter } from '../types/config.types';
import type { GlobalSettingsModel } from '../schemas/global-settings.schema';

const DEFAULTS: Omit<GlobalSettings, '_id' | 'updatedAt'> = {
  timezone: 'UTC',
  devMode: { enabled: false, testEmails: [] },
  imap: {
    enabled: false,
    pollIntervalMs: 300000,
    searchSince: 'last_check',
    bounceSenders: ['mailer-daemon@googlemail.com'],
  },
  ses: { trackOpens: true, trackClicks: true },
  approval: {
    enabled: false,
    defaultMode: 'manual',
    autoApproveDelayMs: 0,
    sendWindow: { timezone: 'UTC', startHour: 9, endHour: 21 },
    spreadStrategy: 'random',
    maxSpreadMinutes: 120,
  },
  unsubscribePage: { companyName: '' },
  queues: {
    sendConcurrency: 3,
    sendAttempts: 3,
    sendBackoffMs: 5000,
    approvalConcurrency: 1,
    approvalAttempts: 3,
    approvalBackoffMs: 10000,
  },
};

export class SettingsService {
  private cache: GlobalSettings | null = null;

  constructor(
    private GlobalSettings: GlobalSettingsModel,
    private logger: LogAdapter,
  ) {}

  async get(): Promise<GlobalSettings> {
    if (this.cache) return this.cache;

    let doc = await this.GlobalSettings.findById('global').lean<GlobalSettings>();

    if (!doc) {
      doc = await this.GlobalSettings.create({
        _id: 'global',
        ...DEFAULTS,
        updatedAt: new Date(),
      }) as unknown as GlobalSettings;
      this.logger.info('GlobalSettings created with defaults');
    }

    this.cache = doc;
    return doc;
  }

  async update(partial: UpdateGlobalSettingsInput): Promise<GlobalSettings> {
    const flattened = flattenObject({ ...partial, updatedAt: new Date() });

    const doc = await this.GlobalSettings.findByIdAndUpdate(
      'global',
      { $set: flattened },
      { new: true, upsert: true },
    ).lean<GlobalSettings>();

    this.cache = doc;
    this.logger.info('GlobalSettings updated', { sections: Object.keys(partial) });
    return doc!;
  }

  async updateSection(section: string, data: unknown): Promise<GlobalSettings> {
    const setFields: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        setFields[`${section}.${key}`] = value;
      }
    } else {
      setFields[section] = data;
    }

    const doc = await this.GlobalSettings.findByIdAndUpdate(
      'global',
      { $set: setFields },
      { new: true, upsert: true },
    ).lean<GlobalSettings>();

    this.cache = doc;
    this.logger.info('GlobalSettings section updated', { section });
    return doc!;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

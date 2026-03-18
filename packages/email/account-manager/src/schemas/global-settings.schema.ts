import { Schema, Model, HydratedDocument } from 'mongoose';
import { IMAP_SEARCH_SINCE, APPROVAL_MODE, SPREAD_STRATEGY } from '../constants';
import type { GlobalSettings } from '../types/settings.types';

export interface IGlobalSettings extends Omit<GlobalSettings, '_id'> {
  _id: string;
}

export type GlobalSettingsDocument = HydratedDocument<IGlobalSettings>;

export interface GlobalSettingsStatics {
  getSettings(): Promise<GlobalSettingsDocument>;
  updateSettings(partial: Partial<Omit<GlobalSettings, '_id' | 'updatedAt'>>): Promise<GlobalSettingsDocument>;
}

export type GlobalSettingsModel = Model<IGlobalSettings> & GlobalSettingsStatics;

const DEFAULT_SETTINGS: Omit<GlobalSettings, '_id' | 'updatedAt'> = {
  timezone: 'UTC',
  devMode: {
    enabled: false,
    testEmails: [],
  },
  imap: {
    enabled: false,
    pollIntervalMs: 300000,
    searchSince: IMAP_SEARCH_SINCE.LastCheck,
    bounceSenders: ['mailer-daemon@googlemail.com'],
  },
  ses: {
    configurationSet: undefined,
    trackOpens: true,
    trackClicks: true,
  },
  approval: {
    enabled: false,
    defaultMode: APPROVAL_MODE.Manual,
    autoApproveDelayMs: 0,
    sendWindow: {
      timezone: 'UTC',
      startHour: 9,
      endHour: 21,
    },
    spreadStrategy: SPREAD_STRATEGY.Random,
    maxSpreadMinutes: 120,
  },
  unsubscribePage: {
    companyName: '',
    logoUrl: undefined,
    accentColor: undefined,
  },
  queues: {
    sendConcurrency: 3,
    sendAttempts: 3,
    sendBackoffMs: 5000,
    approvalConcurrency: 1,
    approvalAttempts: 3,
    approvalBackoffMs: 10000,
  },
};

export interface CreateGlobalSettingsSchemaOptions {
  collectionName?: string;
}

export function createGlobalSettingsSchema(options?: CreateGlobalSettingsSchemaOptions) {
  const schema = new Schema<IGlobalSettings>(
    {
      _id: { type: String, default: 'global' },

      timezone: { type: String, default: DEFAULT_SETTINGS.timezone },

      devMode: {
        type: {
          enabled: { type: Boolean, default: false },
          testEmails: [{ type: String }],
        },
        default: () => ({ ...DEFAULT_SETTINGS.devMode }),
        _id: false,
      },

      imap: {
        type: {
          enabled: { type: Boolean, default: false },
          pollIntervalMs: { type: Number, default: 300000 },
          searchSince: { type: String, enum: Object.values(IMAP_SEARCH_SINCE), default: IMAP_SEARCH_SINCE.LastCheck },
          bounceSenders: [{ type: String }],
        },
        default: () => ({ ...DEFAULT_SETTINGS.imap }),
        _id: false,
      },

      ses: {
        type: {
          configurationSet: String,
          trackOpens: { type: Boolean, default: true },
          trackClicks: { type: Boolean, default: true },
        },
        default: () => ({ ...DEFAULT_SETTINGS.ses }),
        _id: false,
      },

      approval: {
        type: {
          enabled: { type: Boolean, default: false },
          defaultMode: { type: String, enum: Object.values(APPROVAL_MODE), default: APPROVAL_MODE.Manual },
          autoApproveDelayMs: { type: Number, default: 0 },
          sendWindow: {
            type: {
              timezone: { type: String, default: 'UTC' },
              startHour: { type: Number, default: 9, min: 0, max: 23 },
              endHour: { type: Number, default: 21, min: 0, max: 23 },
            },
            _id: false,
          },
          spreadStrategy: { type: String, enum: Object.values(SPREAD_STRATEGY), default: SPREAD_STRATEGY.Random },
          maxSpreadMinutes: { type: Number, default: 120 },
        },
        default: () => ({ ...DEFAULT_SETTINGS.approval, sendWindow: { ...DEFAULT_SETTINGS.approval.sendWindow } }),
        _id: false,
      },

      unsubscribePage: {
        type: {
          companyName: { type: String, default: '' },
          logoUrl: String,
          accentColor: String,
        },
        default: () => ({ ...DEFAULT_SETTINGS.unsubscribePage }),
        _id: false,
      },

      queues: {
        type: {
          sendConcurrency: { type: Number, default: 3 },
          sendAttempts: { type: Number, default: 3 },
          sendBackoffMs: { type: Number, default: 5000 },
          approvalConcurrency: { type: Number, default: 1 },
          approvalAttempts: { type: Number, default: 3 },
          approvalBackoffMs: { type: Number, default: 10000 },
        },
        default: () => ({ ...DEFAULT_SETTINGS.queues }),
        _id: false,
      },
    },
    {
      timestamps: { createdAt: false, updatedAt: true },
      collection: options?.collectionName || 'global_settings',

      statics: {
        async getSettings(): Promise<GlobalSettingsDocument> {
          let doc = await this.findById('global');
          if (!doc) {
            doc = await this.create({ _id: 'global', ...DEFAULT_SETTINGS });
          }
          return doc;
        },

        async updateSettings(partial: Partial<Omit<GlobalSettings, '_id' | 'updatedAt'>>): Promise<GlobalSettingsDocument> {
          const flatUpdate: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(partial)) {
            if (value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
              for (const [subKey, subValue] of Object.entries(value as unknown as Record<string, unknown>)) {
                flatUpdate[`${key}.${subKey}`] = subValue;
              }
            } else {
              flatUpdate[key] = value;
            }
          }

          const doc = await this.findOneAndUpdate(
            { _id: 'global' },
            { $set: flatUpdate },
            { new: true, upsert: true },
          );
          return doc!;
        },
      },
    },
  );

  return schema;
}

import { Schema, Model, HydratedDocument } from 'mongoose';
import { SessionMode } from '@astralibx/chat-types';
import { OUTSIDE_HOURS_BEHAVIOR_VALUES, DEFAULT_BUSINESS_SCHEDULE, OUTSIDE_HOURS_BEHAVIOR, AGENT_ACTIVITY, AUTO_CLOSE, CHAT_MODE_VALUES, CHAT_MODE, FILE_SHARING_DEFAULTS, AI_MODE_VALUES, AI_MODE, RATING_TYPE, RATING_TYPE_VALUES } from '../constants/index.js';
import type { ChatMode, AiMode, RatingType } from '../constants/index.js';

export interface IBusinessHoursSchedule {
  day: number; // 0=Sunday, 6=Saturday
  open: string; // '09:00'
  close: string; // '18:00'
  isOpen: boolean;
}

export interface IBusinessHours {
  enabled: boolean;
  timezone: string;
  schedule: IBusinessHoursSchedule[];
  holidayDates: string[]; // ISO date strings e.g. '2026-12-25'
  outsideHoursMessage: string;
  outsideHoursBehavior: string;
}

export interface IAnalyticsConfig {
  enabled: boolean;
  collectIp: boolean;
  collectBrowser: boolean;
  collectScreen: boolean;
  collectLocation: boolean;
  collectPageView: boolean;
}

export interface IFileSharingConfig {
  enabled: boolean;
  maxFileSizeMb: number;
  allowedTypes: string[];
}

export interface IRatingConfig {
  enabled: boolean;
  ratingType: RatingType;
  followUpOptions: Record<string, string[]>;
}

export interface IAiCharacterProfile {
  name: string;
  tone: string;
  personality: string;
  rules: string[];
  responseStyle: string;
}

export interface IAiCharacterConfig {
  globalCharacter: IAiCharacterProfile | null;
}

export interface IChatSettings {
  key: string;
  defaultSessionMode: SessionMode;
  autoAssignEnabled: boolean;
  aiEnabled: boolean;
  requireAgentForChat?: boolean;
  visitorAgentSelection?: boolean;
  allowPerAgentMode?: boolean;
  autoAwayTimeoutMinutes: number;
  chatMode: ChatMode;
  availableTags: string[];
  autoCloseAfterMinutes: number;
  businessHours: IBusinessHours;
  analyticsConfig: IAnalyticsConfig;
  fileSharing: IFileSharingConfig;
  aiMode: AiMode;
  aiCharacter: IAiCharacterConfig;
  ratingConfig: IRatingConfig;
  showAiTag: boolean;
  userHistoryEnabled: boolean;
  userHistoryLimit: number;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

export type ChatSettingsDocument = HydratedDocument<IChatSettings>;

export type ChatSettingsModel = Model<IChatSettings>;

export function createChatSettingsSchema() {
  const scheduleSchema = new Schema(
    {
      day: { type: Number, required: true, min: 0, max: 6 },
      open: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
      close: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
      isOpen: { type: Boolean, default: true },
    },
    { _id: false },
  );

  const businessHoursSchema = new Schema(
    {
      enabled: { type: Boolean, default: false },
      timezone: { type: String, default: 'UTC' },
      schedule: { type: [scheduleSchema], default: () => [...DEFAULT_BUSINESS_SCHEDULE] },
      holidayDates: { type: [String], default: [] },
      outsideHoursMessage: {
        type: String,
        default: 'We are currently outside business hours. Please leave a message and we will get back to you.',
      },
      outsideHoursBehavior: {
        type: String,
        enum: OUTSIDE_HOURS_BEHAVIOR_VALUES,
        default: OUTSIDE_HOURS_BEHAVIOR.OfflineMessage,
      },
    },
    { _id: false },
  );

  const analyticsConfigSchema = new Schema(
    {
      enabled: { type: Boolean, default: true },
      collectIp: { type: Boolean, default: true },
      collectBrowser: { type: Boolean, default: true },
      collectScreen: { type: Boolean, default: true },
      collectLocation: { type: Boolean, default: true },
      collectPageView: { type: Boolean, default: true },
    },
    { _id: false },
  );

  const fileSharingSchema = new Schema(
    {
      enabled: { type: Boolean, default: FILE_SHARING_DEFAULTS.Enabled },
      maxFileSizeMb: { type: Number, default: FILE_SHARING_DEFAULTS.MaxFileSizeMb, min: 1 },
      allowedTypes: { type: [String], default: () => [...FILE_SHARING_DEFAULTS.AllowedTypes] },
    },
    { _id: false },
  );

  const aiCharacterProfileSchema = new Schema(
    {
      name: { type: String, required: true },
      tone: { type: String, required: true },
      personality: { type: String, required: true },
      rules: { type: [String], default: [] },
      responseStyle: { type: String, required: true },
    },
    { _id: false },
  );

  const ratingConfigSchema = new Schema(
    {
      enabled: { type: Boolean, default: false },
      ratingType: { type: String, enum: RATING_TYPE_VALUES, default: RATING_TYPE.Thumbs },
      followUpOptions: { type: Schema.Types.Mixed, default: {} },
    },
    { _id: false },
  );

  const aiCharacterSchema = new Schema(
    {
      globalCharacter: { type: aiCharacterProfileSchema, default: null },
    },
    { _id: false },
  );

  const schema = new Schema<IChatSettings>(
    {
      key: { type: String, required: true, unique: true, default: 'global' },
      defaultSessionMode: {
        type: String,
        enum: Object.values(SessionMode),
        default: SessionMode.AI,
      },
      autoAssignEnabled: { type: Boolean, default: true },
      aiEnabled: { type: Boolean, default: true },
      requireAgentForChat: { type: Boolean, default: false },
      visitorAgentSelection: { type: Boolean, default: false },
      allowPerAgentMode: { type: Boolean, default: false },
      autoAwayTimeoutMinutes: {
        type: Number,
        default: AGENT_ACTIVITY.DefaultAutoAwayMinutes,
        min: AGENT_ACTIVITY.MinAutoAwayMinutes,
        max: AGENT_ACTIVITY.MaxAutoAwayMinutes,
      },
      chatMode: {
        type: String,
        enum: CHAT_MODE_VALUES,
        default: CHAT_MODE.Switchable,
      },
      availableTags: { type: [String], default: [] },
      autoCloseAfterMinutes: {
        type: Number,
        default: AUTO_CLOSE.DefaultMinutes,
        min: AUTO_CLOSE.MinMinutes,
        max: AUTO_CLOSE.MaxMinutes,
      },
      businessHours: { type: businessHoursSchema, default: () => ({}) },
      analyticsConfig: { type: analyticsConfigSchema, default: () => ({}) },
      fileSharing: { type: fileSharingSchema, default: () => ({}) },
      aiMode: {
        type: String,
        enum: AI_MODE_VALUES,
        default: AI_MODE.AgentWise,
      },
      aiCharacter: { type: aiCharacterSchema, default: () => ({ globalCharacter: null }) },
      ratingConfig: { type: ratingConfigSchema, default: () => ({ enabled: false, ratingType: RATING_TYPE.Thumbs, followUpOptions: {} }) },
      showAiTag: { type: Boolean, default: true },
      userHistoryEnabled: { type: Boolean, default: true },
      userHistoryLimit: { type: Number, default: 5, min: 1, max: 5 },
      tenantId: { type: String, index: true, sparse: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}

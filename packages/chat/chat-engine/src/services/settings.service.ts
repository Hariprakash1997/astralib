import type { LogAdapter } from '@astralibx/core';
import type { ChatSettingsModel, ChatSettingsDocument, IBusinessHours, IAiCharacterConfig, IAiCharacterProfile, IRatingConfig } from '../schemas/chat-settings.schema.js';
import { InvalidConfigError } from '../errors/index.js';
import { OUTSIDE_HOURS_BEHAVIOR_VALUES, AGENT_ACTIVITY, AUTO_CLOSE, CHAT_MODE_VALUES, AI_MODE_VALUES, AI_MODE, RATING_TYPE_VALUES } from '../constants/index.js';
import type { ChatMode, AiMode, RatingType } from '../constants/index.js';

// ── Private validation helpers ──────────────────────────────────────────────

function validateIntegerRange(value: unknown, field: string, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new InvalidConfigError(field, `Must be an integer between ${min} and ${max}`);
  }
}

function validateEnumValue(value: unknown, field: string, allowedValues: readonly string[]): void {
  if (!allowedValues.includes(value as any)) {
    throw new InvalidConfigError(field, `Must be one of: ${allowedValues.join(', ')}`);
  }
}

function validateArrayOfStrings(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.some((item: unknown) => typeof item !== 'string')) {
    throw new InvalidConfigError(field, 'Must be an array of strings');
  }
}

export class SettingsService {
  constructor(
    private ChatSettings: ChatSettingsModel,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get settingsFilter(): Record<string, unknown> {
    const filter: Record<string, unknown> = { key: 'global' };
    if (this.tenantId) filter.tenantId = this.tenantId;
    return filter;
  }

  async get(): Promise<ChatSettingsDocument> {
    let settings = await this.ChatSettings.findOne(this.settingsFilter);
    if (!settings) {
      const createData: Record<string, unknown> = { key: 'global' };
      if (this.tenantId) createData.tenantId = this.tenantId;
      settings = await this.ChatSettings.create(createData);
      this.logger.info('Default chat settings created');
    }
    return settings;
  }

  async update(data: Partial<{
    defaultSessionMode: string;
    autoAssignEnabled: boolean;
    aiEnabled: boolean;
    requireAgentForChat: boolean;
    visitorAgentSelection: boolean;
    allowPerAgentMode: boolean;
    chatMode: ChatMode;
    availableTags: string[];
    availableUserCategories: string[];
    autoAwayTimeoutMinutes: number;
    autoCloseAfterMinutes: number;
    aiMode: AiMode;
    aiCharacter: IAiCharacterConfig;
    showAiTag: boolean;
    userHistoryEnabled: boolean;
    userHistoryLimit: number;
    metadata: Record<string, unknown>;
  }>): Promise<ChatSettingsDocument> {
    if (data.userHistoryLimit != null) validateIntegerRange(data.userHistoryLimit, 'userHistoryLimit', 1, 5);
    if (data.autoAwayTimeoutMinutes != null) validateIntegerRange(data.autoAwayTimeoutMinutes, 'autoAwayTimeoutMinutes', AGENT_ACTIVITY.MinAutoAwayMinutes, AGENT_ACTIVITY.MaxAutoAwayMinutes);
    if (data.chatMode != null) validateEnumValue(data.chatMode, 'chatMode', CHAT_MODE_VALUES);
    if (data.availableTags != null) validateArrayOfStrings(data.availableTags, 'availableTags');
    if (data.availableUserCategories != null) validateArrayOfStrings(data.availableUserCategories, 'availableUserCategories');
    if (data.autoCloseAfterMinutes != null) validateIntegerRange(data.autoCloseAfterMinutes, 'autoCloseAfterMinutes', AUTO_CLOSE.MinMinutes, AUTO_CLOSE.MaxMinutes);
    if (data.aiMode != null) validateEnumValue(data.aiMode, 'aiMode', AI_MODE_VALUES);

    const settings = await this.ChatSettings.findOneAndUpdate(
      this.settingsFilter,
      { $set: data },
      { upsert: true, new: true },
    );
    this.logger.info('Chat settings updated', { fields: Object.keys(data) });
    return settings!;
  }

  // ── Business Hours ─────────────────────────────────────────────────────────

  async getBusinessHours(): Promise<IBusinessHours> {
    const settings = await this.get();
    return settings.businessHours;
  }

  async updateBusinessHours(data: Partial<IBusinessHours>): Promise<IBusinessHours> {
    if (data.outsideHoursBehavior) validateEnumValue(data.outsideHoursBehavior, 'outsideHoursBehavior', OUTSIDE_HOURS_BEHAVIOR_VALUES);

    // Validate schedule entries if provided
    if (data.schedule) {
      for (const entry of data.schedule) {
        if (entry.day < 0 || entry.day > 6) {
          throw new InvalidConfigError('schedule.day', 'Must be between 0 (Sunday) and 6 (Saturday)');
        }
        if (!/^\d{2}:\d{2}$/.test(entry.open) || !/^\d{2}:\d{2}$/.test(entry.close)) {
          throw new InvalidConfigError('schedule.open/close', 'Must be in HH:mm format');
        }
      }
    }

    // Build $set with dotted paths so partial updates merge correctly
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      setFields[`businessHours.${key}`] = value;
    }

    const settings = await this.ChatSettings.findOneAndUpdate(
      this.settingsFilter,
      { $set: setFields },
      { upsert: true, new: true },
    );

    this.logger.info('Business hours updated', { fields: Object.keys(data) });
    return settings!.businessHours;
  }

  /**
   * Checks if the current time falls within configured business hours,
   * considering the configured timezone and holiday dates.
   */
  async isWithinBusinessHours(): Promise<{
    isOpen: boolean;
    businessHours: IBusinessHours;
  }> {
    const bh = await this.getBusinessHours();

    // If business hours are not enabled, always open
    if (!bh.enabled) {
      return { isOpen: true, businessHours: bh };
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: bh.timezone }); // 'en-CA' gives YYYY-MM-DD
    const todayStr = formatter.format(now);

    // Check holidays
    if (bh.holidayDates.includes(todayStr)) {
      return { isOpen: false, businessHours: bh };
    }

    // Get current day of week and time in the configured timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: bh.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayNum = dayMap[weekdayStr ?? 'Sun'] ?? 0;

    const todaySchedule = bh.schedule.find((s) => s.day === dayNum);

    if (!todaySchedule || !todaySchedule.isOpen) {
      return { isOpen: false, businessHours: bh };
    }

    const currentTime = `${hour}:${minute}`;
    const isOpen = currentTime >= todaySchedule.open && currentTime < todaySchedule.close;

    return { isOpen, businessHours: bh };
  }

  // ── AI Settings ──────────────────────────────────────────────────────────

  async getAiSettings(): Promise<{
    aiMode: AiMode;
    aiCharacter: IAiCharacterConfig;
    showAiTag: boolean;
  }> {
    const settings = await this.get();
    return {
      aiMode: settings.aiMode,
      aiCharacter: settings.aiCharacter,
      showAiTag: settings.showAiTag,
    };
  }

  async updateAiSettings(
    data: Partial<{
      aiMode: AiMode;
      aiCharacter: IAiCharacterConfig;
      showAiTag: boolean;
    }>,
    options?: { hasAiAdapter: boolean },
  ): Promise<{
    aiMode: AiMode;
    aiCharacter: IAiCharacterConfig;
    showAiTag: boolean;
  }> {
    if (data.aiMode != null) {
      validateEnumValue(data.aiMode, 'aiMode', AI_MODE_VALUES);

      // Prerequisites: if switching to 'ai' or 'agent-wise', validate adapter is available
      if (data.aiMode === AI_MODE.AI || data.aiMode === AI_MODE.AgentWise) {
        if (!options?.hasAiAdapter) {
          throw new InvalidConfigError(
            'aiMode',
            `Cannot set aiMode to '${data.aiMode}': no AI adapter (generateAiResponse) is configured`,
          );
        }

        // When switching to 'ai' mode, globalCharacter must be set
        if (data.aiMode === AI_MODE.AI) {
          const currentSettings = await this.get();
          const incomingGlobalCharacter = data.aiCharacter?.globalCharacter;
          const existingGlobalCharacter = currentSettings.aiCharacter?.globalCharacter;

          if (!incomingGlobalCharacter && !existingGlobalCharacter) {
            throw new InvalidConfigError(
              'aiMode',
              "Cannot set aiMode to 'ai': globalCharacter must be configured first",
            );
          }
        }
      }
    }

    // Validate aiCharacter.globalCharacter shape if provided
    if (data.aiCharacter?.globalCharacter) {
      const gc = data.aiCharacter.globalCharacter;
      if (!gc.name || typeof gc.name !== 'string') {
        throw new InvalidConfigError('aiCharacter.globalCharacter.name', 'Must be a non-empty string');
      }
      if (!gc.tone || typeof gc.tone !== 'string') {
        throw new InvalidConfigError('aiCharacter.globalCharacter.tone', 'Must be a non-empty string');
      }
      if (!gc.personality || typeof gc.personality !== 'string') {
        throw new InvalidConfigError('aiCharacter.globalCharacter.personality', 'Must be a non-empty string');
      }
      if (!gc.responseStyle || typeof gc.responseStyle !== 'string') {
        throw new InvalidConfigError('aiCharacter.globalCharacter.responseStyle', 'Must be a non-empty string');
      }
      if (gc.rules != null && (!Array.isArray(gc.rules) || gc.rules.some((r: unknown) => typeof r !== 'string'))) {
        throw new InvalidConfigError('aiCharacter.globalCharacter.rules', 'Must be an array of strings');
      }
    }

    // Build $set with dotted paths so partial updates merge correctly
    const setFields: Record<string, unknown> = {};
    if (data.aiMode != null) setFields.aiMode = data.aiMode;
    if (data.showAiTag != null) setFields.showAiTag = data.showAiTag;
    if (data.aiCharacter !== undefined) setFields.aiCharacter = data.aiCharacter;

    const settings = await this.ChatSettings.findOneAndUpdate(
      this.settingsFilter,
      { $set: setFields },
      { upsert: true, new: true },
    );

    this.logger.info('AI settings updated', { fields: Object.keys(data) });

    return {
      aiMode: settings!.aiMode,
      aiCharacter: settings!.aiCharacter,
      showAiTag: settings!.showAiTag,
    };
  }

  // ── Rating Config ──────────────────────────────────────────────────────────

  async getRatingConfig(): Promise<IRatingConfig> {
    const settings = await this.get();
    return settings.ratingConfig;
  }

  async updateRatingConfig(data: Partial<IRatingConfig>): Promise<IRatingConfig> {
    if (data.ratingType != null) validateEnumValue(data.ratingType, 'ratingType', RATING_TYPE_VALUES);

    // Validate followUpOptions shape
    if (data.followUpOptions != null) {
      if (typeof data.followUpOptions !== 'object' || Array.isArray(data.followUpOptions)) {
        throw new InvalidConfigError('followUpOptions', 'Must be an object mapping keys to arrays of strings');
      }
      for (const [key, values] of Object.entries(data.followUpOptions)) {
        if (!Array.isArray(values) || values.some((v: unknown) => typeof v !== 'string')) {
          throw new InvalidConfigError(`followUpOptions.${key}`, 'Must be an array of strings');
        }
      }
    }

    // Build $set with dotted paths
    const setFields: Record<string, unknown> = {};
    if (data.enabled != null) setFields['ratingConfig.enabled'] = data.enabled;
    if (data.ratingType != null) setFields['ratingConfig.ratingType'] = data.ratingType;
    if (data.followUpOptions !== undefined) setFields['ratingConfig.followUpOptions'] = data.followUpOptions;

    const settings = await this.ChatSettings.findOneAndUpdate(
      this.settingsFilter,
      { $set: setFields },
      { upsert: true, new: true },
    );

    this.logger.info('Rating config updated', { fields: Object.keys(data) });
    return settings!.ratingConfig;
  }
}

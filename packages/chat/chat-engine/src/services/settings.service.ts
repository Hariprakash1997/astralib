import type { LogAdapter } from '@astralibx/core';
import type { ChatSettingsModel, ChatSettingsDocument } from '../schemas/chat-settings.schema';

export class SettingsService {
  constructor(
    private ChatSettings: ChatSettingsModel,
    private logger: LogAdapter,
  ) {}

  async get(): Promise<ChatSettingsDocument> {
    let settings = await this.ChatSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = await this.ChatSettings.create({ key: 'global' });
      this.logger.info('Default chat settings created');
    }
    return settings;
  }

  async update(data: Partial<{
    defaultSessionMode: string;
    autoAssignEnabled: boolean;
    aiEnabled: boolean;
    metadata: Record<string, unknown>;
  }>): Promise<ChatSettingsDocument> {
    const settings = await this.ChatSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: data },
      { upsert: true, new: true },
    );
    this.logger.info('Chat settings updated', { fields: Object.keys(data) });
    return settings!;
  }
}

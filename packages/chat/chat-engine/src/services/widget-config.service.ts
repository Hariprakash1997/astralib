import type { LogAdapter } from '@astralibx/core';
import type { ChatWidgetConfigModel, ChatWidgetConfigDocument } from '../schemas/chat-widget-config.schema.js';

export class WidgetConfigService {
  constructor(
    private ChatWidgetConfig: ChatWidgetConfigModel,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get configFilter(): Record<string, unknown> {
    const filter: Record<string, unknown> = { key: 'global' };
    if (this.tenantId) filter.tenantId = this.tenantId;
    return filter;
  }

  async get(): Promise<ChatWidgetConfigDocument> {
    let config = await this.ChatWidgetConfig.findOne(this.configFilter);
    if (!config) {
      const createData: Record<string, unknown> = { key: 'global' };
      if (this.tenantId) createData.tenantId = this.tenantId;
      config = await this.ChatWidgetConfig.create(createData);
      this.logger.info('Default widget config created');
    }
    return config;
  }

  async update(data: Partial<{
    preChatFlow: Record<string, unknown>;
    branding: {
      primaryColor?: string;
      companyName?: string;
      logoUrl?: string;
    };
    features: {
      soundNotifications?: boolean;
      desktopNotifications?: boolean;
      typingIndicator?: boolean;
      readReceipts?: boolean;
      autoOpen?: boolean;
      autoOpenDelayMs?: number;
      liveChatEnabled?: boolean;
    };
    translations: Record<string, string>;
    position: string;
    theme: string;
    metadata: Record<string, unknown>;
    updatedBy: string;
  }>): Promise<ChatWidgetConfigDocument> {
    const config = await this.ChatWidgetConfig.findOneAndUpdate(
      this.configFilter,
      { $set: data },
      { upsert: true, new: true },
    );
    this.logger.info('Widget config updated', { fields: Object.keys(data) });
    return config!;
  }
}

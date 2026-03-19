import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatWebhookModel, ChatWebhookDocument } from '../schemas/chat-webhook.schema';
import { WebhookNotFoundError } from '../errors/index.js';
import { WEBHOOK_EVENT } from '../constants/index.js';

const MAX_RETRY_ATTEMPTS = 3;

export class WebhookService {
  constructor(
    private ChatWebhook: ChatWebhookModel,
    private logger: LogAdapter,
  ) {}

  async register(
    url: string,
    events: string[],
    secret?: string,
    description?: string,
  ): Promise<ChatWebhookDocument> {
    const webhookId = crypto.randomUUID();
    const webhook = await this.ChatWebhook.create({
      webhookId,
      url,
      events,
      secret,
      description,
      isActive: true,
    });

    this.logger.info('Webhook registered', { webhookId, url, events });
    return webhook;
  }

  async remove(webhookId: string): Promise<void> {
    const result = await this.ChatWebhook.deleteOne({ webhookId });
    if (result.deletedCount === 0) {
      throw new WebhookNotFoundError(webhookId);
    }
    this.logger.info('Webhook removed', { webhookId });
  }

  async update(
    webhookId: string,
    data: { url?: string; events?: string[]; secret?: string; isActive?: boolean; description?: string },
  ): Promise<ChatWebhookDocument> {
    const webhook = await this.ChatWebhook.findOne({ webhookId });
    if (!webhook) {
      throw new WebhookNotFoundError(webhookId);
    }

    if (data.url !== undefined) webhook.url = data.url;
    if (data.events !== undefined) webhook.events = data.events;
    if (data.secret !== undefined) webhook.secret = data.secret;
    if (data.isActive !== undefined) webhook.isActive = data.isActive;
    if (data.description !== undefined) webhook.description = data.description;

    await webhook.save();
    this.logger.info('Webhook updated', { webhookId });
    return webhook;
  }

  async list(): Promise<ChatWebhookDocument[]> {
    return this.ChatWebhook.find().sort({ createdAt: -1 });
  }

  async findById(webhookId: string): Promise<ChatWebhookDocument | null> {
    return this.ChatWebhook.findOne({ webhookId });
  }

  /**
   * Fire-and-forget webhook delivery. Does not block the caller.
   */
  trigger(event: string, payload: Record<string, unknown>): void {
    this.deliverWebhooks(event, payload).catch(err => {
      this.logger.error('Webhook delivery error', { event, error: err });
    });
  }

  /**
   * Retry failed deliveries (max 3 attempts per delivery).
   */
  async retryFailedWebhooks(): Promise<number> {
    const webhooks = await this.ChatWebhook.find({
      isActive: true,
      'failedDeliveries.0': { $exists: true },
    });

    let retried = 0;

    for (const webhook of webhooks) {
      const remaining = [];

      for (const delivery of webhook.failedDeliveries) {
        if (delivery.attempts >= MAX_RETRY_ATTEMPTS) {
          // Drop after max attempts
          this.logger.warn('Webhook delivery dropped after max retries', {
            webhookId: webhook.webhookId,
            event: delivery.event,
            attempts: delivery.attempts,
          });
          continue;
        }

        const success = await this.sendPayload(
          webhook.url,
          delivery.event,
          delivery.payload,
          webhook.secret,
        );

        if (success) {
          retried++;
        } else {
          delivery.attempts += 1;
          delivery.lastAttemptAt = new Date();
          remaining.push(delivery);
        }
      }

      webhook.failedDeliveries = remaining;
      await webhook.save();
    }

    return retried;
  }

  private async deliverWebhooks(event: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.ChatWebhook.find({
      isActive: true,
      events: event,
    });

    for (const webhook of webhooks) {
      const success = await this.sendPayload(webhook.url, event, payload, webhook.secret);

      if (!success) {
        webhook.failedDeliveries.push({
          event,
          payload,
          attempts: 1,
          lastAttemptAt: new Date(),
        });

        // Keep only the last 50 failed deliveries to prevent unbounded growth
        if (webhook.failedDeliveries.length > 50) {
          webhook.failedDeliveries = webhook.failedDeliveries.slice(-50);
        }

        await webhook.save();
      }
    }
  }

  private async sendPayload(
    url: string,
    event: string,
    payload: Record<string, unknown>,
    secret?: string,
  ): Promise<boolean> {
    try {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
      };

      if (secret) {
        const signature = crypto
          .createHmac('sha256', secret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn('Webhook delivery failed', {
          url,
          event,
          statusCode: response.status,
        });
        return false;
      }

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Webhook delivery error', { url, event, error: message });
      return false;
    }
  }
}

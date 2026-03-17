import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramBotConfig } from '../types/config.types';
import type { TelegramBotContactModel, BotInteraction } from '../schemas/telegram-bot-contact.schema';
import { CONTACT_STATUS } from '../constants';

export interface TrackingResult {
  success: boolean;
  isNewUser: boolean;
  contactId?: string;
  error?: string;
}

export interface UserFilters {
  status?: 'active' | 'blocked' | 'stopped';
  botUsername?: string;
}

export interface Pagination {
  page?: number;
  limit?: number;
}

export class UserTrackerService {
  private logger: LogAdapter;

  constructor(
    private TelegramBotContact: TelegramBotContactModel,
    private hooks?: TelegramBotConfig['hooks'],
    logger?: LogAdapter,
  ) {
    this.logger = logger || noopLogger;
  }

  async trackInteraction(
    user: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string },
    botUsername: string,
    botId: string,
    chatId: number,
  ): Promise<TrackingResult> {
    try {
      const telegramUserId = user.id.toString();
      const now = new Date();

      let contact = await this.TelegramBotContact.findOne({ telegramUserId });
      let isNewUser = false;

      if (!contact) {
        contact = await this.TelegramBotContact.create({
          telegramUserId,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          languageCode: user.language_code,
          interactions: [{
            botUsername,
            botId,
            status: CONTACT_STATUS.Active,
            interactionCount: 1,
            firstInteractionAt: now,
            lastInteractionAt: now,
          }],
        });
        isNewUser = true;
        this.logger.info('New bot user tracked', { firstName: user.first_name, telegramUserId });
      } else {
        // Update user info
        if (user.first_name) contact.firstName = user.first_name;
        if (user.last_name !== undefined) contact.lastName = user.last_name;
        if (user.username !== undefined) contact.username = user.username;
        if (user.language_code !== undefined) contact.languageCode = user.language_code;

        const interaction = contact.interactions.find(
          (i: BotInteraction) => i.botUsername === botUsername,
        );

        if (interaction) {
          interaction.lastInteractionAt = now;
          interaction.interactionCount += 1;
          if (interaction.status !== CONTACT_STATUS.Active) {
            interaction.status = CONTACT_STATUS.Active;
            interaction.blockedAt = undefined;
            interaction.blockReason = undefined;
            this.logger.info('User reactivated', { firstName: user.first_name, telegramUserId });
          }
        } else {
          contact.interactions.push({
            botUsername,
            botId,
            status: CONTACT_STATUS.Active,
            interactionCount: 1,
            firstInteractionAt: now,
            lastInteractionAt: now,
          } as BotInteraction);
          isNewUser = true;
          this.logger.info('User added to bot', { firstName: user.first_name, telegramUserId });
        }

        await contact.save();
      }

      if (isNewUser) {
        try {
          this.hooks?.onUserStart?.({
            userId: telegramUserId,
            firstName: user.first_name,
            username: user.username,
            chatId,
          });
        } catch (e) {
          this.logger.error('Hook onUserStart error', { error: e instanceof Error ? e.message : String(e) });
        }
      }

      return { success: true, isNewUser, contactId: contact._id?.toString() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error tracking interaction', { error: message });
      return { success: false, isNewUser: false, error: message };
    }
  }

  async getUser(telegramUserId: string) {
    return this.TelegramBotContact.findOne({ telegramUserId });
  }

  async getAllUsers(filters?: UserFilters, pagination?: Pagination) {
    const filter: Record<string, unknown> = {};

    if (filters?.botUsername && filters?.status) {
      filter.interactions = { $elemMatch: { botUsername: filters.botUsername, status: filters.status } };
    } else if (filters?.botUsername) {
      filter['interactions.botUsername'] = filters.botUsername;
    } else if (filters?.status) {
      filter['interactions.status'] = filters.status;
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const total = await this.TelegramBotContact.countDocuments(filter);
    const users = await this.TelegramBotContact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { users, total };
  }

  async getUserCount(botUsername?: string): Promise<number> {
    const filter: Record<string, unknown> = {};
    if (botUsername) {
      filter['interactions.botUsername'] = botUsername;
    }
    return this.TelegramBotContact.countDocuments(filter);
  }

  async getActiveUsers(botUsername?: string): Promise<number> {
    const filter: Record<string, unknown> = {};
    if (botUsername) {
      filter.interactions = { $elemMatch: { botUsername, status: CONTACT_STATUS.Active } };
    } else {
      filter['interactions.status'] = CONTACT_STATUS.Active;
    }
    return this.TelegramBotContact.countDocuments(filter);
  }

  async markBlocked(telegramUserId: string, botUsername: string, reason: string = 'user_blocked', chatId?: number): Promise<boolean> {
    try {
      const contact = await this.TelegramBotContact.findOne({ telegramUserId });
      if (!contact) return false;

      const interaction = contact.interactions.find(
        (i: BotInteraction) => i.botUsername === botUsername,
      );

      if (!interaction) return false;

      interaction.status = reason === 'user_deactivated' ? CONTACT_STATUS.Stopped : CONTACT_STATUS.Blocked;
      interaction.blockedAt = new Date();
      interaction.blockReason = reason;
      await contact.save();

      this.logger.info('User marked as blocked', { reason, telegramUserId, botUsername });

      try {
        this.hooks?.onUserBlocked?.({ userId: telegramUserId, chatId: chatId ?? Number(telegramUserId) });
      } catch (e) {
        this.logger.error('Hook onUserBlocked error', { error: e instanceof Error ? e.message : String(e) });
      }

      return true;
    } catch (error) {
      this.logger.error('Error marking user as blocked', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async isBlocked(telegramUserId: string, botUsername: string): Promise<boolean> {
    const contact = await this.TelegramBotContact.findOne({
      telegramUserId,
      interactions: { $elemMatch: { botUsername, status: { $in: [CONTACT_STATUS.Blocked, CONTACT_STATUS.Stopped] } } },
    });
    return contact !== null;
  }

  async getStats(botUsername: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const stats = await this.TelegramBotContact.aggregate([
      { $match: { 'interactions.botUsername': botUsername } },
      { $unwind: '$interactions' },
      { $match: { 'interactions.botUsername': botUsername } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$interactions.status', CONTACT_STATUS.Active] }, 1, 0] },
          },
          blockedUsers: {
            $sum: { $cond: [{ $eq: ['$interactions.status', CONTACT_STATUS.Blocked] }, 1, 0] },
          },
          stoppedUsers: {
            $sum: { $cond: [{ $eq: ['$interactions.status', CONTACT_STATUS.Stopped] }, 1, 0] },
          },
          newUsersToday: {
            $sum: {
              $cond: [{ $gte: ['$interactions.firstInteractionAt', startOfToday] }, 1, 0],
            },
          },
          newUsersThisWeek: {
            $sum: {
              $cond: [{ $gte: ['$interactions.firstInteractionAt', startOfWeek] }, 1, 0],
            },
          },
          returningUsers: {
            $sum: { $cond: [{ $gt: ['$interactions.interactionCount', 1] }, 1, 0] },
          },
        },
      },
    ]);

    const { _id, ...result } = stats[0] || {
      _id: null,
      totalUsers: 0,
      activeUsers: 0,
      blockedUsers: 0,
      stoppedUsers: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0,
      returningUsers: 0,
    };

    return {
      botUsername,
      ...result,
      blockRate: result.totalUsers > 0
        ? Math.round((result.blockedUsers / result.totalUsers) * 100 * 10) / 10
        : 0,
    };
  }
}

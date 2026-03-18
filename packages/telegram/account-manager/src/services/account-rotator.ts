import type { AccountCapacity } from '../types/account.types';
import type { LogAdapter } from '../types/config.types';
import type { CapacityManager } from './capacity-manager';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import { ROTATION_STRATEGIES, type RotationStrategy } from '../constants';

export class AccountRotator {
  private roundRobinIndex = 0;

  constructor(
    private capacityManager: CapacityManager,
    private TelegramAccount: TelegramAccountModel,
    private logger: LogAdapter,
  ) {}

  async selectAccount(
    strategy: RotationStrategy = ROTATION_STRATEGIES.HighestHealth,
  ): Promise<AccountCapacity | null> {
    switch (strategy) {
      case ROTATION_STRATEGIES.RoundRobin:
        return this.roundRobin();
      case ROTATION_STRATEGIES.LeastUsed:
        return this.leastUsed();
      case ROTATION_STRATEGIES.HighestHealth:
        return this.highestHealth();
      default:
        this.logger.warn(`Unknown rotation strategy "${strategy}", falling back to highest-health`);
        return this.highestHealth();
    }
  }

  private async roundRobin(): Promise<AccountCapacity | null> {
    const { accounts } = await this.capacityManager.getAllCapacity();
    const available = accounts.filter((a) => a.remaining > 0);

    if (available.length === 0) {
      this.logger.warn('No accounts with remaining capacity for round-robin rotation');
      return null;
    }

    const index = this.roundRobinIndex % available.length;
    this.roundRobinIndex++;

    const selected = available[index];
    this.logger.info(`Round-robin selected account ${selected.accountId} (${selected.phone})`);
    return selected;
  }

  private async leastUsed(): Promise<AccountCapacity | null> {
    const { accounts } = await this.capacityManager.getAllCapacity();
    const available = accounts.filter((a) => a.remaining > 0);

    if (available.length === 0) {
      this.logger.warn('No accounts with remaining capacity for least-used rotation');
      return null;
    }

    available.sort((a, b) => a.usagePercent - b.usagePercent);

    const selected = available[0];
    this.logger.info(`Least-used selected account ${selected.accountId} (${selected.phone}, ${selected.usagePercent}% used)`);
    return selected;
  }

  private async highestHealth(): Promise<AccountCapacity | null> {
    const selected = await this.capacityManager.getBestAccount();

    if (!selected) {
      this.logger.warn('No accounts with remaining capacity for highest-health rotation');
      return null;
    }

    this.logger.info(`Highest-health selected account ${selected.accountId} (${selected.phone})`);
    return selected;
  }
}

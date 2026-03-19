import type { RuleEngineAdapters, SendParams, AgentSelection } from '@astralibx/rule-engine';
import type { TelegramRuleEngineConfig } from '../types/config.types';
import type { RuleTarget } from '../types/rule.types';

export function createTelegramAdapters(config: TelegramRuleEngineConfig): RuleEngineAdapters {
  return {
    send: async (params: SendParams) => {
      // Map core SendParams to telegram's sendMessage adapter
      await config.adapters.sendMessage({
        identifierId: params.identifierId,
        contactId: params.contactId,
        accountId: params.accountId,
        message: params.body, // core uses 'body', telegram uses 'message'
        media: params.metadata?.media as any, // telegram media passed via metadata
        ruleId: params.ruleId,
        // Core's SendParams doesn't carry templateId directly; it may be
        // present in metadata if the consumer set it on the template document.
        templateId: (params.metadata?.templateId as string) || '',
      });
    },

    selectAgent: async (identifierId, context) => {
      const result = await config.adapters.selectAccount(identifierId, context);
      if (!result) return null;
      return {
        accountId: result.accountId,
        contactValue: result.phone, // core uses contactValue, telegram uses phone
        metadata: {
          ...result.metadata,
          healthScore: result.healthScore, // preserve for middleware
        },
      } satisfies AgentSelection;
    },

    // Forward collection context (collectionSchema + activeJoins) so consumers can use
    // buildAggregationPipeline() for join-based targeting with personalized templates.
    queryUsers: (target, limit, context) =>
      config.adapters.queryUsers(target as unknown as RuleTarget, limit, context),
    resolveData: config.adapters.resolveData,

    findIdentifier: async (contactValue) => {
      const result = await config.adapters.findIdentifier(contactValue);
      if (!result) return null;
      return { id: result.id, contactId: result.contactId };
    },
  };
}

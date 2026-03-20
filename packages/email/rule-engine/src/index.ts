import {
  createRuleEngine,
  type RuleEngine,
  type RuleEngineConfig,
  type SendParams,
} from '@astralibx/rule-engine';
import { renderMjml, htmlToPlainText } from './mjml-renderer';
import { registerEmailHelpers } from './email-helpers';

export interface EmailSendParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  ruleId: string;
  autoApprove: boolean;
  attachments?: Array<{ filename: string; url: string; contentType: string }>;
}

export interface EmailRuleEngineConfig extends Omit<RuleEngineConfig, 'adapters'> {
  adapters: Omit<RuleEngineConfig['adapters'], 'send' | 'sendTest'> & {
    sendEmail: (params: EmailSendParams) => Promise<void>;
    sendTestEmail?: (to: string, subject: string, html: string, text: string, attachments?: Array<{ filename: string; url: string; contentType: string }>) => Promise<void>;
  };
}

export function createEmailRuleEngine(config: EmailRuleEngineConfig): RuleEngine {
  // Register email-specific helpers before engine creation
  registerEmailHelpers();

  const coreConfig: RuleEngineConfig = {
    ...config,
    adapters: {
      queryUsers: config.adapters.queryUsers,
      resolveData: config.adapters.resolveData,
      selectAgent: config.adapters.selectAgent,
      findIdentifier: config.adapters.findIdentifier,
      send: async (params: SendParams) => {
        const html = renderMjml(params.body);
        const text = params.textBody || htmlToPlainText(html);
        await config.adapters.sendEmail({
          identifierId: params.identifierId,
          contactId: params.contactId,
          accountId: params.accountId,
          subject: params.subject || '',
          htmlBody: html,
          textBody: text,
          ruleId: params.ruleId,
          autoApprove: params.autoApprove,
          attachments: Array.isArray(params.metadata?.attachments) ? params.metadata.attachments : undefined,
        });
      },
      sendTest: config.adapters.sendTestEmail
        ? async (to: string, body: string, subject?: string, metadata?: Record<string, unknown>) => {
            const html = renderMjml(body);
            const text = htmlToPlainText(html);
            await config.adapters.sendTestEmail!(to, subject || '', html, text, Array.isArray(metadata?.attachments) ? metadata.attachments : undefined);
          }
        : undefined,
    },
  };

  return createRuleEngine(coreConfig);
}

// Export email-specific utilities
export { renderMjml, htmlToPlainText } from './mjml-renderer';
export { registerEmailHelpers } from './email-helpers';
export type { RuleEngine } from '@astralibx/rule-engine';

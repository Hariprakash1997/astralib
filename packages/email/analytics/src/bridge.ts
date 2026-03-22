import type { CreateEventInput } from './types/event.types.js';

interface EventRecorder {
  record(event: CreateEventInput): Promise<any>;
}

/**
 * Creates hook handlers that automatically record events in email-analytics.
 * Wire the returned object into your email-account-manager or email-rule-engine config hooks.
 *
 * @example
 * ```typescript
 * const hooks = createAnalyticsBridge(analyticsEventRecorder);
 * const eam = createEmailAccountManager({ hooks, ... });
 * ```
 */
export function createAnalyticsBridge(recorder: EventRecorder) {
  return {
    onSend: (info: { ruleId?: string; ruleName?: string; contactValue: string; status: string; accountId?: string; templateId?: string; runId?: string }) => {
      if (info.status === 'sent') {
        recorder.record({
          type: 'sent',
          accountId: info.accountId || '',
          recipientEmail: info.contactValue,
          ruleId: info.ruleId,
          templateId: info.templateId,
        }).catch(() => {});
      } else if (info.status === 'error') {
        recorder.record({
          type: 'failed',
          accountId: info.accountId || '',
          recipientEmail: info.contactValue,
          ruleId: info.ruleId,
          templateId: info.templateId,
        }).catch(() => {});
      }
    },

    onBounce: (info: { contactValue: string; accountId?: string }) => {
      recorder.record({
        type: 'bounced',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
      }).catch(() => {});
    },

    onComplaint: (info: { contactValue: string; accountId?: string }) => {
      recorder.record({
        type: 'complained',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
      }).catch(() => {});
    },

    onDelivery: (info: { contactValue: string; accountId?: string }) => {
      recorder.record({
        type: 'delivered',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
      }).catch(() => {});
    },

    onOpen: (info: { contactValue: string; accountId?: string }) => {
      recorder.record({
        type: 'opened',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
      }).catch(() => {});
    },

    onClick: (info: { contactValue: string; accountId?: string; channel?: string }) => {
      recorder.record({
        type: 'clicked',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
        channel: info.channel,
      }).catch(() => {});
    },

    onUnsubscribe: (info: { contactValue: string; accountId?: string }) => {
      recorder.record({
        type: 'unsubscribed',
        accountId: info.accountId || '',
        recipientEmail: info.contactValue,
      }).catch(() => {});
    },
  };
}

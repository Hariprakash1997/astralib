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
    onSend: (info: { ruleId?: string; ruleName?: string; email: string; status: string; accountId?: string; templateId?: string; runId?: string }) => {
      if (info.status === 'sent') {
        recorder.record({
          type: 'sent',
          accountId: info.accountId || '',
          recipientEmail: info.email,
          ruleId: info.ruleId,
          templateId: info.templateId,
        }).catch(() => {});
      } else if (info.status === 'error') {
        recorder.record({
          type: 'failed',
          accountId: info.accountId || '',
          recipientEmail: info.email,
          ruleId: info.ruleId,
          templateId: info.templateId,
        }).catch(() => {});
      }
    },

    onBounce: (info: { email: string; accountId?: string }) => {
      recorder.record({
        type: 'bounced',
        accountId: info.accountId || '',
        recipientEmail: info.email,
      }).catch(() => {});
    },

    onComplaint: (info: { email: string; accountId?: string }) => {
      recorder.record({
        type: 'complained',
        accountId: info.accountId || '',
        recipientEmail: info.email,
      }).catch(() => {});
    },

    onDelivery: (info: { email: string; accountId?: string }) => {
      recorder.record({
        type: 'delivered',
        accountId: info.accountId || '',
        recipientEmail: info.email,
      }).catch(() => {});
    },

    onOpen: (info: { email: string; accountId?: string }) => {
      recorder.record({
        type: 'opened',
        accountId: info.accountId || '',
        recipientEmail: info.email,
      }).catch(() => {});
    },

    onClick: (info: { email: string; accountId?: string; channel?: string }) => {
      recorder.record({
        type: 'clicked',
        accountId: info.accountId || '',
        recipientEmail: info.email,
        channel: info.channel,
      }).catch(() => {});
    },

    onUnsubscribe: (info: { email: string; accountId?: string }) => {
      recorder.record({
        type: 'unsubscribed',
        accountId: info.accountId || '',
        recipientEmail: info.email,
      }).catch(() => {});
    },
  };
}

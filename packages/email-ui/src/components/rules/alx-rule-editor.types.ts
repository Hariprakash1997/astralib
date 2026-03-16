export interface Condition {
  field: string;
  operator: string;
  value: string;
}

export interface TemplateOption {
  _id: string;
  name: string;
}

export interface RuleData {
  _id?: string;
  name: string;
  templateId: string;
  platform: string;
  audience: string;
  targetMode: 'query' | 'list';
  target: {
    conditions: Condition[];
    identifiers?: string[];
  };
  behavior: {
    sendOnce: boolean;
    resendAfterDays: number | null;
    maxPerRun: number;
    autoApprove: boolean;
    emailType: string;
    bypassThrottle: boolean;
  };
  validFrom?: string;
  validTill?: string;
  isActive: boolean;
}

export const EMPTY_RULE: RuleData = {
  name: '',
  templateId: '',
  platform: '',
  audience: '',
  targetMode: 'query',
  target: { conditions: [], identifiers: [] },
  behavior: {
    sendOnce: true,
    resendAfterDays: null,
    maxPerRun: 50,
    autoApprove: true,
    emailType: 'automated',
    bypassThrottle: false,
  },
  validFrom: '',
  validTill: '',
  isActive: true,
};

export const OPERATORS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'exists', 'not_exists'];

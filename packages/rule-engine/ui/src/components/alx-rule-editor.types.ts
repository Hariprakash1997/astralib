export interface Condition {
  field: string;
  operator: string;
  value: string;
}

export interface CollectionField {
  path: string;
  type: string;
  label?: string;
  description?: string;
  enumValues?: string[];
  isArray?: boolean;
}

export interface JoinOption {
  alias: string;
  from: string;
  label: string;
}

export interface CollectionSummary {
  name: string;
  label?: string;
  description?: string;
  fieldCount: number;
  joins: JoinOption[];
}

export interface TemplateOption {
  _id: string;
  name: string;
  collectionName?: string;
  joins?: string[];
}

export const TYPE_OPERATORS: Record<string, string[]> = {
  string: ['eq', 'neq', 'contains', 'in', 'not_in', 'exists', 'not_exists'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'exists', 'not_exists'],
  boolean: ['eq', 'neq', 'exists', 'not_exists'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'],
  objectId: ['eq', 'neq', 'in', 'not_in', 'exists', 'not_exists'],
  array: ['contains', 'in', 'not_in', 'exists', 'not_exists'],
  object: ['exists', 'not_exists'],
};

export const OPERATORS: Array<{ value: string; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'does not exist' },
];

export interface TemplateData {
  _id?: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  audience: string;
  platform: string;
  subjects: string[];
  bodies: string[];
  preheaders: string[];
  textBody: string;
  fields: Record<string, string>;
  variables: string[];
  collectionName: string;
  joins: string[];
  attachments: Array<{ filename: string; url: string; contentType: string }>;
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

export const EMPTY_TEMPLATE: TemplateData = {
  name: '',
  slug: '',
  description: '',
  category: '',
  audience: '',
  platform: '',
  subjects: [],
  bodies: [''],
  preheaders: [],
  textBody: '',
  fields: {},
  variables: [],
  collectionName: '',
  joins: [],
  attachments: [],
  isActive: true,
};

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
    ruleType: string;
    bypassThrottle: boolean;
  };
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone: string;
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
    ruleType: 'automated',
    bypassThrottle: false,
  },
  validFrom: '',
  validTill: '',
  isActive: true,
};

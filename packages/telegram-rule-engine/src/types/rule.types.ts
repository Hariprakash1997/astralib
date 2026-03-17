export interface QueryTarget {
  mode: 'query';
  conditions: Record<string, unknown>;
}

export interface ListTarget {
  mode: 'list';
  identifiers: string[];
}

export type RuleTarget = QueryTarget | ListTarget;

export interface RuleRunStats {
  sent: number;
  failed: number;
  skipped: number;
  throttled: number;
}

export interface PerRuleStats {
  ruleId: string;
  ruleName: string;
  stats: RuleRunStats;
}

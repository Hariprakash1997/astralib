import type { JoinDefinition } from '../types/collection.types';
import type { RuleCondition } from '../types/rule.types';

export interface PipelineBuilderOptions {
  joins: JoinDefinition[];
  conditions: RuleCondition[];
  limit?: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOperatorExpression(operator: string, value: unknown): unknown {
  switch (operator) {
    case 'eq': return value;
    case 'neq': return { $ne: value };
    case 'gt': return { $gt: value };
    case 'gte': return { $gte: value };
    case 'lt': return { $lt: value };
    case 'lte': return { $lte: value };
    case 'contains': return { $regex: escapeRegex(String(value ?? '')), $options: 'i' };
    case 'in': return { $in: Array.isArray(value) ? value : [value] };
    case 'not_in': return { $nin: Array.isArray(value) ? value : [value] };
    case 'exists': return { $exists: true };
    case 'not_exists': return { $exists: false };
    default: return value;
  }
}

export function buildAggregationPipeline(options: PipelineBuilderOptions): object[] {
  const pipeline: object[] = [];
  for (const join of options.joins) {
    pipeline.push({
      $lookup: { from: join.from, localField: join.localField, foreignField: join.foreignField, as: join.as },
    });
    pipeline.push({
      $unwind: { path: `$${join.as}`, preserveNullAndEmptyArrays: true },
    });
  }
  if (options.conditions.length > 0) {
    pipeline.push({
      $match: {
        $and: options.conditions.map(cond => ({
          [cond.field]: buildOperatorExpression(cond.operator, cond.value),
        })),
      },
    });
  }
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }
  return pipeline;
}

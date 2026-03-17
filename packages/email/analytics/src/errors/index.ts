import { AlxError } from '@astralibx/core';

export class AlxAnalyticsError extends AlxError {
  constructor(message: string, public readonly code: string) {
    super(message, code);
    this.name = 'AlxAnalyticsError';
  }
}

export { ConfigValidationError } from '@astralibx/core';

export class InvalidDateRangeError extends AlxAnalyticsError {
  constructor(
    public readonly startDate: string,
    public readonly endDate: string,
  ) {
    super(
      `Invalid date range: ${startDate} to ${endDate}`,
      'INVALID_DATE_RANGE',
    );
    this.name = 'InvalidDateRangeError';
  }
}

export class AggregationError extends AlxAnalyticsError {
  constructor(
    public readonly pipeline: string,
    public readonly originalError: Error,
  ) {
    super(
      `Aggregation pipeline failed (${pipeline}): ${originalError.message}`,
      'AGGREGATION_FAILED',
    );
    this.name = 'AggregationError';
  }
}

import type { Request, Response, NextFunction, RequestHandler } from 'express';

function isValidDateString(s: string): boolean {
  return s.trim() !== '' && !isNaN(new Date(s).getTime());
}

export function filterUpdateableFields(
  input: Record<string, unknown>,
  allowedFields: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && allowedFields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export function buildDateRangeFilter(
  dateField: string,
  from?: string,
  to?: string
): Record<string, unknown> {
  const validFrom = from && isValidDateString(from) ? from : undefined;
  const validTo = to && isValidDateString(to) ? to : undefined;
  if (!validFrom && !validTo) return {};
  const filter: Record<string, any> = {};
  filter[dateField] = {};
  if (validFrom) filter[dateField].$gte = new Date(validFrom);
  if (validTo) filter[dateField].$lte = new Date(validTo + 'T23:59:59.999Z');
  return filter;
}

export function calculatePagination(page?: number, limit?: number, maxLimit = 500) {
  const rawPage = page != null && !isNaN(page) ? page : 1;
  const rawLimit = limit != null && !isNaN(limit) ? limit : 200;
  const p = Math.max(1, rawPage);
  const l = Math.max(1, Math.min(rawLimit, maxLimit));
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
}

export function getErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) return 400;
  if (message.includes('already exists') || message.includes('duplicate') || message.includes('conflict')) return 409;
  return 500;
}

export function isValidValue(enumObj: Record<string, string>, value: unknown): boolean {
  return Object.values(enumObj).includes(value as string);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

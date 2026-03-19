/**
 * Filters an input object to only include fields that are in the allowed set.
 * Strips undefined values automatically.
 */
export function filterUpdateableFields(
  input: Record<string, unknown>,
  allowedFields: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && allowedFields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Adds tenantId to a query filter if tenantId is provided.
 * When tenantId is undefined (single-tenant mode), the query is returned unchanged.
 * This ensures zero overhead when multi-tenant is not configured.
 */
export function withTenantFilter<T extends Record<string, unknown>>(query: T, tenantId?: string): T {
  if (tenantId) {
    (query as Record<string, unknown>).tenantId = tenantId;
  }
  return query;
}

/**
 * Sets tenantId on a document data object if tenantId is provided.
 * No-op when tenantId is undefined (single-tenant mode).
 */
export function withTenantId<T extends Record<string, unknown>>(data: T, tenantId?: string): T {
  if (tenantId) {
    (data as Record<string, unknown>).tenantId = tenantId;
  }
  return data;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function defaultDateFrom(daysAgo = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function defaultDateTo(): string {
  return new Date().toISOString().slice(0, 10);
}

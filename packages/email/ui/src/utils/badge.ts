import { html, nothing } from 'lit';

const STATUS_CLASSES: Record<string, string> = {
  sent: 'alx-badge alx-badge-success',
  completed: 'alx-badge alx-badge-success',
  error: 'alx-badge alx-badge-danger',
  failed: 'alx-badge alx-badge-danger',
  skipped: 'alx-badge alx-badge-warning',
  running: 'alx-badge alx-badge-warning',
  invalid: 'alx-badge alx-badge-muted',
  cancelled: 'alx-badge alx-badge-muted',
  throttled: 'alx-badge alx-badge-info',
};

export function renderStatusBadge(status?: string) {
  if (!status) return nothing;
  const cls = STATUS_CLASSES[status] ?? 'alx-badge';
  return html`<span class="${cls}">${status}</span>`;
}

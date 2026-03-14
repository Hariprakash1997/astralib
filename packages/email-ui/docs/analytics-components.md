# Analytics Components

5 components for email analytics: overview metrics, send volume timeline, per-account stats, per-rule stats, and engagement tracking.

All components use `AnalyticsAPI` internally and require `analyticsApi` to be configured via `AlxConfig.setup()`.

All analytics components accept `date-from` and `date-to` attributes for date range filtering. If omitted, they default to the last 30 days.

---

## `<alx-analytics-overview>`

Metric cards showing total sent, delivered, failed, bounced, complained, opened, clicked, and unsubscribed counts with percentages.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `date-from` | `string` | Last 30 days | Start date (YYYY-MM-DD) |
| `date-to` | `string` | Today | End date (YYYY-MM-DD) |

### Events

None.

### Features
- Responsive grid of metric cards
- Each card shows: label, count (formatted with K/M suffixes), percentage of total sent
- Color-coded by metric type:
  - **Muted**: Total Sent
  - **Success**: Delivered
  - **Danger**: Failed, Bounced, Complained, Unsubscribed
  - **Info**: Opened, Clicked
- Auto-reloads when date attributes change

### Usage

```html
<alx-analytics-overview
  date-from="2025-01-01"
  date-to="2025-01-31"
></alx-analytics-overview>
```

---

## `<alx-analytics-timeline>`

Bar chart showing send volume over time with hover tooltips.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `date-from` | `string` | Last 30 days | Start date (YYYY-MM-DD) |
| `date-to` | `string` | Today | End date (YYYY-MM-DD) |
| `interval` | `'daily' \| 'weekly' \| 'monthly'` | `'daily'` | Aggregation interval |

### Events

None.

### Features
- CSS-only bar chart (no external charting library)
- Hover tooltips showing exact date and count
- X-axis labels auto-thin when there are many data points (>15)
- Y-axis max value indicator
- Bars colored with `--alx-info`, highlight to `--alx-primary` on hover
- Auto-reloads when date or interval attributes change

### Usage

```html
<alx-analytics-timeline
  date-from="2025-01-01"
  date-to="2025-03-31"
  interval="weekly"
></alx-analytics-timeline>
```

---

## `<alx-analytics-accounts>`

Sortable table showing per-account email performance stats.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `date-from` | `string` | Last 30 days | Start date (YYYY-MM-DD) |
| `date-to` | `string` | Today | End date (YYYY-MM-DD) |

### Events

None.

### Features
- Columns: Account (email), Sent, Delivered, Bounced, Failed, Delivery Rate
- Click any column header to sort (ascending/descending toggle)
- Sort indicator arrows on active column
- Delivery rate color-coded: green >=95%, yellow >=90%, red <90%
- Computed delivery rate (delivered / sent)
- Auto-reloads when date attributes change

### Usage

```html
<alx-analytics-accounts
  date-from="2025-01-01"
  date-to="2025-01-31"
></alx-analytics-accounts>
```

---

## `<alx-analytics-rules>`

Sortable table showing per-rule performance with error rates.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `date-from` | `string` | Last 30 days | Start date (YYYY-MM-DD) |
| `date-to` | `string` | Today | End date (YYYY-MM-DD) |

### Events

None.

### Features
- Columns: Rule name, Sent, Delivered, Bounced, Failed, Skipped, Error Rate
- Click any column header to sort (ascending/descending toggle)
- Error rate = (bounced + failed) / sent, color-coded: red >5%, green otherwise
- Computed error rate per rule
- Auto-reloads when date attributes change

### Usage

```html
<alx-analytics-rules
  date-from="2025-01-01"
  date-to="2025-01-31"
></alx-analytics-rules>
```

---

## `<alx-analytics-engagement>`

Engagement metrics showing open rate, click rate, and unsubscribe rate with an info banner for SES-only tracking.

### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `date-from` | `string` | Last 30 days | Start date (YYYY-MM-DD) |
| `date-to` | `string` | Today | End date (YYYY-MM-DD) |

### Events

None.

### Features
- Three metric cards: Open Rate, Click Rate, Unsubscribe Rate
- Each shows percentage and raw count (e.g., "1,234 of 10,000 sent")
- Unsubscribe rate styled in warning color
- **SES note**: auto-shows an info banner when open/click data is zero but emails have been sent, explaining that tracking is SES-only
- Auto-reloads when date attributes change

### Usage

```html
<alx-analytics-engagement
  date-from="2025-01-01"
  date-to="2025-01-31"
></alx-analytics-engagement>
```

---

## Composing an Analytics Dashboard

Combine all five components for a full dashboard:

```html
<div style="display: grid; gap: 1.5rem;">
  <alx-analytics-overview date-from="2025-01-01" date-to="2025-01-31"></alx-analytics-overview>
  <alx-analytics-timeline date-from="2025-01-01" date-to="2025-01-31" interval="daily"></alx-analytics-timeline>
  <alx-analytics-engagement date-from="2025-01-01" date-to="2025-01-31"></alx-analytics-engagement>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
    <alx-analytics-accounts date-from="2025-01-01" date-to="2025-01-31"></alx-analytics-accounts>
    <alx-analytics-rules date-from="2025-01-01" date-to="2025-01-31"></alx-analytics-rules>
  </div>
</div>
```

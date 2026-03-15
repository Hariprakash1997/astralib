# Theming

All components use CSS custom properties for styling. Override them at any level -- globally, per-component type, or per-instance.

## CSS Custom Properties

| Property | Dark Default | Light Default | Description |
|----------|-------------|---------------|-------------|
| `--alx-primary` | `#d4af37` | `#b8941e` | Primary accent color (buttons, active states) |
| `--alx-danger` | `#ef4444` | `#dc2626` | Error/danger color |
| `--alx-success` | `#22c55e` | `#16a34a` | Success color |
| `--alx-warning` | `#f59e0b` | `#d97706` | Warning color |
| `--alx-info` | `#3b82f6` | `#2563eb` | Info color (charts, links) |
| `--alx-bg` | `#111` | `#f8f9fa` | Page/component background |
| `--alx-surface` | `#1a1a1a` | `#ffffff` | Card/elevated surface background |
| `--alx-border` | `#333` | `#e2e8f0` | Border color |
| `--alx-text` | `#ccc` | `#1a1a1a` | Primary text color |
| `--alx-text-muted` | `#888` | `#64748b` | Secondary/muted text color |
| `--alx-radius` | `6px` | `6px` | Border radius for cards, inputs, badges |
| `--alx-font-family` | `'Inter', sans-serif` | `'Inter', sans-serif` | Font family |

## Built-in Themes

The package exports two Lit CSS templates:

```typescript
import { alxDarkTheme, alxLightTheme } from '@astralibx/email-ui';
```

These are `CSSResult` objects setting all custom properties on `:host`. They are included in every component's styles by default via `alxBaseStyles`.

## Customization Examples

### Global override (all components)

```css
/* Apply to all alx- components at once */
alx-account-list,
alx-account-form,
alx-account-health,
alx-analytics-overview {
  --alx-primary: #6366f1;
  --alx-bg: #0a0a0a;
  --alx-surface: #171717;
  --alx-font-family: 'JetBrains Mono', monospace;
}
```

### Using a wrapper class

```css
.email-admin-panel {
  --alx-primary: #8b5cf6;
  --alx-radius: 12px;
}
```

```html
<div class="email-admin-panel">
  <alx-account-list></alx-account-list>
  <alx-analytics-overview></alx-analytics-overview>
</div>
```

### Per-instance override

```html
<alx-account-list style="--alx-primary: #ec4899; --alx-radius: 0;"></alx-account-list>
```

### Light theme in a dark app

```css
alx-analytics-overview {
  --alx-bg: #f8f9fa;
  --alx-surface: #ffffff;
  --alx-border: #e2e8f0;
  --alx-text: #1a1a1a;
  --alx-text-muted: #64748b;
  --alx-primary: #b8941e;
}
```

## Density

All components support a `density` attribute to control spacing and sizing. Two presets are available: `"default"` and `"compact"`.

### Usage

```html
<alx-account-list density="compact"></alx-account-list>
```

### CSS Custom Properties

| Property | Default | Compact | Description |
|----------|---------|---------|-------------|
| `--alx-density-padding` | `0.75rem` | `0.375rem` | Inner padding |
| `--alx-density-gap` | `1rem` | `0.5rem` | Gap between elements |
| `--alx-density-font-size` | `0.875rem` | `0.75rem` | Base font size |
| `--alx-density-row-height` | `2.5rem` | `1.75rem` | Table/list row height |
| `--alx-density-header-size` | `1.25rem` | `1rem` | Header font size |

### Custom Override

You can override individual density properties without using a preset:

```html
<style>
  alx-account-list {
    --alx-density-padding: 0.25rem;
    --alx-density-font-size: 0.7rem;
  }
</style>
```

---

## Shared Style Exports

For building custom components that match the design system:

```typescript
import {
  alxBaseStyles,       // :host block, font-family, color, background, box-sizing
  alxResetStyles,      // box-sizing reset
  alxTypographyStyles, // h1-h6, p, .text-muted, .text-small
  alxButtonStyles,     // button, .alx-btn, .alx-btn-primary/danger/success, .alx-btn-sm
  alxInputStyles,      // input, select, textarea, label
  alxTableStyles,      // table, th, td, tr:hover
  alxCardStyles,       // .alx-card, .alx-card-header
  alxBadgeStyles,      // .alx-badge, .alx-badge-success/danger/warning/info/muted
  alxLoadingStyles,    // .alx-loading, .alx-spinner, .alx-empty, .alx-error
} from '@astralibx/email-ui';
```

Use these in your own Lit components:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { alxBaseStyles, alxCardStyles, alxBadgeStyles } from '@astralibx/email-ui';

@customElement('my-custom-panel')
class MyCustomPanel extends LitElement {
  static styles = [alxBaseStyles, alxCardStyles, alxBadgeStyles];

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header"><h3>My Panel</h3></div>
        <span class="alx-badge alx-badge-success">Active</span>
      </div>
    `;
  }
}
```

## Shadow DOM

All components use Shadow DOM, so their internal styles do not leak. CSS custom properties pierce the shadow boundary, making them the only theming mechanism needed.

# Theming — `@astralibx/rule-engine-ui`

Source: [`packages/rule-engine/ui/src/styles/theme.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/styles/theme.ts) · [`packages/rule-engine/ui/src/styles/shared.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/styles/shared.ts)

All components in this package are styled exclusively through CSS custom properties (design tokens) prefixed with `--alx-`. This means you can theme the entire UI by setting a handful of variables on the host element — no CSS overrides inside shadow roots needed.

---

## CSS Custom Properties

The table below lists every `--alx-*` token, along with its value in each built-in theme.

| Property | Dark (`alxDarkTheme`) | Light (`alxLightTheme`) | Purpose |
|---|---|---|---|
| `--alx-primary` | `#d4af37` | `#2563eb` | Brand accent — buttons, focus rings, hover highlights |
| `--alx-danger` | `#ef4444` | `#dc2626` | Destructive actions, error states |
| `--alx-success` | `#22c55e` | `#16a34a` | Positive states, success badges, toggles |
| `--alx-warning` | `#f59e0b` | `#d97706` | Warning badges and inline warn lines |
| `--alx-info` | `#3b82f6` | `#0ea5e9` | Info badges and help panels |
| `--alx-bg` | `#111` | `#f8fafc` | Page / component background |
| `--alx-surface` | `#1a1a1a` | `#ffffff` | Card and panel surfaces |
| `--alx-border` | `#333` | `#e2e8f0` | Borders, dividers, separators |
| `--alx-text` | `#ccc` | `#0f172a` | Primary text colour |
| `--alx-text-muted` | `#888` | `#64748b` | Secondary / placeholder text |
| `--alx-radius` | `4px` | `4px` | Border radius applied to inputs, buttons, cards |
| `--alx-shadow` | `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Standard elevation shadow |
| `--alx-shadow-sm` | `0 1px 2px rgba(0,0,0,0.2)` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card shadow |
| `--alx-font-family` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | same | Font stack for all text |

### Density tokens (from `alxDensityStyles`)

These are set automatically and can be adjusted per `density` attribute.

| Property | Default | Compact (`density="compact"`) |
|---|---|---|
| `--alx-density-padding` | `0.5rem` | `0.3rem` |
| `--alx-density-gap` | `0.75rem` | `0.4rem` |
| `--alx-density-font-size` | `0.8125rem` | `0.75rem` |
| `--alx-density-row-height` | `2.25rem` | `1.625rem` |
| `--alx-density-header-size` | `1.1rem` | `0.9rem` |

---

## Built-in Themes

Two ready-made themes are exported from [`theme.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/styles/theme.ts): `alxDarkTheme` and `alxLightTheme`. Both are Lit `CSSResult` objects that set every `--alx-*` token on `:host`.

### Applying a theme to your own Lit component

```typescript
import { LitElement } from 'lit';
import { alxDarkTheme } from '@astralibx/rule-engine-ui';

class MyShell extends LitElement {
  static override styles = [alxDarkTheme];
}
```

### Applying the light theme

```typescript
import { alxLightTheme } from '@astralibx/rule-engine-ui';

class MyShell extends LitElement {
  static override styles = [alxLightTheme];
}
```

### Switching themes at runtime

Because the tokens are just CSS custom properties, you can toggle them at runtime by swapping a class or attribute on the host element:

```html
<!-- In your HTML -->
<my-app class="dark"></my-app>
```

```css
/* In your global CSS */
my-app.dark {
  --alx-primary: #d4af37;
  --alx-bg: #111;
  --alx-surface: #1a1a1a;
  /* ...remaining tokens */
}
```

---

## Custom Theming

You do not need to use `alxDarkTheme` or `alxLightTheme`. Override any token directly on the host element in your own stylesheet:

```css
alx-template-editor {
  --alx-primary: #7c3aed;       /* purple brand */
  --alx-bg: #0d0d0d;
  --alx-surface: #161616;
  --alx-border: #2e2e2e;
  --alx-text: #e5e5e5;
  --alx-text-muted: #737373;
  --alx-radius: 6px;
}
```

All components within the element's shadow tree will automatically pick up the overridden values. No `!important` or deep selectors are needed.

---

## Style Exports

All shared style sheets are exported from [`shared.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/styles/shared.ts). Import them individually and compose them in your component's `styles` array.

| Export | Purpose |
|---|---|
| `alxDensityStyles` | Density tokens and `density="compact"` attribute support |
| `alxResetStyles` | `box-sizing: border-box` reset with zero margin/padding |
| `alxTypographyStyles` | Headings (`h1`–`h4`), `p`, `.text-muted`, `.text-small`, `code` |
| `alxButtonStyles` | `button`, `.alx-btn`, `.alx-btn-primary`, `.alx-btn-danger`, `.alx-btn-success`, `.alx-btn-sm`, `.alx-btn-icon` |
| `alxInputStyles` | `input`, `select`, `textarea`, `label`, `.form-group`, `.form-row`, `.form-actions`, `.form-section` |
| `alxTableStyles` | `table`, `thead`, `th`, `td`, row hover, clickable rows |
| `alxCardStyles` | `.alx-card`, `.alx-card-header` |
| `alxBadgeStyles` | `.alx-badge`, `.alx-badge-success`, `.alx-badge-danger`, `.alx-badge-warning`, `.alx-badge-info`, `.alx-badge-muted` |
| `alxLoadingStyles` | `.alx-loading`, `.alx-spinner`, `.alx-empty`, `.alx-error`, `.alx-success-msg` |
| `alxToolbarStyles` | `.toolbar`, `.spacer`, `.pagination` |
| `alxToggleStyles` | `.toggle`, `.toggle-slider` — CSS-only checkbox toggle |
| `alxProgressBarStyles` | `.progress-bar`, `.progress-track`, `.progress-fill`, `.progress-label` |
| `alxTooltipStyles` | `.help-toggle`, `.help-panel`, `.info-line`, `.warn-line` |

Also exported from [`theme.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/styles/theme.ts):

| Export | Purpose |
|---|---|
| `alxDarkTheme` | Full dark token set applied to `:host` |
| `alxLightTheme` | Full light token set applied to `:host` |
| `alxBaseStyles` | `:host { display: block }` with font, color, background, and box-sizing defaults |

---

## Using in Custom Components

Import whichever style sheets you need and compose them in your Lit component's `styles` array. Styles are evaluated in order, so place your own overrides last.

```typescript
import { LitElement, html, css } from 'lit';
import { alxDarkTheme } from '@astralibx/rule-engine-ui';
import {
  alxBaseStyles,
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
} from '@astralibx/rule-engine-ui';

class MyDashboard extends LitElement {
  static override styles = [
    alxDarkTheme,          // 1. set all --alx-* tokens
    alxBaseStyles,         // 2. :host defaults
    alxDensityStyles,      // 3. density tokens
    alxResetStyles,        // 4. box-model reset
    alxTypographyStyles,   // 5. headings, text helpers
    alxButtonStyles,       // 6. buttons
    alxInputStyles,        // 7. form controls
    alxCardStyles,         // 8. card layout
    alxBadgeStyles,        // 9. status badges
    alxLoadingStyles,      // 10. spinner, empty state
    css`
      /* component-specific overrides go last */
      :host { padding: 1.5rem; }
    `,
  ];

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header"><h3>My Panel</h3></div>
        <span class="alx-badge alx-badge-success">Active</span>
        <div class="alx-loading">
          <div class="alx-spinner"></div> Loading…
        </div>
      </div>
    `;
  }
}
```

Because all colours, spacing, and typography are driven by CSS custom properties, switching the theme is as simple as replacing `alxDarkTheme` with `alxLightTheme` in the `styles` array, or overriding individual tokens in your final `css` block.

# Theming

All components use CSS custom properties with the `--alx-*` prefix. Override them on the host element or any parent to customize the look.

## Quick Override

```css
alx-chat-dashboard {
  --alx-primary: #8b5cf6;
  --alx-bg: #0a0a0f;
  --alx-surface: #12141a;
}
```

## Color Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-bg` | `#0f1117` | Page/app background |
| `--alx-surface` | `#181a20` | Card and panel background |
| `--alx-surface-alt` | `#1e2028` | Alternate surface (e.g. nested panels) |
| `--alx-border` | `#2a2d37` | Border color |
| `--alx-text` | `#e1e4ea` | Primary text color |
| `--alx-text-muted` | `#8b8fa3` | Secondary/muted text color |
| `--alx-primary` | `#6366f1` | Primary accent (buttons, active tabs, focus rings) |
| `--alx-success` | `#22c55e` | Success state |
| `--alx-danger` | `#ef4444` | Danger/error state |
| `--alx-warning` | `#f59e0b` | Warning state |
| `--alx-info` | `#3b82f6` | Info state |

## Layout Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-radius` | `6px` | Border radius for cards, buttons, inputs |
| `--alx-font-family` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Font stack |
| `--alx-shadow-sm` | `0 1px 3px rgba(0, 0, 0, 0.3)` | Small box shadow |
| `--alx-shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.4)` | Medium box shadow |

## Density Properties

These are set automatically based on the `density` attribute but can be overridden:

| Property | Default | Compact |
|----------|---------|---------|
| `--alx-density-padding` | `0.5rem` | `0.3rem` |
| `--alx-density-gap` | `0.75rem` | `0.4rem` |
| `--alx-density-font-size` | `0.8125rem` | `0.75rem` |
| `--alx-density-row-height` | `2.25rem` | `1.625rem` |
| `--alx-density-header-size` | `1.1rem` | `0.9rem` |

## Shared Style Exports

The package exports reusable Lit CSS template literals that each component uses internally. You can also import them to build custom components that match the same design system:

| Export | Purpose |
|--------|---------|
| `alxChatResetStyles` | Box-sizing reset |
| `alxChatThemeStyles` | Color and font custom properties |
| `alxChatDensityStyles` | Density-aware spacing |
| `alxChatTypographyStyles` | Heading and paragraph styles |
| `alxChatButtonStyles` | Button variants (`.alx-btn-primary`, `.alx-btn-danger`, `.alx-btn-success`, `.alx-btn-sm`, `.alx-btn-icon`) |
| `alxChatInputStyles` | Form inputs, selects, textareas, labels, `.form-group`, `.form-row`, `.form-actions` |
| `alxChatTableStyles` | Sticky-header tables with hover and striping |
| `alxChatCardStyles` | `.alx-card` and `.alx-card-header` |
| `alxChatBadgeStyles` | `.alx-badge` with color variants (`-success`, `-danger`, `-warning`, `-info`, `-muted`) |
| `alxChatLoadingStyles` | Spinner, empty state, error/success messages |
| `alxChatToolbarStyles` | Filter toolbar layout with pagination |
| `alxChatToggleStyles` | Toggle switch |
| `alxChatDrawerStyles` | Slide-in drawer overlay and panel |
| `alxChatTabStyles` | Tab bar with active indicator |

```typescript
import { alxChatThemeStyles, alxChatButtonStyles } from '@astralibx/chat-ui';

class MyComponent extends LitElement {
  static styles = [alxChatThemeStyles, alxChatButtonStyles, css`/* ... */`];
}
```

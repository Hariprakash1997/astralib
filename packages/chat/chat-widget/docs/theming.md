# Theming

The widget uses CSS custom properties for full visual customization. All properties are prefixed with `--alx-chat-*`.

## Built-in Themes

Three themes are available:

| Theme | Description |
|-------|-------------|
| `dark` | Dark background with light text (default) |
| `light` | Light background with dark text |
| `auto` | Detects OS preference via `prefers-color-scheme` and switches automatically with a smooth transition |

Set the theme via HTML attribute or config:

```html
<alx-chat-widget theme="auto"></alx-chat-widget>
```

```ts
widget.configure({ theme: 'auto' });
```

When `theme="auto"`, the widget listens for OS-level theme changes and re-renders without a page reload.

## Branding Shortcut

The `branding.primaryColor` config option sets `--alx-chat-primary` without writing CSS:

```ts
widget.configure({
  branding: {
    primaryColor: '#D4AF37',
    companyName: 'Acme',
    logoUrl: '/logo.png',
  },
});
```

## CSS Custom Properties Reference

Override these on the `alx-chat-widget` element or any ancestor:

```css
alx-chat-widget {
  --alx-chat-primary: #D4AF37;
  --alx-chat-bg: #1a1a2e;
}
```

### Colors

| Property | Default (Dark) | Description |
|----------|---------------|-------------|
| `--alx-chat-primary` | `#6366f1` | Primary brand color |
| `--alx-chat-primary-hover` | `#5558e6` | Hover variant (auto-derived: 8% darker) |
| `--alx-chat-primary-text` | `#ffffff` | Text on primary surfaces |
| `--alx-chat-primary-light` | auto-derived | 12% opacity primary (badges, focus rings) |
| `--alx-chat-primary-muted` | auto-derived | 40% opacity primary (avatars, accents) |
| `--alx-chat-bg` | `#0f0f1a` | Main background |
| `--alx-chat-surface` | `#1a1a2e` | Card/bubble background |
| `--alx-chat-surface-hover` | `#1f1f38` | Surface hover state |
| `--alx-chat-surface-alt` | `#232340` | Elevated surface (date pills, system messages) |
| `--alx-chat-text` | `#f0f0f5` | Primary text |
| `--alx-chat-text-muted` | `#8b8ba3` | Secondary/muted text |
| `--alx-chat-border` | `#2a2a45` | Borders and dividers |
| `--alx-chat-success` | `#22c55e` | Online status, confirmations |
| `--alx-chat-warning` | `#f59e0b` | Reconnecting status |
| `--alx-chat-danger` | `#ef4444` | Error states, failed badges |

### Bubble Colors

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-chat-visitor-bg` | `var(--alx-chat-primary)` | Visitor bubble background |
| `--alx-chat-visitor-text` | `var(--alx-chat-primary-text)` | Visitor bubble text |
| `--alx-chat-agent-bg` | `var(--alx-chat-surface)` | Agent bubble background |
| `--alx-chat-agent-text` | `var(--alx-chat-text)` | Agent bubble text |
| `--alx-chat-system-text` | `var(--alx-chat-text-muted)` | System message text |

### Layout

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-chat-radius` | `16px` | Window/header border radius |
| `--alx-chat-radius-sm` | `10px` | Input/button border radius |
| `--alx-chat-radius-bubble` | `18px` | Message bubble radius |
| `--alx-chat-radius-bubble-tail` | `6px` | Bubble tail corner radius |
| `--alx-chat-font` | `system-ui, -apple-system, sans-serif` | Font family |
| `--alx-chat-font-size` | `14px` | Base font size |

### Shadows

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-chat-shadow` | 3-layer composite | Window drop shadow |
| `--alx-chat-shadow-sm` | 2-layer composite | Button/card shadow |

### Animation Easing

| Property | Default | Description |
|----------|---------|-------------|
| `--alx-chat-spring-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy spring easing |
| `--alx-chat-spring-smooth` | `cubic-bezier(0.22, 1, 0.36, 1)` | Smooth decelerate easing |
| `--alx-chat-spring-snappy` | `cubic-bezier(0.16, 1, 0.3, 1)` | Quick snap easing |

## Auto-Derived Colors

When you set `--alx-chat-primary` (or use `branding.primaryColor`), the following variants are auto-derived using CSS `color-mix()`:

- `--alx-chat-primary-hover` -- 85% of primary mixed with black (set via `_applyPrimaryColor`)
- `--alx-chat-primary-light` -- 12% opacity of primary (defined in shared styles)
- `--alx-chat-primary-muted` -- 40% opacity of primary (defined in shared styles)

No manual tuning is needed. Set one color and the rest follow.

## Animation Customization

All animations use spring physics by default via the three easing variables above. Override them to change the animation feel:

```css
alx-chat-widget {
  --alx-chat-spring-bounce: ease-out;
  --alx-chat-spring-smooth: ease;
  --alx-chat-spring-snappy: ease-in-out;
}
```

The widget respects `prefers-reduced-motion: reduce` automatically. When active, all animation durations and transitions are set to near-zero, disabling visual motion entirely.

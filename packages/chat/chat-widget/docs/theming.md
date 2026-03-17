# Theming

The widget uses CSS custom properties for full visual customization. All properties are prefixed with `--alx-chat-*`.

## Built-in Themes

Two themes are available out of the box:

| Theme | Description |
|-------|-------------|
| `dark` | Dark background with light text (default) |
| `light` | Light background with dark text |

Set the theme via HTML attribute or config:

```html
<alx-chat-widget theme="light"></alx-chat-widget>
```

```ts
widget.configure({ theme: 'light' });
```

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

| Property | Description |
|----------|-------------|
| `--alx-chat-primary` | Primary accent color |
| `--alx-chat-primary-hover` | Primary hover color |
| `--alx-chat-primary-text` | Text color on primary background |
| `--alx-chat-bg` | Widget background color |
| `--alx-chat-surface` | Surface/card background color |
| `--alx-chat-text` | Primary text color |
| `--alx-chat-text-muted` | Secondary/muted text color |
| `--alx-chat-border` | Border color |
| `--alx-chat-radius` | Border radius |
| `--alx-chat-font` | Font family |
| `--alx-chat-font-size` | Base font size |

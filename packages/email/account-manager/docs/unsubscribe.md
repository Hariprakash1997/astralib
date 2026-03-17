# Unsubscribe System

## Built-in HMAC Token Flow

1. When an email is sent, an unsubscribe URL is generated and added as a `List-Unsubscribe` header
2. The URL contains an HMAC-SHA256 signed token with the recipient email and timestamp
3. Clicking the link hits the unsubscribe route, which verifies the token and marks the identifier as unsubscribed
4. A styled confirmation page is shown to the user

### Configuration

```ts
createEmailAccountManager({
  // ...
  options: {
    unsubscribe: {
      builtin: {
        enabled: true,
        secret: 'your-hmac-secret-key',
        baseUrl: 'https://yourdomain.com/unsubscribe',
        tokenExpiryDays: 365,
      },
    },
  },
});
```

### Confirmation Page Branding

Customize the unsubscribe confirmation page via Global Settings:

```ts
await eam.settings.updateSection('unsubscribePage', {
  companyName: 'Your Company',
  logoUrl: 'https://yourdomain.com/logo.png',
  accentColor: '#4F46E5',
});
```

## Programmatic Access

```ts
// Generate a token manually
const url = eam.unsubscribe.generateUrl('user@example.com', accountId);

// Verify a token
const valid = eam.unsubscribe.verifyToken('user@example.com', token);

// Process unsubscribe
const result = await eam.unsubscribe.handleUnsubscribe('user@example.com', token);
// { success: true, email: 'user@example.com' }
```

## RFC 8058 One-Click Unsubscribe

The library automatically adds both headers required for one-click unsubscribe support in email clients:

```
List-Unsubscribe: <https://yourdomain.com/unsubscribe?token=...>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Email clients that support RFC 8058 (Gmail, Yahoo, etc.) will show a one-click unsubscribe button. When clicked, a `POST` request is sent to the unsubscribe route, and the recipient is unsubscribed without visiting a page.

## Custom Unsubscribe URLs

To use your own unsubscribe system instead of the built-in one, provide a `generateUrl` function in config:

```ts
createEmailAccountManager({
  // ...
  options: {
    unsubscribe: {
      generateUrl: (email, accountId) => `https://yourdomain.com/unsub?e=${email}`,
    },
  },
});
```

When using custom URLs, you are responsible for processing unsubscribe requests and updating identifier status.

## Routes

Mount the unsubscribe router on a public path:

```ts
app.use('/unsubscribe', eam.unsubscribeRoutes);
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Show unsubscribe confirmation page |
| `POST` | `/` | Process one-click unsubscribe (RFC 8058) |

## Related

- [Configuration](./configuration.md) -- `options.unsubscribe`
- [API Routes](./api-routes.md) -- unsubscribe route details

# SES Webhooks

Process AWS SES event notifications (bounces, complaints, deliveries, opens, clicks) sent via SNS.

## Setup

1. Create an SNS topic in AWS
2. Subscribe the webhook endpoint to the topic: `https://yourdomain.com/webhooks/ses`
3. The library auto-confirms SNS subscription requests
4. Configure a Configuration Set in SES to publish events to the SNS topic

### Configuration

```ts
createEmailAccountManager({
  // ...
  options: {
    ses: {
      enabled: true,
      validateSignature: true,
      allowedTopicArns: [
        'arn:aws:sns:us-east-1:123456789:ses-notifications',
      ],
    },
  },
});
```

### Mounting the Route

```ts
app.use('/webhooks/ses', eam.webhookRoutes.ses);
```

This endpoint must be publicly accessible so AWS SNS can reach it.

## SNS Signature Verification

By default, all incoming SNS messages are cryptographically verified:

- Certificate URL must be from `*.amazonaws.com` over HTTPS
- SHA1 signature is validated against the message content

Disable with `options.ses.validateSignature: false` (not recommended for production).

If verification fails, a `SnsSignatureError` is thrown with code `SNS_SIGNATURE_INVALID`.

## Event Processing

| SES Event | Action |
|-----------|--------|
| **Bounce (Permanent)** | Identifier marked `invalid` or `bounced`, health score -10, `onBounce` hook |
| **Bounce (Transient)** | Identifier marked `bounced` (soft), health score -10, `onBounce` hook |
| **Complaint** | Identifier marked `blocked`, `onComplaint` hook |
| **Delivery** | `onDelivery` hook |
| **Open** | `onOpen` hook |
| **Click** | `onClick` hook |

### Bounce Types

- **Permanent bounces**: The recipient address is invalid. The identifier is marked as `invalid` or `bounced` and should not be contacted again.
- **Transient bounces**: A temporary delivery failure (full mailbox, server down). The identifier is marked as `bounced` (soft bounce) but may recover.

### Complaints

When a recipient marks your email as spam, the identifier is marked as `blocked`. This is a strong signal -- do not send to this address again.

## Hooks

Use hooks to react to SES events in your application:

```ts
createEmailAccountManager({
  // ...
  hooks: {
    onBounce: ({ accountId, email, bounceType, provider }) => {
      console.log(`Bounce from ${email}: ${bounceType}`);
    },
    onComplaint: ({ accountId, email }) => {
      console.log(`Complaint from ${email}`);
    },
    onDelivery: ({ accountId, email }) => {},
    onOpen: ({ accountId, email, timestamp }) => {},
    onClick: ({ accountId, email, link }) => {},
  },
});
```

## Related

- [Health Tracking](./health-tracking.md) -- how bounces affect health scores
- [Configuration](./configuration.md) -- `options.ses`
- [Error Handling](./error-handling.md) -- `SnsSignatureError`

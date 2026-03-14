# SMTP Pooling — Efficient Email Delivery

SMTP pooling reuses persistent connections to your mail server instead of opening a new connection for every email. This is implemented in your `sendEmail` adapter.

## Why SMTP Pooling Matters

Without pooling, each email requires:
1. TCP connection
2. TLS handshake
3. SMTP EHLO
4. Authentication
5. Send email
6. Close connection

With pooling, steps 1-4 happen once. Subsequent sends reuse the open connection, reducing latency from ~500ms to ~50ms per email.

## Nodemailer Pool Transport

Nodemailer has built-in connection pooling:

```typescript
import nodemailer from 'nodemailer';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const transporter = nodemailer.createTransport({
  pool: true,
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  auth: {
    user: 'user@example.com',
    pass: 'password',
  },
  maxConnections: 5,    // max simultaneous connections
  maxMessages: 100,     // max messages per connection before reconnect
  rateDelta: 1000,      // time window for rate limiting (ms)
  rateLimit: 14,        // max messages per rateDelta
});

transporter.verify((err) => {
  if (err) console.error('SMTP connection failed:', err);
  else console.log('SMTP pool ready');
});

async function sendEmail(params: SendEmailParams) {
  await transporter.sendMail({
    from: '"My App" <noreply@example.com>',
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
    headers: {
      'X-Rule-Id': params.ruleId,
    },
  });
}
```

### Pool Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `pool` | `false` | Enable connection pooling |
| `maxConnections` | `5` | Max simultaneous SMTP connections |
| `maxMessages` | `100` | Messages per connection before cycling |
| `rateDelta` | `1000` | Rate limit time window (ms) |
| `rateLimit` | — | Max messages per `rateDelta` window |

## AWS SES Example

AWS SES uses HTTPS API calls, not SMTP, so traditional pooling doesn't apply. However, you can optimize with connection reuse:

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'https';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const ses = new SESClient({
  region: 'ap-south-1',
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({
      keepAlive: true,
      maxSockets: 25,
    }),
  }),
});

async function sendEmail(params: SendEmailParams) {
  await ses.send(new SendEmailCommand({
    Source: 'noreply@example.com',
    Destination: { ToAddresses: [params.identifierId] },
    Message: {
      Subject: { Data: params.subject },
      Body: {
        Html: { Data: params.htmlBody },
        Text: { Data: params.textBody },
      },
    },
  }));
}
```

## Queue-Based Delivery with BullMQ

For high-volume sending, decouple email rendering from delivery using a job queue:

```typescript
import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const emailQueue = new Queue('email-delivery', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// Adapter — just queues the email
async function sendEmail(params: SendEmailParams) {
  await emailQueue.add('send', {
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
    accountId: params.accountId,
    ruleId: params.ruleId,
  });
}

// Worker — processes the queue with pooled SMTP
const transporter = nodemailer.createTransport({
  pool: true,
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  auth: { user: 'user', pass: 'pass' },
  maxConnections: 3,
});

const worker = new Worker('email-delivery', async (job) => {
  const { to, subject, html, text } = job.data;
  await transporter.sendMail({
    from: 'noreply@example.com',
    to,
    subject,
    html,
    text,
  });
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 3,
  limiter: { max: 10, duration: 1000 }, // 10 emails/sec
});
```

## Connection Error Handling

SMTP connections can drop unexpectedly. Handle common errors:

```typescript
const transporter = nodemailer.createTransport({
  pool: true,
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  auth: { user: 'user', pass: 'pass' },
  maxConnections: 5,
  maxMessages: 50,
  socketTimeout: 30000,     // 30s socket timeout
  connectionTimeout: 10000, // 10s connection timeout
  greetingTimeout: 15000,   // 15s greeting timeout
});

transporter.on('error', (err) => {
  console.error('SMTP pool error:', err.message);
});

transporter.on('idle', () => {
  // Pool has available connections — can be used for monitoring
});

async function sendEmail(params: SendEmailParams) {
  try {
    await transporter.sendMail({
      from: 'noreply@example.com',
      to: params.identifierId,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
    });
  } catch (err: unknown) {
    const error = err as Error & { responseCode?: number };
    if (error.responseCode && error.responseCode >= 500) {
      throw err; // permanent failure — will be counted as error in stats
    }
    if (error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
      throw err; // transient — retry logic in your queue handles this
    }
    throw err;
  }
}
```

## Combining with Delivery Delays

When using [delivery delays](delivery-delays.md), the delay happens in the engine before calling your `sendEmail` adapter. The SMTP pool handles the connection management independently. Both features complement each other:

- **Delivery delays**: Control the pace at which the engine sends
- **SMTP pooling**: Ensure each send is as fast as possible when it happens

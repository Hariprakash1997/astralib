import crypto from 'crypto';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import { IDENTIFIER_STATUS } from '../constants';
import { InvalidTokenError } from '../errors';
import type { EmailIdentifierModel } from '../schemas/email-identifier.schema';

const SEPARATOR = '|';

export class UnsubscribeService {
  constructor(
    private EmailIdentifier: EmailIdentifierModel,
    private config: EmailAccountManagerConfig,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  generateUrl(email: string, accountId?: string): string {
    const customGenerator = this.config.options?.unsubscribe?.generateUrl;
    if (customGenerator) {
      return customGenerator(email, accountId || '');
    }

    const builtin = this.config.options?.unsubscribe?.builtin;
    if (!builtin?.enabled || !builtin.baseUrl) {
      return '';
    }

    const token = this.generateToken(email);
    return `${builtin.baseUrl}?token=${token}`;
  }

  generateToken(email: string): string {
    const secret = this.config.options?.unsubscribe?.builtin?.secret;
    if (!secret) return '';

    const timestamp = Date.now().toString();
    const payload = `${email.toLowerCase()}${SEPARATOR}${timestamp}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');
    const token = `${payload}${SEPARATOR}${signature}`;
    return Buffer.from(token).toString('base64url');
  }

  verifyToken(email: string, token: string): boolean {
    try {
      const secret = this.config.options?.unsubscribe?.builtin?.secret;
      if (!secret) return false;

      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(SEPARATOR);

      if (parts.length !== 3) return false;

      const [tokenEmail, timestampStr, providedSignature] = parts;
      const payload = `${tokenEmail}${SEPARATOR}${timestampStr}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');

      const sig1 = Buffer.from(providedSignature);
      const sig2 = Buffer.from(expectedSignature);

      if (sig1.length !== sig2.length || !crypto.timingSafeEqual(sig1, sig2)) {
        return false;
      }

      if (email && tokenEmail !== email.toLowerCase()) {
        return false;
      }

      const expiryDays = this.config.options?.unsubscribe?.builtin?.tokenExpiryDays;
      if (expiryDays) {
        const timestamp = parseInt(timestampStr, 10);
        const expiresAt = timestamp + expiryDays * 24 * 60 * 60 * 1000;
        if (Date.now() > expiresAt) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async handleUnsubscribe(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string; email?: string }> {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(SEPARATOR);
    const tokenEmail = parts.length === 3 ? parts[0] : email;

    if (!this.verifyToken(tokenEmail, token)) {
      return { success: false, error: 'Invalid or expired unsubscribe link' };
    }

    const identifier = await this.EmailIdentifier.findOne({
      email: tokenEmail.toLowerCase(),
    });

    if (!identifier) {
      return { success: true, email: tokenEmail };
    }

    if ((identifier as any).status === IDENTIFIER_STATUS.Unsubscribed) {
      return { success: true, email: tokenEmail };
    }

    await this.EmailIdentifier.findByIdAndUpdate(identifier._id, {
      $set: {
        status: IDENTIFIER_STATUS.Unsubscribed,
        unsubscribedAt: new Date(),
      },
    });

    this.logger.info('Unsubscribe processed', { email: tokenEmail });
    this.hooks?.onUnsubscribe?.({ email: tokenEmail });

    return { success: true, email: tokenEmail };
  }

  getConfirmationHtml(email: string, success: boolean): string {
    const statusIcon = success ? '&#10003;' : '&#10007;';
    const statusColor = success ? '#22c55e' : '#ef4444';
    const title = success ? 'Unsubscribed' : 'Error';
    const message = success
      ? `${email ? email + ' has' : 'You have'} been unsubscribed successfully.`
      : 'Invalid or expired unsubscribe link. Please try again.';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }
    .card {
      background: white;
      padding: 40px 50px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 48px;
      color: ${statusColor};
      margin-bottom: 20px;
    }
    h1 { color: #1f2937; font-size: 24px; margin: 0 0 12px; }
    p { color: #6b7280; font-size: 16px; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${statusIcon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
  }
}

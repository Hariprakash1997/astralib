import type { Request, Response } from 'express';
import type { SessionGeneratorService } from '../services/session-generator.service';
import type { LogAdapter } from '../types/config.types';

export function createSessionController(
  sessionGenerator: SessionGeneratorService,
  logger: LogAdapter,
) {
  return {
    async requestCode(req: Request, res: Response) {
      try {
        const { phone } = req.body;
        if (!phone) {
          return res.status(400).json({ success: false, error: 'phone is required' });
        }

        const result = await sessionGenerator.requestCode(phone);
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Session requestCode failed', { error: message });
        res.status(500).json({ success: false, error: message });
      }
    },

    async verifyCode(req: Request, res: Response) {
      try {
        const { phone, code, phoneCodeHash, password } = req.body;
        if (!phone || !code || !phoneCodeHash) {
          return res.status(400).json({ success: false, error: 'phone, code, and phoneCodeHash are required' });
        }

        const result = await sessionGenerator.verifyCode(phone, code, phoneCodeHash, password);
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Session verifyCode failed', { error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}

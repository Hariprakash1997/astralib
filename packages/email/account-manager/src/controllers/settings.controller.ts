import type { Request, Response } from 'express';
import type { SettingsService } from '../services/settings.service';

export function createSettingsController(settingsService: SettingsService) {
  return {
    async getSettings(_req: Request, res: Response) {
      try {
        const settings = await settingsService.get();
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateSettings(req: Request, res: Response) {
      try {
        const settings = await settingsService.update(req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateTimezone(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('timezone', req.body.timezone);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateDevMode(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('devMode', req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateImap(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('imap', req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateApproval(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('approval', req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateQueues(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('queues', req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateSes(req: Request, res: Response) {
      try {
        const settings = await settingsService.updateSection('ses', req.body);
        res.json({ success: true, data: { settings } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}

import { Request, Response } from 'express';
import { TemplateCategory, TemplateAudience } from '../types/enums';
import type { TemplateService } from '../services/template.service';
import { getParam } from '../utils/express-helpers';

function isValidEnum<T extends Record<string, string>>(enumObj: T, value: unknown): value is T[keyof T] {
  return typeof value === 'string' && Object.values(enumObj).includes(value as T[keyof T]);
}

function getErrorStatus(message: string): number {
  if (message.includes('already exists') || message.includes('validation failed')) return 400;
  if (message.includes('not found')) return 404;
  return 500;
}

export function createTemplateController(templateService: TemplateService, platformValues?: string[]) {

  async function list(req: Request, res: Response) {
    try {
      const { category, audience, platform, isActive } = req.query;
      const templates = await templateService.list({
        category: category as TemplateCategory | undefined,
        audience: audience as TemplateAudience | undefined,
        platform: platform as string | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      });
      res.json({ success: true, data: { templates } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function getById(req: Request, res: Response) {
    try {
      const template = await templateService.getById(getParam(req, 'id'));
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: { template } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function create(req: Request, res: Response) {
    try {
      const { name, subject, body, category, audience, platform } = req.body;

      if (!name || !subject || !body || !category || !audience || !platform) {
        return res.status(400).json({ success: false, error: 'name, subject, body, category, audience, and platform are required' });
      }
      if (!isValidEnum(TemplateCategory, category)) {
        return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${Object.values(TemplateCategory).join(', ')}` });
      }
      if (!isValidEnum(TemplateAudience, audience)) {
        return res.status(400).json({ success: false, error: `Invalid audience. Must be one of: ${Object.values(TemplateAudience).join(', ')}` });
      }
      if (platformValues && !platformValues.includes(platform)) {
        return res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${platformValues.join(', ')}` });
      }

      const template = await templateService.create(req.body);
      res.status(201).json({ success: true, data: { template } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function update(req: Request, res: Response) {
    try {
      const template = await templateService.update(getParam(req, 'id'), req.body);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: { template } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function remove(req: Request, res: Response) {
    try {
      const deleted = await templateService.delete(getParam(req, 'id'));
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function toggleActive(req: Request, res: Response) {
    try {
      const template = await templateService.toggleActive(getParam(req, 'id'));
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: { template } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function preview(req: Request, res: Response) {
    try {
      const { sampleData } = req.body;
      const result = await templateService.preview(getParam(req, 'id'), sampleData || {});
      if (!result) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function previewRaw(req: Request, res: Response) {
    try {
      const { subject, body, textBody, sampleData } = req.body;
      if (!subject || !body) {
        return res.status(400).json({ success: false, error: 'subject and body are required' });
      }
      const result = await templateService.previewRaw(subject, body, sampleData || {}, textBody);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function validate(req: Request, res: Response) {
    try {
      const { body: templateBody } = req.body;
      if (!templateBody) {
        return res.status(400).json({ success: false, error: 'body is required' });
      }
      const result = await templateService.validate(templateBody);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function sendTestEmail(req: Request, res: Response) {
    try {
      const { testEmail, sampleData } = req.body;
      if (!testEmail) {
        return res.status(400).json({ success: false, error: 'testEmail is required' });
      }
      const result = await templateService.sendTestEmail(getParam(req, 'id'), testEmail, sampleData || {});
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { list, getById, create, update, remove, toggleActive, preview, previewRaw, validate, sendTestEmail };
}

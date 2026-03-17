import { Request, Response } from 'express';
import { getParam } from '@astralibx/core';

function getErrorStatus(message: string): number {
  if (message.includes('already exists') || message.includes('validation failed')) return 400;
  if (message.includes('not found')) return 404;
  return 500;
}

export interface TemplateControllerOptions {
  platforms?: string[];
  categories?: string[];
  audiences?: string[];
}

export interface TemplateServiceLike {
  list(filters?: { category?: string; platform?: string; audience?: string }): Promise<any[]>;
  getById(id: string): Promise<any>;
  create(input: any): Promise<any>;
  update(id: string, input: any): Promise<any>;
  delete(id: string): Promise<boolean>;
  preview(id: string, sampleData: Record<string, unknown>): Promise<any>;
}

export function createTemplateController(templateService: TemplateServiceLike, options?: TemplateControllerOptions) {
  const platformValues = options?.platforms;
  const validCategories = options?.categories;
  const validAudiences = options?.audiences;

  function isValidValue(allowed: string[] | undefined, value: unknown): boolean {
    if (!allowed) return true;
    return typeof value === 'string' && allowed.includes(value);
  }

  async function list(req: Request, res: Response) {
    try {
      const { category, platform, audience } = req.query;
      const templates = await templateService.list({
        category: category as string | undefined,
        platform: platform as string | undefined,
        audience: audience as string | undefined,
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
      const { name, messages, category, platform, audience } = req.body;

      if (!name || !messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: 'name and messages (non-empty array) are required' });
      }

      if (category && !isValidValue(validCategories, category)) {
        return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${validCategories!.join(', ')}` });
      }
      if (audience && !isValidValue(validAudiences, audience)) {
        return res.status(400).json({ success: false, error: `Invalid audience. Must be one of: ${validAudiences!.join(', ')}` });
      }
      if (platform && !isValidValue(platformValues, platform)) {
        return res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${platformValues!.join(', ')}` });
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

  return { list, getById, create, update, remove, preview };
}

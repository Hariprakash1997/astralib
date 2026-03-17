import { Request, Response } from 'express';
import { getParam } from '../utils/express-helpers';

function getErrorStatus(message: string): number {
  if (message.includes('not found')) return 404;
  if (message.includes('mismatch') || message.includes('validation failed') || message.includes('Cannot activate')) return 400;
  return 500;
}

export interface RuleControllerOptions {
  platforms?: string[];
  audiences?: string[];
}

export interface RuleServiceLike {
  list(filters?: { isActive?: boolean; platform?: string; audience?: string }): Promise<any[]>;
  getById(id: string): Promise<any>;
  create(input: any): Promise<any>;
  update(id: string, input: any): Promise<any>;
  delete(id: string): Promise<{ deleted: boolean; disabled?: boolean }>;
  activate(id: string): Promise<any>;
  deactivate(id: string): Promise<any>;
  dryRun(id: string): Promise<any>;
}

export function createRuleController(ruleService: RuleServiceLike, options?: RuleControllerOptions) {
  const platformValues = options?.platforms;
  const validAudiences = options?.audiences;

  function isValidValue(allowed: string[] | undefined, value: unknown): boolean {
    if (!allowed) return true;
    return typeof value === 'string' && allowed.includes(value);
  }

  async function list(req: Request, res: Response) {
    try {
      const { isActive, platform, audience } = req.query;
      const rules = await ruleService.list({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        platform: platform as string | undefined,
        audience: audience as string | undefined,
      });
      res.json({ success: true, data: { rules } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function getById(req: Request, res: Response) {
    try {
      const rule = await ruleService.getById(getParam(req, 'id'));
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      res.json({ success: true, data: { rule } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function create(req: Request, res: Response) {
    try {
      const { name, target, templateId } = req.body;

      if (!name || !target || !templateId) {
        return res.status(400).json({ success: false, error: 'name, target, and templateId are required' });
      }

      const mode = target.mode || 'query';

      if (mode === 'list') {
        if (!Array.isArray(target.identifiers) || target.identifiers.length === 0) {
          return res.status(400).json({ success: false, error: 'target.identifiers must be a non-empty array for list mode' });
        }
      } else {
        if (target.conditions && !Array.isArray(target.conditions) && typeof target.conditions !== 'object') {
          return res.status(400).json({ success: false, error: 'target.conditions must be an array or object' });
        }
      }

      if (req.body.audience && !isValidValue(validAudiences, req.body.audience)) {
        return res.status(400).json({ success: false, error: `Invalid audience. Must be one of: ${validAudiences!.join(', ')}` });
      }
      if (req.body.platform && !isValidValue(platformValues, req.body.platform)) {
        return res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${platformValues!.join(', ')}` });
      }

      const rule = await ruleService.create(req.body);
      res.status(201).json({ success: true, data: { rule } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function update(req: Request, res: Response) {
    try {
      const { target, audience, platform } = req.body;

      if (target) {
        const mode = target.mode || 'query';
        if (mode === 'list') {
          if (target.identifiers && (!Array.isArray(target.identifiers) || target.identifiers.length === 0)) {
            return res.status(400).json({ success: false, error: 'target.identifiers must be a non-empty array for list mode' });
          }
        }
      }

      if (audience && !isValidValue(validAudiences, audience)) {
        return res.status(400).json({ success: false, error: `Invalid audience. Must be one of: ${validAudiences!.join(', ')}` });
      }
      if (platform && !isValidValue(platformValues, platform)) {
        return res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${platformValues!.join(', ')}` });
      }

      const rule = await ruleService.update(getParam(req, 'id'), req.body);
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      res.json({ success: true, data: { rule } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function remove(req: Request, res: Response) {
    try {
      const result = await ruleService.delete(getParam(req, 'id'));
      if (!result.deleted && !result.disabled) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function activate(req: Request, res: Response) {
    try {
      const rule = await ruleService.activate(getParam(req, 'id'));
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      res.json({ success: true, data: { rule } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function deactivate(req: Request, res: Response) {
    try {
      const rule = await ruleService.deactivate(getParam(req, 'id'));
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }
      res.json({ success: true, data: { rule } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  async function dryRun(req: Request, res: Response) {
    try {
      const result = await ruleService.dryRun(getParam(req, 'id'));
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(getErrorStatus(message)).json({ success: false, error: message });
    }
  }

  return { list, getById, create, update, remove, activate, deactivate, dryRun };
}

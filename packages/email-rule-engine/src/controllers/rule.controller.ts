import { Request, Response } from 'express';
import { TemplateAudience, EmailType } from '../types/enums';
import type { RuleService } from '../services/rule.service';
import { getParam } from '../utils/express-helpers';

function isValidEnum<T extends Record<string, string>>(enumObj: T, value: unknown): value is T[keyof T] {
  return typeof value === 'string' && Object.values(enumObj).includes(value as T[keyof T]);
}

function getErrorStatus(message: string): number {
  if (message.includes('not found')) return 404;
  if (message.includes('mismatch') || message.includes('validation failed') || message.includes('Cannot activate')) return 400;
  return 500;
}

export function createRuleController(ruleService: RuleService, platformValues?: string[]) {

  async function list(_req: Request, res: Response) {
    try {
      const rules = await ruleService.list();
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
      if (!target.role || !isValidEnum(TemplateAudience, target.role)) {
        return res.status(400).json({ success: false, error: `Invalid target.role. Must be one of: ${Object.values(TemplateAudience).join(', ')}` });
      }
      if (platformValues && !platformValues.includes(target.platform)) {
        return res.status(400).json({ success: false, error: `Invalid target.platform. Must be one of: ${platformValues.join(', ')}` });
      }
      if (!Array.isArray(target.conditions)) {
        return res.status(400).json({ success: false, error: 'target.conditions must be an array' });
      }
      if (req.body.emailType && !isValidEnum(EmailType, req.body.emailType)) {
        return res.status(400).json({ success: false, error: `Invalid emailType. Must be one of: ${Object.values(EmailType).join(', ')}` });
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
      const { target, emailType } = req.body;

      if (target?.role && !isValidEnum(TemplateAudience, target.role)) {
        return res.status(400).json({ success: false, error: `Invalid target.role. Must be one of: ${Object.values(TemplateAudience).join(', ')}` });
      }
      if (target?.platform && platformValues && !platformValues.includes(target.platform)) {
        return res.status(400).json({ success: false, error: `Invalid target.platform. Must be one of: ${platformValues.join(', ')}` });
      }
      if (target?.conditions && !Array.isArray(target.conditions)) {
        return res.status(400).json({ success: false, error: 'target.conditions must be an array' });
      }
      if (emailType && !isValidEnum(EmailType, emailType)) {
        return res.status(400).json({ success: false, error: `Invalid emailType. Must be one of: ${Object.values(EmailType).join(', ')}` });
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

  async function toggleActive(req: Request, res: Response) {
    try {
      const rule = await ruleService.toggleActive(getParam(req, 'id'));
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

  async function runHistory(req: Request, res: Response) {
    try {
      const limitParam = req.query.limit;
      const limit = parseInt(String(Array.isArray(limitParam) ? limitParam[0] : limitParam), 10) || 20;
      const logs = await ruleService.getRunHistory(limit);
      res.json({ success: true, data: { logs } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { list, getById, create, update, remove, toggleActive, dryRun, runHistory };
}

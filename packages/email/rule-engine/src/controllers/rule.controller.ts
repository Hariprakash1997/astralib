import { Request, Response } from 'express';
import { TEMPLATE_AUDIENCE, EMAIL_TYPE } from '../constants';
import type { RuleService } from '../services/rule.service';
import { getParam } from '@astralibx/core';

function isValidValue(allowed: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function getErrorStatus(message: string): number {
  if (message.includes('not found')) return 404;
  if (message.includes('mismatch') || message.includes('validation failed') || message.includes('Cannot activate')) return 400;
  return 500;
}

export interface RuleControllerOptions {
  platforms?: string[];
  audiences?: string[];
}

export function createRuleController(ruleService: RuleService, options?: RuleControllerOptions) {
  const platformValues = options?.platforms;
  const validAudiences = options?.audiences || Object.values(TEMPLATE_AUDIENCE);
  const validEmailTypes = Object.values(EMAIL_TYPE);

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

      const mode = target.mode || 'query';

      if (mode === 'list') {
        if (!Array.isArray(target.identifiers) || target.identifiers.length === 0) {
          return res.status(400).json({ success: false, error: 'target.identifiers must be a non-empty array for list mode' });
        }
      } else {
        if (!target.role || !isValidValue(validAudiences, target.role)) {
          return res.status(400).json({ success: false, error: `Invalid target.role. Must be one of: ${validAudiences.join(', ')}` });
        }
        if (platformValues && !platformValues.includes(target.platform)) {
          return res.status(400).json({ success: false, error: `Invalid target.platform. Must be one of: ${platformValues.join(', ')}` });
        }
        if (!Array.isArray(target.conditions)) {
          return res.status(400).json({ success: false, error: 'target.conditions must be an array' });
        }
      }

      if (req.body.emailType && !isValidValue(validEmailTypes, req.body.emailType)) {
        return res.status(400).json({ success: false, error: `Invalid emailType. Must be one of: ${validEmailTypes.join(', ')}` });
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

      if (target) {
        const mode = target.mode || 'query';
        if (mode === 'list') {
          if (target.identifiers && (!Array.isArray(target.identifiers) || target.identifiers.length === 0)) {
            return res.status(400).json({ success: false, error: 'target.identifiers must be a non-empty array for list mode' });
          }
        } else {
          if (target.role && !isValidValue(validAudiences, target.role)) {
            return res.status(400).json({ success: false, error: `Invalid target.role. Must be one of: ${validAudiences.join(', ')}` });
          }
          if (target.platform && platformValues && !platformValues.includes(target.platform)) {
            return res.status(400).json({ success: false, error: `Invalid target.platform. Must be one of: ${platformValues.join(', ')}` });
          }
          if (target.conditions && !Array.isArray(target.conditions)) {
            return res.status(400).json({ success: false, error: 'target.conditions must be an array' });
          }
        }
      }

      if (emailType && !isValidValue(validEmailTypes, emailType)) {
        return res.status(400).json({ success: false, error: `Invalid emailType. Must be one of: ${validEmailTypes.join(', ')}` });
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

  async function clone(req: Request, res: Response) {
    try {
      const { name } = req.body;
      const result = await ruleService.clone(getParam(req, 'id'), name);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(error instanceof Error && error.message === 'Rule not found' ? 404 : 500).json({ success: false, error: message });
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

  return { list, getById, create, update, remove, toggleActive, dryRun, runHistory, clone };
}

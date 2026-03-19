import { Request, Response } from 'express';
import { TEMPLATE_AUDIENCE } from '../constants';
import type { RuleService } from '../services/rule.service';
import { getParam } from '@astralibx/core';
import { asyncHandler, calculatePagination } from '../utils/helpers';

export interface RuleControllerOptions {
  platforms?: string[];
  audiences?: string[];
}

export function createRuleController(ruleService: RuleService, options?: RuleControllerOptions) {
  const platformValues = options?.platforms;
  const validAudiences = options?.audiences || Object.values(TEMPLATE_AUDIENCE);

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = calculatePagination(
      parseInt(String(req.query.page), 10) || undefined,
      parseInt(String(req.query.limit), 10) || undefined,
    );
    const platform = req.query.platform as string | undefined;
    const { rules, total } = await ruleService.list({ page, limit, platform });
    res.json({ success: true, data: { rules, total } });
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const rule = await ruleService.getById(getParam(req, 'id'));
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: { rule } });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
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
      if (!target.role || !validAudiences.includes(target.role)) {
        return res.status(400).json({ success: false, error: `Invalid target.role. Must be one of: ${validAudiences.join(', ')}` });
      }
      if (platformValues && !platformValues.includes(target.platform)) {
        return res.status(400).json({ success: false, error: `Invalid target.platform. Must be one of: ${platformValues.join(', ')}` });
      }
      if (!Array.isArray(target.conditions)) {
        return res.status(400).json({ success: false, error: 'target.conditions must be an array' });
      }
    }

    const rule = await ruleService.create(req.body);
    res.status(201).json({ success: true, data: { rule } });
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const { target } = req.body;

    if (target) {
      const mode = target.mode || 'query';
      if (mode === 'list') {
        if (target.identifiers && (!Array.isArray(target.identifiers) || target.identifiers.length === 0)) {
          return res.status(400).json({ success: false, error: 'target.identifiers must be a non-empty array for list mode' });
        }
      } else {
        if (target.role && !validAudiences.includes(target.role)) {
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

    const rule = await ruleService.update(getParam(req, 'id'), req.body);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: { rule } });
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await ruleService.delete(getParam(req, 'id'));
    if (!result.deleted && !result.disabled) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: result });
  });

  const toggleActive = asyncHandler(async (req: Request, res: Response) => {
    const rule = await ruleService.toggleActive(getParam(req, 'id'));
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: { rule } });
  });

  const dryRun = asyncHandler(async (req: Request, res: Response) => {
    const result = await ruleService.dryRun(getParam(req, 'id'));
    res.json({ success: true, data: result });
  });

  const clone = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const result = await ruleService.clone(getParam(req, 'id'), name);
    res.json({ success: true, data: result });
  });

  const runHistory = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = calculatePagination(
      parseInt(String(req.query.page), 10) || undefined,
      parseInt(String(req.query.limit), 10) || 20,
    );
    const { logs, total } = await ruleService.runHistory({ page, limit });
    res.json({ success: true, data: { logs, total } });
  });

  const previewConditions = asyncHandler(async (req: Request, res: Response) => {
    const result = await ruleService.previewConditions(req.body);
    res.json({ success: true, data: result });
  });

  return { list, getById, create, update, remove, toggleActive, dryRun, runHistory, clone, previewConditions };
}

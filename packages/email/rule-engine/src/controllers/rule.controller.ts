import { Request, Response } from 'express';
import { TEMPLATE_AUDIENCE, EMAIL_TYPE } from '../constants';
import type { RuleService } from '../services/rule.service';
import { getParam } from '@astralibx/core';
import { asyncHandler, isValidValue } from '../utils/controller';
import { calculatePagination } from '../utils/query-helpers';

export interface RuleControllerOptions {
  platforms?: string[];
  audiences?: string[];
}

export function createRuleController(ruleService: RuleService, options?: RuleControllerOptions) {
  const platformValues = options?.platforms;
  const validAudiences = options?.audiences || Object.values(TEMPLATE_AUDIENCE);
  const validEmailTypes = Object.values(EMAIL_TYPE);

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = calculatePagination(
      parseInt(String(req.query.page), 10) || undefined,
      parseInt(String(req.query.limit), 10) || undefined,
    );
    const { rules, total } = await ruleService.list({ page, limit });
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
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
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
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;

    const logs = await ruleService.getRunHistory(limit, { page, from, to });
    const total = await ruleService.getRunHistoryCount({ from, to });
    res.json({ success: true, data: { logs, total } });
  });

  return { list, getById, create, update, remove, toggleActive, dryRun, runHistory, clone };
}

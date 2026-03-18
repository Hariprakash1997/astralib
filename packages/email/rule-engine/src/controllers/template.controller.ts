import { Request, Response } from 'express';
import { TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE } from '../constants';
import type { TemplateService } from '../services/template.service';
import { getParam } from '@astralibx/core';
import { asyncHandler, isValidValue } from '../utils/controller';
import { calculatePagination } from '../utils/query-helpers';

export interface TemplateControllerOptions {
  platforms?: string[];
  categories?: string[];
  audiences?: string[];
}

export function createTemplateController(templateService: TemplateService, options?: TemplateControllerOptions) {
  const platformValues = options?.platforms;
  const validCategories = options?.categories || Object.values(TEMPLATE_CATEGORY);
  const validAudiences = options?.audiences || Object.values(TEMPLATE_AUDIENCE);

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { category, audience, platform, isActive, page, limit } = req.query;
    const { templates, total } = await templateService.list({
      category: category as string | undefined,
      audience: audience as string | undefined,
      platform: platform as string | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      ...calculatePagination(parseInt(String(page), 10) || undefined, parseInt(String(limit), 10) || undefined),
    });
    res.json({ success: true, data: { templates, total } });
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const template = await templateService.getById(getParam(req, 'id'));
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: { template } });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const { name, subjects, bodies, category, audience, platform, preheaders } = req.body;

    if (!name || !subjects || subjects.length === 0 || !bodies || bodies.length === 0 || !category || !audience || !platform) {
      return res.status(400).json({ success: false, error: 'name, subjects, bodies, category, audience, and platform are required' });
    }

    if (!isValidValue(validCategories, category)) {
      return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }
    if (!isValidValue(validAudiences, audience)) {
      return res.status(400).json({ success: false, error: `Invalid audience. Must be one of: ${validAudiences.join(', ')}` });
    }
    if (platformValues && !platformValues.includes(platform)) {
      return res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${platformValues.join(', ')}` });
    }

    const template = await templateService.create(req.body);
    res.status(201).json({ success: true, data: { template } });
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const template = await templateService.update(getParam(req, 'id'), req.body);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: { template } });
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const deleted = await templateService.delete(getParam(req, 'id'));
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true });
  });

  const toggleActive = asyncHandler(async (req: Request, res: Response) => {
    const template = await templateService.toggleActive(getParam(req, 'id'));
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: { template } });
  });

  const preview = asyncHandler(async (req: Request, res: Response) => {
    const { sampleData } = req.body;
    const result = await templateService.preview(getParam(req, 'id'), sampleData || {});
    if (!result) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: result });
  });

  const previewRaw = asyncHandler(async (req: Request, res: Response) => {
    const { subject, body, textBody, sampleData, variables } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'subject and body are required' });
    }
    const result = await templateService.previewRaw(subject, body, sampleData || {}, variables, textBody);
    res.json({ success: true, data: result });
  });

  const validate = asyncHandler(async (req: Request, res: Response) => {
    const { body: templateBody } = req.body;
    if (!templateBody) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }
    const result = await templateService.validate(templateBody);
    res.json({ success: true, data: result });
  });

  const clone = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const result = await templateService.clone(getParam(req, 'id'), name);
    res.json({ success: true, data: result });
  });

  const sendTestEmail = asyncHandler(async (req: Request, res: Response) => {
    const { testEmail, sampleData } = req.body;
    if (!testEmail) {
      return res.status(400).json({ success: false, error: 'testEmail is required' });
    }
    const result = await templateService.sendTestEmail(getParam(req, 'id'), testEmail, sampleData || {});
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  });

  const previewWithRecipient = asyncHandler(async (req: Request, res: Response) => {
    const { recipientData } = req.body;
    if (!recipientData || typeof recipientData !== 'object') {
      return res.status(400).json({ success: false, error: 'recipientData object is required' });
    }
    const result = await templateService.previewWithRecipient(getParam(req, 'id'), recipientData);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: result });
  });

  return { list, getById, create, update, remove, toggleActive, preview, previewRaw, validate, sendTestEmail, clone, previewWithRecipient };
}

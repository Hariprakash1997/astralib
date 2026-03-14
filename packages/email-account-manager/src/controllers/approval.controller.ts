import type { Request, Response } from 'express';
import type { ApprovalService } from '../services/approval.service';

export function createApprovalController(approvalService: ApprovalService) {
  return {
    async getDrafts(req: Request, res: Response) {
      try {
        const status = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 50;

        const result = await approvalService.getDrafts(
          status ? { status } : undefined,
          page,
          limit,
        );

        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getDraftById(req: Request, res: Response) {
      try {
        const draft = await approvalService.getDraftById(req.params.id);
        if (!draft) {
          return res.status(404).json({ success: false, error: 'Draft not found' });
        }
        res.json({ success: true, data: { draft } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async countByStatus(_req: Request, res: Response) {
      try {
        const counts = await approvalService.countByStatus();
        res.json({ success: true, data: counts });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async approve(req: Request, res: Response) {
      try {
        await approvalService.approve(req.params.id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async reject(req: Request, res: Response) {
      try {
        const { reason } = req.body;
        await approvalService.reject(req.params.id, reason);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async sendNow(req: Request, res: Response) {
      try {
        await approvalService.sendNow(req.params.id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateContent(req: Request, res: Response) {
      try {
        const draft = await approvalService.updateContent(req.params.id, req.body);
        res.json({ success: true, data: { draft } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async bulkApprove(req: Request, res: Response) {
      try {
        const { draftIds } = req.body;
        if (!Array.isArray(draftIds) || draftIds.length === 0) {
          return res.status(400).json({ success: false, error: 'draftIds array is required' });
        }
        await approvalService.bulkApprove(draftIds);
        res.json({ success: true, data: { approved: draftIds.length } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async bulkReject(req: Request, res: Response) {
      try {
        const { draftIds, reason } = req.body;
        if (!Array.isArray(draftIds) || draftIds.length === 0) {
          return res.status(400).json({ success: false, error: 'draftIds array is required' });
        }
        await approvalService.bulkReject(draftIds, reason);
        res.json({ success: true, data: { rejected: draftIds.length } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}

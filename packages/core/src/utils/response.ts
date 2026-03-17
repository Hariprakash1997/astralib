import type { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendError(res: Response, error: string, status = 400): void {
  res.status(status).json({ success: false, error });
}

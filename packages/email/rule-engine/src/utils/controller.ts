import type { Request, Response } from 'express';

export function getErrorStatus(message: string): number {
  if (message.includes('not found')) return 404;
  if (
    message.includes('already exists') ||
    message.includes('validation failed') ||
    message.includes('mismatch') ||
    message.includes('Cannot activate') ||
    message.includes('Cannot delete')
  ) return 400;
  return 500;
}

export function isValidValue(allowed: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<any>
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error: unknown) => {
      if (res.headersSent) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = getErrorStatus(message);
      res.status(status).json({ success: false, error: message });
    });
  };
}

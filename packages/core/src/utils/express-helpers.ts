import { Request } from 'express';

export function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

export function getQueryString(req: Request, name: string): string | undefined {
  const val = req.query[name];
  if (val === undefined) return undefined;
  return Array.isArray(val) ? String(val[0]) : String(val);
}

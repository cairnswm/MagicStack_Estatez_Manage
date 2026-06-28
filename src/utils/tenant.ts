import { Request, Response, NextFunction } from 'express';

export function getTenantId(req: Request): string {
  return (
    req.header('x-tenant-id') ||
    req.header('X-Tenant-ID') ||
    (req.query && (req.query.tenantId as string)) ||
    ''
  ) as string;
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: { message: 'Tenant id required' } });
    return;
  }

  // make tenantId available to downstream handlers
  res.locals.tenantId = tenantId;
  next();
}

export function getTenantOrRespond(req: Request, res: Response): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: { message: 'Tenant id required' } });
    return null;
  }
  return tenantId;
}

export default { getTenantId, requireTenant, getTenantOrRespond };

import { Request, Response, NextFunction } from 'express';
import * as authClient from '../utils/authClient';
import { requestStorage, generateRequestId } from '../utils/requestContext';

interface TenantUtils {
  tenant?: any;
  properties?: Array<{ name: string; value: string }>;
  settings?: Record<string, any>;
  getProperty: (name: string) => Promise<string | undefined>;
  getSetting: (name: string) => Promise<any>;
  refresh: () => Promise<void>;
}

export default function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || generateRequestId();
  const hostname =
    req.header('x-hostname') ||
    req.header('referer') ||
    req.header('origin') ||
    undefined;
  (req as any).requestId = requestId;
  requestStorage.run({ requestId, hostname }, () => {
    initTenantContext(req, res, next).catch(next);
  });
}

async function initTenantContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header('authorization') || req.header('Authorization') || '';
  const tenantId = req.header('x-tenant-id') || req.header('X-Tenant-ID') || '';

  // Attach auth helpers
  (req as any).authClient = {
    validateToken: authClient.validateToken,
    fetchTenant: authClient.fetchTenant,
  };

  // Attach a default tenantUtils object. We'll try to populate if X-Tenant-ID provided.
  const tenantUtils: TenantUtils = {
    tenant: undefined,
    properties: [],
    settings: {},
    getProperty: async (name: string) => undefined,
    getSetting: async (name: string) => undefined,
    refresh: async () => {},
  };

  if (tenantId) {
    try {
      const data = await authClient.fetchTenant(tenantId, authHeader);

      tenantUtils.tenant = data.tenant;
      tenantUtils.properties = data.properties || [];
      tenantUtils.settings = data.settings || {};
      tenantUtils.getProperty = async (name: string) => {
        const prop = (tenantUtils.properties || []).find(p => p.name === name);
        return prop ? prop.value : undefined;
      };
      tenantUtils.getSetting = async (name: string) => {
        return tenantUtils.settings ? tenantUtils.settings[name] : undefined;
      };
      tenantUtils.refresh = async () => {
        const fresh = await authClient.fetchTenant(tenantId, authHeader);
        tenantUtils.tenant = fresh.tenant;
        tenantUtils.properties = fresh.properties || [];
        tenantUtils.settings = fresh.settings || {};
      };
    } catch (err) {
      // attach the error so routes can inspect if they want
      (req as any).tenantFetchError = err;
    }
  }

  (req as any).tenantUtils = tenantUtils;

  // Also attach a convenience method to validate token on demand
  (req as any).validateToken = async (token?: string) => {
    const t = token || authHeader;
    if (!t) throw new Error('No Authorization token provided');
    return authClient.validateToken(t);
  };

  next();
}

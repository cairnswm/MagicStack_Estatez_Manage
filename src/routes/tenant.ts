import { Router, Request, Response } from 'express';
import * as authClient from '../utils/authClient';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';

const router = Router();

// GET /tenant/property - returns all properties for tenant (tenantId via header or query)
router.get('/property', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const authHeader = req.header('authorization') || '';
    const data = await authClient.fetchTenant(tenantId, authHeader);
    const props = data.properties || [];

    res.json(successResponse(props));
  } catch (err) {
    res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /tenant/property/:name - return a single property value by name
// - Tenant id MUST be provided via `X-Tenant-ID` header or `?tenantId=` query
// - Response: `{ name, value }` (404 if not found)
router.get('/property/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    if (!name) return res.status(400).json(errorResponse('property name is required in path'));

    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=) when requesting a property by name'));

    const authHeader = req.header('authorization') || '';
    const data = await authClient.fetchTenant(tenantId, authHeader);
    const prop = (data.properties || []).find(p => p.name === name);
    if (typeof prop === 'undefined') return res.status(404).json(errorResponse(`Property '${name}' not found for tenant ${tenantId}`));
    res.json({ name, value: prop.value });
  } catch (err) {
    res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /tenant/setting - returns all settings for tenant
router.get('/setting', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const authHeader = req.header('authorization') || '';
    const data = await authClient.fetchTenant(tenantId, authHeader);
    const settingsObj = data.settings || {};
    const settings = Object.keys(settingsObj).map(k => ({ name: k, value: settingsObj[k] }));

    res.json(successResponse(settings));
  } catch (err) {
    res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /tenant/setting/:name - return a single setting value by name
// - Tenant id MUST be provided via `X-Tenant-ID` header or `?tenantId=` query
// - Response: `{ name, value }` (404 if not found)
router.get('/setting/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    if (!name) return res.status(400).json(errorResponse('setting name is required in path'));

    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=) when requesting a setting by name'));

    const authHeader = req.header('authorization') || '';
    const data = await authClient.fetchTenant(tenantId, authHeader);
    const val = data.settings ? data.settings[name] : undefined;
    if (typeof val === 'undefined') return res.status(404).json(errorResponse(`Setting '${name}' not found for tenant ${tenantId}`));
    res.json({ name, value: val });
  } catch (err) {
    res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;

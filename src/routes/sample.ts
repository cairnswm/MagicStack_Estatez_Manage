import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';

const router = Router();

type SampleRow = {
  id: number;
  name: string | null;
  value: string | null;
  created_at: string | null;
};

// GET /:id - fetch sample by id, cached per-tenant+id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query('SELECT id, name, value, created_at FROM sample WHERE id = ?', [id]);
      return result as any[];
    });
    const row: SampleRow | null = rows.length > 0 ? rows[0] as SampleRow : null;

    if (!row) return res.status(404).json(errorResponse(`Sample with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /name/:name - fetch by name (unique), cached per-tenant+name
router.get('/name/:name', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const name = req.params.name as string;
    if (!name) return res.status(400).json(errorResponse('Name is required in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query('SELECT id, name, value, created_at FROM sample WHERE name = ?', [name]);
      return result as any[];
    });
    const row: SampleRow | null = rows.length > 0 ? rows[0] as SampleRow : null;

    if (!row) return res.status(404).json(errorResponse(`Sample with name '${name}' not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
